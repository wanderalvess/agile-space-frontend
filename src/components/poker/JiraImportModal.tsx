"use client";

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bookmark, ChevronDown, CloudDownload, ExternalLink, FileUp, Globe, Loader2, Plug, RotateCcw, Search, Settings2, Tag, User, X,
} from 'lucide-react';
import { FIELD, FOCUS_RING, Modal, ModalButton, StatusChip, TabBar } from '@/components/room-kit';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useSavedJqls } from '@/hooks/useSavedJqls';
import { useUserContext } from '@/context/UserContext';
import { cn, toSafeExternalUrl } from '@/lib/utils';
import {
  EMPTY_FILTER, JQL_PRESETS, cleanJiraDomain, countDistinct, dedupeByKey, filterJiraResults, jiraStatusTone, stripHtml,
  type JiraResultFilter,
} from '@/lib/jira-import';
import { renderIssueRichText } from '@/lib/poker-issue-detail';
import { enrichWithCodificacaoChildren, enrichWithParentContext, fetchJiraIssues, parseJiraXml, type JiraIssue } from '@/services/jiraService';

interface JiraImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (issues: JiraIssue[]) => void;
  /** Chaves que já estão na fila (maiúsculas): aparecem como "Já na fila", desmarcadas e sem como marcar. */
  existingKeys?: ReadonlySet<string>;
}

type Source = 'api' | 'xml';

const SOURCES = [
  { id: 'api', label: 'Consulta JQL' },
  { id: 'xml', label: 'Arquivo XML' },
] as const;

const CHIP = 'inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-foreground transition-colors duration-fast hover:bg-accent';

const NO_KEYS: ReadonlySet<string> = new Set();

