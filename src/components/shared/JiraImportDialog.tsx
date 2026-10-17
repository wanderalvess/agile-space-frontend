'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark, ChevronDown, CloudDownload, ExternalLink, FileUp, Globe, Loader2, RotateCcw, Search, Tag, User, X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { FIELD, FOCUS_RING, Modal, ModalButton, TabBar } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseJiraXml, fetchJiraIssues, enrichWithCodificacaoChildren, enrichWithParentContext, JiraIssue } from '@/services/jiraService';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useSavedJqls } from '@/hooks/useSavedJqls';
import { JQL_VISIBILITY_HELP, jqlPresets } from '@/components/showcase/review-room-logic';

interface JiraImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (issues: JiraIssue[]) => void;
  title?: string;
  description?: string;
  /** Chaves que já são cards da Review: aparecem marcadas na revisão e não voltam marcadas para importar. */
  existingKeys?: readonly string[];
  /** Chave da squad, para a predefinição de refinamento da própria squad. */
  squadKey?: string;
  /** Sprint ativa da squad (id do Jira), para a predefinição "Review da sprint atual". */
  sprintId?: string;
}

type SourceTab = 'xml' | 'api';

const LABEL = 'text-[13px] font-semibold text-foreground';
const CHIP = 'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors';

/** Cor do selo de status por heurística de texto (o Jira varia o nome). */
function statusClasses(s?: string) {
  const t = (s || '').toLowerCase();
  if (/(done|conclu|fech|resolv|encerr)/.test(t)) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (/(progress|andamento|doing|desenvolv|execu)/.test(t)) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (/(block|imped|bloque)/.test(t)) return 'bg-red-500/10 text-red-700 dark:text-red-300';
  if (/(review|revis|test|qa|homolog)/.test(t)) return 'bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground';
  return 'bg-muted text-muted-foreground';
}

