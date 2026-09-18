from app.utils.rbac import get_room_membership, RequireRole, require_room_admin
from app.models.multi_tenant import RoomMembership
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, update
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
import json
import logging
import re
import os
import uuid
import asyncio

from app.database import get_db, async_session_maker
from app.models.user import User, BlockedUser
from app.models.communication import Conversation, ConversationMember, Message, Notification
from app.routers.auth import get_current_user
from app.services.ai_service import query_ai

logger = logging.getLogger(__name__)

router = APIRouter(tags=["communication"])

# --- WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        # Maps user_id to a list of their active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        is_new_connection = False
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
            is_new_connection = True
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected to chat")
        return is_new_connection

    def disconnect(self, websocket: WebSocket, user_id: int):
        is_fully_disconnected = False
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                is_fully_disconnected = True
        logger.info(f"User {user_id} disconnected from chat")
        return is_fully_disconnected

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(message)
                except Exception:
                    self.disconnect(connection, user_id)

    async def broadcast_to_conversation(self, message_data: dict, member_ids: List[int]):
        # Send live message to all active sessions of all members
        for user_id in member_ids:
            if user_id in self.active_connections:
                for connection in list(self.active_connections[user_id]):
                    try:
                        await connection.send_text(json.dumps(message_data))
                    except Exception:
                        self.disconnect(connection, user_id)
                
    async def broadcast_global(self, message_data: dict):
        """Broadcasts a message to all connected clients (e.g., Discovery Feed updates)"""
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_text(json.dumps(message_data))
                except Exception:
                    self.disconnect(connection, user_id)

manager = ConnectionManager()

# --- REST ENDPOINTS ---

