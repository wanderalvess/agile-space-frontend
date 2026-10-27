'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, GlobalRole, SquadMember } from '@/lib/types';
import { userApi } from '@/app/users/api';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/auth-client';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { resolveCargo } from '@/lib/cargo';
import type { MyMemberships } from '@/lib/memberships-api';
import { deriveMustOnboard, findMembership, isLegacyOnly, leadershipOfActiveSquad, resolveActiveSquadId } from '@/lib/memberships';

interface UserContextType {
  userProfile: UserProfile | null;
  setGuestProfile: (name: string, role: GlobalRole, email?: string) => void;
  /** Atualiza o perfil da pessoa (nome, avatar). A squad ativa NÃO se grava aqui: vem dos vínculos e muda pelo `switchProject`. */
  updateProfile: (updates: Partial<Omit<UserProfile, 'squadId'>>) => void;
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
  /** Vínculos (`/me/memberships`) conferidos para a sessão atual; `null` se o endpoint não existe ou ainda não voltou. */
  memberships: MyMemberships | null;
  /** Sem vínculo nenhum, só com rastro do modelo antigo: o app mostra o aviso "peça à liderança da squad". */
  legacyOnly: boolean;
  /** Squad ativa: a da sessão validada contra os vínculos (`''` quando não há). */
  activeSquadId: string;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'agileSpace_guest_profile';
const PUBLIC_EXPLORATION_KEY = 'agileSpace_public_exploration';

/** Cache local só de campos da pessoa (avatar, carga horária). A squad nunca entra: é derivada dos vínculos. */
type CachedProfile = { uid: string | null; profile: Omit<UserProfile, 'squadId'> };

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
  // Descarta `squadId` (e o antigo `team`): cache de uma versão anterior também é limpo na próxima gravação.
  const { squadId: _squadId, team: _team, ...rest } = profile as UserProfile & { team?: string };
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ uid, profile: rest }));
  } catch {}
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { session, isLoading: isAuthLoading, logout: authLogout } = useAuth();
  const { memberships } = useMyMemberships();
  const [baseProfile, setUserProfile] = useState<UserProfile | null>(null);
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

  // Squad ativa = a da sessão validada contra os vínculos. É a única fonte: nada aqui troca a squad sozinho.
  const activeSquadId = resolveActiveSquadId(session?.activeProjectId, memberships);
  const activeMembership = findMembership(memberships, activeSquadId);
  const activeMembershipRole = activeMembership?.roleName;

  // O perfil vem da sessão; a squad e o papel ativos vêm dos vínculos quando o servidor os devolve.
  const userProfile = useMemo<UserProfile | null>(() => {
    if (!baseProfile) return null;
    const isAdminProfile = baseProfile.role === 'admin';
    return {
      ...baseProfile,
      squadId: activeSquadId || baseProfile.squadId,
      role: (isAdminProfile ? 'admin' : activeMembershipRole || baseProfile.role) as GlobalRole,
      cargo: resolveCargo(baseProfile.jobTitle, activeMembershipRole),
    };
  }, [baseProfile, activeSquadId, activeMembershipRole]);

  // Sem vínculo nenhum = tela de espera (onboarding). Com `/me/memberships`, vale a lista de vínculos; sem ele
  // (backend antigo), o critério de antes: sem squad ativa.
  const mustOnboard = !!userProfile && deriveMustOnboard({ memberships, sessionLegacyOnly: session?.legacyOnly, profileSquadId: userProfile.squadId });
  const legacyOnly = !!session && isLegacyOnly(memberships, session.legacyOnly);

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

    const isSystemAdmin = session.role?.toUpperCase() === 'ADMIN' || session.role?.toLowerCase() === 'admin';

    const profile: UserProfile = {
      id: session.id,
      name: session.name,
      email: session.email,
      role: (isSystemAdmin ? 'admin' : session.activeProjectRole || cachedForUser?.role || 'user') as GlobalRole,
      // Sem cache local aqui: a squad vem só da sessão (e dos vínculos, no memo `userProfile`).
      jobTitle: (session.jobTitle || undefined) as GlobalRole | undefined,
      squadId: session.activeProjectId || '',
      isGuest: false,
      avatarSeed: cachedForUser?.avatarSeed || session.avatarSeed || 'Felix',
      photoUrl: session.photoUrl ?? null,
      dailyHours: cachedForUser?.dailyHours,
    };

    // Migração silenciosa: cache antigo que guardava `squadId`/`team` é reescrito sem eles.
    if (cached && cachedForUser && ('squadId' in cachedForUser || 'team' in cachedForUser)) {
      writeCachedProfile(cached.uid, cachedForUser as UserProfile);
    }

    setUserProfile(profile);
    setIsInitializing(false);
  }, [session, isAuthLoading]);

  // Sincroniza o ID da squad ativa no localStorage para seletores e componentes administrativos
  useEffect(() => {
    if (userProfile?.squadId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('agileSpace_activeSquadId', userProfile.squadId);
      } catch {}
    }
  }, [userProfile?.squadId]);

  // Carrega os papéis do roster do usuário logado (por e-mail ou ID), para completar "Meus vínculos" sem `/me/memberships`
  useEffect(() => {
    if (!userProfile?.email && !userProfile?.id) return;
    const identifier = userProfile.email || userProfile.id;

    const fetchUserSquads = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
        const res = await authFetch(`${apiUrl}/squads/by-user?identifier=${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const data: SquadMember[] = await res.json();
          // Só alimenta a lista de papéis do roster. Não troca a squad ativa nem grava nada: quem troca é o
          // `switchProject` (seletor de squad), e a squad ativa vem da sessão validada pelos vínculos.
          if (Array.isArray(data) && data.length > 0) setUserSquads(data);
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
  const setGuestProfile = async (name: string, role: GlobalRole, _email?: string) => {
    // O avatarSeed já gravado no perfil não é exibido nem editado; segue como está (o merge em updateProfile o preserva).
    await updateProfile({ name, role });
    if (pendingCallback.current) {
      const cb = pendingCallback.current;
      pendingCallback.current = null;
      setTimeout(cb, 0);
    }
  };

  const updateProfile = async (updates: Partial<Omit<UserProfile, 'squadId'>>) => {
    if (!userProfile) return;

    // id/email são a identidade autenticada (JWT) — não editáveis via este formulário. `squadId` (e o antigo `team`)
    // também não: o vínculo é a fonte da verdade, então nunca vai para a base nem para o cache local.
    const { id: _ignoredId, email: _ignoredEmail, squadId: _ignoredSquad, team: _ignoredTeam, ...safeUpdates } = updates as typeof updates & {
      id?: string;
      squadId?: string;
      team?: string;
    };
    const newProfile = { ...userProfile, ...safeUpdates };
    setUserProfile((prev) => (prev ? { ...prev, ...safeUpdates } : prev));
    setIsIdentityRequested(false);
    setIsEditProfileOpen(false);
    setIsPublicExploration(true);
    writeCachedProfile(newProfile.id, newProfile);

    try {
      await userApi.saveUser({
        id: newProfile.id,
        name: newProfile.name,
        role: newProfile.role,
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

  // Liderança na squad ativa: a bandeira do vínculo (qualquer papel dela). Sem dados de vínculos, a lista por nome.
  const LEADERSHIP_ROLES = ['Product Owner', 'Agile Master', 'People Lead', 'Tech Lead', 'Tribe Lead', 'Agile Coach', 'SME', 'admin'];
  const isLeadership =
    userProfile?.role === 'admin' || (leadershipOfActiveSquad(memberships, activeSquadId) ?? LEADERSHIP_ROLES.includes(userProfile?.role || ''));

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
      memberships,
      legacyOnly,
      activeSquadId,
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

