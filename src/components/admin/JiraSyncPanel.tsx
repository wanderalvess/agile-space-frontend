'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { authFetch } from '@/lib/auth-client';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, IconButton, IconTile, Modal, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { AdminCheckbox, FIELD_HINT, FIELD_LABEL } from './AdminOpsParts';
import { SQUAD_ROLES, jiraErrorInfo, type JiraErrorInfo } from './admin-platform-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

const ESTIMATION_OPTIONS = [
  { value: 'HOURS', label: 'Horas (h)' },
  { value: 'SP', label: 'Story Points (Fibonacci: 1, 2, 3, 5, 8, 13...)' },
  { value: 'TSHIRT', label: 'Tamanhos T-Shirt (PP, P, M, G, GG)' },
  { value: 'COUNT', label: 'Contagem de histórias (throughput)' },
] as const;

interface JiraSyncPanelProps {
  onSyncSuccess?: (squadId: string) => void;
}

interface MemberCandidate {
  jiraAccountId: string;
  displayName: string;
  email: string | null;
  role: string;
  score: number;
  selected: boolean;
  capacityHoursPerDay: number;
}

interface PreviewData {
  squadId: string;
  squadName: string;
  jiraDomain: string;
  totalCandidates: number;
  members: MemberCandidate[];
}

interface SyncResult {
  squadId: string;
  squadName: string;
  memberCount: number;
}

