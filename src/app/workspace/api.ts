import { KanbanCardData, StickyNote } from '@/components/workspace/types';
import { authFetch } from '@/lib/auth-client';

export interface QuickLink {
  id?: string;
  userId?: string;
  title: string;
  url: string;
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Workspace API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const workspaceApi = {
  // --- Kanban ---
  async getKanbanCards(userId: string): Promise<KanbanCardData[]> {
    const list = await req<any[]>(`/workspace/${userId}/kanban`);
    return list.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate,
      tag: item.tag,
      originLink: item.originLink,
      exportedAt: item.exportedAt,
      updatedAt: item.updatedAt
    }));
  },

  async saveKanbanCard(userId: string, card: Partial<KanbanCardData>): Promise<KanbanCardData> {
    return req<KanbanCardData>(`/workspace/${userId}/kanban`, {
      method: 'POST',
      body: JSON.stringify(card)
    });
  },

  async deleteKanbanCard(id: string): Promise<void> {
    return req<void>(`/workspace/kanban/${id}`, { method: 'DELETE' });
  },

  // --- Sticky Notes ---
  async getStickyNotes(userId: string): Promise<StickyNote[]> {
    return req<StickyNote[]>(`/workspace/${userId}/notes`);
  },

  async saveStickyNote(userId: string, note: Partial<StickyNote>): Promise<StickyNote> {
    return req<StickyNote>(`/workspace/${userId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note)
    });
  },

  async deleteStickyNote(id: string): Promise<void> {
    return req<void>(`/workspace/notes/${id}`, { method: 'DELETE' });
  },

  // --- Quick Links ---
  async getQuickLinks(userId: string): Promise<QuickLink[]> {
    return req<QuickLink[]>(`/workspace/${userId}/links`);
  },

  async saveQuickLink(userId: string, link: Partial<QuickLink>): Promise<QuickLink> {
    return req<QuickLink>(`/workspace/${userId}/links`, {
      method: 'POST',
      body: JSON.stringify(link)
    });
  },

  async deleteQuickLink(id: string): Promise<void> {
    return req<void>(`/workspace/links/${id}`, { method: 'DELETE' });
  }
};
