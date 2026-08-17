'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateGoogleSignIn, initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { UserProfile, GlobalRole } from '@/lib/types';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { useDailyStore } from '@/store/useDailyStore';
import { userApi } from '@/app/users/api';

// Chaves de localStorage escritas diretamente (fora de stores Zustand) que
// carregam dados pessoais e precisam ser limpas no logout — senão vazam
// entre contas num computador compartilhado, mesmo com reload de página.
const PERSONAL_LOCALSTORAGE_KEYS = [
  'focus_task_categories',
  'focus_streak',
  'focus_session_history',
  'focus_daily_goal',
];

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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'agileSpace_guest_profile';
const PUBLIC_EXPLORATION_KEY = 'agileSpace_public_exploration';

// Cache local sempre vinculado ao uid que o gerou, para nunca aplicar o
// perfil de um usuário/convidado anterior a uma nova sessão/uid diferente
// num computador compartilhado.
type CachedProfile = { uid: string | null; profile: UserProfile };

function readCachedProfile(): CachedProfile | null {
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'profile' in parsed) {
      return parsed as CachedProfile;
    }
    return null; // formato legado (sem uid) — não é mais confiável, descarta
  } catch {
    return null;
  }
}

function writeCachedProfile(uid: string | null, profile: UserProfile) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ uid, profile }));
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading, firestore, auth, setUserAuthState } = useFirebase();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isIdentityRequested, setIsIdentityRequested] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPublicExploration, setIsPublicExplorationState] = useState(false);
  const pendingCallback = useRef<(() => void) | null>(null);

  // Persistimos a escolha de explorar sem cadastro para o visitante não ser
  // reincomodado a cada reload. requestIdentity() limpa isso quando um recurso
  // específico exigir identidade.
  useEffect(() => {
    try {
      if (localStorage.getItem(PUBLIC_EXPLORATION_KEY) === '1') {
        setIsPublicExplorationState(true);
      }
    } catch {}
  }, []);

  const setIsPublicExploration = (value: boolean) => {
    setIsPublicExplorationState(value);
    try {
      if (value) localStorage.setItem(PUBLIC_EXPLORATION_KEY, '1');
      else localStorage.removeItem(PUBLIC_EXPLORATION_KEY);
    } catch {}
  };
  const autoSignInAttempted = useRef(false);

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      const cached = readCachedProfile();
      if (cached) {
        // Pré-preenchimento apenas visual enquanto a sessão anônima é
        // restaurada/criada; será substituído pelos dados autoritativos do
        // Firestore assim que `user` resolver (ou descartado se o uid não bater).
        setUserProfile(cached.profile);

        if (auth && !autoSignInAttempted.current) {
          autoSignInAttempted.current = true;
          initiateAnonymousSignIn(auth).catch(err => {
            console.error("Auto anonymous sign-in failed:", err);
            setIsInitializing(false);
          });
          return;
        }
      }
      setIsInitializing(false);
      return;
    }

    // Se detectou usuário autenticado, removemos o pedido de identidade pendente
    // pois agora o fluxo passa a ser o de Onboarding ou Perfil
    setIsIdentityRequested(false);

    // Se logado, buscar dados da REST API
    const loadProfile = async () => {
      try {
        const data = await userApi.getUser(user.uid);
        if (data) {
          const profile: UserProfile = {
            id: user.uid,
            name: data.name || '',
            role: data.role || '',
            squadId: data.squadId || '',
            email: data.email || user.email || '',
            isGuest: false,
            team: data.squadId || '',
            avatarSeed: data.avatarSeed || '',
            dailyHours: data.dailyHours || 6,
            googleAccessToken: data.googleAccessToken || ''
          };
          setUserProfile(profile);
          writeCachedProfile(user.uid, profile);

          const isComplete = !!(profile.name && profile.role && profile.squadId);
          if (isComplete) {
            setIsIdentityRequested(false);
          }
        } else {
          const cached = readCachedProfile();
          const baseProfile = cached && cached.uid === user.uid ? cached.profile : null;

          const profile: UserProfile = {
            id: user.uid,
            name: baseProfile?.name || user.displayName || '',
            role: baseProfile?.role || '' as any,
            squadId: baseProfile?.squadId || '',
            email: baseProfile?.email || user.email || '',
            isGuest: false,
            avatarSeed: baseProfile?.avatarSeed || ''
          };
          setUserProfile(profile);

          await userApi.saveUser({
            id: user.uid,
            name: profile.name,
            role: profile.role,
            squadId: profile.squadId,
            email: profile.email,
            isGuest: false,
            avatarSeed: profile.avatarSeed,
          });
        }
      } catch (error) {
        console.error("UserContext: Error fetching user profile:", error);
        const cached = readCachedProfile();
        if (cached && cached.uid === user.uid) {
          setUserProfile(cached.profile);
        } else {
          setUserProfile({
            id: user.uid,
            name: user.displayName || '',
            role: '' as any,
            squadId: '',
            email: user.email || '',
            isGuest: false,
          });
        }
      } finally {
        setIsInitializing(false);
      }
    };

    loadProfile();
  }, [user, isUserLoading]);

  const requestIdentity = (onSuccess?: () => void) => {
    if (onSuccess) pendingCallback.current = onSuccess;
    setIsPublicExploration(false);
    setIsIdentityRequested(true);
  };

  const setGuestProfile = async (name: string, role: GlobalRole, squadId: string, email?: string, avatarSeed?: string) => {
    let currentAuthUser = user;

    if (!currentAuthUser && auth) {
      try {
        const result = await initiateAnonymousSignIn(auth);
        currentAuthUser = result.user;
      } catch (error) {
        console.error("Falha na autenticação anônima:", error);
      }
    }

    const uid = currentAuthUser?.uid || crypto.randomUUID();
    const newProfile: UserProfile = {
      id: uid,
      name,
      role,
      squadId: squadId || '',
      email: email || currentAuthUser?.email || '',
      isGuest: !currentAuthUser,
      avatarSeed: avatarSeed || ''
    };
    
    setIsIdentityRequested(false);
    writeCachedProfile(currentAuthUser?.uid ?? null, newProfile);
    setUserProfile(newProfile);

    if (pendingCallback.current) {
      const cb = pendingCallback.current;
      pendingCallback.current = null;
      setTimeout(cb, 0);
    }

    if (currentAuthUser) {
      try {
        await userApi.saveUser({
          id: currentAuthUser.uid,
          name: newProfile.name,
          role: newProfile.role,
          squadId: newProfile.squadId,
          email: newProfile.email,
          isGuest: false,
          avatarSeed: newProfile.avatarSeed,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    
    const newProfile = { ...userProfile, ...updates };
    setUserProfile(newProfile);
    setIsIdentityRequested(false);

    if (user) {
      const dbUpdates: any = { id: user.uid };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.squadId !== undefined) dbUpdates.squadId = updates.squadId;
      if (updates.email !== undefined) dbUpdates.email = updates.email || '';
      if (updates.avatarSeed !== undefined) dbUpdates.avatarSeed = updates.avatarSeed || '';
      if (updates.dailyHours !== undefined) dbUpdates.dailyHours = updates.dailyHours;
      if (updates.googleAccessToken !== undefined) dbUpdates.googleAccessToken = updates.googleAccessToken;

      try {
        await userApi.saveUser(dbUpdates);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const logout = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Erro ao deslogar do Firebase:", err);
      }
    }
    localStorage.removeItem(GUEST_STORAGE_KEY);
    PERSONAL_LOCALSTORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    useCalmariaStore.getState().logoutSpotify();
    useDailyStore.getState().reset();
    setUserProfile(null);
    window.location.href = '/';
  };

  const loginWithGoogle = async () => {
    if (auth && setUserAuthState) {
      try {
        const result = await initiateGoogleSignIn(auth);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        
        if (token) {
          setUserAuthState(prev => ({ ...prev, googleAccessToken: token }));
          await userApi.saveUser({
            id: result.user.uid,
            googleAccessToken: token,
          });
        }
      } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          console.log("Login com Google cancelado pelo usuário.");
          return;
        }

        console.error("Erro ao fazer login com Google:", error);
        toast({
          title: "Erro na Autenticação",
          description: error.code === 'auth/popup-blocked'
            ? "O navegador bloqueou o popup de login. Por favor, habilite popups para este site."
            : "Não foi possível completar o login com Google.",
          variant: "destructive"
        });
      }
    } else {
      console.error("Serviços de Auth não disponíveis:", { auth: !!auth, setUserAuthState: !!setUserAuthState });
      toast({
        title: "Sistema Indisponível",
        description: "Os serviços de autenticação ainda estão carregando. Tente novamente em instantes.",
        variant: "destructive"
      });
    }
  };

    const isProfileComplete = !!(
      userProfile?.name && 
      userProfile?.role && 
      userProfile?.squadId
    );

    const mustOnboard = !!user && !isProfileComplete;

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
