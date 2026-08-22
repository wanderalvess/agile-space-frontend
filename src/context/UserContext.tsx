'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, GlobalRole, SquadMember } from '@/lib/types';
import { userApi } from '@/app/users/api';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/auth-client';

interface UserContextType {
  userProfile: UserProfile | null;
  setGuestProfile: (name: string, role: GlobalRole, squadId: string, email?: string, avatarSeed?: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  logout: () => void;
  isInitializing: boolean;
  isIdentityRequested: boolean;
  setIsIdentityRequested: (value: boolean) => void;
  requestIdentity: (onSuccess?: () => void) => void;
  isEditProfileOpen: boolean;
  setIsEditProfileOpen: (open: boolean) => void;
  mustOnboard: boolean;
  loginWithGoogle: () => void;
  isPublicExploration: boolean;
  setIsPublicExploration: (value: boolean) => void;
  userSquads: SquadMember[];
  isLeadership: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'agileSpace_guest_profile';
const PUBLIC_EXPLORATION_KEY = 'agileSpace_public_exploration';

type CachedProfile = { uid: string | null; profile: UserProfile };

function readCachedProfile(): CachedProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'profile' in parsed) {
      return parsed as CachedProfile;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedProfile(uid: string | null, profile: UserProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ uid, profile }));
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { session, isLoading: isAuthLoading, logout: authLogout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isIdentityRequested, setIsIdentityRequested] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPublicExploration, setIsPublicExplorationState] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(PUBLIC_EXPLORATION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [userSquads, setUserSquads] = useState<SquadMember[]>([]);
  const pendingCallback = useRef<(() => void) | null>(null);

  // Perfil completo (squad/role definidos) até que o usuário finalize o onboarding pós-login
  const mustOnboard = !!userProfile && !userProfile.squadId;

  const setIsPublicExploration = (value: boolean) => {
    setIsPublicExplorationState(value);
    try {
      if (value) localStorage.setItem(PUBLIC_EXPLORATION_KEY, '1');
      else localStorage.removeItem(PUBLIC_EXPLORATION_KEY);
    } catch {}
  };

  // Deriva o perfil da sessão autenticada (JWT), não mais de um nome auto-declarado no localStorage.
  // Campos cosméticos (avatar, carga horária) continuam vindo do cache local do dispositivo.
  useEffect(() => {
    if (isAuthLoading) return;

    if (!session) {
      setUserProfile(null);
      setIsInitializing(false);
      return;
    }

    const cached = readCachedProfile();
    const cachedForUser = cached?.uid === session.id ? cached.profile : null;

    const profile: UserProfile = {
      id: session.id,
      name: session.name,
      email: session.email,
      role: (session.activeProjectRole || cachedForUser?.role || 'user') as GlobalRole,
      squadId: session.activeProjectId || cachedForUser?.squadId || '',
      isGuest: false,
      avatarSeed: cachedForUser?.avatarSeed || session.avatarSeed || 'Felix',
      dailyHours: cachedForUser?.dailyHours,
    };

    setUserProfile(profile);
    setIsInitializing(false);
  }, [session, isAuthLoading]);

  // Carrega automaticamente as Squads e papéis vinculados ao usuário logado (por e-mail ou ID)
  useEffect(() => {
    if (!userProfile?.email && !userProfile?.id) return;
    const identifier = userProfile.email || userProfile.id;

    const fetchUserSquads = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
        const res = await authFetch(`${apiUrl}/squads/by-user?identifier=${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const data: SquadMember[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setUserSquads(data);
            
            // Sincroniza a Squad ativa e o papel caso pertença à Squad
            const currentSquadMatch = data.find(s => s.squadId === userProfile.squadId) || data[0];
            if (currentSquadMatch) {
              const matchedRole = (currentSquadMatch.role as GlobalRole) || userProfile.role;
              if (userProfile.squadId !== currentSquadMatch.squadId || userProfile.role !== matchedRole) {
                setUserProfile(prev => prev ? {
                  ...prev,
                  squadId: currentSquadMatch.squadId,
                  role: matchedRole
                } : null);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar squads vinculadas ao usuário:", err);
      }
    };

    fetchUserSquads();
  }, [userProfile?.email, userProfile?.id]);

  const requestIdentity = (onSuccess?: () => void) => {
    if (userProfile?.name && userProfile?.role) {
      if (onSuccess) onSuccess();
      return;
    }
    if (onSuccess) pendingCallback.current = onSuccess;
    setIsPublicExploration(false);
    setIsIdentityRequested(true);
  };

  // Mantido pela assinatura consumida pelo UserProfileModal e pela tela de login
  // (conclusão de onboarding pós-login); e-mail não é aceito aqui — a identidade
  // vem da sessão autenticada, não de texto livre.
  const setGuestProfile = async (name: string, role: GlobalRole, squadId: string, _email?: string, avatarSeed?: string) => {
    await updateProfile({ name, role, squadId, avatarSeed });
    if (pendingCallback.current) {
      const cb = pendingCallback.current;
      pendingCallback.current = null;
      setTimeout(cb, 0);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;

    // id/email são a identidade autenticada (JWT) — não editáveis via este formulário
    const { id: _ignoredId, email: _ignoredEmail, ...safeUpdates } = updates;
    const newProfile = { ...userProfile, ...safeUpdates };
    setUserProfile(newProfile);
    setIsIdentityRequested(false);
    setIsEditProfileOpen(false);
    setIsPublicExploration(true);
    writeCachedProfile(newProfile.id, newProfile);

    try {
      await userApi.saveUser({
        id: newProfile.id,
        name: newProfile.name,
        role: newProfile.role,
        squadId: newProfile.squadId,
        email: newProfile.email,
        isGuest: false,
        avatarSeed: newProfile.avatarSeed,
      });
    } catch (err) {
      console.warn("Aviso ao atualizar perfil no Postgres:", err);
    }
  };

  const logout = () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setUserProfile(null);
    authLogout();
  };

  const loginWithGoogle = () => {
    console.log("Login com Google desativado (usando modo local com PostgreSQL).");
  };

  const LEADERSHIP_ROLES = ['Product Owner', 'Agile Master', 'People Lead', 'Tech Lead', 'Tribe Lead', 'Agile Coach', 'SME', 'admin'];
  const isLeadership = LEADERSHIP_ROLES.includes(userProfile?.role || '');

  const isProfileComplete = true;

  return (
    <UserContext.Provider value={{ 
      userProfile, 
      setGuestProfile, 
      updateProfile, 
      logout, 
      isInitializing,
      isEditProfileOpen,
      setIsEditProfileOpen,
      mustOnboard,
      isIdentityRequested,
      setIsIdentityRequested,
      requestIdentity,
      loginWithGoogle,
      isPublicExploration,
      setIsPublicExploration,
      userSquads,
      isLeadership,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

export const useUser = useUserContext;