const norm = (s?: string) => (s || '').toLowerCase();
const stripHtml = (s?: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function JiraImportDialog({
  open,
  onClose,
  onImport,
  title = 'Importar do Jira',
  description = 'Conecte sua squad ao Jira via XML ou API para sincronizar tarefas.',
  existingKeys,
  squadKey,
  sprintId,
}: JiraImportDialogProps) {
  const presets = useMemo(() => jqlPresets({ squadKey, sprintId }), [squadKey, sprintId]);
  const existing = useMemo(() => new Set(existingKeys ?? []), [existingKeys]);

  const { toast } = useToast();
  const { savedJqls, saveJql, deleteJql } = useSavedJqls();
  const [isSaveJqlOpen, setIsSaveJqlOpen] = useState(false);
  const [newJqlLabel, setNewJqlLabel] = useState('');
  const [newJqlIsPublic, setNewJqlIsPublic] = useState(false);
  const [tab, setTab] = useState<SourceTab>('xml');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JiraIssue[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Filtros sobre o resultado retornado (revisar antes de importar).
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  // Quais issues estão com o detalhe (descrição completa/critérios) expandido.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // API State
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [jql, setJql] = useState('');
  const [saveDefault, setSaveDefault] = useState(false);

  const { settings, saveSettings } = useJiraSettings();

  // Auto-populate saved credentials e prioriza API quando token já existe
  useEffect(() => {
    if (settings && open) {
      if (settings.token) setTab('api');
      if (!domain && !token) {
        setDomain(settings.domain || 'jiraproducao.totvs.com.br');
        setToken(settings.token || '');
        setSaveDefault(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, open]);

  const clearFilters = () => {
    setFilterText('');
    setTypeFilter(new Set());
    setStatusFilter(new Set());
  };

  /** Tudo vem marcado, menos o que já é card da Review (a importação não duplica a chave). */
  const selectNew = (issues: JiraIssue[]) => new Set(issues.filter((i) => !existing.has(i.key)).map((i) => i.key));

  const handleXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setLoading(true);
    try {
      const allIssues: JiraIssue[] = [];
      const filePromises = Array.from(files).map(async (file) => {
        const text = await file.text();
        return parseJiraXml(text);
      });

      const resultsArray = await Promise.all(filePromises);
      resultsArray.forEach((issues) => allIssues.push(...issues));

      // Chaves repetidas viram uma
      const uniqueIssues = Array.from(new Map(allIssues.map((i) => [i.key, i])).values());

      setResults(uniqueIssues);
      clearFilters();
      setSelected(selectNew(uniqueIssues));
      toast({ title: 'Arquivo lido!', description: `${uniqueIssues.length} issues detectadas.` });
    } catch (err: unknown) {
      toast({ title: 'Erro no XML', description: (err as Error)?.message || 'Arquivo inválido.', variant: 'destructive' });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleApiSearch = async () => {
    if (!domain || !token || !jql) return;
    setLoading(true);
    try {
      if (saveDefault) await saveSettings({ domain, token });
      const { issues, total } = await fetchJiraIssues(domain, token, jql);
      // Problema/solução às vezes só existem na subtarefa "Codificação" (issue filha), não na história em si.
      const enrichedFromChildren = await enrichWithCodificacaoChildren(domain, token, issues);
      // Caminho inverso: quando a própria subtarefa é a issue buscada, o contexto costuma estar na história pai.
      const enriched = await enrichWithParentContext(domain, token, enrichedFromChildren);
      setResults(enriched);
      clearFilters();
      setSelected(selectNew(enriched));
      // Avisa quando o board é maior que o limite retornado: refine a JQL para ver o resto.
      const truncated = typeof total === 'number' && total > issues.length;
      toast({
        title: 'Busca concluída!',
        description: truncated
          ? `${issues.length} de ${total} issues (limite atingido: refine a JQL para ver o resto).`
          : `${issues.length} issues encontradas.`,
        variant: truncated ? 'default' : undefined,
      });
    } catch (err: unknown) {
      toast({ title: 'Erro na busca', description: (err as Error)?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (key: string) => {
    if (existing.has(key)) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) =>
    setter((prev) => { const n = new Set(prev); if (n.has(value)) n.delete(value); else n.add(value); return n; });

  const distinctTypes = Array.from(new Set(results.map((r) => r.type).filter(Boolean)));
  const distinctStatuses = Array.from(new Set(results.map((r) => r.status).filter(Boolean)));

  // Resultado filtrado (busca por texto + tipo + status). Filtro vazio = tudo.
  const filteredResults = results.filter((r) => {
    if (typeFilter.size && !typeFilter.has(r.type)) return false;
    if (statusFilter.size && !statusFilter.has(r.status)) return false;
    if (filterText.trim()) {
      const q = norm(filterText);
      if (!norm(r.key).includes(q) && !norm(r.title).includes(q) && !norm(r.description).includes(q)) return false;
    }
    return true;
  });

  const selectable = filteredResults.filter((r) => !existing.has(r.key));
  const allFilteredSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.key));
  const alreadyCount = results.filter((r) => existing.has(r.key)).length;

  // Marcar/desmarcar age sobre o que está VISÍVEL (filtrado), preservando o resto da seleção.
  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) selectable.forEach((r) => next.delete(r.key));
    else selectable.forEach((r) => next.add(r.key));
    setSelected(next);
  };

  const reset = () => {
    setResults([]);
    setSelected(new Set());
    clearFilters();
    setExpanded(new Set());
    setJql('');
    if (!saveDefault) {
      setDomain('');
      setToken('');
    }
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpanded(next);
  };

  const handleConfirmImport = () => {
    const selectedIssues = results.filter((r) => selected.has(r.key) && !existing.has(r.key));
    onImport(selectedIssues);
    reset();
    onClose();
  };

  const close = () => { reset(); onClose(); };

  const fileInput = (cls: string) => (
    <input type="file" accept=".xml" multiple className={cls} onChange={handleXml} disabled={loading} aria-label="Selecionar arquivos XML do Jira" />
  );

  const footerButtons =
    results.length === 0 ? (
      tab === 'xml' ? (
        <span className="relative inline-flex">
          <ModalButton variant="primary" className="gap-2" tabIndex={-1}>
            <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Selecionar XML
          </ModalButton>
          {fileInput('absolute inset-0 cursor-pointer opacity-0')}
        </span>
      ) : (
        <ModalButton variant="primary" className="gap-2" onClick={handleApiSearch} disabled={loading || !domain || !token || !jql}>
          {loading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> : <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          Buscar no Jira
        </ModalButton>
      )
    ) : (
      <>
        {tab === 'api' && (
          <ModalButton className="gap-2" onClick={() => setResults([])}>
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Outra busca
          </ModalButton>
        )}
        <ModalButton variant="primary" onClick={handleConfirmImport} disabled={selected.size === 0}>
          Importar selecionados ({selected.size})
        </ModalButton>
      </>
    );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => { if (!o) close(); }}
        size="lg"
        icon={CloudDownload}
        title={title}
        description={description}
        className="sm:h-[min(88vh,840px)] sm:max-w-[1100px]"
        bodyClassName="pt-4"
        headerExtra={
          <TabBar<SourceTab>
            label="Origem das issues"
            idPrefix="jira"
            value={tab}
            onChange={setTab}
            tabs={[{ id: 'xml', label: 'Upload XML' }, { id: 'api', label: 'Conexão API' }]}
          />
        }
        footerStart={
          <div className="hidden min-w-0 flex-col md:flex">
            <span className="text-xs text-muted-foreground">Status da importação</span>
            <span className="truncate text-sm font-semibold">
              {results.length > 0
                ? <>{selected.size} {selected.size === 1 ? 'item selecionado' : 'itens selecionados'}{alreadyCount > 0 && <span className="font-normal text-muted-foreground"> · {alreadyCount} já {alreadyCount === 1 ? 'está' : 'estão'} na Review</span>}</>
                : tab === 'xml' ? 'Aguardando arquivo…' : 'Preencha os filtros…'}
            </span>
          </div>
        }
        footer={
          <>
            <ModalButton onClick={close}>Cancelar</ModalButton>
            {footerButtons}
          </>
        }
      >
        <div role="tabpanel" id={`jira-panel-${tab}`} aria-labelledby={`jira-tab-${tab}`} className="flex flex-col gap-4">
          {results.length === 0 && tab === 'xml' && (
            <div className="relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-within:border-primary/60">
              <FileUp className="mb-2.5 h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm font-semibold">Arraste ou selecione seu arquivo XML do Jira</span>
              <span className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Dica: no Jira, acesse <strong className="font-semibold text-foreground">Filters &gt; View all issues</strong>, aplique a busca e clique em <strong className="font-semibold text-foreground">Export &gt; XML</strong>.
              </span>
              {fileInput('absolute inset-0 cursor-pointer opacity-0')}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-card/75 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 text-primary motion-safe:animate-spin" aria-label="Lendo o arquivo" />
                </div>
              )}
            </div>
          )}

          {results.length === 0 && tab === 'api' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="jira-domain" className={LABEL}>Domínio do Jira</label>
                  <input id="jira-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="exemplo.atlassian.net" className={cn(FIELD, 'h-10')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="jira-token" className={LABEL}>Token (PAT)</label>
                  <input id="jira-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••••••" autoComplete="off" className={cn(FIELD, 'h-10 font-mono')} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="jira-jql" className={LABEL}>Consulta JQL</label>
                  <ModalButton
                    className="h-8 gap-1.5 px-3 text-[13px]"
                    disabled={!jql.trim()}
                    onClick={() => { setNewJqlLabel(''); setNewJqlIsPublic(false); setIsSaveJqlOpen(true); }}
                  >
                    <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Salvar JQL
                  </ModalButton>
                </div>
                <textarea
                  id="jira-jql"
                  value={jql}
                  onChange={(e) => setJql(e.target.value)}
                  placeholder='Ex.: sprint = 123 AND status = "In Progress"'
                  className={cn(FIELD, 'h-[72px] min-h-[72px] resize-none py-2 font-mono text-xs leading-normal')}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Consultas salvas e predefinições">
                  {/* Consultas salvas: ficam só neste navegador */}
                  {savedJqls.map((sj) => (
                    <span key={sj.id} className="group relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setJql(sj.jql)}
                        title={`Consulta ${sj.isPublic ? 'pública (só neste navegador)' : 'privada'} · criada por ${sj.createdBy || 'Usuário'}\n${sj.jql}`}
                        className={cn(CHIP, 'pr-7 border-border bg-card hover:bg-accent', FOCUS_RING)}
                      >
                        {sj.isPublic ? <Globe className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" /> : <User className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />}
                        <span className="max-w-[160px] truncate">{sj.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteJql(sj.id); toast({ title: 'JQL excluída com sucesso.' }); }}
                        title="Excluir esta JQL salva"
                        aria-label={`Excluir a JQL salva ${sj.label}`}
                        className={cn('absolute right-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100', FOCUS_RING)}
                      >
                        <X className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setJql(preset.jql)}
                      className={cn(CHIP, 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <label htmlFor="save-creds" className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
                <Checkbox id="save-creds" checked={saveDefault} onCheckedChange={(v) => setSaveDefault(!!v)} className="h-4 w-4 shrink-0 rounded-md" />
                <span className="text-[13px] font-medium">Lembrar as credenciais para as próximas sessões</span>
              </label>
            </div>
          )}

          {/* Revisão do que voltou do Jira */}
          {results.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-bold text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">
                    {filteredResults.length === results.length ? `${results.length} itens` : `${filteredResults.length} de ${results.length}`}
                  </span>
                  <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{selected.size} marcadas</span>
                  {alreadyCount > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">{alreadyCount} já na Review</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <ModalButton variant="ghost" className="h-8 px-3 text-[13px] font-semibold" onClick={toggleAll}>
                    {allFilteredSelected ? 'Desmarcar' : 'Marcar todas'}
                  </ModalButton>
                  <ModalButton variant="ghost" className="h-8 gap-1.5 px-3 text-[13px] font-semibold text-red-700 hover:text-red-700 dark:text-red-300" onClick={reset}>
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Resetar
                  </ModalButton>
                </div>
              </div>

              {/* Busca + filtros por tipo/status */}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filtrar por título, chave ou descrição..."
                    aria-label="Filtrar as issues"
                    className={cn(FIELD, 'h-9 pl-9 pr-8 text-[13px]')}
                  />
                  {filterText && (
                    <button type="button" onClick={() => setFilterText('')} aria-label="Limpar o filtro" className={cn('absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground', FOCUS_RING)}>
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {(distinctTypes.length > 1 || distinctStatuses.length > 1) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {distinctTypes.map((tp) => {
                      const active = typeFilter.has(tp);
                      return (
                        <button
                          key={`t-${tp}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleIn(setTypeFilter, tp)}
                          className={cn(CHIP, active ? 'border-primary bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border bg-card text-muted-foreground hover:border-foreground/30', FOCUS_RING)}
                        >
                          {tp} · {results.filter((r) => r.type === tp).length}
                        </button>
                      );
                    })}
                    {distinctStatuses.length > 1 && distinctTypes.length > 1 && <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />}
                    {distinctStatuses.map((st) => {
                      const active = statusFilter.has(st);
                      return (
                        <button
                          key={`s-${st}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleIn(setStatusFilter, st)}
                          className={cn(CHIP, active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:border-foreground/30', FOCUS_RING)}
                        >
                          {st} · {results.filter((r) => r.status === st).length}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <ul className="m-0 flex max-h-[46vh] min-h-[260px] list-none flex-col gap-2.5 overflow-y-auto p-0 pb-2 pr-1">
                {filteredResults.length === 0 ? (
                  <li className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Search className="mb-2 h-6 w-6 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                    <p className="m-0 text-sm font-semibold">Nenhum item bate o filtro</p>
                  </li>
                ) : filteredResults.map((r) => {
                  const isSel = selected.has(r.key);
                  const isOpen = expanded.has(r.key);
                  const isKnown = existing.has(r.key);
                  const hasDetail = !!(r.description || r.acceptanceCriteria);
                  return (
                    <li
                      key={r.key}
                      onClick={() => toggleSelect(r.key)}
                      className={cn(
                        'group rounded-xl border transition-colors',
                        isKnown ? 'cursor-default border-border bg-muted/30' : 'cursor-pointer',
                        !isKnown && (isSel ? 'border-primary/50 bg-primary/5' : 'border-border bg-card hover:bg-accent/40')
                      )}
                    >
                      <div className="flex items-start gap-3 p-3">
                        <Checkbox
                          checked={isSel}
                          disabled={isKnown}
                          onCheckedChange={() => toggleSelect(r.key)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={isKnown ? `${r.key} já está na Review` : `Marcar ${r.key}`}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{r.key}</span>
                            {r.type && <span className="rounded-md border border-border px-1.5 text-xs text-muted-foreground">{r.type}</span>}
                            {r.status && <span className={cn('rounded-md px-1.5 text-xs font-semibold', statusClasses(r.status))}>{r.status}</span>}
                            {isKnown && <span className="rounded-md bg-amber-500/10 px-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Já está na Review</span>}
                            {r.priority && <span className="text-xs text-muted-foreground">• {r.priority}</span>}
                            {r.points > 0 && <span className="ml-auto shrink-0 rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{r.points} pts</span>}
                          </div>
                          <h4 className="m-0 line-clamp-2 text-sm font-semibold leading-snug">{r.title}</h4>
                          {stripHtml(r.description) && <p className="m-0 mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{stripHtml(r.description)}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {r.assignee && <p className="m-0 truncate text-xs text-muted-foreground">Resp.: <span className="text-foreground">{r.assignee}</span></p>}
                            {r.labels && r.labels.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {r.labels.slice(0, 3).map((lb) => (
                                  <span key={lb} className="inline-flex items-center gap-1 rounded border border-border px-1.5 text-xs text-muted-foreground">
                                    <Tag className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />{lb}
                                  </span>
                                ))}
                                {r.labels.length > 3 && <span className="text-xs text-muted-foreground">+{r.labels.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(r.key); }}
                            aria-label={isOpen ? 'Recolher detalhes' : 'Ver detalhes'}
                            aria-expanded={isOpen}
                            className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', FOCUS_RING)}
                          >
                            <ChevronDown className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-180')} strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      {isOpen && hasDetail && (
                        <div className="flex cursor-default flex-col gap-3.5 rounded-b-xl border-t border-border bg-muted/30 px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          {r.description && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-muted-foreground">Descrição</span>
                              <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed">{r.description}</p>
                            </div>
                          )}
                          {r.acceptanceCriteria && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Critérios de aceite</span>
                              <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed">{r.acceptanceCriteria}</p>
                            </div>
                          )}
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Abrir no Jira
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* Salvar a consulta JQL (fica só neste navegador) */}
      <Modal
        open={isSaveJqlOpen}
        onOpenChange={setIsSaveJqlOpen}
        size="md"
        icon={Bookmark}
        title="Salvar consulta JQL"
        description="Dê um nome e escolha a visibilidade para reutilizar a consulta nas próximas importações."
        footer={
          <>
            <ModalButton onClick={() => setIsSaveJqlOpen(false)}>Cancelar</ModalButton>
            <ModalButton
              variant="primary"
              disabled={!newJqlLabel.trim() || !jql.trim()}
              onClick={() => {
                saveJql({ label: newJqlLabel, jql, isPublic: newJqlIsPublic });
                setIsSaveJqlOpen(false);
                toast({ title: 'JQL salva com sucesso!', description: newJqlIsPublic ? 'Salva como Pública, só neste navegador.' : 'Salva como Privada.' });
              }}
            >
              Salvar filtro
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Prévia da consulta</span>
            <div className="max-h-24 overflow-y-auto break-all rounded-xl border border-border bg-muted/40 p-2.5 font-mono text-xs leading-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              {jql || 'Nenhuma JQL preenchida'}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jql-name" className={LABEL}>Nome do filtro</label>
            <input id="jql-name" autoFocus value={newJqlLabel} onChange={(e) => setNewJqlLabel(e.target.value)} placeholder="Ex.: Meus bugs, Sprint ativa" className={cn(FIELD, 'h-10')} />
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className={cn(LABEL, 'mb-2 p-0')}>Visibilidade do filtro</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                { pub: false, icon: User, name: 'Privada', desc: JQL_VISIBILITY_HELP.private },
                { pub: true, icon: Globe, name: 'Pública', desc: JQL_VISIBILITY_HELP.public },
              ] as const).map((o) => {
                const on = newJqlIsPublic === o.pub;
                return (
                  <button
                    key={o.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setNewJqlIsPublic(o.pub)}
                    className={cn('flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors', on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/40', FOCUS_RING)}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold"><o.icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />{o.name}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{o.desc}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Modal>
    </>
  );
}