/** Importar do Jira (Scrum Poker): conexão, consulta ou XML, revisão das issues e importação para a fila. */
export function JiraImportModal({ open, onClose, onImport, existingKeys = NO_KEYS }: JiraImportModalProps) {
  const inQueue = (key: string) => existingKeys.has(key.toUpperCase());
  const { toast } = useToast();
  const { settings, saveSettings } = useJiraSettings();
  const { savedJqls, saveJql, deleteJql } = useSavedJqls();
  const { setIsEditProfileOpen } = useUserContext();

  const [source, setSource] = useState<Source>('api');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JiraIssue[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<JiraResultFilter>(EMPTY_FILTER);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editingCreds, setEditingCreds] = useState(false);
  // Vazio (null) = usa a conexão salva; digitar assume o campo.
  const [domainInput, setDomainInput] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [jql, setJql] = useState('');

  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [savePublic, setSavePublic] = useState(false);
  const xmlRef = useRef<HTMLInputElement>(null);

  const connected = !!(settings?.domain && settings?.token);
  const showCredFields = !connected || editingCreds;
  const domain = domainInput ?? settings?.domain ?? '';
  const token = tokenInput ?? settings?.token ?? '';

  const reset = () => {
    setResults(null);
    setTotal(null);
    setSelected(new Set());
    setFilter(EMPTY_FILTER);
    setExpanded(new Set());
    setError(null);
    setEditingCreds(false);
    setDomainInput(null);
    setTokenInput(null);
    setSource('api');
    setJql('');
    setLoading(false);
  };
  const close = () => { reset(); onClose(); };

  const startResults = (issues: JiraIssue[], count: number | null) => {
    setResults(issues);
    setTotal(count);
    setSelected(new Set(issues.filter((i) => !inQueue(i.key)).map((i) => i.key)));
    setFilter(EMPTY_FILTER);
    setExpanded(new Set());
  };

  const handleXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await Promise.all(Array.from(files).map(async (file) => parseJiraXml(await file.text())));
      const unique = dedupeByKey(parsed.flat());
      startResults(unique, null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Arquivo XML inválido.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const useDomain = cleanJiraDomain(domain);
  const useToken = token.trim();
  const canSearch = !!useDomain && !!useToken && !!jql.trim() && !loading;

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      if (showCredFields && remember) await saveSettings({ domain: useDomain, token: useToken });
      const { issues, total: count } = await fetchJiraIssues(useDomain, useToken, jql);
      // Problema/solução às vezes só existem na subtarefa "Codificação" (ou na história pai):
      // busca extra só para quem ficou sem esse contexto.
      const withChildren = await enrichWithCodificacaoChildren(useDomain, useToken, issues);
      const enriched = await enrichWithParentContext(useDomain, useToken, withChildren);
      startResults(enriched, typeof count === 'number' ? count : null);
      setEditingCreds(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível consultar o Jira.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    if (inQueue(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const toggleIn = (field: 'types' | 'statuses', value: string) =>
    setFilter((f) => {
      const next = new Set(f[field]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...f, [field]: next };
    });

  const visible = useMemo(() => (results ? filterJiraResults(results, filter) : []), [results, filter]);
  const types = useMemo(() => (results ? countDistinct(results, (r) => r.type) : []), [results]);
  const statuses = useMemo(() => (results ? countDistinct(results, (r) => r.status) : []), [results]);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.key) || inQueue(r.key));
  const alreadyQueued = results ? results.filter((r) => inQueue(r.key)).length : 0;
  const truncated = results !== null && total !== null && total > results.length;

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.key));
      else visible.forEach((r) => { if (!inQueue(r.key)) next.add(r.key); });
      return next;
    });

  const confirmImport = () => {
    if (!results) return;
    onImport(results.filter((r) => selected.has(r.key)));
    reset();
    onClose();
  };

  const openProfile = () => { close(); setIsEditProfileOpen(true); };

  const confirmSaveJql = () => {
    if (!saveLabel.trim() || !jql.trim()) return;
    saveJql({ label: saveLabel, jql, isPublic: savePublic });
    setIsSaveOpen(false);
    toast({ title: 'Consulta salva', description: savePublic ? 'Disponível para a squad.' : 'Disponível só para você.' });
  };

  const hasResults = results !== null && results.length > 0;
  const isEmpty = results !== null && results.length === 0;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => { if (!o) close(); }}
        size="lg"
        icon={CloudDownload}
        title="Importar do Jira"
        description="Escolha as tarefas que entram na fila. Importar não muda nada no Jira."
        headerExtra={
          results === null ? (
            <TabBar tabs={SOURCES} value={source} onChange={(id) => { setSource(id); setError(null); }} label="Origem das issues" idPrefix="jira-source" />
          ) : hasResults ? (
            <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 pb-3">
            {truncated && (
              <div role="status" className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span>Mostrando {results!.length} de {total} issues. Refine a consulta para ver o resto.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="neutral">{visible.length === results!.length ? `${results!.length} issues` : `${visible.length} de ${results!.length}`}</StatusChip>
              <StatusChip tone="brand">{selected.size} {selected.size === 1 ? 'marcada' : 'marcadas'}</StatusChip>
              {alreadyQueued > 0 && <StatusChip tone="neutral">{alreadyQueued} já na fila</StatusChip>}
              <span className="flex-1" />
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={visible.length === 0}
                className={cn('rounded text-xs font-semibold text-primary hover:underline disabled:opacity-50 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
              >
                {allVisibleSelected ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>

            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <input
                aria-label="Filtrar issues"
                value={filter.text}
                onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
                placeholder="Chave, título ou descrição"
                className={cn(FIELD, 'h-9 pl-9 pr-9 text-xs')}
              />
              {filter.text && (
                <button type="button" onClick={() => setFilter((f) => ({ ...f, text: '' }))} aria-label="Limpar filtro" className={cn('absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground', FOCUS_RING)}>
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {(types.length > 1 || statuses.length > 1) && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [&>*]:shrink-0">
                {types.map(([t, n]) => (
                  <button key={`t-${t}`} type="button" aria-pressed={filter.types.has(t)} onClick={() => toggleIn('types', t)} className={cn(CHIP, filter.types.has(t) && 'border-primary/50 bg-primary/10 font-semibold', FOCUS_RING)}>
                    {t} <span className="font-normal tabular-nums">{n}</span>
                  </button>
                ))}
                {types.length > 1 && statuses.length > 1 && <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />}
                {statuses.map(([s, n]) => (
                  <button key={`s-${s}`} type="button" aria-pressed={filter.statuses.has(s)} onClick={() => toggleIn('statuses', s)} className={cn(CHIP, filter.statuses.has(s) && 'border-primary/50 bg-primary/10 font-semibold', FOCUS_RING)}>
                    {s} <span className="font-normal tabular-nums">{n}</span>
                  </button>
                ))}
              </div>
            )}
            </div>
          ) : undefined
        }
        footerStart={
          results !== null ? (
            <>
              <ModalButton variant="ghost" onClick={() => { setResults(null); setError(null); }} className="gap-2">
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> <span className="max-sm:sr-only">Nova busca</span>
              </ModalButton>
              {hasResults && <span className="text-[13px] text-muted-foreground max-md:hidden">Entram na fila na ordem do Jira.</span>}
            </>
          ) : undefined
        }
        footer={
          <>
            <ModalButton onClick={close}>Cancelar</ModalButton>
            {hasResults ? (
              <ModalButton variant="primary" onClick={confirmImport} disabled={selected.size === 0} className="room-glow">
                Importar {selected.size} {selected.size === 1 ? 'tarefa' : 'tarefas'}
              </ModalButton>
            ) : results === null && source === 'api' ? (
              <ModalButton variant="primary" onClick={handleSearch} disabled={!canSearch} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> : <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                Buscar no Jira
              </ModalButton>
            ) : results === null ? (
              <ModalButton variant="primary" onClick={() => xmlRef.current?.click()} disabled={loading} className="gap-2">
                <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Selecionar XML
              </ModalButton>
            ) : null}
          </>
        }
        bodyClassName="pt-4"
      >
        <input ref={xmlRef} type="file" accept=".xml" multiple aria-label="Arquivo XML do Jira" className="hidden" onChange={handleXml} />

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dispensar erro" className={cn('rounded p-0.5 hover:bg-red-500/10', FOCUS_RING)}>
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {loading ? (
          <div role="status" className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" />
            {source === 'api' ? 'Consultando o Jira' : 'Lendo o arquivo'}
          </div>
        ) : results === null ? (
          source === 'api' ? (
            <div id="jira-source-panel-api" role="tabpanel" aria-labelledby="jira-source-tab-api" className="flex flex-col gap-5">
              {/* Conexão */}
              {showCredFields ? (
                <fieldset className="m-0 flex flex-col gap-3 rounded-xl border border-border p-3.5">
                  <legend className="sr-only">Conexão com o Jira</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="jira-domain" className="text-[13px] font-semibold text-foreground">Domínio</label>
                      <input id="jira-domain" value={domain} onChange={(e) => setDomainInput(e.target.value)} placeholder="empresa.atlassian.net" autoComplete="off" className={cn(FIELD, 'h-10 text-[13px]')} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="jira-token" className="text-[13px] font-semibold text-foreground">Token (PAT)</label>
                      <input id="jira-token" type="password" value={token} onChange={(e) => setTokenInput(e.target.value)} placeholder="••••••••••••" autoComplete="off" className={cn(FIELD, 'h-10 font-code text-[13px]')} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="jira-remember" className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                      <Checkbox id="jira-remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                      Lembrar credenciais
                    </label>
                    {connected && (
                      <ModalButton variant="ghost" onClick={() => { setEditingCreds(false); setDomainInput(null); setTokenInput(null); }} className="h-8 px-3 text-[13px]">
                        Usar a conexão salva
                      </ModalButton>
                    )}
                  </div>
                </fieldset>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                  <Plug className="h-4 w-4 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
                  <StatusChip tone="success">Conectado</StatusChip>
                  <span className="min-w-0 flex-1 truncate font-code text-[13px] text-foreground">{settings?.domain}</span>
                  <ModalButton variant="ghost" onClick={() => setEditingCreds(true)} className="h-8 px-3 text-[13px]">Alterar</ModalButton>
                  <ModalButton variant="ghost" onClick={openProfile} className="h-8 gap-1.5 px-3 text-[13px]">
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Perfil
                  </ModalButton>
                </div>
              )}

              {/* Consulta */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="jira-jql" className="text-[13px] font-semibold text-foreground">Consulta JQL</label>
                  <ModalButton
                    variant="ghost"
                    disabled={!jql.trim()}
                    onClick={() => { setSaveLabel(''); setSavePublic(false); setIsSaveOpen(true); }}
                    className="h-8 gap-1.5 px-3 text-[13px]"
                  >
                    <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Salvar consulta
                  </ModalButton>
                </div>
                <textarea
                  id="jira-jql"
                  value={jql}
                  onChange={(e) => setJql(e.target.value)}
                  onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSearch(); }}
                  placeholder='sprint = 123 AND status = "In Progress"'
                  rows={3}
                  spellCheck={false}
                  className={cn(FIELD, 'min-h-[84px] resize-none py-2.5 font-code text-xs leading-relaxed')}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {savedJqls.map((sj) => (
                    <span key={sj.id} className="group inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setJql(sj.jql)}
                        title={`${sj.isPublic ? 'Da squad' : 'Sua'} · ${sj.createdBy || 'Usuário'}\n${sj.jql}`}
                        className={cn(CHIP, 'rounded-r-none border-r-0', FOCUS_RING)}
                      >
                        {sj.isPublic ? <Globe className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> : <User className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
                        <span className="max-w-[140px] truncate">{sj.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { deleteJql(sj.id); toast({ title: 'Consulta excluída' }); }}
                        aria-label={`Excluir consulta ${sj.label}`}
                        className={cn('inline-flex h-7 w-7 items-center justify-center rounded-r-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground', FOCUS_RING)}
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                  {JQL_PRESETS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setJql(p.jql)} className={cn(CHIP, jql === p.jql && 'border-primary/50 bg-primary/10 font-semibold', FOCUS_RING)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div id="jira-source-panel-xml" role="tabpanel" aria-labelledby="jira-source-tab-xml">
              <div className="relative flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors duration-fast hover:border-primary/60 hover:bg-primary/5">
                <FileUp className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Arraste ou selecione o XML do Jira</span>
                <input type="file" accept=".xml" multiple aria-label="Selecionar arquivos XML" onChange={handleXml} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </div>
            </div>
          )
        ) : isEmpty ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Search className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-sm font-semibold text-foreground">Nenhuma issue encontrada</p>
            <ModalButton onClick={() => setResults(null)}>Nova busca</ModalButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                <p className="m-0 text-sm font-semibold text-foreground">Nenhuma issue com esse filtro</p>
                <ModalButton variant="ghost" onClick={() => setFilter(EMPTY_FILTER)} className="h-8 text-xs">Limpar filtros</ModalButton>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {visible.map((r) => {
                  const queued = inQueue(r.key);
                  const checked = !queued && selected.has(r.key);
                  const open = expanded.has(r.key);
                  const snippet = stripHtml(r.description);
                  const hasDetail = !!(r.description || r.acceptanceCriteria);
                  const href = toSafeExternalUrl(r.url);
                  const inputId = `jira-issue-${r.key}`;
                  return (
                    <li key={r.key} className={cn('rounded-xl border transition-colors duration-fast', queued ? 'border-dashed border-border opacity-75' : checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/40')}>
                      <div className="flex items-start">
                        <label htmlFor={inputId} className={cn('flex min-w-0 flex-1 items-start gap-3 p-3', queued ? 'cursor-default' : 'cursor-pointer')}>
                          <Checkbox id={inputId} checked={checked} disabled={queued} onCheckedChange={() => toggle(r.key)} className="mt-0.5" />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{r.key}</span>
                              {queued && <StatusChip tone="neutral">Já na fila</StatusChip>}
                              {r.type && <StatusChip tone="neutral">{r.type}</StatusChip>}
                              {r.status && <StatusChip tone={jiraStatusTone(r.status)}>{r.status}</StatusChip>}
                              {r.priority && <span className="text-xs text-muted-foreground">{r.priority}</span>}
                              {r.points > 0 && <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{r.points} pts</span>}
                            </span>
                            <span className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-foreground">{r.title}</span>
                            {snippet && <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{snippet}</span>}
                            {(r.assignee || (r.labels && r.labels.length > 0)) && (
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {r.assignee && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />{r.assignee}</span>}
                                {r.labels?.slice(0, 3).map((lb) => (
                                  <span key={lb} className="inline-flex items-center gap-1"><Tag className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />{lb}</span>
                                ))}
                                {r.labels && r.labels.length > 3 && <span>+{r.labels.length - 3}</span>}
                              </span>
                            )}
                          </span>
                        </label>
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.key)}
                            aria-expanded={open}
                            aria-label={open ? `Recolher ${r.key}` : `Pré-visualizar ${r.key}`}
                            title={open ? 'Recolher' : 'Pré-visualizar'}
                            className={cn('m-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground', FOCUS_RING)}
                          >
                            <ChevronDown className={cn('h-4 w-4 transition-transform duration-base motion-reduce:transition-none', open && 'rotate-180')} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                      {open && hasDetail && <IssuePreview issue={r} href={href} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={isSaveOpen}
        onOpenChange={setIsSaveOpen}
        size="sm"
        icon={Bookmark}
        title="Salvar consulta"
        footer={
          <>
            <ModalButton onClick={() => setIsSaveOpen(false)}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={confirmSaveJql} disabled={!saveLabel.trim() || !jql.trim()}>Salvar</ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <pre className="m-0 max-h-24 overflow-y-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-muted/40 p-2.5 font-code text-xs leading-normal text-foreground">{jql}</pre>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jira-save-label" className="text-[13px] font-semibold text-foreground">Nome</label>
            <input id="jira-save-label" value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder="Ex.: Sprint ativa" autoComplete="off" className={cn(FIELD, 'h-10 text-[13px]')} />
          </div>
          <div role="radiogroup" aria-label="Quem vê" className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
            {([[false, 'Só para mim', User], [true, 'Para a squad', Globe]] as const).map(([pub, label, Icon]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={savePublic === pub}
                onClick={() => setSavePublic(pub)}
                className={cn(
                  'flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors duration-fast',
                  FOCUS_RING,
                  savePublic === pub ? 'bg-card font-semibold text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Pré-visualização da issue antes de importar: descrição, critérios e link. */
function IssuePreview({ issue, href }: { issue: JiraIssue; href: string | null }) {
  const description = useMemo(() => renderIssueRichText(issue.description, issue.url), [issue.description, issue.url]);
  const criteria = useMemo(() => renderIssueRichText(issue.acceptanceCriteria, issue.url), [issue.acceptanceCriteria, issue.url]);
  return (
    <div className="flex flex-col gap-3 rounded-b-xl border-t border-border bg-muted/30 px-4 py-3.5">
      {description && (
        <section className="flex flex-col gap-1.5">
          <h4 className="m-0 text-xs font-bold text-muted-foreground">Descrição</h4>
          <div className="prose prose-sm max-h-60 max-w-none overflow-y-auto break-words text-[13px] leading-relaxed text-foreground dark:prose-invert prose-p:my-1.5" dangerouslySetInnerHTML={{ __html: description }} />
        </section>
      )}
      {criteria && (
        <section className="flex flex-col gap-1.5">
          <h4 className="m-0 text-xs font-bold text-muted-foreground">Critérios de aceite</h4>
          <div className="prose prose-sm max-h-48 max-w-none overflow-y-auto break-words text-[13px] leading-relaxed text-foreground dark:prose-invert prose-p:my-1.5" dangerouslySetInnerHTML={{ __html: criteria }} />
        </section>
      )}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1.5 self-start rounded text-xs font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Abrir no Jira
        </a>
      )}
    </div>
  );
}
