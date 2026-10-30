'use client';

import { useEffect, useState } from 'react';
import { userApi } from '@/app/users/api';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { bestJiraAvatar, writeStoredProfilePhoto } from '@/lib/profile-photo';

/** Resposta do `/myself` do Jira que a tela usa. */
export interface JiraAccount {
  displayName?: string;
  name?: string;
  key?: string;
  accountId?: string;
  emailAddress?: string;
  timeZone?: string;
  avatarUrls?: Record<string, string | null | undefined>;
}

/**
 * Conexão com o Jira da pessoa (domínio, token pessoal, sincronização). A fonte única das credenciais é
 * `useJiraSettings` (localStorage por usuário + backend), a mesma de ConnectivitySettings/JiraImportDialog.
 * A conta sincronizada fica só enquanto o modal está aberto e alimenta a foto do Jira (`useProfilePhoto`).
 */
export function useJiraConnection({ isOpen, userStoreId }: { isOpen: boolean; userStoreId?: string }) {
  const { settings, saveSettings, removeSettings } = useJiraSettings();
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  // O PAT guardado não volta para o campo: a tela mostra "salvo" e só pede o valor de novo ao trocar.
  const [replacingToken, setReplacingToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [account, setAccount] = useState<JiraAccount | null>(null);

  const hasSavedToken = !!settings?.token && !replacingToken;
  const connected = !!settings?.token || !!account;

  useEffect(() => {
    if (isOpen && settings) {
      setDomain(settings.domain || '');
      setToken('');
      setReplacingToken(false);
    }
  }, [isOpen, settings]);

  // Ao fechar, esquece a conta sincronizada.
  useEffect(() => {
    if (!isOpen) setAccount(null);
  }, [isOpen]);

  const sync = async () => {
    const tokenToUse = (token || settings?.token || '').trim();
    const domainToUse = (domain || settings?.domain || '').trim();

    if (!tokenToUse) {
      toast({ title: 'Token do Jira necessário', variant: 'destructive' });
      return;
    }
    if (!domainToUse) {
      toast({ title: 'Domínio do Jira necessário', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      const jiraUser: JiraAccount | null = await userApi.getMyself(domainToUse, tokenToUse);
      if (jiraUser) {
        if (remember) {
          saveSettings({ domain: domainToUse, token: tokenToUse });
          setToken('');
          setReplacingToken(false);
        }
        setDomain(domainToUse);
        setAccount(jiraUser);
        // A foto fica guardada para os cabeçalhos mostrarem a mesma imagem.
        writeStoredProfilePhoto(userStoreId, bestJiraAvatar(jiraUser.avatarUrls) ?? null);
        toast({ title: 'Jira sincronizado', description: `Identidade carregada: ${jiraUser.displayName || jiraUser.name}.` });
      }
    } catch (err) {
      toast({
        title: 'Erro ao conectar ao Jira',
        description: (err instanceof Error && err.message) || 'Verifique o token e o domínio.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const removeToken = async () => {
    await removeSettings();
    setToken('');
    setAccount(null);
    // Sem token, a foto sincronizada some e voltam as iniciais (se o time não tiver foto).
    writeStoredProfilePhoto(userStoreId, null);
    toast({ title: 'Token do Jira removido', description: 'Ele saiu deste navegador e da sua conta.' });
  };

  return {
    connected,
    domain,
    setDomain,
    token,
    setToken,
    hasSavedToken,
    replaceToken: () => setReplacingToken(true),
    remember,
    setRemember,
    syncing,
    account,
    sync,
    removeToken,
  };
}

export type JiraConnection = ReturnType<typeof useJiraConnection>;
