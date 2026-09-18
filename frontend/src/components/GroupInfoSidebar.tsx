import React, { useState, useEffect } from 'react';
import { X, UserPlus, Settings, VolumeX, Volume2, Shield, Trash2, Edit2, Check } from 'lucide-react';
import { communicationApi, authApi } from '@/lib/api';
import { useDialog } from '@/context/DialogContext';

export default function GroupInfoSidebar({ conv, currentUser, onClose, onUpdate, onUploadFile }: { conv: any, currentUser: any, onClose: () => void, onUpdate: () => void, onUploadFile?: (file: File) => Promise<string | null> }) {
  const { confirm, showToast } = useDialog();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(conv.name || '');
  const [bio, setBio] = useState(conv.bio || '');
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  useEffect(() => {
    if (showAddMember) {
      authApi.users().then(res => {
        // Filter out users already in the group
        const existingIds = conv.members.map((m: any) => m.id);
        setAvailableUsers(res.data.filter((u: any) => !existingIds.includes(u.id)));
      }).catch(console.error);
    } else {
      setSelectedUserIds([]);
    }
  }, [showAddMember, conv.members]);

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      await communicationApi.addGroupMembers(conv.id, selectedUserIds);
      setShowAddMember(false);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const myMember = conv.members.find((m: any) => m.id === currentUser?.id);
  const isAdmin = myMember?.role === 'admin';

  const handleUpdateProfile = async () => {
    try {
      await communicationApi.updateGroupProfile(conv.id, { name, bio });
      setEditing(false);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;
    try {
      const url = await onUploadFile(file);
      if (url) {
        // extract the actual URL from the markdown markdown [Attachment: ...] (url) if needed, but onUploadFile returns markdown.
        // Wait, the API `uploadFileAndGetContent` returns `markdown`. But `data.url` is what we actually want for PFP.
        // Let's just use a direct fetch here to be clean.
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKick = async (userId: number) => {
    const confirmed = await confirm({
      title: "Kick User",
      message: "Are you sure you want to kick this user?",
      type: "destructive",
      confirmText: "Kick"
    });
    if (!confirmed) return;
    try {
      await communicationApi.removeGroupMember(conv.id, userId);
      onUpdate();
      showToast("User kicked from group", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to kick user", "error");
    }
  };

  const handleToggleMute = async (userId: number, currentMute: boolean) => {
    try {
      await communicationApi.muteGroupMember(conv.id, userId, !currentMute);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAdmin = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await communicationApi.updateMemberRole(conv.id, userId, newRole);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-80 bg-[#12121a] border-l border-[#2a2a3e] flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-[#2a2a3e] flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Group Info</h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex flex-col items-center border-b border-[#2a2a3e]">
        <div className="relative group/pfp mb-4">
          <img src={conv.pfp_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${conv.id}`} className="w-24 h-24 rounded-full bg-[#2a2a3e] object-cover" />
          {isAdmin && (
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover/pfp:opacity-100 cursor-pointer transition-opacity">
              <span className="text-xs text-white font-medium">Change</span>
              <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  const token = localStorage.getItem('auth_token');
                  const res = await fetch('/api/communication/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                  });
                  if (res.ok) {
                    const data = await res.json();
                    await communicationApi.updateGroupProfile(conv.id, { pfp_url: data.url });
                    onUpdate();
                  }
                } catch (e) { console.error(e); }
              }} />
            </label>
          )}
        </div>
        
        {editing ? (
          <div className="w-full space-y-3">
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-[#1e1e2d] border border-[#2a2a3e] rounded p-2 text-white text-sm focus:outline-none focus:border-[#ff79c6]"
              placeholder="Group Name"
            />
            <textarea 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              className="w-full bg-[#1e1e2d] border border-[#2a2a3e] rounded p-2 text-white text-sm focus:outline-none focus:border-[#ff79c6] min-h-[60px]"
              placeholder="Group Bio..."
            />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 px-3 py-1 text-xs text-gray-400 bg-[#1e1e2d] hover:bg-[#2a2a3e] rounded">Cancel</button>
              <button onClick={handleUpdateProfile} className="flex-1 px-3 py-1 text-xs text-white bg-[#ff79c6] hover:bg-[#ff92df] rounded">Save</button>
            </div>
          </div>
        ) : (
          <div className="text-center w-full relative group">
            <h3 className="text-xl font-bold text-white mb-1">{conv.name}</h3>
            <p className="text-sm text-gray-400">{conv.bio || 'No bio set.'}</p>
            {isAdmin && (
              <button onClick={() => setEditing(true)} className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Members ({conv.members?.length})</h4>
          {isAdmin && (
            <button 
              onClick={() => setShowAddMember(!showAddMember)}
              className={`p-1 transition-colors rounded ${showAddMember ? 'bg-[#ff79c6] text-white' : 'text-[#ff79c6] hover:text-[#ff92df] hover:bg-[#ff79c6]/10'}`}
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
        </div>

        {showAddMember && (
          <div className="mb-4 bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl p-3">
            <h5 className="text-xs font-semibold text-gray-400 mb-2 uppercase">Select Users to Add</h5>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
              {availableUsers.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">No users available.</p>
              ) : availableUsers.map(u => (
                <div 
                  key={u.id}
                  onClick={() => {
                    setSelectedUserIds(prev => 
                      prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                    )
                  }}
                  className="flex items-center gap-2 p-1.5 hover:bg-[#2a2a3e] rounded cursor-pointer transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedUserIds.includes(u.id) ? 'bg-[#ff79c6] border-[#ff79c6]' : 'border-gray-500'}`}>
                    {selectedUserIds.includes(u.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-6 h-6 rounded-full" />
                  <span className="text-sm text-gray-300">{u.name}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={handleAddMembers}
              disabled={selectedUserIds.length === 0}
              className="w-full py-1.5 bg-[#ff79c6] hover:bg-[#ff92df] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
            >
              Add Selected ({selectedUserIds.length})
            </button>
          </div>
        )}

        <div className="space-y-3">
          {conv.members?.map((m: any) => (
            <div key={m.id} className="flex items-center group">
              <img src={m.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}`} className="w-10 h-10 rounded-full mr-3" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">{m.name}</span>
                  {m.role === 'admin' && <Shield className="w-3 h-3 text-yellow-500" />}
                  {m.is_server_muted && <VolumeX className="w-3 h-3 text-red-500" />}
                </div>
                <div className="text-gray-500 text-xs truncate">@{m.nickname || `user${m.id}`}</div>
              </div>

              {isAdmin && m.id !== currentUser?.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleToggleMute(m.id, m.is_server_muted)} className="p-1.5 hover:bg-[#2a2a3e] rounded text-gray-400 hover:text-white" title={m.is_server_muted ? "Unmute" : "Mute"}>
                    {m.is_server_muted ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
                  </button>
                  <button onClick={() => handleToggleAdmin(m.id, m.role)} className="p-1.5 hover:bg-[#2a2a3e] rounded text-gray-400 hover:text-yellow-500" title={m.role === 'admin' ? "Remove Admin" : "Make Admin"}>
                    <Shield className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleKick(m.id)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-500" title="Kick">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {isAdmin && (
        <div className="p-4 border-t border-[#2a2a3e]">
          <button 
            onClick={async () => {
              const confirmed = await confirm({
                title: "Delete Group",
                message: "Are you sure you want to completely DELETE this group? This cannot be undone.",
                type: "destructive",
                confirmText: "Delete"
              });
              if (confirmed) {
                try {
                  await communicationApi.deleteGroup(conv.id);
                  onClose();
                  onUpdate();
                  showToast("Group deleted successfully", "success");
                } catch (e) { 
                  console.error(e); 
                  showToast("Failed to delete group", "error");
                }
              }
            }}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Group
          </button>
        </div>
      )}
    </div>
  );
}
