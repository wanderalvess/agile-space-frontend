'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, GlobalRole, SquadMember } from '@/lib/types';
import { userApi } from '@/app/users/api';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isIdentityRequested, setIsIdentityRequested] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPublicExploration, setIsPublicExplorationState] = useState(true);
  const [userSquads, setUserSquads] = useState<SquadMember[]>([]);
  const pendingCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsPublicExplorationState(true);
    try {
      localStorage.setItem(PUBLIC_EXPLORATION_KEY, '1');
    } catch {}
  }, []);

  const mustOnboard = false;

  const setIsPublicExploration = (value: boolean) => {
    setIsPublicExplorationState(value);
    try {
      if (value) localStorage.setItem(PUBLIC_EXPLORATION_KEY, '1');
      else localStorage.removeItem(PUBLIC_EXPLORATION_KEY);
    } catch {}
  };

  // Inicialização do perfil (sem qualquer dependência de Firebase Auth)
  useEffect(() => {
    const cached = readCachedProfile();
    const isComplete = cached?.profile?.name && cached?.profile?.role && cached?.profile?.squadId;

    if (cached && isComplete) {
      setUserProfile(cached.profile);
    } else {
      setUserProfile(null);
    }

    setIsInitializing(false);
  }, []);

  // Carrega automaticamente as Squads e papéis vinculados ao usuário logado (por e-mail ou ID)
  useEffect(() => {
    if (!userProfile?.email && !userProfile?.id) return;
    const identifier = userProfile.email || userProfile.id;

    const fetchUserSquads = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
        const res = await fetch(`${apiUrl}/squads/by-user?identifier=${encodeURIComponent(identifier)}`);
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

  const setGuestProfile = async (name: string, role: GlobalRole, squadId: string, email?: string, avatarSeed?: string) => {
    const uid = email || `${name.toLowerCase().replace(/\s+/g, '.')}-${Date.now()}`;
    const newProfile: UserProfile = {
      id: uid,
      name,
      role,
      squadId: squadId || '',
      email: email || '',
      isGuest: false,
      avatarSeed: avatarSeed || 'Felix'
    };
    
    setIsIdentityRequested(false);
    setIsEditProfileOpen(false);
    setIsPublicExploration(true);
    writeCachedProfile(uid, newProfile);
    setUserProfile(newProfile);

    if (pendingCallback.current) {
      const cb = pendingCallback.current;
      pendingCallback.current = null;
      setTimeout(cb, 0);
    }

    try {
      await userApi.saveUser({
        id: uid,
        name: newProfile.name,
        role: newProfile.role,
        squadId: newProfile.squadId,
        email: newProfile.email,
        isGuest: true,
        avatarSeed: newProfile.avatarSeed,
      });
    } catch (err) {
      console.warn("Aviso ao salvar perfil no Postgres:", err);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    
    const newProfile = { ...userProfile, ...updates };
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
        isGuest: true,
        avatarSeed: newProfile.avatarSeed,
      });
    } catch (err) {
      console.warn("Aviso ao atualizar perfil no Postgres:", err);
    }
  };

  const logout = () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setUserProfile(null);
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

