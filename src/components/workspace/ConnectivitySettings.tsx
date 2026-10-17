'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Database, Globe, Loader2, Save, ShieldCheck } from 'lucide-react';
import { IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import { MyApiKeysManager } from '@/components/shared/MyApiKeysManager';
import { useUserContext } from '@/context/UserContext';
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useTdnSettings } from '@/hooks/useTdnSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Field, TEXT_INPUT, WorkspaceSectionHeader } from './workspace-ui';

export function ConnectivitySettings() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();

  // Jira Settings
  const { settings: jiraSettings, saveSettings: saveJira, loading: loadingJira } = useJiraSettings();
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraToken, setJiraToken] = useState('');

  // TDN Settings
  const { settings: tdnSettings, saveSettings: saveTdn, loading: loadingTdn } = useTdnSettings();
  const [tdnUrl, setTdnUrl] = useState('');
  const [tdnToken, setTdnToken] = useState('');
  const [tdnSpace, setTdnSpace] = useState('');
  const [tdnLabel, setTdnLabel] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Agenda do Google (somente leitura): o consentimento fica neste navegador.
  const calendar = useGoogleCalendarConnection(userProfile?.email || userProfile?.id || '');

  // Sync state with loaded settings
  useEffect(() => {
    if (jiraSettings) {
      setJiraUrl(jiraSettings.domain || '');
      setJiraToken(jiraSettings.token || '');
    }
  }, [jiraSettings]);

  useEffect(() => {
    if (tdnSettings) {
      setTdnUrl(tdnSettings.baseUrl || '');
      setTdnToken(tdnSettings.token || '');
      setTdnSpace(tdnSettings.space || '');
      setTdnLabel(tdnSettings.label || '');
    }
  }, [tdnSettings]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveJira({ domain: jiraUrl, token: jiraToken }),
        saveTdn({ baseUrl: tdnUrl, token: tdnToken, space: tdnSpace, label: tdnLabel }),
      ]);
      toast({
        title: 'Conexões Atualizadas',
        description: 'Suas credenciais de integração foram salvas com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro ao Salvar',
        description: 'Não foi possível salvar uma ou mais configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calendarState = calendar.isConnected ? { label: 'Conectada', tone: 'success' as const } : calendar.isConnecting ? { label: 'Conectando...', tone: 'neutral' as const } : { label: 'Não conectada', tone: 'neutral' as const };

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Conexões e integrações"
        subtitle="Suas credenciais para trazer dados de ferramentas externas"
        action={
          <ModalButton variant="primary" onClick={handleSaveAll} disabled={isSaving || loadingJira || loadingTdn}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            Salvar configurações
          </ModalButton>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Jira */}
        <section className={cn(PAGE_CARD, 'flex flex-col gap-5 rounded-3xl p-6')}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={Database} size="lg" />
              <div>
                <h3 className="text-base font-bold text-foreground">Jira Software</h3>
                <p className="text-xs text-muted-foreground">Atlassian Cloud Sync</p>
              </div>
            </div>
            <StatusChip tone="neutral">v2.0 API</StatusChip>
          </header>
          <div className="flex flex-col gap-4">
            <Field label="Domínio da instância" htmlFor="ws-jira-domain">
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <input id="ws-jira-domain" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="exemplo.atlassian.net" autoComplete="off" className={cn(TEXT_INPUT, 'pl-10')} />
              </div>
            </Field>
            <Field label="Personal Access Token (PAT)" htmlFor="ws-jira-token">
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <input id="ws-jira-token" type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="••••••••••••••••" autoComplete="off" className={cn(TEXT_INPUT, 'pl-10')} />
              </div>
            </Field>
          </div>
          <p className="rounded-2xl border border-border bg-muted/40 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
            Utilizado para importar Histórias de Usuário e Critérios de Aceite para as sessões de Poker.
          </p>
        </section>

        {/* TDN */}
        <section className={cn(PAGE_CARD, 'flex flex-col gap-5 rounded-3xl p-6')}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={Globe} size="lg" />
              <div>
                <h3 className="text-base font-bold text-foreground">TDN / Confluence Wiki</h3>
                <p className="text-xs text-muted-foreground">Technical Knowledge Hub</p>
              </div>
            </div>
            <StatusChip tone="neutral">Confluence</StatusChip>
          </header>
          <div className="flex flex-col gap-4">
            <Field label="URL base do TDN" htmlFor="ws-tdn-url">
              <input id="ws-tdn-url" value={tdnUrl} onChange={(e) => setTdnUrl(e.target.value)} placeholder="wiki.suaempresa.com" autoComplete="off" className={TEXT_INPUT} />
            </Field>
            <Field label="Personal Access Token (PAT)" htmlFor="ws-tdn-token">
              <input id="ws-tdn-token" type="password" value={tdnToken} onChange={(e) => setTdnToken(e.target.value)} placeholder="••••••••••••••••" autoComplete="off" className={TEXT_INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Espaço (Space)" htmlFor="ws-tdn-space">
                <input id="ws-tdn-space" value={tdnSpace} onChange={(e) => setTdnSpace(e.target.value)} placeholder="Ex: PRO" autoComplete="off" className={TEXT_INPUT} />
              </Field>
              <Field label="Rótulo (Label)" htmlFor="ws-tdn-label">
                <input id="ws-tdn-label" value={tdnLabel} onChange={(e) => setTdnLabel(e.target.value)} placeholder="Ex: agile, space" autoComplete="off" className={TEXT_INPUT} />
              </Field>
            </div>
          </div>
          <p className="rounded-2xl border border-border bg-muted/40 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
            Permite buscar documentações técnicas da empresa e importá-las para sua Wiki local com um clique.
          </p>
        </section>
      </div>

      {/* Agenda do Google */}
      <section className={cn(PAGE_CARD, 'flex flex-wrap items-center gap-4 rounded-3xl p-5')}>
        <IconTile icon={CalendarDays} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-base font-bold text-foreground">Agenda do Google</h3>
          <p className="text-[13px] text-muted-foreground">Somente leitura, usada na Próxima cerimônia do Painel do time</p>
          {calendar.error && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {calendar.error}
            </p>
          )}
        </div>
        {calendar.isConfigured ? (
          <>
            <StatusChip tone={calendarState.tone}>{calendarState.label}</StatusChip>
            {calendar.isConnected ? (
              <ModalButton onClick={calendar.disconnect}>Desconectar</ModalButton>
            ) : (
              <ModalButton variant="primary" onClick={calendar.connect} disabled={calendar.isConnecting}>
                Conectar minha agenda
              </ModalButton>
            )}
          </>
        ) : (
          <StatusChip tone="neutral">Indisponível neste ambiente</StatusChip>
        )}
      </section>

      {/* Minhas API Keys: self-service, com lista e formulário */}
      <MyApiKeysManager />
    </div>
  );
}
