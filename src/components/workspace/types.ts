export type KanbanStatus = 'todo' | 'doing' | 'done';
export type KanbanPriority = 'baixa' | 'media' | 'alta' | 'critica';

export interface KanbanCardData {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  priority: KanbanPriority;
  dueDate?: string;
  tag: string;
  originLink?: string;
  exportedAt?: string;
  updatedAt: string;
}

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface HistoryItem {
  id: string;
  roomId: string;
  type: 'poker' | 'retro' | 'health';
  title: string;
  team: string;
  creatorId: string;
  createdAt: string;
  participantIds?: string[];
  summary?: any;
}