@router.get("/conversations")
async def get_conversations(membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    """Fetch all conversations (DMs and Teams) for the current user."""
    
    # Auto-create "General Team" if it doesn't exist, and add user to it
    gen_conv_check = await db.execute(select(Conversation).where(and_(Conversation.name == 'General Team', Conversation.room_id == membership.room_id)))
    gen_conv = gen_conv_check.scalars().first()
    if not gen_conv:
        gen_conv = Conversation(type='team', name='General Team', room_id=membership.room_id)
        db.add(gen_conv)
        await db.commit()
        await db.refresh(gen_conv)
        
    # Check if user is in General Team
    member_check = await db.execute(select(ConversationMember).where(
        and_(ConversationMember.conversation_id == gen_conv.id, ConversationMember.user_id == membership.user.id)
    ))
    if not member_check.scalars().first():
        new_member = ConversationMember(conversation_id=gen_conv.id, user_id=membership.user.id)
        db.add(new_member)
        await db.commit()
        
    # Check if AI User is in General Team
    ai_user_check = await db.execute(select(User).where(User.email == 'ai@system.local'))
    ai_user = ai_user_check.scalars().first()
    if ai_user:
        ai_member_check = await db.execute(select(ConversationMember).where(
            and_(ConversationMember.conversation_id == gen_conv.id, ConversationMember.user_id == ai_user.id)
        ))
        if not ai_member_check.scalars().first():
            ai_member = ConversationMember(conversation_id=gen_conv.id, user_id=ai_user.id)
            db.add(ai_member)
            await db.commit()
            await db.commit()

    # Fetch blocked users for current user
    blocked_result = await db.execute(select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == membership.user.id))
    blocked_ids = {b for b in blocked_result.scalars().all()}
    # Find all conversations where the user is a member
    result = await db.execute(
        select(Conversation)
        .join(ConversationMember)
        .where(and_(ConversationMember.user_id == membership.user.id, Conversation.room_id == membership.room_id))
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conversations = result.scalars().all()
    
    # Format for frontend
    res = []
    for conv in conversations:
        # Get user's membership
        my_member = next((m for m in conv.members if m.user_id == membership.user.id), None)
        is_pinned = getattr(my_member, 'is_pinned', False) if my_member else False
        is_hidden = getattr(my_member, 'is_hidden', False) if my_member else False
        last_read_message_id = getattr(my_member, 'last_read_message_id', 0) if my_member else 0
        
        # Get last message timestamp
        last_msg_res = await db.execute(select(Message).where(Message.conversation_id == conv.id).order_by(Message.timestamp.desc()).limit(1))
        last_msg = last_msg_res.scalars().first()
        last_message_timestamp = last_msg.timestamp if last_msg else conv.created_at
        
        # Get unread count
        unread_count_res = await db.execute(select(func.count(Message.id)).where(and_(Message.conversation_id == conv.id, Message.id > last_read_message_id, Message.sender_id != membership.user.id)))
        unread_count = unread_count_res.scalar() or 0
        
        # Determine name: if DM, name is the OTHER person's name
        name = conv.name
        if conv.type == 'direct':
            other_member = next((m for m in conv.members if m.user_id != membership.user.id), None)
            if other_member:
                name = other_member.user.name
        
        res.append({
            "id": conv.id,
            "type": conv.type,
            "name": name,
            "bio": getattr(conv, 'bio', None),
            "pfp_url": getattr(conv, 'pfp_url', None),
            "created_at": conv.created_at,
            "is_pinned": is_pinned,
            "is_hidden": is_hidden,
            "unread_count": unread_count,
            "last_message_timestamp": last_message_timestamp,
            "members": [{"id": m.user_id, "name": m.user.name, "nickname": m.user.nickname, "pfp_url": m.user.pfp_url, "role": getattr(m, 'role', 'member'), "is_server_muted": getattr(m, 'is_server_muted', False), "status": getattr(m.user, 'status', 'online') if (m.user_id in manager.active_connections or m.user.email == 'ai@system.local') else 'offline', "is_blocked_by_me": m.user_id in blocked_ids} for m in conv.members]
        })
    return res

from pydantic import BaseModel
class CreateDirectConversationRequest(BaseModel):
    target_user_id: int

@router.post("/conversations/direct")
async def get_or_create_direct_conversation(request: CreateDirectConversationRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    target_user_id = request.target_user_id
    if target_user_id == membership.user.id:
        raise HTTPException(status_code=400, detail="Cannot create DM with yourself")

    block_check = await db.execute(select(BlockedUser).where(
        or_(
            and_(BlockedUser.blocker_id == membership.user.id, BlockedUser.blocked_id == target_user_id),
            and_(BlockedUser.blocker_id == target_user_id, BlockedUser.blocked_id == membership.user.id)
        )
    ))
    if block_check.scalars().first():
        raise HTTPException(status_code=403, detail="Cannot message this user (blocked)")
        
    # Check if a direct conversation already exists between these two users
    result = await db.execute(
        select(Conversation)
        .join(ConversationMember)
        .where(and_(Conversation.type == 'direct', ConversationMember.user_id == membership.user.id, Conversation.room_id == membership.room_id))
        .options(selectinload(Conversation.members))
    )
    convs = result.scalars().all()
    
    for conv in convs:
        member_ids = [m.user_id for m in conv.members]
        if target_user_id in member_ids and len(member_ids) == 2:
            return {"id": conv.id}
            
    # Verify target user exists
    target_user_check = await db.execute(select(User).where(User.id == target_user_id))
    if not target_user_check.scalars().first():
        raise HTTPException(status_code=404, detail="Target user not found")
        
    # Create new
    new_conv = Conversation(type='direct', room_id=membership.room_id)
    db.add(new_conv)
    await db.flush()
    
    db.add(ConversationMember(conversation_id=new_conv.id, user_id=membership.user.id))
    db.add(ConversationMember(conversation_id=new_conv.id, user_id=target_user_id))
    
    await db.commit()
    return {"id": new_conv.id}

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: int, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    """Fetch messages for a specific conversation."""
    # Verify membership
    member_check = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    member = member_check.scalars().first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
        
    cleared_id = member.cleared_until_message_id
    
    result = await db.execute(
        select(Message)
        .where(and_(Message.conversation_id == conversation_id, Message.id > cleared_id))
        .order_by(Message.timestamp.asc())
        .options(selectinload(Message.sender), selectinload(Message.reply_to))
    )
    messages = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "content": m.content if not m.is_deleted else "This message was deleted.",
            "is_edited": m.is_edited,
            "is_deleted": m.is_deleted,
            "reply_to_id": m.reply_to_id,
            "reply_to_content": m.reply_to.content if m.reply_to and not m.reply_to.is_deleted else ("This message was deleted." if m.reply_to else None),
            "timestamp": m.timestamp,
            "sender": {
                "id": m.sender.id,
                "name": m.sender.name,
                "pfp_url": m.sender.pfp_url,
                "status": getattr(m.sender, 'status', 'online') if (m.sender.id in manager.active_connections or getattr(m.sender, 'email', '') == 'ai@system.local') else 'offline'
            }
        }
        for m in messages
    ]
    
    return formatted_messages

