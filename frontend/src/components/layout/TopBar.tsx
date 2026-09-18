'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { communicationApi, authApi, roomApi } from '@/lib/api';
import { Search, Bell, LogOut, User, ChevronDown, MessageSquare, Settings, Menu, Server } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export default function TopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { user, logout } = useAuth();
  const { activeRoom, fetchRooms } = useRoom();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<any>(null);

  // Custom Modal Confirmation and Error Dialogs
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const showErrorModal = (title: string, message: string) => {
    setErrorModal({
      isOpen: true,
      title,
      message
    });
  };

  const handleLeaveWorkspace = () => {
    if (!activeRoom) return;

    // Step 1: First Confirmation
    showConfirm(
      "Leave Workspace",
      `Are you sure you want to leave the workspace "${activeRoom.name}"?`,
      () => {
        // Step 2: Second Confirmation (2-step confirm)
        showConfirm(
          "Confirm Permanent Leave",
          `WARNING: This action is permanent and you will lose all access. Do you really want to leave?`,
          async () => {
            try {
              setShowUserMenu(false);
              await roomApi.leave(activeRoom.id);
              await fetchRooms();
              router.push('/rooms');
            } catch (err: any) {
              showErrorModal("Failed to Leave Workspace", err.response?.data?.detail || 'Failed to leave workspace.');
            }
          }
        );
      }
    );
  };

  useEffect(() => {
    if (!user) return;
    
    // Fetch initial notifications
    communicationApi.getNotifications()
      .then(res => setNotifications(res.data))
      .catch(console.error);
      
    // Listen for real-time notifications from other components (like Chat)
    const handleNewNotif = (e: any) => {
      setNotifications(prev => [e.detail, ...prev]);
      // Show toast
      setActiveToast(e.detail);
      setTimeout(() => setActiveToast(null), 5000); // Hide after 5s
    };
    
    window.addEventListener('new_notification', handleNewNotif);
    return () => window.removeEventListener('new_notification', handleNewNotif);
  }, [user]);

  const handleMarkRead = async () => {
    try {
      await communicationApi.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const [showDmMenu, setShowDmMenu] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [dmSearchValue, setDmSearchValue] = useState('');
  const [creatingDm, setCreatingDm] = useState(false);

  useEffect(() => {
    if (showDmMenu && users.length === 0) {
      authApi.users().then(res => {
        // Filter out the current user
        setUsers(res.data.filter((u: any) => u.id !== user?.id));
      }).catch(console.error);
    }
  }, [showDmMenu, user]);

  const handleStartDm = async (targetUserId: number) => {
    try {
      setCreatingDm(true);
      const res = await communicationApi.createDirectConversation(targetUserId);
      setShowDmMenu(false);
      window.location.href = `/chat?convId=${res.data.id}`;
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingDm(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <header className="h-16 border-b border-[#2a2a3e] bg-[#0a0a0f]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-50">
      {/* Mobile Menu Toggle */}
      <div className="flex items-center mr-3 md:hidden">
        <button onClick={onMobileMenuToggle} className="text-[#6b6b7b] hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
          <input
            type="text"
            placeholder="Search entities, documents, relationships..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] transition-colors"
          />
        </div>
      </form>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-4">
        {/* Team Chat / DMs */}
        <div className="relative">
          <button 
            onClick={() => { setShowDmMenu(!showDmMenu); setShowNotifMenu(false); setShowUserMenu(false); }}
            className={`relative p-2 rounded-lg transition-colors ${showDmMenu ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-[#6b6b7b] hover:text-white'}`}
            title="Start a Direct Message"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          
          {showDmMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDmMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#12121a] border border-[#2a2a3e] rounded-xl shadow-xl py-2 animate-fade-in z-50">
                <div className="px-4 py-2 border-b border-[#2a2a3e] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Direct Messages</h3>
                  <Link href="/chat" onClick={() => setShowDmMenu(false)} className="text-[10px] text-[#ff79c6] uppercase tracking-wide hover:underline">
                    Go to Chat
                  </Link>
                </div>
                <div className="p-2 border-b border-[#2a2a3e]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b7b]" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={dmSearchValue}
                      onChange={(e) => setDmSearchValue(e.target.value)}
                      className="w-full bg-[#1e1e2d] border border-[#2a2a3e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] transition-colors"
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {users
                    .filter(u => u.name.toLowerCase().includes(dmSearchValue.toLowerCase()) || (u.nickname && u.nickname.toLowerCase().includes(dmSearchValue.toLowerCase())))
                    .map(u => (
                      <button
                        key={u.id}
                        disabled={creatingDm}
                        onClick={() => handleStartDm(u.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#2a2a3e] overflow-hidden shrink-0 border border-[#2a2a3e]">
                          {u.pfp_url ? <img src={u.pfp_url} alt="pfp" className="w-full h-full object-cover" /> : <User className="w-full h-full text-[#6b6b7b] p-1.5" />}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm text-white font-medium truncate">{u.name}</span>
                          {u.nickname && <span className="text-[10px] text-[#a0a0b0] truncate">@{u.nickname}</span>}
                        </div>
                      </button>
                    ))}
                  {users.length === 0 && (
                    <div className="px-4 py-3 text-center text-xs text-[#6b6b7b]">Loading users...</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => { setShowNotifMenu(!showNotifMenu); setShowUserMenu(false); }}
            className={`relative p-2 rounded-lg transition-colors ${showNotifMenu ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-[#6b6b7b] hover:text-white'}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ef4444] rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            )}
          </button>

          {showNotifMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#12121a] border border-[#2a2a3e] rounded-xl shadow-xl py-2 animate-fade-in z-50">
                <div className="px-4 py-2 border-b border-[#2a2a3e] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkRead} className="text-xs text-[#ff79c6] hover:text-[#ff92df]">Mark all read</button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto py-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Bell className="w-8 h-8 text-[#2a2a3e] mx-auto mb-2" />
                      <p className="text-sm text-[#6b6b7b]">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.map((notif: any, idx: number) => (
                      <Link href={notif.link_url || '#'} key={idx} onClick={() => setShowNotifMenu(false)} className={`block px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-[#2a2a3e] last:border-0 ${!notif.is_read ? 'bg-[#ff79c6]/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <p className={`text-sm ${!notif.is_read ? 'text-white font-medium' : 'text-[#e0e0e0]'}`}>{notif.content}</p>
                          {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[#ff79c6] mt-1.5 ml-2 shrink-0" />}
                        </div>
                        <p className="text-xs text-[#6b6b7b] mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center overflow-hidden">
              {(user as any)?.pfp_url ? (
                <img src={(user as any).pfp_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <span className="text-sm text-[#a0a0b0] hidden md:block">{(user as any)?.nickname || user?.name || 'User'}</span>
            <ChevronDown className="w-3 h-3 text-[#6b6b7b] hidden md:block" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#12121a] border border-[#2a2a3e] rounded-xl shadow-xl py-1 animate-fade-in z-50">
                <div className="px-4 py-2 border-b border-[#2a2a3e]">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-[#6b6b7b]">{user?.email}</p>
                </div>
                <Link
                  href="/settings/profile"
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#a0a0b0] hover:bg-white/5 hover:text-white transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  Profile Settings
                </Link>
                <Link
                  href="/rooms"
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#a0a0b0] hover:bg-white/5 hover:text-white transition-colors border-b border-[#2a2a3e]/50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Server className="w-4 h-4" />
                  Switch Data Room
                </Link>
                {activeRoom && (
                  <button
                    onClick={handleLeaveWorkspace}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-400 hover:bg-white/5 hover:text-white transition-colors border-t border-[#2a2a3e]/50"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave Workspace
                  </button>
                )}
                <button
                  onClick={logout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#ef4444] hover:bg-white/5 transition-colors border-t border-[#2a2a3e]/50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    {/* Toast Notification Popup */}
    {activeToast && (
      <div className="fixed bottom-6 right-6 bg-glass-surface backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl z-[9999] animate-fade-in max-w-sm flex items-start gap-3 transform transition-all hover:scale-105 cursor-pointer" onClick={() => { setActiveToast(null); if (activeToast.link_url) router.push(activeToast.link_url); }}>
        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-1">New Notification</h4>
          <p className="text-white/80 text-sm line-clamp-2">{activeToast.content}</p>
        </div>
        <button className="text-white/40 hover:text-white/80 ml-auto" onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    )}

    {/* Reusable Confirm Modal */}
    <Modal 
      isOpen={confirmModal.isOpen} 
      onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
      title={confirmModal.title}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-[#a0a0b0] text-sm">{confirmModal.message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            className="text-[#a0a0b0] border-[#2a2a3e] hover:bg-[#2a2a3e]/30"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
              confirmModal.onConfirm();
            }}
            className="bg-red-500 hover:bg-red-600 text-white border-0"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>

    {/* Reusable Error/Warning Modal */}
    <Modal 
      isOpen={errorModal.isOpen} 
      onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))} 
      title={errorModal.title}
      size="sm"
    >
      <div className="space-y-4">
        <div className="text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20 leading-relaxed font-medium">
          {errorModal.message}
        </div>
        <div className="flex justify-end pt-2">
          <Button 
            onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
            className="bg-[#2a2a3e] hover:bg-[#2a2a3e]/80 text-white border-0"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
