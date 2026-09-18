"use client";
import React, { useState, useEffect } from 'react';
import { UserCircle, MoreVertical, MessageSquare, X, Loader2, Share2 } from 'lucide-react';
import { profileApi, communicationApi, authApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/context/DialogContext';
import { useAuth } from '@/hooks/useAuth';

export default function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { confirm, showToast } = useDialog();

  // Profile Popover state
  const [hoveredUserId, setHoveredUserId] = useState<number | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<any>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;

    // Fetch all users, then fetch real online IDs and merge
    profileApi.getAllUsers().then(async (res) => {
      if (!isMounted) return;
      const allUsers = res.data;

      // Get actual online user IDs from presence system
      let onlineIds: Set<number> = new Set();
      try {
        const onlineRes = await authApi.online();
        const onlineList: { id: number }[] = onlineRes.data?.online_users ?? [];
        onlineIds = new Set(onlineList.map((u) => u.id));
      } catch (_) {}

      // Merge: mark truly online users, everyone else is offline
      // AI assistant is always online (virtual user, no real WS session)
      const merged = allUsers.map((u: any) => ({
        ...u,
        status: u.email === 'ai@system.local' ? 'online' : onlineIds.has(u.id) ? 'online' : 'offline',
      }));

      setUsers(merged);
      setLoading(false);
    });

    const connectWebSocket = () => {
      if (!currentUser) return;
      let wsUrl = '';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl && !apiUrl.includes('backend') && !apiUrl.includes('localhost')) {
        const isSecure = apiUrl.startsWith('https:');
        wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${apiUrl.replace(/^https?:\/\//, '')}/api/communication/ws/${currentUser.id}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        wsUrl = `${protocol}//${hostname}${port}/api/communication/ws/${currentUser.id}`;
      }

      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'presence_update') {
          if (isMounted) {
            setUsers(prev => prev.map(u => u.id === data.user_id ? { ...u, status: data.status } : u));
            setHoveredProfile((prev: any) => (prev && prev.id === data.user_id) ? { ...prev, status: data.status } : prev);
          }
        }
      };
      
      socket.onclose = () => {
        if (isMounted) {
          setTimeout(connectWebSocket, 3000);
        }
      };
    };

    if (currentUser) {
      connectWebSocket();
    }

    return () => {
      isMounted = false;
      if (socket) socket.close();
    };
  }, [currentUser?.id]);

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

  const handleAvatarClick = async (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHoveredUserId(userId);
    setHoveredProfile(null);
    try {
      const res = await profileApi.getOther(userId);
      setHoveredProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const closePopover = () => {
    setHoveredUserId(null);
    setHoveredProfile(null);
    setShowProfileDropdown(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-[#22c55e]';
      case 'away': return 'bg-[#fbbf24]';
      case 'dnd': return 'bg-[#ef4444]';
      default: return 'bg-[#6b6b7b]';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-accent-secondary/5 pointer-events-none" />
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary mb-6">Team Members</h2>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-2xl p-6 h-full relative overflow-hidden group">
      {/* Subtle light reflection effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-[64px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
      
      <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary mb-6 relative z-10">Team Members</h2>
      <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
        {users?.map((user) => (
          <div 
            key={user.id} 
            className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer profile-popover"
            onClick={(e) => handleAvatarClick(user.id, e)}
          >
            <div className="relative w-11 h-11 shrink-0">
              {user.pfp_url ? (
                <img src={user.pfp_url} alt="pfp" className="w-full h-full rounded-full object-cover shadow-sm" />
              ) : (
                <UserCircle className="w-full h-full text-slate-400 drop-shadow-sm" />
              )}
              <div 
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0B1120] ${
                  user.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-slate-500'
                }`}
                title={user.status}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100 truncate tracking-wide">{user.name}</p>
              {user.email !== 'ai@system.local' && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
              )}
            </div>
            <div className="shrink-0">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
                user.status === 'online' 
                  ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                {user.status === 'online' ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hoveredUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={closePopover}>
          <div 
            className="profile-popover bg-[#12121a] border border-[#2a2a3e] rounded-xl shadow-2xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto custom-scrollbar relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-white">User Profile</h3>
              <div className="flex items-center gap-1">
                {hoveredProfile && (
                  <div className="profile-dropdown-container relative">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowProfileDropdown(!showProfileDropdown); }} 
                      className="text-[#6b6b7b] hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showProfileDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                        {!hoveredProfile.is_blocked_by_me && (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              setShowProfileDropdown(false);
                              try {
                                const res = await communicationApi.createDirectConversation(hoveredProfile.id);
                                localStorage.setItem('activeConvId', res.data.id.toString());
                                router.push('/chat');
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
                          onClick={(e) => {
                            e.stopPropagation();
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              setShowProfileDropdown(false);
                              try {
                                await communicationApi.unblockUser(hoveredProfile.id);
                                showToast("User unblocked successfully", "success");
                                setHoveredProfile({...hoveredProfile, is_blocked_by_me: false});
                              } catch(e) {}
                            }} 
                            className="w-full px-3 py-2 text-sm text-left text-green-400 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                          >
                            <UserCircle className="w-3.5 h-3.5" /> Unblock User
                          </button>
                        ) : (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
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
                <button onClick={(e) => { e.stopPropagation(); closePopover(); }} className="text-[#6b6b7b] hover:text-white p-1 rounded hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button>
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
                      onClick={(e) => { e.stopPropagation(); if (hoveredProfile.pfp_url) setFullScreenImage(hoveredProfile.pfp_url); }}
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
                        onClick={e => e.stopPropagation()}
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
                    <div className="text-xs text-[#ef4444] bg-[#ef4444]/10 p-3 rounded-lg border border-[#ef4444]/20 text-center font-medium mt-5">
                      You have blocked this user.
                    </div>
                  ) : (
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      if (!hoveredProfile) return;
                      try {
                        const res = await communicationApi.createDirectConversation(hoveredProfile.id);
                        localStorage.setItem('activeConvId', res.data.id.toString());
                        router.push('/chat');
                      } catch (error: any) {
                        if (error.response?.status === 403) {
                          showToast(error.response?.data?.detail || "Cannot message this user (blocked)", "warning");
                        } else {
                          console.error("Failed to jump to DM:", error);
                        }
                      }
                    }} className="w-full mt-5 bg-[#ff79c6] hover:bg-[#ff92df] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#ff79c6]/20">
                      <MessageSquare className="w-4 h-4" /> Message
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setFullScreenImage(null)}
        >
          <img 
            src={fullScreenImage} 
            alt="Full screen profile" 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
          <button 
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
            onClick={() => setFullScreenImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
