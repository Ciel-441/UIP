'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { roomApi } from '@/lib/api';
import { useAuth } from './useAuth';

export interface Room {
  id: number;
  name: string;
  description: string;
  role: 'admin' | 'analyst' | 'editor' | 'viewer';
  member_count: number;
  created_at: string;
}

export interface PendingRoom {
  id: number;
  room_id: number;
  room_name: string;
  created_at: string;
}

interface RoomContextType {
  activeRoomId: number | null;
  activeRoom: Room | null;
  myRole: 'admin' | 'analyst' | 'editor' | 'viewer' | null;
  rooms: Room[];
  pendingRooms: PendingRoom[];
  loading: boolean;
  switchRoom: (roomId: number) => void;
  fetchRooms: () => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

import { useRouter } from 'next/navigation';

export function RoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('active_room_id');
      if (stored) return parseInt(stored, 10);
    }
    return null;
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pendingRooms, setPendingRooms] = useState<PendingRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [approvedRes, pendingRes] = await Promise.all([
        roomApi.list(),
        roomApi.listPending()
      ]);
      const fetchedRooms = approvedRes.data.rooms || [];
      setRooms(fetchedRooms);
      setPendingRooms(pendingRes.data.pending || []);
      
      const serverActiveId = approvedRes.data.active_room_id;
      const storedActiveId = localStorage.getItem('active_room_id');
      
      if (serverActiveId) {
        setActiveRoomId(serverActiveId);
        localStorage.setItem('active_room_id', serverActiveId.toString());
      } else if (storedActiveId && fetchedRooms.find((r: Room) => r.id === parseInt(storedActiveId, 10))) {
        setActiveRoomId(parseInt(storedActiveId, 10));
      } else if (fetchedRooms.length > 0) {
        setActiveRoomId(fetchedRooms[0].id);
        localStorage.setItem('active_room_id', fetchedRooms[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      setLoading(true);
      fetchRooms().finally(() => setLoading(false));
    } else {
      setRooms([]);
      setPendingRooms([]);
      setActiveRoomId(null);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchRooms]);

  const switchRoom = async (roomId: number) => {
    try {
      await roomApi.setActive(roomId);
      setActiveRoomId(roomId);
      localStorage.setItem('active_room_id', roomId.toString());
      router.push('/dashboard'); 
    } catch (err) {
      console.error("Failed to set active room", err);
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;
  const myRole = activeRoom?.role || null;

  return React.createElement(
    RoomContext.Provider,
    {
      value: {
        activeRoomId,
        activeRoom,
        myRole,
        rooms,
        pendingRooms,
        loading,
        switchRoom,
        fetchRooms,
      },
    },
    children
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
