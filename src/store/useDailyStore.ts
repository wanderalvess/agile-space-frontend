import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dailyFlowApi } from '@/app/daily-flow/api';

export interface Task {
  id: string;
  title: string;
  category?: string;
}

export interface Worklog {
  id: string;
  userId: string;
  taskId?: string;
  title: string;
  durationMinutes: number;
  timestamp: string;
  isJira: boolean;
  date: string; // YYYY-MM-DD
  jiraStatus: 'pendente' | 'lançado';
}

interface DailyStoreState {
  activeTaskId: string | null;
  worklogs: Worklog[];
  selectedDate: string;
  tasks: Task[];
  weeklyWorklogs: Worklog[];
  dailyReports: any[];
  isLoadingWorklogs: boolean;
  
  setActiveTaskId: (id: string | null) => void;
  setSelectedDate: (date: string) => void;
  setTasks: (tasks: Task[]) => void;
  
  fetchWorklogs: (firestore: any, userId: string, date: string) => Promise<void>;
  fetchWeeklyWorklogs: (firestore: any, userId: string) => Promise<void>;
  fetchDailyReports: (firestore: any, userId: string) => Promise<void>;
  addWorklogFirebase: (
    firestore: any, 
    userId: string, 
    log: { taskId?: string; title: string; durationMinutes: number }
  ) => Promise<void>;
  deleteWorklogFirebase: (firestore: any, id: string) => Promise<void>;
  updateWorklogFirebase: (
    firestore: any,
    id: string,
    durationMinutes: number
  ) => Promise<void>;
  addTask: (title: string, category?: string) => void;
  reset: () => void;
}

export const useDailyStore = create<DailyStoreState>()(
  persist(
    (set, get) => ({
      activeTaskId: null,
      selectedDate: (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      tasks: [],
      worklogs: [],
      weeklyWorklogs: [],
      dailyReports: [],
      isLoadingWorklogs: false,

      setActiveTaskId: (id) => set({ activeTaskId: id }),
      
      setSelectedDate: (date) => set({ selectedDate: date }),

      setTasks: (tasks) => set({ tasks }),
      
      fetchWorklogs: async (firestore, userId, date) => {
        set({ isLoadingWorklogs: true });
        try {
          const logs = await dailyFlowApi.listWorklogs(userId, date);
          logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          set({ worklogs: logs });
        } catch (err) {
          console.error('Erro ao buscar worklogs:', err);
        } finally {
          set({ isLoadingWorklogs: false });
        }
      },

      fetchWeeklyWorklogs: async (firestore, userId) => {
        const today = new Date();
        const currentDay = today.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(today);
        monday.setDate(today.getDate() + distanceToMonday);

        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayStr = String(d.getDate()).padStart(2, '0');
          weekDates.push(`${y}-${m}-${dayStr}`);
        }

        try {
          const logs = await dailyFlowApi.listWeeklyWorklogs(userId, weekDates);
          set({ weeklyWorklogs: logs });
        } catch (err) {
          console.error('Erro ao buscar worklogs semanais:', err);
        }
      },

      fetchDailyReports: async (firestore, userId) => {
        try {
          const reports = await dailyFlowApi.listDailyReports(userId);
          reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          set({ dailyReports: reports });
        } catch (err) {
          console.error('Erro ao buscar daily reports:', err);
        }
      },

      addWorklogFirebase: async (firestore, userId, log) => {
        const isJira = !!(log.taskId && /^[A-Z0-9]+-\d+/i.test(log.taskId) && !log.taskId.startsWith('TASK-'));
        const docId = `${userId}_${Date.now()}`;
        const timestamp = new Date().toISOString();
        const date = get().selectedDate;

        const newLog: Worklog = {
          id: docId,
          userId,
          taskId: log.taskId || '',
          title: log.title,
          durationMinutes: log.durationMinutes,
          timestamp,
          isJira,
          date,
          jiraStatus: 'pendente'
        };

        try {
          const saved = await dailyFlowApi.saveOrUpdateWorklog(newLog);
          set(state => ({
            worklogs: [saved, ...state.worklogs],
            weeklyWorklogs: [saved, ...state.weeklyWorklogs]
          }));
        } catch (err) {
          console.error('Erro ao adicionar worklog no Spring Boot:', err);
          throw err;
        }
      },

      updateWorklogFirebase: async (firestore, id, durationMinutes) => {
        try {
          const currentLog = get().worklogs.find(w => w.id === id) || get().weeklyWorklogs.find(w => w.id === id);
          if (!currentLog) throw new Error('Worklog local não encontrado para atualização');
          
          const updatedLog = { ...currentLog, durationMinutes };
          const saved = await dailyFlowApi.saveOrUpdateWorklog(updatedLog);
          
          set(state => ({
            worklogs: state.worklogs.map(w => w.id === id ? saved : w),
            weeklyWorklogs: state.weeklyWorklogs.map(w => w.id === id ? saved : w)
          }));
        } catch (err) {
          console.error('Erro ao atualizar worklog no Spring Boot:', err);
          throw err;
        }
      },

      deleteWorklogFirebase: async (firestore, id) => {
        try {
          await dailyFlowApi.deleteWorklog(id);
          
          set(state => ({
            worklogs: state.worklogs.filter(w => w.id !== id),
            weeklyWorklogs: state.weeklyWorklogs.filter(w => w.id !== id)
          }));
        } catch (err) {
          console.error('Erro ao deletar worklog do Spring Boot:', err);
          throw err;
        }
      },

      addTask: (title, category = 'Codificação') => set((state) => {
        const isJiraPattern = /^[A-Z]+-\d+/i.test(title);
        const id = isJiraPattern ? title.split(' ')[0].toUpperCase() : `TASK-${Date.now()}`;
        const cleanTitle = isJiraPattern ? title.replace(/^[A-Z]+-\d+\s*/i, '') : title;
        
        const newTask: Task = {
          id,
          title: cleanTitle,
          category
        };
        return {
          tasks: [...state.tasks, newTask]
        };
      }),

      reset: () => set({
        activeTaskId: null,
        worklogs: [],
        tasks: [],
        weeklyWorklogs: [],
        dailyReports: []
      })
    }),
    {
      name: 'agile-space-daily-flow-store',
      partialize: (state) => ({
        tasks: state.tasks,
        activeTaskId: state.activeTaskId
      })
    }
  )
);
