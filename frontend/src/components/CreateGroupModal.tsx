import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { communicationApi, authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function CreateGroupModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    authApi.users().then(res => setUsers(res.data)).catch(console.error);
  }, []);

  const filteredUsers = users.filter(u => u.id !== user?.id);

  const toggleUser = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await communicationApi.createGroup(name, selectedIds);
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#12121a] rounded-2xl w-full max-w-md border border-[#2a2a3e] flex flex-col max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-[#2a2a3e] flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Create Group Chat</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <label className="block text-sm font-medium text-gray-400 mb-1">Group Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            placeholder="E.g. The Squad"
            className="w-full bg-[#1e1e2d] border border-[#2a2a3e] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#ff79c6] mb-6"
          />

          <label className="block text-sm font-medium text-gray-400 mb-2">Select Members</label>
          <div className="space-y-2">
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => toggleUser(u.id)}
                className={`flex items-center p-2 rounded-lg cursor-pointer border ${selectedIds.includes(u.id) ? 'border-[#ff79c6] bg-[#ff79c6]/10' : 'border-transparent hover:bg-white/5'}`}
              >
                <img src={u.pfp_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-8 h-8 rounded-full mr-3" />
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{u.name}</div>
                  <div className="text-gray-500 text-xs">@{u.nickname || `user${u.id}`}</div>
                </div>
                {selectedIds.includes(u.id) && <Check className="w-5 h-5 text-[#ff79c6]" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[#2a2a3e] flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white mr-2"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="bg-[#ff79c6] hover:bg-[#ff92df] disabled:opacity-50 text-white px-6 py-2 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