@router.delete("/conversations/dm/{conversation_id}")
async def clear_dm_history(conversation_id: int, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ConversationMember).where(
            and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")
    
    msg_res = await db.execute(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id.desc()).limit(1))
    latest_msg = msg_res.scalars().first()
    if latest_msg:
        member.cleared_until_message_id = latest_msg.id
    member.is_hidden = True
    await db.commit()
    return {"status": "cleared"}

@router.get("/messages/{message_id}/read_by")
async def get_message_read_by(message_id: int, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    msg_res = await db.execute(select(Message).where(Message.id == message_id))
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404)
        
    members_res = await db.execute(
        select(ConversationMember)
        .join(User)
        .where(
            and_(
                ConversationMember.conversation_id == msg.conversation_id,
                ConversationMember.last_read_message_id >= message_id,
                ConversationMember.user_id != membership.user.id,
                User.read_receipts_enabled == True
            )
        )
        .options(selectinload(ConversationMember.user))
    )
    readers = members_res.scalars().all()
    
    return [
        {"id": m.user.id, "name": m.user.name, "nickname": m.user.nickname, "pfp_url": m.user.pfp_url} 
        for m in readers if m.user
    ]

class CreateGroupRequest(BaseModel):
    name: str
    member_ids: List[int]

@router.post("/conversations/group")
async def create_group_conversation(request: CreateGroupRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")
        
    new_conv = Conversation(type='team', name=request.name, room_id=membership.room_id)
    db.add(new_conv)
    await db.flush()
    
    # Creator is admin
    db.add(ConversationMember(conversation_id=new_conv.id, user_id=membership.user.id, role='admin'))
    
    # Add other members
    for user_id in request.member_ids:
        if user_id != membership.user.id:
            db.add(ConversationMember(conversation_id=new_conv.id, user_id=user_id, role='member'))
            
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": new_conv.id})
    return {"id": new_conv.id, "message": "Group created successfully"}

class UpdateGroupProfileRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    pfp_url: Optional[str] = None

@router.put("/conversations/group/{conversation_id}/profile")
async def update_group_profile(conversation_id: int, request: UpdateGroupProfileRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    member = member.scalars().first()
    if not member or member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update group profile")
        
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.type != 'team':
        raise HTTPException(status_code=404, detail="Group not found")
        
    if request.name is not None: conv.name = request.name
    if request.bio is not None: conv.bio = request.bio
    if request.pfp_url is not None: conv.pfp_url = request.pfp_url
    
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": conversation_id})
    return {"message": "Group profile updated"}

class AddGroupMembersRequest(BaseModel):
    member_ids: List[int]

@router.post("/conversations/group/{conversation_id}/members")
async def add_group_members(conversation_id: int, request: AddGroupMembersRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    member = member.scalars().first()
    if not member or member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can add members")
        
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.type != 'team':
        raise HTTPException(status_code=404, detail="Group not found")
        
    for user_id in request.member_ids:
        existing = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)))
        if not existing.scalars().first():
            db.add(ConversationMember(conversation_id=conversation_id, user_id=user_id, role='member'))
            
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": conversation_id})
    return {"message": "Members added"}

class UpdateMemberRoleRequest(BaseModel):
    role: str

@router.put("/conversations/group/{conversation_id}/members/{user_id}/role")
async def update_member_role(conversation_id: int, user_id: int, request: UpdateMemberRoleRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    admin_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    admin_member = admin_member.scalars().first()
    if not admin_member or admin_member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can change roles")
        
    target_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)))
    target_member = target_member.scalars().first()
    if not target_member:
        raise HTTPException(status_code=404, detail="User is not in the group")
        
    target_member.role = request.role
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": conversation_id})
    return {"message": "Role updated"}

@router.delete("/conversations/group/{conversation_id}/members/{user_id}")
async def remove_group_member(conversation_id: int, user_id: int, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    admin_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    admin_member = admin_member.scalars().first()
    if not admin_member or admin_member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can remove members")
        
    target_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)))
    target_member = target_member.scalars().first()
    if not target_member:
        raise HTTPException(status_code=404, detail="User is not in the group")
        
    if target_member.user_id == membership.user.id:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")
        
    await db.delete(target_member)
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": conversation_id})
    return {"message": "User removed"}

