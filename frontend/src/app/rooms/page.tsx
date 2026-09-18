'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { roomApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, LogIn, LogOut, Loader2, ArrowRight, Server, ShieldCheck, Trash2 } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import Threads from '@/components/ui/Threads';
import SplitText from '@/components/ui/SplitText';

export default function RoomsPage() {
  const { user, logout } = useAuth();
  const { rooms, pendingRooms, switchRoom, fetchRooms, loading } = useRoom();
  const router = useRouter();

  const [isJoinModalOpen, setJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [switchingId, setSwitchingId] = useState<number | null>(null);

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

  const handleSwitchRoom = async (roomId: number) => {
    setSwitchingId(roomId);
    try {
      await switchRoom(roomId);
    } catch (err) {
      setSwitchingId(null);
    }
  };

  const handleDeleteRoom = (roomId: number, roomName: string) => {
    showConfirm(
      "Delete Workspace",
      `Are you sure you want to permanently delete the workspace "${roomName}"? This will delete all documents, chat logs, and cannot be undone.`,
      async () => {
        try {
          await roomApi.delete(roomId);
          await fetchRooms();
        } catch (err: any) {
          showErrorModal("Failed to Delete Workspace", err.response?.data?.detail || 'Failed to delete workspace.');
        }
      }
    );
  };

  const handleLeaveRoom = (roomId: number, roomName: string) => {
    // Step 1: First Confirmation
    showConfirm(
      "Leave Workspace",
      `Are you sure you want to leave the workspace "${roomName}"?`,
      () => {
        // Step 2: Second Confirmation (2-step confirm)
        showConfirm(
          "Confirm Permanent Leave",
          `WARNING: This action is permanent and you will lose all access. Do you really want to leave?`,
          async () => {
            try {
              await roomApi.leave(roomId);
              await fetchRooms();
            } catch (err: any) {
              showErrorModal("Failed to Leave Workspace", err.response?.data?.detail || 'Failed to leave workspace.');
            }
          }
        );
      }
    );
  };

  useEffect(() => {
    const handleApproved = () => {
      fetchRooms();
    };
    window.addEventListener('room_approved', handleApproved);
    return () => window.removeEventListener('room_approved', handleApproved);
  }, [fetchRooms]);

  const handleJoin = async () => {
    try {
      setError('');
      setActionLoading(true);
      await roomApi.join({ invite_code: inviteCode });
      await fetchRooms();
      setJoinModalOpen(false);
      setInviteCode('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join room. Invalid code?');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError('');
      setActionLoading(true);
      await roomApi.create({ name: roomName, description: roomDesc });
      await fetchRooms();
      setCreateModalOpen(false);
      setRoomName('');
      setRoomDesc('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create room.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff79c6]" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0a0a0f] flex flex-col relative overflow-y-auto">
      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-[#ff79c6]/15 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-[#d68eff]/15 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 opacity-45">
          <Threads
            amplitude={1.2}
            distance={0.3}
            enableMouseInteraction={true}
            color={[0.388, 0.4, 0.945]}
          />
        </div>
      </div>

      <header className="p-6 flex justify-between items-center relative z-10 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg border border-white/10">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Unified Intelligence</span>
        </div>
        <button 
          onClick={logout}
          className="text-[#6b6b7b] hover:text-white flex items-center gap-2 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6 relative z-10 w-full max-w-6xl mx-auto pt-10 md:pt-20 pb-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <SplitText
            text={`Welcome back, ${user?.name ? user.name.split(' ')[0] : 'user'}`}
            className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight"
            delay={30}
            duration={0.6}
            ease="power3.out"
            textAlign="left"
            tag="h1"
          />
          <p className="text-lg text-[#a0a0b0]">Select a workspace to continue or join a new one.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full mb-12">
          {rooms.map((room, idx) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22, delay: idx * 0.06 }}
            >
              <GlassCard 
                className="h-full cursor-pointer group hover:border-[#ff79c6]/50 hover:bg-[#1a1a2e]/60 transition-all duration-300"
                onClick={() => handleSwitchRoom(room.id)}
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 rounded-xl bg-[#2a2a3e] border border-[#3f3f5a] flex items-center justify-center mb-4 group-hover:bg-[#ff79c6]/20 group-hover:border-[#ff79c6]/40 transition-colors">
                    <LayoutGrid className="w-6 h-6 text-[#a0a0b0] group-hover:text-[#ff92df] transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{room.name}</h3>
                  <p className="text-[#a0a0b0] text-sm flex-1 line-clamp-2">
                    {room.description || 'No description provided.'}
                  </p>
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#2a2a3e] text-[#a0a0b0] capitalize">
                        {room.role}
                      </span>
                      {room.role === 'admin' ? (
                        <button
                          title="Delete Workspace"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id, room.name);
                          }}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          title="Leave Workspace"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveRoom(room.id, room.name);
                          }}
                          className="p-1.5 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#4b4b6b] group-hover:text-[#ff79c6] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}

          {/* Pending Rooms */}
          {pendingRooms.map((pending, idx) => (
            <motion.div
              key={pending.room_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (rooms.length + idx) * 0.1 }}
            >
              <GlassCard className="h-full border-dashed border-[#3f3f5a] opacity-60">
                <div className="p-6 flex flex-col h-full items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
                    <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1">Approval Pending</h3>
                  <p className="text-sm text-[#a0a0b0]">Waiting for an admin to approve your request.</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <button
            onClick={() => setJoinModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-[#12121a] border border-[#2a2a3e] text-white hover:bg-[#1a1a2e] hover:border-[#3f3f5a] transition-all shadow-lg"
          >
            <LogIn className="w-5 h-5 text-[#ff92df]" />
            <span className="font-medium">Join Workspace</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff79c6] to-[#d68eff] text-white hover:opacity-90 transition-all shadow-lg shadow-[#ff79c6]/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create New Workspace</span>
          </button>
        </motion.div>
      </main>

      {/* Join Modal */}
      <Modal isOpen={isJoinModalOpen} onClose={() => { setJoinModalOpen(false); setError(''); }} title="Join Workspace">
        <div className="space-y-4">
          <p className="text-[#a0a0b0] text-sm">Enter the invite code provided by the workspace administrator.</p>
          <Input 
            label="Invite Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="e.g. A1B2C3D4"
          />
          {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
          <div className="flex justify-end pt-4">
            <Button onClick={handleJoin} disabled={!inviteCode || actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Join Workspace'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => { setCreateModalOpen(false); setError(''); }} title="Create Workspace">
        <div className="space-y-4">
          <p className="text-[#a0a0b0] text-sm">Create a new isolated data room. You can create up to 2 workspaces.</p>
          <Input 
            label="Workspace Name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Engineering Dept..."
          />
          <Input 
            label="Description (Optional)"
            value={roomDesc}
            onChange={(e) => setRoomDesc(e.target.value)}
            placeholder="Brief description..."
          />
          {error && <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
          <div className="flex justify-end pt-4">
            <Button onClick={handleCreate} disabled={!roomName || actionLoading} className="w-full bg-gradient-to-r from-[#ff79c6] to-[#d68eff] border-0">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Workspace'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Connecting/Switching Portal Overlay */}
      <AnimatePresence>
        {switchingId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0a0a0f]/90 backdrop-blur-2xl z-50 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              className="relative flex flex-col items-center max-w-sm px-6 text-center"
            >
              {/* Spinning particle rings effect */}
              <div className="absolute w-48 h-48 rounded-full border border-[#ff79c6]/30 border-t-[#ff79c6] animate-spin duration-[2s]" />
              <div className="absolute w-44 h-44 rounded-full border border-dashed border-[#d68eff]/20 animate-spin duration-[4s] reverse" />
              
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center shadow-lg shadow-[#ff79c6]/20 mb-8 relative z-10">
                <Server className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2 relative z-10">Connecting to Segment</h2>
              <p className="text-sm text-[#a0a0b0] relative z-10">Initializing isolated multi-tenant secure container...</p>
              <Loader2 className="w-6 h-6 animate-spin text-[#ff92df] mt-8 relative z-10" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
}
