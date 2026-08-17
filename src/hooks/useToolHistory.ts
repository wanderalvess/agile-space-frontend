'use client';

import { useState, useEffect } from 'react';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export interface RoomMeta {
  roomId: string;
  type: 'poker' | 'retro' | 'health' | 'brainstorming' | 'sprint-planner' | 'showcase' | 'action_plan';
  title: string;
  team: string;
  createdBy?: string;
  createdAt: string;
}

export function useToolHistory(type: RoomMeta['type']) {
  const [history, setHistory] = useState<RoomMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const saved = localStorage.getItem(ROOMS_META_KEY);
        if (saved) {
          const allRooms: RoomMeta[] = JSON.parse(saved);
          const filtered = allRooms
            .filter(room => room.type === type)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setHistory(filtered);
        }
      } catch (e) {
        console.error("Failed to load room history", e);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();

    // Listen for storage changes in other tabs
    window.addEventListener('storage', loadHistory);
    return () => window.removeEventListener('storage', loadHistory);
  }, [type]);

  const removeRoom = (roomId: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      if (saved) {
        const allRooms: RoomMeta[] = JSON.parse(saved);
        const updated = allRooms.filter(room => room.roomId !== roomId);
        localStorage.setItem(ROOMS_META_KEY, JSON.stringify(updated));
        setHistory(prev => prev.filter(r => r.roomId !== roomId));
      }
    } catch (e) {
      console.error("Failed to remove room from history", e);
    }
  };

  return { history, loading, removeRoom };
}