export function JiraSyncPanel({ onSyncSuccess }: JiraSyncPanelProps) {
  const { squadId: activeSquadId } = useActiveSquad();
  const { toast } = useToast();
  const { settings: jiraSettingsStore, saveSettings: saveJiraSettings, removeSettings: removeJiraSettings } = useJiraSettings();
  const [projectKey, setProjectKey] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [token, setToken] = useState('');
  const [estimationUnit, setEstimationUnit] = useState('SP');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<JiraErrorInfo | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [erasing, setErasing] = useState(false);

  // Estados da camada de validação e confirmação
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [syncUsers, setSyncUsers] = useState(true);

  // Carrega chave de projeto / unidade de estimativa (locais deste painel) ao montar.
  React.useEffect(() => {
    try {
      const activeProject = activeSquadId || localStorage.getItem('agileSpace_activeSquadId') || '';
      const savedKey = localStorage.getItem('agileSpace_jiraSync_projectKey') || activeProject;
      const savedUnit = localStorage.getItem('agileSpace_projectEstimationUnit') || 'SP';

      setProjectKey(savedKey);
      setEstimationUnit(savedUnit);
    } catch {}
  }, [activeSquadId]);

  // Domínio/token do Jira vêm da fonte única (useJiraSettings) — mesmo slot usado em
  // ConnectivitySettings/JiraImportDialog, sem localStorage próprio deste painel.
  React.useEffect(() => {
    if (jiraSettingsStore) {
      setJiraDomain(jiraSettingsStore.domain || '');
      setToken(jiraSettingsStore.token || '');
    }
  }, [jiraSettingsStore]);

  const handleKeyChange = (val: string) => {
    const upper = val.toUpperCase();
    setProjectKey(upper);
    try { localStorage.setItem('agileSpace_jiraSync_projectKey', upper); } catch {}
  };

  // Passo 1: consulta a API do Jira e abre o diálogo de validação prévia
  const handlePreviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSyncResult(null);

    // Salva chave de projeto / unidade de estimativa (locais); domínio+token do Jira
    // vão pra fonte única via saveJiraSettings.
    try {
      localStorage.setItem('agileSpace_jiraSync_projectKey', projectKey);
      localStorage.setItem('agileSpace_projectEstimationUnit', estimationUnit);
      if (projectKey) {
        localStorage.setItem(`agileSpace_estimationUnit_${projectKey}`, estimationUnit);
      }
    } catch {}
    void saveJiraSettings({ domain: jiraDomain, token }).then((savedOnAccount) => {
      if (!savedOnAccount) {
        toast({ title: 'Token guardado só neste navegador', description: 'Não foi possível guardá-lo na sua conta.' });
      }
    });

    try {
      const res = await authFetch(`${API_BASE}/admin/jira/preview-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey, jiraDomain, token, estimationUnit }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(jiraErrorInfo(res.status, body?.message || body?.error, projectKey));
        return;
      }

      const data: PreviewData = await res.json();
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch {
      setError(jiraErrorInfo(null));
    } finally {
      setLoading(false);
    }
  };

  const handleEraseToken = async () => {
    setErasing(true);
    try {
      await removeJiraSettings();
      setToken('');
      toast({ title: 'Token apagado', description: 'O token saiu deste navegador e da sua conta.' });
    } finally {
      setErasing(false);
      setEraseOpen(false);
    }
  };

  // Funções de manipulação dentro do diálogo de prévia
  const patchMembers = (fn: (members: MemberCandidate[]) => MemberCandidate[]) =>
    setPreviewData((prev) => (prev ? { ...prev, members: fn(prev.members) } : null));

  const toggleSelectMember = (accountId: string) =>
    patchMembers((ms) => ms.map((m) => (m.jiraAccountId === accountId ? { ...m, selected: !m.selected } : m)));

  const toggleSelectAll = () => {
    if (!previewData) return;
    const allSelected = previewData.members.every((m) => m.selected);
    patchMembers((ms) => ms.map((m) => ({ ...m, selected: !allSelected })));
  };

  const updateCandidateRole = (accountId: string, newRole: string) =>
    patchMembers((ms) => ms.map((m) => (m.jiraAccountId === accountId ? { ...m, role: newRole } : m)));

  const removeCandidate = (accountId: string) => patchMembers((ms) => ms.filter((m) => m.jiraAccountId !== accountId));

  // Passo 2: confirmação e gravação
  const handleConfirmSync = async () => {
    if (!previewData) return;
    setConfirming(true);
    try {
      const payload = {
        squadId: previewData.squadId,
        squadName: previewData.squadName,
        jiraDomain: previewData.jiraDomain,
        estimationUnit: estimationUnit,
        replaceExisting: replaceExisting,
        syncUsers: syncUsers,
        members: previewData.members.filter((m) => m.selected),
      };

      const res = await authFetch(`${API_BASE}/admin/jira/confirm-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Erro ${res.status}`);
      }

      const result: SyncResult = await res.json();
      setSyncResult(result);
      setIsPreviewOpen(false);

      toast({
        title: 'Importação validada e salva!',
        description: `${result.memberCount} membros sincronizados na squad "${result.squadName}" e no cadastro de usuários.`,
      });

      onSyncSuccess?.(result.squadId);
    } catch (err) {
      toast({
        title: 'Erro ao salvar importação',
        description: (err as Error)?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  const members = previewData?.members ?? [];
  const selectedCount = members.filter((m) => m.selected).length;
  const allState: boolean | 'indeterminate' = members.length > 0 && selectedCount === members.length ? true : selectedCount > 0 ? 'indeterminate' : false;
  const hasSavedToken = !!jiraSettingsStore?.token;

  return (
    <>
      <section className={cn(PAGE_CARD, 'overflow-clip')} aria-label="Importar o time de um projeto do Jira">
        <header className="flex flex-wrap items-center gap-3.5 border-b border-border px-6 py-4">
          <IconTile icon={Users} />
          <div className="flex min-w-0 flex-1 basis-[14rem] flex-col">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Importar o time de um projeto do Jira</h2>
            <p className="text-[13px] text-muted-foreground">Usa o seu token pessoal; nada vale para a organização inteira.</p>
          </div>
          <StatusChip tone="brand">Com validação prévia</StatusChip>
        </header>
        <form onSubmit={handlePreviewSubmit} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jira-key" className={FIELD_LABEL}>Chave do projeto</label>
              <input id="jira-key" value={projectKey} onChange={(e) => handleKeyChange(e.target.value)} placeholder="Ex.: DDWMISSI" required className={cn(FIELD, 'h-11')} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jira-domain" className={FIELD_LABEL}>Domínio do Jira</label>
              <input
                id="jira-domain"
                value={jiraDomain}
                onChange={(e) => setJiraDomain(e.target.value)}
                placeholder="Ex.: jiraproducao.totvs.com.br"
                required
                autoComplete="off"
                className={cn(FIELD, 'h-11')}
              />
              <span className={FIELD_HINT}>Só o endereço, sem https://</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jira-unit" className={FIELD_LABEL}>Unidade de estimativa</label>
              <SelectField id="jira-unit" aria-label="Unidade de estimativa" value={estimationUnit} onChange={setEstimationUnit} options={ESTIMATION_OPTIONS} className="h-11" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jira-token" className={FIELD_LABEL}>Token de acesso do Jira (PAT)</label>
              <input
                id="jira-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole o token pessoal"
                required
                autoComplete="off"
                className={cn(FIELD, 'h-11')}
              />
              <span className={cn(FIELD_HINT, 'flex flex-wrap items-center gap-x-2')}>
                Fica salvo na sua conta ao consultar.
                {hasSavedToken && (
                  <button
                    type="button"
                    onClick={() => setEraseOpen(true)}
                    className="rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
                  >
                    Apagar o token salvo
                  </button>
                )}
              </span>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error.title}</p>
                {error.hint && <p className="text-[13px] text-foreground">{error.hint}</p>}
                {error.detail && <p className="text-xs text-muted-foreground">{error.detail}</p>}
              </div>
            </div>
          )}

          <ModalButton variant="primary" type="submit" disabled={loading} className="h-11 w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            {loading ? 'Consultando o Jira...' : 'Consultar e pré-visualizar integrantes'}
          </ModalButton>

          {syncResult && (
            <div role="status" className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="success">{syncResult.memberCount} membros sincronizados</StatusChip>
                <span className="text-[13px] font-semibold text-foreground">{syncResult.squadName}</span>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* Validação e confirmação prévia */}
      <Modal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        size="lg"
        icon={ShieldCheck}
        title="Validação da importação do Jira"
        description={
          <>
            Projeto {previewData?.squadName} ({previewData?.squadId}): ajuste os cargos e tire quem não faz parte.
          </>
        }
        preventClose={confirming}
        footerStart={
          <span className="text-[13px] text-muted-foreground">
            Total a gravar: <strong className="text-foreground">{selectedCount}</strong> integrantes
          </span>
        }
        footer={
          <>
            <ModalButton variant="secondary" onClick={() => setIsPreviewOpen(false)} disabled={confirming}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleConfirmSync} disabled={confirming || selectedCount === 0} className="gap-2">
              {confirming ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              {confirming ? 'Gravando...' : 'Confirmar e gravar'}
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-foreground">
              <AdminCheckbox checked={allState} onChange={toggleSelectAll} label="Selecionar todos" />
              Selecionar todos
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className={FIELD_HINT}>O cargo é um dos {SQUAD_ROLES.length} da lista, escolhido por pessoa</span>
              <StatusChip tone="brand">{selectedCount} de {members.length} selecionados</StatusChip>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <Users className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">O Jira não devolveu ninguém neste projeto</p>
              <p className="text-[13px] text-muted-foreground">Confira a chave do projeto e o domínio.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {members.map((member) => (
                <li
                  key={member.jiraAccountId}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors',
                    member.selected ? 'border-border bg-muted/40' : 'border-border/60 bg-transparent opacity-60',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AdminCheckbox checked={member.selected} onChange={() => toggleSelectMember(member.jiraAccountId)} label={`Incluir ${member.displayName}`} />
                    <InitialsAvatar name={member.displayName} email={member.email} className="h-[34px] w-[34px] text-xs" />
                    <div className="flex min-w-0 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-foreground">{member.displayName}</span>
                        {member.score >= 90 && <StatusChip tone="warn" className="h-5">Liderança</StatusChip>}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{member.email || member.jiraAccountId}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SelectField
                      aria-label={`Cargo de ${member.displayName}`}
                      value={member.role}
                      onChange={(role) => updateCandidateRole(member.jiraAccountId, role)}
                      disabled={!member.selected}
                      options={(SQUAD_ROLES as readonly string[]).includes(member.role) ? SQUAD_ROLES.map((r) => ({ value: r, label: r })) : [member.role, ...SQUAD_ROLES].map((r) => ({ value: r, label: r }))}
                      className="h-9 w-[200px]"
                    />
                    <IconButton
                      size="sm"
                      label={`Excluir ${member.displayName} da lista`}
                      icon={Trash2}
                      onClick={() => removeCandidate(member.jiraAccountId)}
                      className="hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5">
              <AdminCheckbox checked={replaceExisting} onChange={() => setReplaceExisting((v) => !v)} label="Tirar da squad quem não estiver marcado" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-foreground">Tirar da squad quem não estiver marcado</span>
                <span className={FIELD_HINT}>Vem ligado. Quem a liderança removeu à mão do time não volta.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <AdminCheckbox checked={syncUsers} onChange={() => setSyncUsers((v) => !v)} label="Atualizar o cargo no cadastro de usuários" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-foreground">Atualizar o cargo no cadastro de usuários</span>
                <span className={FIELD_HINT}>Vem ligado. Quem ainda não tem cadastro entra como pré-cadastro.</span>
              </span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        tone="warn"
        icon={Trash2}
        title="Apagar o token salvo?"
        description="O token sai deste navegador e da sua conta. Para consultar de novo, cole o token outra vez."
        cancelLabel="Manter"
        confirmLabel="Apagar o token"
        loading={erasing}
        loadingLabel="Apagando…"
        keepOpenOnConfirm
        onConfirm={handleEraseToken}
      />
    </>
  );
}