class MuteMemberRequest(BaseModel):
    is_server_muted: bool

@router.put("/conversations/group/{conversation_id}/members/{user_id}/mute")
async def mute_group_member(conversation_id: int, user_id: int, request: MuteMemberRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    admin_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    admin_member = admin_member.scalars().first()
    if not admin_member or admin_member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can mute members")
        
    target_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id)))
    target_member = target_member.scalars().first()
    if not target_member:
        raise HTTPException(status_code=404, detail="User is not in the group")
        
    target_member.is_server_muted = request.is_server_muted
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_UPDATED", "conversation_id": conversation_id})
    return {"message": "User mute status updated"}

@router.delete("/conversations/group/{conversation_id}")
async def delete_group(conversation_id: int, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    # Verify admin
    my_member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    my_member = my_member.scalars().first()
    if not my_member or my_member.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete the group")
        
    conv = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    await db.delete(conv)
    await db.commit()
    await manager.broadcast_global({"type": "GROUP_DELETED", "conversation_id": conversation_id})
    return {"message": "Group deleted"}

class UpdateChatStateRequest(BaseModel):
    is_pinned: Optional[bool] = None
    is_hidden: Optional[bool] = None
    is_local_muted: Optional[bool] = None
    last_read_message_id: Optional[int] = None

@router.put("/conversations/{conversation_id}/state")
async def update_chat_state(conversation_id: int, request: UpdateChatStateRequest, membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    member = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == membership.user.id)))
    member = member.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="You are not in this conversation")
        
    if request.is_pinned is not None:
        member.is_pinned = request.is_pinned
    if request.is_hidden is not None:
        member.is_hidden = request.is_hidden
    if request.is_local_muted is not None:
        member.is_local_muted = request.is_local_muted
    if request.last_read_message_id is not None:
        # Only update if it's greater than current to prevent going backwards
        if member.last_read_message_id is None or request.last_read_message_id > member.last_read_message_id:
            member.last_read_message_id = request.last_read_message_id
            
            # Broadcast read receipt
            await manager.broadcast_to_conversation(conversation_id, json.dumps({
                "type": "read_receipt",
                "conversation_id": conversation_id,
                "user_id": membership.user.id,
                "last_read_message_id": request.last_read_message_id
            }))
            
    await db.commit()
    return {"message": "Chat state updated"}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    membership: RoomMembership = Depends(get_room_membership)
):
    """Upload a file or voice note for chat."""
    from app.config import settings
    from app.utils.file_validation import validate_file_upload, ALLOWED_CHAT_EXTENSIONS
    
    fallback = ".webm" if file.content_type == "audio/webm" else None
    ext = await validate_file_upload(file, ALLOWED_CHAT_EXTENSIONS, fallback_ext=fallback)
    
    upload_dir = os.path.join(settings.UPLOAD_DIR, "chat")
    os.makedirs(upload_dir, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    # Construct download URL
    url = f"/api/communication/files/{unique_filename}"
    return {"url": url, "filename": file.filename}

@router.get("/files/{filename}")
async def get_file(filename: str):
    """Serve an uploaded chat file."""
    from app.config import settings
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.UPLOAD_DIR, "chat", safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@router.get("/notifications")
async def get_notifications(membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    """Fetch unread notifications for the current user."""
    result = await db.execute(
        select(Notification)
        .where(and_(Notification.user_id == membership.user.id, Notification.is_read == False))
        .order_by(Notification.timestamp.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    return [
        {
            "id": n.id,
            "content": n.content,
            "link_url": n.link_url,
            "is_read": n.is_read,
            "timestamp": n.timestamp
        } for n in notifications
    ]

@router.post("/notifications/read")
async def mark_notifications_read(membership: RoomMembership = Depends(get_room_membership), db: AsyncSession = Depends(get_db)):
    """Mark all unread notifications as read."""
    result = await db.execute(
        select(Notification).where(and_(Notification.user_id == membership.user.id, Notification.is_read == False))
    )
    for notif in result.scalars().all():
        notif.is_read = True
    await db.commit()
    return {"status": "success"}

# --- WEBSOCKET ENDPOINT ---

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: int, 
    db: AsyncSession = Depends(get_db)
):
    # In a decoupled app, use token in query params to authenticate WebSocket connection
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token missing")
        return
        
    try:
        from app.utils.security import decode_access_token
        payload = decode_access_token(token)
        authed_user_id = int(payload.get("sub"))
        if authed_user_id != user_id:
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User ID mismatch")
            return
    except Exception:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token")
        return

    is_new = await manager.connect(websocket, user_id)
    user_result = await db.execute(select(User).where(User.id == user_id))
    u = user_result.scalars().first()
    if u:
        await manager.broadcast_global({
            "type": "presence_update",
            "user_id": user_id,
            "status": "online"
        })
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            print("DEBUG: RECEIVED WEBSOCKET MESSAGE:", payload, flush=True)
            
            # Expected payload: {"type": "send_message", "conversation_id": 1, "content": "Hello!"}
            if payload.get("type") == "send_message":
                conv_id = payload["conversation_id"]
                content = payload["content"]
                reply_to_id = payload.get("reply_to_id")
                
                # Verify membership
                member_check = await db.execute(select(ConversationMember).where(and_(ConversationMember.conversation_id == conv_id, ConversationMember.user_id == user_id)))
                member = member_check.scalars().first()
                if not member:
                    continue # Ignore unauthorized messages
                    
                if getattr(member, 'is_server_muted', False):
                    # Send a system message back to the user that they are muted
                    await manager.send_personal_message(json.dumps({
                        "type": "error",
                        "message": "You have been muted by an admin and cannot send messages."
                    }), user_id)
                    continue
                    
                # Create message
                
                # Fetch sender details for broadcast
                sender_result = await db.execute(select(User).where(User.id == user_id))
                sender = sender_result.scalars().first()
                
                # Tag parsing & notification generation
                tags = re.findall(r'@([a-zA-Z0-9_]+)', content)
                notifications_to_send = []
                ai_triggered = False
                ai_user_id = None
                
                if tags:
                    print(f"DEBUG: tags found: {tags}", flush=True)
                    
                    # Fetch conversation to get its name/type for description
                    conv_res = await db.execute(select(Conversation).where(Conversation.id == conv_id))
                    conv = conv_res.scalars().first()
                    conv_desc = "a chat"
                    if conv:
                        if conv.type == 'direct':
                            conv_desc = "a Direct Message"
                        elif conv.name:
                            conv_desc = f"#{conv.name}"
                        else:
                            conv_desc = "a group chat"

                    members_result = await db.execute(select(ConversationMember).where(ConversationMember.conversation_id == conv_id).options(selectinload(ConversationMember.user)))
                    all_members = members_result.scalars().all()
                    
                    for tag in tags:
                        tag_lower = tag.lower()
                        tagged_member = None
                        for m in all_members:
                            if m.user:
                                name_clean = m.user.name.lower().replace(" ", "") if m.user.name else ""
                                nick_clean = m.user.nickname.lower() if m.user.nickname else ""
                                if name_clean == tag_lower or nick_clean == tag_lower:
                                    tagged_member = m
                                    break
                                    
                        if tagged_member and tagged_member.user_id != user_id:
                            if tagged_member.user.email == 'ai@system.local':
                                ai_triggered = True
                                ai_user_id = tagged_member.user_id
                            else:
                                preview = re.sub(r'@[a-zA-Z0-9_]+', '', content).strip()
                                if len(preview) > 50:
                                    preview = preview[:50] + "..."
                                notif_text = f"{sender.name} mentioned you in {conv_desc}"
                                if preview:
                                    notif_text += f": {preview}"
                                notif = Notification(
                                    user_id=tagged_member.user_id,
                                    content=notif_text,
                                    link_url=f"/chat?convId={conv_id}"
                                )
                                db.add(notif)
                                notifications_to_send.append((tagged_member.user_id, notif))

                # If not triggered by tag, check if it's a DM with the AI
                blocked = False
                if not ai_triggered:
                    conv_check = await db.execute(select(Conversation).where(Conversation.id == conv_id))
                    conv = conv_check.scalars().first()
                    if conv and conv.type == 'direct':
                        members_check = await db.execute(select(ConversationMember).where(ConversationMember.conversation_id == conv_id).options(selectinload(ConversationMember.user)))
                        all_members = members_check.scalars().all()
                        other_members = [m for m in all_members if m.user_id != user_id]
                        if other_members:
                            other_id = other_members[0].user_id
                            block_check = await db.execute(select(BlockedUser).where(
                                or_(
                                    and_(BlockedUser.blocker_id == user_id, BlockedUser.blocked_id == other_id),
                                    and_(BlockedUser.blocker_id == other_id, BlockedUser.blocked_id == user_id)
                                )
                            ))
                            if block_check.scalars().first():
                                blocked = True
                                await manager.send_personal_message(json.dumps({
                                    "type": "error",
                                    "message": "Cannot send message (user is blocked)"
                                }), user_id)

                        for m in all_members:
                            if m.user_id != user_id and m.user and m.user.email == 'ai@system.local':
                                ai_triggered = True
                                ai_user_id = m.user_id
                                print("DEBUG: AI TRIGGERED SET TO TRUE FOR DM!", flush=True)
                                break
                                
                if blocked:
                    continue

                # Save to DB
                new_msg = Message(conversation_id=conv_id, sender_id=user_id, content=content, reply_to_id=reply_to_id)
                db.add(new_msg)
                
                # Unhide conversation for all members
                update_members_stmt = update(ConversationMember).where(
                    ConversationMember.conversation_id == conv_id
                ).values(is_hidden=False)
                await db.execute(update_members_stmt)
                
                await db.commit()
                await db.refresh(new_msg)
                
                # Dispatch real-time notifications to tagged users
                for uid, notif in notifications_to_send:
                    await manager.send_personal_message(json.dumps({
                        "type": "new_notification",
                        "notification": {
                            "id": notif.id,
                            "content": notif.content,
                            "link_url": notif.link_url,
                            "is_read": notif.is_read,
                            "timestamp": notif.timestamp.isoformat() + "Z"
                        }
                    }), uid)
                
                # If it's a reply, fetch reply_to content
                reply_to_content = None
                if reply_to_id:
                    reply_msg_result = await db.execute(select(Message).where(Message.id == reply_to_id))
                    reply_msg = reply_msg_result.scalars().first()
                    if reply_msg:
                        reply_to_content = reply_msg.content if not reply_msg.is_deleted else "This message was deleted."

                # Broadcast to all members in conversation
                members_result = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id))
                member_ids = members_result.scalars().all()
                
                broadcast_data = {
                    "type": "new_message",
                    "message": {
                        "id": new_msg.id,
                        "conversation_id": conv_id,
                        "content": new_msg.content,
                        "is_edited": False,
                        "is_deleted": False,
                        "reply_to_id": reply_to_id,
                        "reply_to_content": reply_to_content,
                        "timestamp": new_msg.timestamp.isoformat() + "Z",
                        "sender": {
                            "id": sender.id,
                            "name": sender.name,
                            "pfp_url": sender.pfp_url,
                            "status": sender.status
                        }
                    }
                }
                await manager.broadcast_to_conversation(broadcast_data, member_ids)

                if ai_triggered and ai_user_id:
                    print(f"DEBUG: AI Triggered before create_task! ai_user_id={ai_user_id}, conv_id={conv_id}, user_id={user_id}", flush=True)
                    async def generate_ai_reply(question: str, c_id: int, u_id: int, ai_uid: int):
                        print(f"DEBUG: generate_ai_reply started with question: '{question}'", flush=True)
                        async with async_session_maker() as bg_db:
                            try:
                                sender_res = await bg_db.execute(select(User).where(User.id == ai_uid))
                                ai_sender = sender_res.scalars().first()
                                print(f"DEBUG: AI Sender found: {ai_sender.name}", flush=True)
                                
                                members_res = await bg_db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == c_id))
                                t_ids = members_res.scalars().all()
                                
                                await manager.broadcast_to_conversation({
                                    "type": "typing_start",
                                    "conversation_id": c_id,
                                    "user": {"id": ai_sender.id, "name": ai_sender.name, "nickname": ai_sender.nickname}
                                }, [uid for uid in t_ids if uid != ai_uid])
                            except Exception as e:
                                print(f"DEBUG: Failed to send typing indicator: {e}", flush=True)
                            
                            try:
                                print("DEBUG: Querying AI...")
                                conv_result = await bg_db.execute(select(Conversation).where(Conversation.id == c_id))
                                conv = conv_result.scalars().first()
                                room_id = conv.room_id if conv else None

                                # Fetch recent messages for conversational context (last 4 messages)
                                history_res = await bg_db.execute(
                                    select(Message)
                                    .where(Message.conversation_id == c_id)
                                    .order_by(Message.id.desc())
                                    .limit(5)  # Fetch current message + 4 previous ones
                                )
                                history_msgs = list(history_res.scalars().all())
                                history_msgs.reverse()

                                history = []
                                for h_msg in history_msgs:
                                    if h_msg.id == new_msg.id:
                                        continue
                                    role = "assistant" if h_msg.sender_id == ai_uid else "user"
                                    content_text = h_msg.content if not h_msg.is_deleted else ""
                                    if content_text:
                                        history.append({"role": role, "content": content_text})

                                ai_response = await query_ai(question, u_id, room_id, bg_db, agent_persona="ChatBot AI Assistant", history=history)
                                print("DEBUG: AI Response:", ai_response)
                                answer = ai_response.get("answer", "No response generated.")
                                
                                print("DEBUG: Saving AI Message...")
                                ai_msg = Message(conversation_id=c_id, sender_id=ai_uid, content=answer)
                                bg_db.add(ai_msg)
                                await bg_db.commit()
                                await bg_db.refresh(ai_msg)
                                print("DEBUG: AI Message saved. ID:", ai_msg.id)
                                
                                sender_result = await bg_db.execute(select(User).where(User.id == ai_uid))
                                ai_sender = sender_result.scalars().first()
                                
                                members_result = await bg_db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == c_id))
                                target_ids = members_result.scalars().all()
                                
                                # Send typing stop
                                await manager.broadcast_to_conversation({
                                    "type": "typing_stop",
                                    "conversation_id": c_id,
                                    "user": {"id": ai_sender.id, "name": ai_sender.name, "nickname": ai_sender.nickname}
                                }, [uid for uid in target_ids if uid != ai_uid])
                                
                                b_data = {
                                    "type": "new_message",
                                    "message": {
                                        "id": ai_msg.id,
                                        "conversation_id": c_id,
                                        "content": ai_msg.content,
                                        "is_edited": False,
                                        "is_deleted": False,
                                        "reply_to_id": new_msg.id,
                                        "reply_to_content": new_msg.content,
                                        "timestamp": ai_msg.timestamp.isoformat() + "Z",
                                        "sender": {
                                            "id": ai_sender.id,
                                            "name": ai_sender.name,
                                            "pfp_url": ai_sender.pfp_url
                                        }
                                    }
                                }
                                await manager.broadcast_to_conversation(b_data, target_ids)
                            except Exception as e:
                                logger.error(f"AI reply failed: {e}")
                                # Try to stop typing
                                try:
                                    await manager.broadcast_to_conversation({
                                        "type": "typing_stop",
                                        "conversation_id": c_id,
                                        "user": {"id": ai_uid, "name": "AI Assistant"}
                                    }, target_ids)
                                except: pass

                    clean_question = re.sub(r'@([a-zA-Z0-9_]+)', '', content).strip()
                    asyncio.create_task(generate_ai_reply(clean_question, conv_id, user_id, ai_user_id))

            elif payload.get("type") in ["typing_start", "typing_stop", "recording_start", "recording_stop"]:
                conv_id = payload.get("conversation_id")
                if not conv_id: continue
                
                sender_result = await db.execute(select(User).where(User.id == user_id))
                sender = sender_result.scalars().first()
                if not sender: continue
                
                members_result = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id))
                member_ids = members_result.scalars().all()
                
                await manager.broadcast_to_conversation({
                    "type": payload.get("type"),
                    "conversation_id": conv_id,
                    "user": {
                        "id": sender.id,
                        "name": sender.name,
                        "nickname": sender.nickname,
                        "status": sender.status
                    }
                }, [uid for uid in member_ids if uid != user_id])
                
            elif payload.get("type") in ["webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"]:
                target_user_id = payload.get("target_user_id")
                if target_user_id:
                    # Forward the exact payload but append sender info
                    forward_payload = {**payload, "sender_id": user_id}
                    await manager.send_personal_message(json.dumps(forward_payload), target_user_id)
                    
            elif payload.get("type") == "call_status":
                conv_id = payload.get("conversation_id")
                if not conv_id: continue
                
                members_result = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id))
                member_ids = members_result.scalars().all()
                
                await manager.broadcast_to_conversation({
                    "type": "call_status",
                    "conversation_id": conv_id,
                    "sender_id": user_id,
                    "status": payload.get("status"), # 'joined', 'left', 'muted', 'unmuted', 'video_on', 'video_off'
                    "peerId": payload.get("peerId") # Optional: can pass peer connection ID if needed
                }, [uid for uid in member_ids if uid != user_id])

            elif payload.get("type") == "edit_message":
                msg_id = payload["message_id"]
                new_content = payload["content"]
                
                msg_result = await db.execute(select(Message).where(Message.id == msg_id))
                msg = msg_result.scalars().first()
                
                if msg and (msg.sender_id == user_id or msg.content.startswith("📞 Started")) and not msg.is_deleted:
                    msg.content = new_content
                    msg.is_edited = True
                    await db.commit()
                    
                    members_result = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id))
                    member_ids = members_result.scalars().all()
                    
                    await manager.broadcast_to_conversation({
                        "type": "edited_message",
                        "message_id": msg.id,
                        "conversation_id": msg.conversation_id,
                        "content": new_content
                    }, member_ids)

            elif payload.get("type") == "delete_message":
                msg_id = payload["message_id"]
                
                msg_result = await db.execute(select(Message).where(Message.id == msg_id))
                msg = msg_result.scalars().first()
                
                if msg and msg.sender_id == user_id:
                    msg.is_deleted = True
                    msg.content = ""
                    await db.commit()
                    
                    members_result = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id))
                    member_ids = members_result.scalars().all()
                    
                    await manager.broadcast_to_conversation({
                        "type": "deleted_message",
                        "message_id": msg.id,
                        "conversation_id": msg.conversation_id
                    }, member_ids)

                # --- Specialized AI Agent Routing ---
                match = re.search(r'@(\w+Agent|\w+Assistant)\b', content, re.IGNORECASE)
                if match:
                    agent_persona = match.group(1)
                    
                    async def generate_ai_reply(question: str, c_id: int, persona: str, u_id: int):
                        async with async_session_maker() as bg_db:
                            try:
                                ai_result = await bg_db.execute(select(User).where(User.email == 'ai@system.local'))
                                ai_user = ai_result.scalars().first()
                                if not ai_user:
                                    return
                                    
                                conv_result = await bg_db.execute(select(Conversation).where(Conversation.id == c_id))
                                conv = conv_result.scalars().first()
                                room_id = conv.room_id if conv else None
                                ai_response = await query_ai(question, u_id, room_id, bg_db, agent_persona=persona)
                                answer = ai_response.get("answer", "No response generated.")
                                
                                ai_msg = Message(conversation_id=c_id, sender_id=ai_user.id, content=answer)
                                bg_db.add(ai_msg)
                                await bg_db.commit()
                                await bg_db.refresh(ai_msg)
                                
                                ai_broadcast = {
                                    "type": "new_message",
                                    "message": {
                                        "id": ai_msg.id,
                                        "conversation_id": c_id,
                                        "content": ai_msg.content,
                                        "timestamp": ai_msg.timestamp.isoformat() + "Z",
                                        "sender": {
                                            "id": ai_user.id,
                                            "name": ai_user.name,
                                            "pfp_url": ai_user.pfp_url
                                        }
                                    }
                                }
                                m_res = await bg_db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == c_id))
                                await manager.broadcast_to_conversation(ai_broadcast, m_res.scalars().all())
                            except Exception as e:
                                logger.error(f"Failed to query AI agent: {e}")
                                
                    asyncio.create_task(generate_ai_reply(content, conv_id, agent_persona, user_id))

    except WebSocketDisconnect:
        is_disconnected = manager.disconnect(websocket, user_id)
        if is_disconnected:
            await manager.broadcast_global({
                "type": "presence_update",
                "user_id": user_id,
                "status": "offline"
            })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        is_disconnected = manager.disconnect(websocket, user_id)
        if is_disconnected:
            await manager.broadcast_global({
                "type": "presence_update",
                "user_id": user_id,
                "status": "offline"
            })
