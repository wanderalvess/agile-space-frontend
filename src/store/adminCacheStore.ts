import { create } from 'zustand';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  getCountFromServer,
  Firestore
} from 'firebase/firestore';

export interface UnifiedSession {
  id: string;
  type: 'poker' | 'retro' | 'health' | 'brainstorm' | 'sprint_planning';
  title: string;
  creatorId: string;
  createdAt: any;
  participantCount?: number;
}

interface AdminCacheState {
  sessions: UnifiedSession[];
  lastFetchedSessions: number | null;
  isFetchingSessions: boolean;
  totalSessionsCount: number;

  users: any[];
  lastFetchedUsers: number | null;
  isFetchingUsers: boolean;
  totalUsersCount: number;

  fetchSessions: (firestore: Firestore, forceRefresh?: boolean) => Promise<void>;
  fetchUsers: (firestore: Firestore, forceRefresh?: boolean) => Promise<void>;
  
  removeSessionFromCache: (sessionId: string) => void;
  removeMultipleSessionsFromCache: (sessionIds: string[]) => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export const useAdminCacheStore = create<AdminCacheState>((set, get) => ({
  sessions: [],
  lastFetchedSessions: null,
  isFetchingSessions: false,
  totalSessionsCount: 0,

  users: [],
  lastFetchedUsers: null,
  isFetchingUsers: false,
  totalUsersCount: 0,

  fetchSessions: async (firestore: Firestore, forceRefresh = false) => {
    const { lastFetchedSessions, isFetchingSessions } = get();
    
    if (isFetchingSessions) return;
    
    const now = Date.now();
    const isCacheValid = lastFetchedSessions && (now - lastFetchedSessions < CACHE_TTL_MS);

    if (isCacheValid && !forceRefresh) {
      return; // Usa o cache
    }

    set({ isFetchingSessions: true });

    try {
      const fetchLimit = 100; // Trazemos um lote maior para o cache

      const [pokerSnap, retroSnap, healthSnap, brainstormSnap, planningSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'rooms'), limit(fetchLimit))),
        getDocs(query(collection(firestore, 'retro_boards'), limit(fetchLimit))),
        getDocs(query(collection(firestore, 'health_checks'), limit(fetchLimit))),
        getDocs(query(collection(firestore, 'brainstorming_boards'), limit(fetchLimit))),
        getDocs(query(collection(firestore, 'sprint_plannings'), limit(fetchLimit)))
      ]);

      const pokerSessions: UnifiedSession[] = pokerSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'poker',
          title: data.title || 'Sem Título',
          creatorId: data.creatorId || 'Anônimo',
          createdAt: data.createdAt || data.updatedAt || data.sessionEndedAt || data.finishedAt,
          participantCount: data.participantIds?.length || 0
        };
      });

      const retroSessions: UnifiedSession[] = retroSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'retro',
          title: data.title || 'Sem Título',
          creatorId: data.creatorId || 'Anônimo',
          createdAt: data.createdAt || data.updatedAt || data.finishedAt,
          participantCount: data.participantIds?.length || 0
        };
      });

      const healthSessions: UnifiedSession[] = healthSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'health',
          title: data.sprintName || 'Health Check',
          creatorId: data.creatorId || 'Anônimo',
          createdAt: data.createdAt || data.updatedAt || data.finishedAt,
          participantCount: data.participantIds?.length || 0
        };
      });

      const brainstormSessions: UnifiedSession[] = brainstormSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'brainstorm',
          title: data.title || 'Sem Título',
          creatorId: data.creatorId || 'Anônimo',
          createdAt: data.createdAt || data.updatedAt || data.finishedAt,
          participantCount: data.participantIds?.length || 0
        };
      });

      const planningSessions: UnifiedSession[] = planningSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'sprint_planning',
          title: data.title || 'Sprint Planning',
          creatorId: data.creatorId || 'Anônimo',
          createdAt: data.createdAt || data.updatedAt || data.finishedAt,
          participantCount: data.participantIds?.length || 0
        };
      });

      const all = [...pokerSessions, ...retroSessions, ...healthSessions, ...brainstormSessions, ...planningSessions];
      all.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000;
          const date = new Date(val);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });

      const [pokerCount, retroCount, healthCount, brainstormCount, planningCount] = await Promise.all([
        getCountFromServer(collection(firestore, 'rooms')),
        getCountFromServer(collection(firestore, 'retro_boards')),
        getCountFromServer(collection(firestore, 'health_checks')),
        getCountFromServer(collection(firestore, 'brainstorming_boards')),
        getCountFromServer(collection(firestore, 'sprint_plannings'))
      ]);

      const totalCount = pokerCount.data().count + retroCount.data().count + healthCount.data().count + brainstormCount.data().count + planningCount.data().count;

      set({
        sessions: all,
        totalSessionsCount: totalCount,
        lastFetchedSessions: Date.now(),
        isFetchingSessions: false
      });
    } catch (error) {
      console.error("Erro ao buscar sessões para o cache:", error);
      set({ isFetchingSessions: false });
    }
  },

  fetchUsers: async (firestore: Firestore, forceRefresh = false) => {
    const { lastFetchedUsers, isFetchingUsers } = get();
    
    if (isFetchingUsers) return;
    
    const now = Date.now();
    const isCacheValid = lastFetchedUsers && (now - lastFetchedUsers < CACHE_TTL_MS);

    if (isCacheValid && !forceRefresh) {
      return;
    }

    set({ isFetchingUsers: true });

    try {
      const snap = await getDocs(query(collection(firestore, 'users'), limit(500)));
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const countSnap = await getCountFromServer(collection(firestore, 'users'));

      set({
        users: usersData,
        totalUsersCount: countSnap.data().count,
        lastFetchedUsers: Date.now(),
        isFetchingUsers: false
      });
    } catch (error) {
      console.error("Erro ao buscar usuários para o cache:", error);
      set({ isFetchingUsers: false });
    }
  },

  removeSessionFromCache: (sessionId: string) => {
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== sessionId),
      totalSessionsCount: Math.max(0, state.totalSessionsCount - 1)
    }));
  },

  removeMultipleSessionsFromCache: (sessionIds: string[]) => {
    set(state => ({
      sessions: state.sessions.filter(s => !sessionIds.includes(s.id)),
      totalSessionsCount: Math.max(0, state.totalSessionsCount - sessionIds.length)
    }));
  }
}));
