import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KnowledgeDocument } from './knowledge-types';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface KnowledgeStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  addSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  addMessage: (sessionId: string, message: Message) => void;
  documents: KnowledgeDocument[];
  lastDocsFetch: number | null;
  setDocuments: (docs: KnowledgeDocument[]) => void;
  clearDocsCache: () => void;
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: null,
      addSession: (session) => set((state) => ({ 
        sessions: [session, ...state.sessions] 
      })),
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map((s) => s.id === sessionId ? { ...s, ...updates } : s)
      })),
      deleteSession: (sessionId) => set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
      })),
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      addMessage: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId 
            ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() } 
            : s
        )
      })),
      documents: [],
      lastDocsFetch: null,
      setDocuments: (docs) => set({ 
        documents: docs, 
        lastDocsFetch: Date.now() 
      }),
      clearDocsCache: () => set({ 
        documents: [], 
        lastDocsFetch: null 
      }),
    }),
    {
      name: 'agile-space-knowledge-store',
    }
  )
);
