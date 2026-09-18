'use client';

import ClientOnly from '@/components/ClientOnly';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useSearchParams } from 'next/navigation';
import { communicationApi, profileApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Paperclip, Send, UserCircle, Hash, Search, Mic, Square, Loader2, Reply, Edit2, Trash2, X, ArrowLeft, Plus, Info, Camera, Pin, MoreVertical, BellOff, EyeOff, Phone, PhoneOff, Video, Check, CheckCheck, Share2, Fingerprint } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import VoiceNotePlayer from '@/components/ui/VoiceNotePlayer';
import { VoiceNotePreview } from '@/components/VoiceNotePreview';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CreateGroupModal from '@/components/CreateGroupModal';
import GroupInfoSidebar from '@/components/GroupInfoSidebar';
import CameraCaptureModal from '@/components/CameraCaptureModal';
import CallOverlay from '@/components/CallOverlay';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useDialog } from '@/context/DialogContext';
import ReflectiveCard from '@/components/ui/ReflectiveCard';

function ChatContent() {
  const { user } = useAuth();
  const { confirm, showToast } = useDialog();
  const searchParams = useSearchParams();
  const urlConvIdStr = searchParams ? searchParams.get('convId') : null;
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const activeConvIdRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // Advanced features state
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Attachments and Voice Note state
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [voiceNotePreview, setVoiceNotePreview] = useState<File | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Profile Popover state
  const [hoveredUserId, setHoveredUserId] = useState<number | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<any>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [fullScreenPfp, setFullScreenPfp] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  // Indicators state
  const [typingUsers, setTypingUsers] = useState<Record<number, Record<number, string>>>({});
  const [recordingUsers, setRecordingUsers] = useState<Record<number, Record<number, string>>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Group and Camera state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: number, x: number, y: number, type?: 'team' | 'direct', targetId?: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [readByModal, setReadByModal] = useState<{message: any, readers: any[]} | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // WebRTC
  const {
    activeCallConvId,
    localStream,
    remoteStreams,
    startCall,
    endCall,
    setRemoteVolume,
    toggleLocalAudio,
    toggleLocalVideo,
    incomingCall,
    setIncomingCall,
    acceptCall
  } = useWebRTC(ws, user?.id ? Number(user.id) : undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeCallMsgIdRef = useRef<number | null>(null);
  const activeCallConvIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeCallConvIdRef.current = activeCallConvId;
  }, [activeCallConvId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hoveredUserId && !(e.target as Element).closest('.profile-popover')) {
        closePopover();
      }
      if (showProfileDropdown && !(e.target as Element).closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hoveredUserId, showProfileDropdown]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        setWs((prevWs) => {
          if (!prevWs || prevWs.readyState === WebSocket.CLOSED) {
            console.log("Tab visible again, reconnecting WebSocket...");
            socket = initWebSocket(user.id);
            return socket;
          }
          return prevWs;
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (user) {
      loadConversations();
      socket = initWebSocket(user.id);
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socket) {
        socket.close();
      }
    };
  }, [user]);

  useEffect(() => {
    if (urlConvIdStr) {
      const parsedId = parseInt(urlConvIdStr);
      if (!isNaN(parsedId) && activeConvIdRef.current !== parsedId) {
        setActiveConvId(parsedId);
      }
    }
  }, [urlConvIdStr]);

  useEffect(() => {
    // Clear input value when switching conversations to prevent leaks
    setInputValue('');
    
    const prevConvId = activeConvIdRef.current;
    activeConvIdRef.current = activeConvId;
    if (activeConvId) {
      localStorage.setItem('activeConvId', activeConvId.toString());
      loadMessages(activeConvId);
    } else {
      localStorage.removeItem('activeConvId');
    }
    
    return () => {
      localStorage.removeItem('activeConvId');
      // If we were typing in the previous conversation, send typing_stop
      if (ws && ws.readyState === WebSocket.OPEN && prevConvId) {
        try {
          ws.send(JSON.stringify({ type: "typing_stop", conversation_id: prevConvId }));
        } catch (e) {
          console.error("Failed to send typing_stop on cleanup", e);
        }
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      lastTypingStartRef.current = 0;
    };
  }, [activeConvId, ws]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-[#10b981]';
      case 'working': return 'bg-[#d68eff]';
      case 'free': return 'bg-[#3b82f6]';
      case 'dnd': return 'bg-[#ef4444]';
      case 'sleeping': return 'bg-[#6b7280]';
      case 'offline': return 'bg-transparent border border-[#6b7280]';
      default: return 'bg-[#10b981]'; // Default online
    }
  };

  const handleAvatarClick = async (userId: number, e: React.MouseEvent, msgSender?: any) => {
    e.stopPropagation();
    if (hoveredUserId === userId) {
      if (hoveredProfile?.pfp_url || msgSender?.pfp_url) {
        setFullScreenImage(hoveredProfile?.pfp_url || msgSender?.pfp_url);
      }
      closePopover();
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: Math.min(rect.right + 10, window.innerWidth - 300) });
    setHoveredUserId(userId);
    setHoveredProfile(null);

    try {
      const res = await profileApi.getOther(userId);
      setHoveredProfile(res.data);
    } catch (err) {
      console.error("Failed to fetch user profile", err);
    }
  };

  const closePopover = () => {
    setHoveredUserId(null);
    setHoveredProfile(null);
    setShowProfileDropdown(false);
    setShowIdCardModal(false);
  };

  const initWebSocket = (userId: number | string) => {
    let wsUrl = '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || '') : '';
    
    if (apiUrl && !apiUrl.includes('backend') && !apiUrl.includes('localhost')) {
      const isSecure = apiUrl.startsWith('https:');
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      const urlWithoutProtocol = apiUrl.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}//${urlWithoutProtocol}/api/communication/ws/${userId}?token=${token}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/api/communication/ws/${userId}?token=${token}`;
    }

    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connected");
      if (activeCallConvIdRef.current) {
        socket.send(JSON.stringify({
          type: 'call_status',
          conversation_id: activeCallConvIdRef.current,
          status: 'joined'
        }));
      }
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("DEBUG: chat/page WS RECEIVED MESSAGE", data);
      if (data.type === 'new_message') {
        // If message belongs to active conversation, append it
        setMessages(prev => {
          if (data.message.conversation_id === activeConvIdRef.current) {
            // Prevent duplicates if already in list (just in case)
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          }
          return prev;
        });
        
        // Track the call message ID if it is a call start message
        if (data.message.content.includes("Started a voice call") || data.message.content.includes("Started a video call")) {
          activeCallMsgIdRef.current = data.message.id;
        }

        // Refresh conversations to update unread counts, snippets, and un-hide archived chats if necessary
        loadConversations();
      } else if (data.type === 'edited_message') {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: data.content, is_edited: true } : m));
      } else if (data.type === 'deleted_message') {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: "This message was deleted.", is_deleted: true, has_attachments: false } : m));
      } else if (data.type === 'new_notification') {
        window.dispatchEvent(new CustomEvent('new_notification', { detail: data.notification }));
      } else if (data.type === 'typing_start') {
        setTypingUsers(prev => ({
          ...prev,
          [data.conversation_id]: {
            ...(prev[data.conversation_id] || {}),
            [data.user.id]: data.user.name || data.user.nickname
          }
        }));
      } else if (data.type === 'typing_stop') {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (next[data.conversation_id]) {
            next[data.conversation_id] = { ...next[data.conversation_id] };
            delete next[data.conversation_id][data.user.id];
          }
          return next;
        });
      } else if (data.type === 'read_receipt') {
        setConversations(prev => prev.map(c => {
          if (c.id === data.conversation_id) {
            const newMembers = c.members?.map((m: any) => 
              m.user_id === data.user_id ? { ...m, last_read_message_id: data.last_read_message_id } : m
            );
            return { ...c, members: newMembers };
          }
          return c;
        }));
      } else if (data.type === 'recording_start') {
        setRecordingUsers(prev => ({
          ...prev,
          [data.conversation_id]: {
            ...(prev[data.conversation_id] || {}),
            [data.user.id]: data.user.name || data.user.nickname
          }
        }));
      } else if (data.type === 'recording_stop') {
        setRecordingUsers(prev => {
          const next = { ...prev };
          if (next[data.conversation_id]) {
            next[data.conversation_id] = { ...next[data.conversation_id] };
            delete next[data.conversation_id][data.user.id];
          }
          return next;
        });
      } else if (data.type === 'presence_update') {
        setConversations(prev => prev.map(conv => ({
          ...conv,
          members: conv.members?.map((m: any) => m.id === data.user_id ? { ...m, status: data.status } : m)
        })));
        setMessages(prev => prev.map(msg => 
          msg.sender.id === data.user_id ? { ...msg, sender: { ...msg.sender, status: data.status } } : msg
        ));
        setHoveredProfile((prev: any) => (prev && prev.id === data.user_id) ? { ...prev, status: data.status } : prev);
      }
    };
    
    setWs(socket);
    return socket;
  };

  const loadConversations = async () => {
    try {
      const res = await communicationApi.getConversations();
      setConversations(res.data);
      if (res.data.length > 0) {
        // Only auto-select a conversation if we don't have one selected, OR if the current one was deleted/hidden
        const currentStillExists = activeConvIdRef.current ? res.data.some((c: any) => c.id === activeConvIdRef.current) : false;
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlConvId = urlParams.get('convId');
        if (urlConvId && res.data.find((c: any) => c.id === parseInt(urlConvId))) {
          setActiveConvId(parseInt(urlConvId));
        } else if (!activeConvIdRef.current || !currentStillExists) {
          setActiveConvId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: number) => {
    try {
      const res = await communicationApi.getMessages(convId);
      setMessages(res.data);
      
      // Look up if there's any active call message
      const callMsgs = res.data.filter((m: any) => m.content.includes("Started a voice call") || m.content.includes("Started a video call"));
      if (callMsgs.length > 0) {
        const latestCallMsg = [...callMsgs].sort((a: any, b: any) => b.id - a.id)[0];
        activeCallMsgIdRef.current = latestCallMsg.id;
      } else {
        activeCallMsgIdRef.current = null;
      }

      // Mark as read if we have messages
      if (res.data.length > 0) {
        const lastMsgId = Math.max(...res.data.map((m: any) => m.id));
        communicationApi.updateChatState(convId, { last_read_message_id: lastMsgId })
          .then(() => loadConversations()) // refresh unread count
          .catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !activeConvId || !ws) return;

    if (ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open. State:", ws.readyState);
      // Attempt reconnect if closed
      if (ws.readyState === WebSocket.CLOSED && user) {
        initWebSocket(user.id);
      }
      return;
    }

    if (editingMsg) {
      const payload = {
        type: "edit_message",
        message_id: editingMsg.id,
        content: inputValue
      };
      ws.send(JSON.stringify(payload));
      setEditingMsg(null);
    } else {
      const payload = {
        type: "send_message",
        conversation_id: activeConvId,
        content: inputValue,
        reply_to_id: replyingTo ? replyingTo.id : null
      };
      ws.send(JSON.stringify(payload));
      
      // Stop typing
      ws.send(JSON.stringify({ type: "typing_stop", conversation_id: activeConvId }));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      setReplyingTo(null);
    }
    setInputValue('');
  };

  const initiateCall = (convId: number, withVideo: boolean = false) => {
    startCall(convId, withVideo);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "send_message",
        conversation_id: convId,
        content: `📞 Started a ${withVideo ? 'video' : 'voice'} call`
      }));
    }
  };

  const handleEndCall = () => {
    const remotePeersCount = Object.keys(remoteStreams).length;
    if (remotePeersCount === 0 && activeCallMsgIdRef.current && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "edit_message",
        message_id: activeCallMsgIdRef.current,
        content: `📞 Call ended`
      }));
      activeCallMsgIdRef.current = null;
    }
    endCall();
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const confirmed = await confirm({
      title: "Delete Message",
      message: "Are you sure you want to delete this message?",
      type: "destructive",
      confirmText: "Delete"
    });
    if (confirmed) {
      ws.send(JSON.stringify({
        type: "delete_message",
        message_id: msgId
      }));
    }
  };

  const uploadFileAndGetContent = async (file: File): Promise<string | null> => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
      const res = await fetch('/api/communication/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      const fileUrl = data.url;
      const fileName = file.name;
      
      return `[Attachment: ${fileName}](${fileUrl})`;
    } catch (err) {
      console.error('File upload error:', err);
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId || !ws || ws.readyState !== WebSocket.OPEN) return;

    const content = await uploadFileAndGetContent(file);
    if (content) {
      // Append to the input value instead of sending immediately for normal files
      setInputValue(prev => prev ? `${prev} ${content}` : content);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        
        setVoiceNotePreview(file);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      if (ws && ws.readyState === WebSocket.OPEN && activeConvId) {
        ws.send(JSON.stringify({ type: "recording_start", conversation_id: activeConvId }));
        
        recordingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "recording_start", conversation_id: activeConvId }));
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (ws && ws.readyState === WebSocket.OPEN && activeConvId) {
        ws.send(JSON.stringify({ type: "recording_stop", conversation_id: activeConvId }));
      }
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  const activeConv = conversations.find(c => c.id === activeConvId);

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.name === 'General Team') return -1;
    if (b.name === 'General Team') return 1;
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    
    const timeA = a.last_message_timestamp ? new Date(a.last_message_timestamp).getTime() : new Date(a.created_at).getTime();
    const timeB = b.last_message_timestamp ? new Date(b.last_message_timestamp).getTime() : new Date(b.created_at).getTime();
    return timeB - timeA;
  });

  const visibleConversations = sortedConversations.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchive = showArchived ? !!c.is_hidden : !c.is_hidden;
    return matchesSearch && matchesArchive;
  });

  return (
    <AppShell>
      <div className="flex w-full max-w-full h-full bg-[#0a0a0f] overflow-hidden">
        
        {/* Left Pane: Conversations List */}
        <div className={`w-full md:w-80 h-full border-r border-[#2a2a3e] bg-[#12121a]/80 shrink-0 flex flex-col ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-[#2a2a3e]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Messages</h2>
              <button onClick={() => setShowCreateGroup(true)} className="p-1.5 bg-[#2a2a3e] hover:bg-[#ff79c6] text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex justify-between items-center px-1 mb-2">
              <span className="text-xs text-[#a0a0b0] font-medium uppercase tracking-wider">
                {showArchived ? 'Archived Chats' : 'Active Chats'}
              </span>
              <button 
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs text-[#ff79c6] hover:text-[#ff92df] font-medium transition-colors"
              >
                {showArchived ? 'View Active' : 'View Archive'}
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1e2d]/50 border border-[#2a2a3e] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff79c6]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2" onClick={() => setContextMenu(null)}>
            {visibleConversations.map(conv => (
              <div key={conv.id} className="relative group">
                <button
                  onClick={() => setActiveConvId(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ 
                        id: conv.id, 
                        x: e.pageX, 
                        y: e.pageY,
                        type: conv.type,
                        targetId: conv.type === 'direct' ? conv.members?.find((m: any) => m.id !== user?.id)?.id : undefined
                    });
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    activeConvId === conv.id ? 'bg-[#ff79c6]/10 border border-[#ff79c6]/20' : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-[#2a2a3e] flex items-center justify-center overflow-hidden">
                      {conv.pfp_url ? (
                        <img src={conv.pfp_url} alt="pfp" className="w-full h-full object-cover" />
                      ) : conv.type === 'team' ? (
                        <Hash className="w-5 h-5 text-[#a0a0b0]" />
                      ) : conv.members?.find((m: any) => m.id !== user?.id)?.pfp_url ? (
                        <img src={conv.members.find((m: any) => m.id !== user?.id).pfp_url} alt="pfp" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-6 h-6 text-[#a0a0b0]" />
                      )}
                    </div>
                    {conv.type === 'direct' && conv.members?.find((m: any) => m.id !== user?.id)?.status && (
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#12121a] ${getStatusColor(conv.members.find((m: any) => m.id !== user?.id).status)} z-10`} title={conv.members.find((m: any) => m.id !== user?.id).status} />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                        {conv.name || 'Unnamed Chat'}
                      </h3>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#6b6b7b] truncate">{conv.type === 'team' ? 'Team Channel' : 'Direct Message'}</p>
                      {conv.is_pinned && <Pin className="w-3 h-3 text-[#ff79c6] ml-1 flex-shrink-0" />}
                    </div>
                  </div>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ 
                        id: conv.id, 
                        x: e.pageX, 
                        y: e.pageY,
                        type: conv.type,
                        targetId: conv.type === 'direct' ? conv.members?.find((m: any) => m.id !== user?.id)?.id : undefined
                    });
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-white/10"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="p-4 text-center text-[#6b6b7b] text-sm">
                No active conversations yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Chat Interface */}
        <div className={`flex-1 flex-col bg-[#0a0a0f] relative min-w-0 w-full max-w-full overflow-hidden ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Chat Header */}
          {activeConv ? (
            <>
              <div className="h-16 shrink-0 border-b border-[#2a2a3e] bg-[#12121a]/50 flex items-center px-4 md:px-6 gap-3">
                <button onClick={() => setActiveConvId(null)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-white/5 text-[#6b6b7b] hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-[#2a2a3e] flex items-center justify-center overflow-hidden">
                      {activeConv.pfp_url ? (
                        <img src={activeConv.pfp_url} alt="pfp" className="w-full h-full object-cover" />
                      ) : activeConv.type === 'team' ? (
                        <Hash className="w-5 h-5 text-[#a0a0b0]" />
                      ) : activeConv.members?.find((m: any) => m.id !== user?.id)?.pfp_url ? (
                        <img src={activeConv.members.find((m: any) => m.id !== user?.id).pfp_url} alt="pfp" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-6 h-6 text-[#a0a0b0]" />
                      )}
                    </div>
                    {activeConv.type === 'direct' && activeConv.members?.find((m: any) => m.id !== user?.id)?.status && (
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#12121a]/50 ${getStatusColor(activeConv.members.find((m: any) => m.id !== user?.id).status)} z-10`} title={activeConv.members.find((m: any) => m.id !== user?.id).status} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white leading-tight">{activeConv.name || 'Unnamed Chat'}</h2>
                    <p className="text-xs text-[#6b6b7b]">{activeConv.members?.length || 0} members</p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => initiateCall(activeConv.id, false)} className="p-2 text-[#6b6b7b] hover:text-[#ff79c6] transition-colors rounded-xl hover:bg-[#ff79c6]/10" title="Voice Call">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button onClick={() => initiateCall(activeConv.id, true)} className="p-2 text-[#6b6b7b] hover:text-[#ff79c6] transition-colors rounded-xl hover:bg-[#ff79c6]/10" title="Video Call">
                    <Video className="w-5 h-5" />
                  </button>
                  {activeConv.type === 'team' && (
                    <button onClick={() => setShowGroupInfo(prev => !prev)} className="p-2 text-[#6b6b7b] hover:text-[#ff79c6] transition-colors rounded-xl hover:bg-[#ff79c6]/10">
                      <Info className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender.id === user?.id;
                  const isCallEnded = msg.content.includes("Call ended");
                  
                  // Hide consecutive "Call ended" messages to prevent UI spam
                  if (isCallEnded && idx > 0 && messages[idx - 1].content.includes("Call ended")) {
                    return null;
                  }

                  const isCallMessage = msg.content.includes("Started a voice call") || msg.content.includes("Started a video call") || isCallEnded;
                  
                  if (isCallMessage) {
                    const withVideo = msg.content.includes("video");
                    const isCallerMe = msg.sender.id === user?.id;
                    const callerName = isCallerMe ? "You" : msg.sender.name;
                    
                    if (isCallEnded) {
                      return (
                        <div key={msg.id || idx} className="flex justify-center my-2 w-full animate-fade-in">
                          <div className="flex items-center gap-2 bg-[#12121a]/40 border border-[#2a2a3e]/50 px-3.5 py-1.5 rounded-full text-xs text-[#6b6b7b] font-medium tracking-wide">
                            <PhoneOff className="w-3.5 h-3.5 text-[#ef4444]/75 shrink-0" />
                            <span>Call ended</span>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={msg.id || idx} className="flex justify-center my-4 w-full">
                        <div className="flex items-center gap-3 bg-[#1e1e2f]/85 backdrop-blur border border-[#2a2a3e] px-4 py-2 rounded-2xl shadow-md max-w-sm text-sm text-[#e0e0e0]">
                          <span className="font-semibold text-[#ff79c6]">
                            {withVideo ? "📹" : "📞"}
                          </span>
                          <span className="flex-1 truncate font-medium text-xs">
                            {callerName} started a {withVideo ? "video" : "voice"} call
                          </span>
                          {activeCallConvId !== activeConv.id ? (
                            <button
                              onClick={() => startCall(activeConv.id, withVideo)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#10b981] hover:bg-[#059669] text-white transition-colors cursor-pointer shadow-md shadow-[#10b981]/20 flex items-center gap-1 shrink-0"
                            >
                              <Phone className="w-3 h-3" />
                              Join
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-[#10b981] bg-[#10b981]/15 border border-[#10b981]/30 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id || idx} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div 
                          className={`w-full h-full rounded-full bg-[#2a2a3e] overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#ff79c6] transition-all profile-popover`}
                          onClick={(e) => handleAvatarClick(msg.sender.id, e, msg.sender)}
                        >
                          {msg.sender.pfp_url ? (
                            <img src={msg.sender.pfp_url} alt="pfp" className="w-full h-full object-cover" />
                          ) : (
                            <UserCircle className="w-full h-full text-[#6b6b7b]" />
                          )}
                        </div>
                        {msg.sender.status && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12121a] ${getStatusColor(msg.sender.status)} z-10 pointer-events-none`} title={msg.sender.status.charAt(0).toUpperCase() + msg.sender.status.slice(1)} />
                        )}
                      </div>
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%] min-w-0`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[#a0a0b0] flex items-center gap-1.5">
                            {msg.sender.name}
                          </span>
                          <span className="text-[10px] text-[#6b6b7b] flex items-center gap-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            {isMe && (
                              <span className="ml-0.5">
                                {(() => {
                                  const otherMembers = activeConv.members?.filter((m: any) => m.user_id !== user?.id) || [];
                                  if (otherMembers.length === 0) return <Check className="w-3.5 h-3.5 text-[#6b6b7b]" />;
                                  
                                  const allRead = otherMembers.every((m: any) => m.last_read_message_id >= msg.id);
                                  const someRead = otherMembers.some((m: any) => m.last_read_message_id >= msg.id);
                                  
                                  const anyOnline = otherMembers.some((m: any) => m.status === 'online');
                                  
                                  if (allRead) return <CheckCheck className="w-3.5 h-3.5 text-[#d68eff]" />;
                                  if (someRead) return <CheckCheck className="w-3.5 h-3.5 text-[#6b6b7b]" />;
                                  if (anyOnline) return <CheckCheck className="w-3.5 h-3.5 text-[#6b6b7b]" />;
                                  return <Check className="w-3.5 h-3.5 text-[#6b6b7b]" />;
                                })()}
                              </span>
                            )}
                          </span>
                          {msg.is_edited && <span className="text-[10px] text-[#6b6b7b] italic">(edited)</span>}
                          {isMe && activeConv?.type === 'team' && (
                            <button onClick={async () => {
                              try {
                                const readers = await communicationApi.getMessageReadBy(msg.id);
                                setReadByModal({ message: msg, readers: readers.data });
                              } catch (e) {
                                console.error(e);
                              }
                            }} className="text-[#6b6b7b] hover:text-[#ff79c6] ml-1" title="Info">
                              <Info className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {msg.reply_to_id && (
                          <div className={`text-xs p-2 mb-1 rounded bg-[#1e1e2d] border-l-2 border-[#ff79c6] text-[#a0a0b0] opacity-80 cursor-pointer`}>
                            <span className="font-medium text-[#ff79c6]">Replying to</span>
                            <div className="truncate max-w-[200px] mt-0.5">{msg.reply_to_content || '...'}</div>
                          </div>
                        )}
                        <div className={`p-3 rounded-2xl relative break-words ${isMe ? 'bg-[#ff79c6] text-white rounded-tr-none' : 'bg-[#1e1e2d] text-[#e0e0e0] border border-[#2a2a3e] rounded-tl-none'} ${msg.is_deleted ? 'italic opacity-60' : ''}`}>
                          
                          {/* Desktop Hover Actions */}
                          <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} hidden md:group-hover:flex items-center gap-1 bg-[#1e1e2d] rounded-lg border border-[#2a2a3e] p-1 shadow-lg z-10`}>
                            <button onClick={() => setReplyingTo(msg)} className="p-1.5 text-[#6b6b7b] hover:text-[#22d3ee] rounded hover:bg-white/5 transition-colors" title="Reply">
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            {isMe && !msg.is_deleted && (
                              <>
                                <button onClick={() => { setEditingMsg(msg); setInputValue(msg.content); setReplyingTo(null); }} className="p-1.5 text-[#6b6b7b] hover:text-[#fbbf24] rounded hover:bg-white/5 transition-colors" title="Edit">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-[#6b6b7b] hover:text-[#ef4444] rounded hover:bg-white/5 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                          {msg.content.includes('[Attachment:') ? (
                            <div className="text-sm">
                              {msg.content.match(/\((.*?)\)/)?.[1]?.endsWith('.webm') || msg.content.match(/\((.*?)\)/)?.[1]?.endsWith('.mp3') ? (
                                <VoiceNotePlayer src={msg.content.match(/\((.*?)\)/)?.[1] || ''} />
                              ) : msg.content.match(/\((.*?)\)/)?.[1]?.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                                <img src={msg.content.match(/\((.*?)\)/)?.[1]} alt="attachment" className="max-w-xs rounded-lg mt-1 border border-white/20" />
                              ) : (
                                <a href={msg.content.match(/\((.*?)\)/)?.[1]} download={msg.content.match(/\[Attachment: (.*?)\]/)?.[1] || 'Document'} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/10 transition-colors mt-1 w-fit max-w-[250px] shadow-sm">
                                  <div className="w-10 h-10 rounded bg-[#ff79c6]/20 flex items-center justify-center shrink-0">
                                    <Paperclip className="w-5 h-5 text-[#ff79c6]" />
                                  </div>
                                  <div className="overflow-hidden flex-1">
                                    <p className="text-sm font-medium text-white truncate">{msg.content.match(/\[Attachment: (.*?)\]/)?.[1] || 'Document'}</p>
                                    <p className="text-xs text-[#a0a0b0]">Click to view file</p>
                                  </div>
                                </a>
                              )}
                            </div>
                          ) : (msg.sender?.name === 'AI Assistant' || msg.sender?.id === 2) ? (
                            <div className="text-sm text-white/90">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  strong: ({node, ...props}) => <strong className="font-bold text-[#22d3ee]" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2 whitespace-pre-wrap" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-2 mb-1 text-white" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-md font-bold mt-2 mb-1 text-white" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="font-bold mt-2 mb-1 text-white" {...props} />,
                                }}
                              >
                                {msg.content.replace(/\+\+(.*?)\+\+/g, '**$1**')}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content.split(/(@\w+)/g).map((part: string, i: number) => {
                                if (part.startsWith('@')) {
                                  const tagName = part.substring(1).toLowerCase();
                                  const taggedMember = (activeConv?.members || []).find((m: any) => 
                                    m.name.toLowerCase().replace(/\s+/g, '') === tagName || 
                                    (m.nickname && m.nickname.toLowerCase() === tagName)
                                  );
                                  return (
                                    <span 
                                      key={i} 
                                      className="text-[#22d3ee] font-semibold bg-[#22d3ee]/10 px-1 rounded mx-0.5 cursor-pointer hover:bg-[#22d3ee]/20 transition-colors" 
                                      title={taggedMember ? "View Profile" : "User not found"}
                                      onClick={(e) => {
                                        if (taggedMember) {
                                          handleAvatarClick(taggedMember.id, e, taggedMember);
                                        }
                                      }}
                                    >
                                      {part}
                                    </span>
                                  );
                                }
                                return part;
                              })}
                            </p>
                          )}
                        </div>
                        
                        {/* Mobile Actions (Visible under bubble) */}
                        <div className={`flex md:hidden items-center gap-4 mt-1.5 px-1 text-[#6b6b7b]`}>
                          <button onClick={() => setReplyingTo(msg)} className="flex items-center gap-1 p-1 hover:text-[#22d3ee] transition-colors">
                            <Reply className="w-3 h-3" />
                            <span className="text-[10px]">Reply</span>
                          </button>
                          {isMe && !msg.is_deleted && (
                            <>
                              <button onClick={() => { setEditingMsg(msg); setInputValue(msg.content); setReplyingTo(null); }} className="flex items-center gap-1 p-1 hover:text-[#fbbf24] transition-colors">
                                <Edit2 className="w-3 h-3" />
                                <span className="text-[10px]">Edit</span>
                              </button>
                              <button onClick={() => handleDeleteMessage(msg.id)} className="flex items-center gap-1 p-1 hover:text-[#ef4444] transition-colors">
                                <Trash2 className="w-3 h-3" />
                                <span className="text-[10px]">Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing/Recording Indicators */}
              {(Object.keys(typingUsers[activeConvId || 0] || {}).length > 0 || Object.keys(recordingUsers[activeConvId || 0] || {}).length > 0) && (
                <div className="px-6 pb-2 text-xs text-[#a0a0b0] flex items-center gap-2 min-h-[24px]">
                  {Object.keys(recordingUsers[activeConvId || 0] || {}).length > 0 && (
                    <div className="flex items-center gap-2 text-[#ef4444]">
                      <div className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
                      <span className="italic">{Object.values(recordingUsers[activeConvId || 0] || {}).join(', ')} {Object.keys(recordingUsers[activeConvId || 0] || {}).length > 1 ? 'are' : 'is'} recording voice note...</span>
                    </div>
                  )}
                  {Object.keys(recordingUsers[activeConvId || 0] || {}).length > 0 && Object.keys(typingUsers[activeConvId || 0] || {}).length > 0 && <span>•</span>}
                  {Object.keys(typingUsers[activeConvId || 0] || {}).length > 0 && (
                    <div className="flex items-center gap-1.5 italic">
                      <div className="flex space-x-1 items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-[#ff79c6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#ff79c6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#ff79c6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="ml-1">{Object.values(typingUsers[activeConvId || 0] || {}).join(', ')} {Object.keys(typingUsers[activeConvId || 0] || {}).length > 1 ? 'are' : 'is'} typing...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 shrink-0 bg-[#12121a] border-t border-[#2a2a3e]">
                {activeConv?.members?.find((m: any) => m.id === user?.id)?.is_server_muted ? (
                  <div className="flex items-center justify-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                    You have been muted by an admin and cannot send messages.
                  </div>
                ) : (
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  {voiceNotePreview ? (
                    <VoiceNotePreview 
                      file={voiceNotePreview}
                      isUploading={uploadingFile}
                      onDiscard={() => setVoiceNotePreview(null)}
                      onSend={async () => {
                        const content = await uploadFileAndGetContent(voiceNotePreview);
                        if (content && ws && ws.readyState === WebSocket.OPEN && activeConvId) {
                          const payload = {
                            type: "send_message",
                            conversation_id: activeConvId,
                            content: content
                          };
                          ws.send(JSON.stringify(payload));
                        }
                        setVoiceNotePreview(null);
                      }}
                    />
                  ) : (
                    <>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload} 
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="p-3 text-[#6b6b7b] hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                        title="Attach File"
                      >
                        {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowCamera(true)}
                        disabled={uploadingFile}
                        className="p-3 text-[#6b6b7b] hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                        title="Take Photo"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                      
                      {isRecording ? (
                        <div className="flex-1 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl overflow-hidden flex items-center justify-between px-4 min-h-[44px]">
                          <div className="flex items-center gap-2 text-[#ef4444] animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                            <span className="text-sm font-medium">Recording voice note...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 bg-[#1e1e2d]/50 border border-[#2a2a3e] rounded-xl focus-within:border-[#ff79c6] transition-colors flex flex-col relative">
                          {(replyingTo || editingMsg) && (
                            <div className="bg-[#1e1e2d] border-b border-[#2a2a3e] px-4 py-2 flex items-center justify-between rounded-t-xl">
                              <div className="text-xs text-[#a0a0b0] flex items-center gap-2">
                                {editingMsg ? <Edit2 className="w-3 h-3 text-[#fbbf24]" /> : <Reply className="w-3 h-3 text-[#ff79c6]" />}
                                <span className="font-medium">{editingMsg ? 'Editing message' : `Replying to ${replyingTo.sender?.name}`}</span>
                                <span className="truncate max-w-[200px] text-[#6b6b7b] ml-2">{editingMsg ? editingMsg.content : replyingTo.content}</span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => { setReplyingTo(null); setEditingMsg(null); setInputValue(''); }}
                                className="text-[#6b6b7b] hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          
                          {/* Mentions Dropdown */}
                          {mentionQuery !== null && (() => {
                            const candidates = (activeConv.members || []).filter((m: any) => 
                              m.name.toLowerCase().includes(mentionQuery) || 
                              (m.nickname && m.nickname.toLowerCase().includes(mentionQuery))
                            ).slice(0, 5);
                            
                            if (candidates.length === 0) return null;
                            
                            return (
                              <div className="absolute bottom-[calc(100%+10px)] left-0 w-64 bg-[#12121a] border border-[#2a2a3e] rounded-xl shadow-2xl overflow-hidden z-20">
                                {candidates.map((candidate: any, idx: number) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    onClick={() => {
                                      const cursor = inputRef.current?.selectionStart || inputValue.length;
                                      const textBeforeCursor = inputValue.slice(0, cursor);
                                      const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
                                      if (match) {
                                        const start = cursor - match[0].length;
                                        const mentionText = `@${candidate.nickname || candidate.name.replace(/\s+/g, '')} `;
                                        const newText = inputValue.slice(0, start) + mentionText + inputValue.slice(cursor);
                                        setInputValue(newText);
                                        setMentionQuery(null);
                                        setTimeout(() => {
                                          if (inputRef.current) {
                                            inputRef.current.focus();
                                            inputRef.current.setSelectionRange(start + mentionText.length, start + mentionText.length);
                                          }
                                        }, 0);
                                      }
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === mentionIndex ? 'bg-[#ff79c6]/20 border-l-2 border-[#ff79c6]' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                                  >
                                    <div className="w-6 h-6 rounded-full bg-[#2a2a3e] overflow-hidden shrink-0">
                                      {candidate.pfp_url ? <img src={candidate.pfp_url} alt="pfp" className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-[#6b6b7b]" />}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="text-sm text-white truncate leading-tight">{candidate.name}</span>
                                      {candidate.nickname && <span className="text-[10px] text-[#a0a0b0] truncate leading-tight">@{candidate.nickname}</span>}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}

                          <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => {
                              setInputValue(e.target.value);
                              
                              if (ws && (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING)) {
                                console.log("WebSocket closed while typing, reconnecting...");
                                if (user) initWebSocket(user.id);
                              }
                              
                              // Handle typing indicator
                              if (ws && ws.readyState === WebSocket.OPEN && activeConvId) {
                                const now = Date.now();
                                if (now - lastTypingStartRef.current > 1000) {
                                  ws.send(JSON.stringify({ type: "typing_start", conversation_id: activeConvId }));
                                  lastTypingStartRef.current = now;
                                }
                                
                                if (typingTimeoutRef.current) {
                                  clearTimeout(typingTimeoutRef.current);
                                }
                                
                                typingTimeoutRef.current = setTimeout(() => {
                                  if (ws.readyState === WebSocket.OPEN) {
                                    ws.send(JSON.stringify({ type: "typing_stop", conversation_id: activeConvId }));
                                  }
                                  typingTimeoutRef.current = null;
                                  lastTypingStartRef.current = 0;
                                }, 2000);
                              }
                              
                              const cursor = e.target.selectionStart;
                              const textBeforeCursor = e.target.value.slice(0, cursor);
                              const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
                              if (match) {
                                setMentionQuery(match[1].toLowerCase());
                                setMentionIndex(0);
                              } else {
                                setMentionQuery(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (mentionQuery !== null) {
                                const candidates = (activeConv.members || []).filter((m: any) => 
                                  m.name.toLowerCase().includes(mentionQuery) || 
                                  (m.nickname && m.nickname.toLowerCase().includes(mentionQuery))
                                ).slice(0, 5);
                                
                                if (candidates.length > 0) {
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setMentionIndex(prev => (prev > 0 ? prev - 1 : candidates.length - 1));
                                    return;
                                  }
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setMentionIndex(prev => (prev < candidates.length - 1 ? prev + 1 : 0));
                                    return;
                                  }
                                  if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault();
                                    const candidate = candidates[mentionIndex];
                                    const cursor = inputRef.current?.selectionStart || inputValue.length;
                                    const textBeforeCursor = inputValue.slice(0, cursor);
                                    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
                                    if (match) {
                                      const start = cursor - match[0].length;
                                      const mentionText = `@${candidate.nickname || candidate.name.replace(/\s+/g, '')} `;
                                      const newText = inputValue.slice(0, start) + mentionText + inputValue.slice(cursor);
                                      setInputValue(newText);
                                      setMentionQuery(null);
                                      setTimeout(() => {
                                        if (inputRef.current) {
                                          inputRef.current.focus();
                                          inputRef.current.setSelectionRange(start + mentionText.length, start + mentionText.length);
                                        }
                                      }, 0);
                                    }
                                    return;
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setMentionQuery(null);
                                    return;
                                  }
                                }
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e as any);
                              }
                            }}
                            placeholder={editingMsg ? "Edit your message..." : `Message ${activeConv.name}...`}
                            className="w-full max-h-32 min-h-[44px] bg-transparent p-3 text-sm text-white resize-none focus:outline-none"
                            rows={1}
                          />
                        </div>
                      )}

                      {inputValue.trim() ? (
                        <button
                          type="submit"
                          disabled={uploadingFile}
                          className="p-3 bg-[#ff79c6] text-white rounded-xl hover:bg-[#ff92df] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      ) : isRecording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="p-3 bg-[#ef4444] text-white rounded-xl hover:bg-[#dc2626] transition-colors"
                        >
                          <Square className="w-5 h-5" fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          disabled={uploadingFile}
                          className="p-3 bg-transparent text-[#10b981] hover:bg-[#10b981]/10 rounded-xl transition-colors"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                </form>
                )}
              </div>

              {/* User Profile Popover */}
              {hoveredUserId && (
                <div 
                  className="profile-popover fixed z-50 bg-[#12121a]/95 backdrop-blur-xl border border-[#2a2a3e] rounded-xl shadow-2xl p-4 w-72 animate-fade-in max-h-[80vh] overflow-y-auto custom-scrollbar"
                  style={{ top: Math.min(popoverPos.top, window.innerHeight - 450), left: popoverPos.left }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-white">User Profile</h3>
                    <div className="flex items-center gap-1">
                      {hoveredProfile && (
                        <div className="profile-dropdown-container relative">
                          <button 
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)} 
                            className="text-[#6b6b7b] hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {showProfileDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                              {!hoveredProfile.is_blocked_by_me && (
                                <button 
                                  onClick={async () => {
                                    setShowProfileDropdown(false);
                                    try {
                                      const res = await communicationApi.createDirectConversation(hoveredProfile.id);
                                      setActiveConvId(res.data.id);
                                      loadConversations();
                                      closePopover();
                                    } catch (error: any) {
                                      if (error.response?.status === 403) {
                                        showToast(error.response?.data?.detail || "Cannot message this user (blocked)", "warning");
                                      } else {
                                        console.error("Failed to jump to DM:", error);
                                      }
                                    }
                                  }} 
                                  className="w-full px-3 py-2 text-sm text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 transition-colors"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-[#ff79c6]" /> Direct Message
                                </button>
                              )}
                              
                              <button 
                                onClick={() => {
                                  setShowProfileDropdown(false);
                                  const profileLink = `${window.location.origin}/chat?user=${hoveredProfile.id}`;
                                  navigator.clipboard.writeText(profileLink);
                                  showToast("Profile link copied to clipboard", "success");
                                }} 
                                className="w-full px-3 py-2 text-sm text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5 text-green-400" /> Share Profile
                              </button>
                              
                              <div className="h-px bg-[#2a2a3e] my-1" />
                              
                              {hoveredProfile.is_blocked_by_me ? (
                                <button 
                                  onClick={async () => {
                                    setShowProfileDropdown(false);
                                    try {
                                      await communicationApi.unblockUser(hoveredProfile.id);
                                      showToast("User unblocked successfully", "success");
                                      setHoveredProfile({...hoveredProfile, is_blocked_by_me: false});
                                      loadConversations();
                                    } catch(e) {}
                                  }} 
                                  className="w-full px-3 py-2 text-sm text-left text-green-400 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                                >
                                  <UserCircle className="w-3.5 h-3.5" /> Unblock User
                                </button>
                              ) : (
                                <button 
                                  onClick={async () => {
                                    setShowProfileDropdown(false);
                                    const confirmed = await confirm({
                                      title: "Block User",
                                      message: "Are you sure you want to block this user?",
                                      type: "destructive",
                                      confirmText: "Block"
                                    });
                                    if (confirmed) {
                                      try {
                                        await communicationApi.blockUser(hoveredProfile.id);
                                        showToast("User blocked successfully", "success");
                                        setHoveredProfile({...hoveredProfile, is_blocked_by_me: true});
                                        loadConversations();
                                      } catch(e) {}
                                    }
                                  }} 
                                  className="w-full px-3 py-2 text-sm text-left text-[#ef4444] hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                                >
                                  <UserCircle className="w-3.5 h-3.5" /> Block User
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={closePopover} className="text-[#6b6b7b] hover:text-white p-1 rounded hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  {!hoveredProfile ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#ff79c6]" /></div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div 
                            className="w-12 h-12 rounded-full bg-[#2a2a3e] overflow-hidden shrink-0 border border-[#2a2a3e] cursor-pointer hover:ring-2 hover:ring-[#ff79c6] transition-all"
                            onClick={() => { if (hoveredProfile.pfp_url) setFullScreenImage(hoveredProfile.pfp_url); }}
                            title="Click to view full size"
                          >
                            {hoveredProfile.pfp_url ? <img src={hoveredProfile.pfp_url} alt="pfp" className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-[#6b6b7b]" />}
                          </div>
                          {hoveredProfile.status && (
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-[#12121a]/95 ${getStatusColor(hoveredProfile.status)} z-10 pointer-events-none`} title={hoveredProfile.status.charAt(0).toUpperCase() + hoveredProfile.status.slice(1)} />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-medium text-white truncate">{hoveredProfile.name}</div>
                          {hoveredProfile.nickname && <div className="text-xs text-[#ff79c6] truncate">@{hoveredProfile.nickname}</div>}
                        </div>
                      </div>
                      
                      <div className="space-y-2.5 text-sm pt-2 border-t border-[#2a2a3e]/50">
                        {hoveredProfile.email !== 'ai@system.local' && (
                          <div className="flex flex-col">
                            <span className="text-xs text-[#a0a0b0]">Email</span>
                            <a 
                              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${hoveredProfile.email}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#e0e0e0] truncate hover:text-[#ff79c6] transition-colors hover:underline"
                            >
                              {hoveredProfile.email}
                            </a>
                          </div>
                        )}
                        {hoveredProfile.position && (
                          <div className="flex flex-col">
                            <span className="text-xs text-[#a0a0b0]">Role/Position</span>
                            <span className="text-[#e0e0e0] truncate">{hoveredProfile.position}</span>
                          </div>
                        )}
                        {(hoveredProfile.gender || hoveredProfile.dob) && (
                          <div className="flex gap-4">
                            {hoveredProfile.gender && (
                              <div className="flex flex-col">
                                <span className="text-xs text-[#a0a0b0]">Gender</span>
                                <span className="text-[#e0e0e0]">{hoveredProfile.gender}</span>
                              </div>
                            )}
                            {hoveredProfile.dob && (
                              <div className="flex flex-col">
                                <span className="text-xs text-[#a0a0b0]">DOB</span>
                                <span className="text-[#e0e0e0]">{hoveredProfile.dob}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {hoveredProfile.bio && (
                          <div className="flex flex-col mt-2 bg-[#1e1e2d]/50 p-2 rounded-lg border border-[#2a2a3e]/30">
                            <span className="text-[10px] uppercase tracking-wider text-[#a0a0b0] mb-1">Bio</span>
                            <span className="text-[#e0e0e0] text-xs italic leading-relaxed">"{hoveredProfile.bio}"</span>
                          </div>
                        )}
                        {hoveredProfile.is_blocked_by_me ? (
                          <div className="space-y-3 mt-5">
                            <div className="text-xs text-[#ef4444] bg-[#ef4444]/10 p-3 rounded-lg border border-[#ef4444]/20 text-center font-medium">
                              You have blocked this user.
                            </div>
                            <button 
                              onClick={() => setShowIdCardModal(true)} 
                              className="w-full bg-[#2a2a3e] hover:bg-[#3b3b54] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-[#3b3b54] hover:border-[#ff79c6]"
                            >
                              <Fingerprint className="w-4 h-4 text-[#ff79c6]" /> View ID Card
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-5">
                            <button 
                              onClick={async () => {
                                if (!hoveredProfile) return;
                                try {
                                  const res = await communicationApi.createDirectConversation(hoveredProfile.id);
                                  setActiveConvId(res.data.id);
                                  loadConversations();
                                  closePopover();
                                } catch (error: any) {
                                   if (error.response?.status === 403) {
                                     showToast(error.response?.data?.detail || "Cannot message this user (blocked)", "warning");
                                   } else {
                                    console.error("Failed to jump to DM:", error);
                                  }
                                }
                              }} 
                              className="flex-1 bg-[#ff79c6] hover:bg-[#ff92df] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#ff79c6]/20"
                            >
                              <MessageSquare className="w-4 h-4" /> Message
                            </button>
                            <button 
                              onClick={() => setShowIdCardModal(true)} 
                              className="w-24 bg-[#2a2a3e] hover:bg-[#3b3b54] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-[#3b3b54] hover:border-[#ff79c6]"
                              title="View ID Card"
                            >
                              <Fingerprint className="w-4 h-4 text-[#ff79c6]" /> Card
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#6b6b7b]">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a conversation or start a new one</p>
            </div>
          )}

        </div>

        {showGroupInfo && activeConv?.type === 'team' && (
          <GroupInfoSidebar conv={activeConv} currentUser={user} onClose={() => setShowGroupInfo(false)} onUpdate={() => { loadConversations(); }} onUploadFile={uploadFileAndGetContent} />
        )}

      </div>

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setFullScreenImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setFullScreenImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white hover:bg-black/80 rounded-full backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={fullScreenImage} alt="Enlarged Profile" className="w-full h-full object-contain max-h-[90vh]" />
          </div>
        </div>
      )}
      
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={() => { setShowCreateGroup(false); loadConversations(); }} />
      )}
      {showCamera && (
        <CameraCaptureModal onClose={() => setShowCamera(false)} onCapture={async (file) => {
          setShowCamera(false);
          const content = await uploadFileAndGetContent(file);
          if (content && ws && ws.readyState === WebSocket.OPEN && activeConvId) {
            const payload = {
              type: "send_message",
              conversation_id: activeConvId,
              content: content,
            };
            ws.send(JSON.stringify(payload));
          }
        }} />
      )}

      {/* Read By Modal */}
      {readByModal && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e1e2d] border border-[#2a2a3e] rounded-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Message Info</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Sent at {new Date(readByModal.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setReadByModal(null)} className="text-gray-400 hover:text-white mt-1"><X className="w-5 h-5"/></button>
            </div>
            
            <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-[#d68eff]" />
              Read by
            </h4>
            {readByModal.readers.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No one has read this yet.</div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {readByModal.readers.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2a2a3e] overflow-hidden flex-shrink-0">
                      {r.pfp_url ? <img src={r.pfp_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{r.name}</div>
                      {r.nickname && <div className="text-xs text-[#ff79c6] truncate">@{r.nickname}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed z-50 w-40 bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl shadow-xl py-1 overflow-hidden"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: contextMenu.x }}
          onClick={() => setContextMenu(null)}
        >
          {(() => {
            const c = conversations.find(x => x.id === contextMenu.id);
            if (!c) return null;
            return (
              <>
                <button 
                  onClick={() => {
                    communicationApi.updateChatState(c.id, { is_pinned: !c.is_pinned }).then(() => loadConversations());
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                >
                  <Pin className="w-4 h-4" />
                  {c.is_pinned ? 'Unpin Chat' : 'Pin Chat'}
                </button>
                <button 
                  onClick={() => {
                    communicationApi.updateChatState(c.id, { is_hidden: !c.is_hidden }).then(() => loadConversations());
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                >
                  <EyeOff className="w-4 h-4" />
                  {c.is_hidden ? 'Unarchive' : 'Archive'}
                </button>
                {c.type === 'direct' && (
                  <>
                    <button 
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: "Delete Chat History",
                          message: "Are you sure you want to delete this chat history for yourself?",
                          type: "destructive",
                          confirmText: "Delete"
                        });
                        if (confirmed) {
                          communicationApi.clearDMHistory(c.id).then(() => {
                            if (activeConvId === c.id) setActiveConvId(null);
                            loadConversations();
                          });
                        }
                      }}
                      className="w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-white/5 hover:text-red-300 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Chat
                    </button>
                    {contextMenu.targetId && (
                      (() => {
                        const targetMember = c.members?.find((m: any) => m.id === contextMenu.targetId);
                        if (targetMember?.is_blocked_by_me) {
                          return (
                            <button 
                              onClick={() => {
                                 communicationApi.unblockUser(contextMenu.targetId!).then(() => {
                                   showToast("User unblocked successfully", "success");
                                   loadConversations();
                                 });
                               }}
                              className="w-full px-4 py-2 text-sm text-left text-green-500 hover:bg-white/5 hover:text-green-400 flex items-center gap-2"
                            >
                              <UserCircle className="w-4 h-4" />
                              Unblock User
                            </button>
                          );
                        } else {
                          return (
                            <button 
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: "Block User",
                                  message: "Are you sure you want to block this user?",
                                  type: "destructive",
                                  confirmText: "Block"
                                });
                                if (confirmed) {
                                  communicationApi.blockUser(contextMenu.targetId!).then(() => {
                                    showToast("User blocked successfully", "success");
                                    loadConversations();
                                  });
                                }
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-white/5 hover:text-red-400 flex items-center gap-2"
                            >
                              <UserCircle className="w-4 h-4" />
                              Block User
                            </button>
                          );
                        }
                      })()
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* WebRTC Call Overlay */}
      {activeCallConvId && (
        <CallOverlay 
          activeConvId={activeCallConvId}
          conversations={conversations}
          localStream={localStream}
          remoteStreams={remoteStreams}
          onEndCall={handleEndCall}
          onToggleAudio={toggleLocalAudio}
          onToggleVideo={toggleLocalVideo}
          onSetVolume={setRemoteVolume}
          currentUserId={user?.id ? Number(user.id) : undefined}
        />
      )}

      {/* Incoming Call Popup */}
      {incomingCall && (() => {
        const conv = conversations.find(c => c.id === incomingCall.conversationId);
        const caller = conv?.members?.find((m: any) => m.user_id === incomingCall.senderId)?.user;
        const callerName = caller?.name || caller?.nickname || 'Someone';
        const convName = conv?.type === 'direct' ? 'Direct Message' : `#${conv?.name || 'Group Chat'}`;
        
        return (
          <div className="fixed top-6 right-6 z-[1000] w-80 bg-[#12121a]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4 animate-fade-in flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center overflow-hidden shrink-0">
                {caller?.pfp_url ? (
                  <img src={caller.pfp_url} alt="pfp" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold text-white truncate">{callerName}</h4>
                <p className="text-xs text-[#a0a0b0] truncate">Incoming call in {convName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button 
                onClick={() => setIncomingCall(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button 
                onClick={acceptCall}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10b981] hover:bg-[#059669] text-white transition-colors cursor-pointer flex items-center gap-1 shadow-lg shadow-[#10b981]/25"
              >
                <Phone className="w-3.5 h-3.5" />
                Answer
              </button>
            </div>
          </div>
        );
      })()}

      {/* ID Card Modal */}
      {showIdCardModal && hoveredProfile && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative animate-fade-in">
            <button 
              onClick={() => setShowIdCardModal(false)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-[#1e1e2d] border border-[#2a2a3e] text-[#6b6b7b] hover:text-white transition-colors cursor-pointer"
              title="Close ID Card"
            >
              <X className="w-5 h-5" />
            </button>
            <ReflectiveCard
              overlayColor="rgba(0, 0, 0, 0.45)"
              blurStrength={15}
              glassDistortion={0}
              metalness={0.5}
              roughness={0.3}
              displacementStrength={0}
              noiseScale={1.0}
              specularConstant={1.0}
              grayscale={0}
              color="#ffffff"
              userName={hoveredProfile.name?.toUpperCase() || hoveredProfile.nickname?.toUpperCase()}
              userRole={hoveredProfile.position?.toUpperCase() || "VISITOR"}
              userEmail={hoveredProfile.email}
              userPfp={hoveredProfile.pfp_url}
              userStatus={hoveredProfile.status || 'offline'}
              joinedDate={hoveredProfile.created_at}
              userRoomRole={hoveredProfile.room_role}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-[#0a0a0f] h-screen"><Spinner /></div>}>
      <ChatContent />
    </Suspense>
  );
}
