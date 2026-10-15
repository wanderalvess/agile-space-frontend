"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { type Issue, type DeckType, type Participant, type VotingRound } from '@/lib/types';
import { ConfirmDialog, FIELD, FOCUS_RING, IconTile, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Ban, Bug, CheckCircle2, ChevronDown, CloudDownload, Code, ExternalLink, FileText, Hourglass, Import, Layers,
  ListPlus, MessageSquare, MoreHorizontal, Palette, Pin, Play, Plus, RotateCcw, Search, SkipForward, Trash2, ArrowUpDown, type LucideIcon,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, isValidJiraKey, toSafeExternalUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { JiraIssue } from '@/services/jiraService';
import {
  filterQueue, importSummary, jiraIssueToQueueItem, nextQueueSort, queueStats, queueStatus,
  type QueueFilter, type QueueSort, type QueueStatus,
} from '@/lib/poker-queue';
import { issueToDetail } from '@/lib/poker-issue-detail';
import { IssueDetail } from './IssueDetail';
import { JiraImportModal } from './JiraImportModal';
import { QueueBulkModal } from './QueueBulkModal';
import { QueueTaskModal } from './QueueTaskModal';
import { RoundReportDialog } from './RoundReportDialog';

interface TopicQueueProps {
  issues: Issue[];
  activeIssueId: string | null;
  isFacilitator: boolean;
  onAddIssue: (title: string, jiraLink?: string, type?: Issue['type'], extraData?: Partial<Issue>) => void;
  onBulkAddIssues: (items: Partial<Issue>[]) => number | void;
  onSelectIssue: (issueId: string, autoSavePoints?: { points: string; devPoints?: string; qaPoints?: string }) => void;
  onDeleteIssue: (id: string) => void;
  onUnskipIssue?: (id: string) => void;
  onCancelIssue?: (id: string, note?: string) => void;
  onUncancelIssue?: (id: string) => void;
  onRevoteIssue?: (id: string) => void;
  // História de referência (baseline). Só habilitado quando o facilitador liga
  // o toggle; permite fixar um item já estimado como régua (toggle no próprio
  // item: clicar de novo no atual limpa).
  onSetReference?: (issueId: string | null) => void;
  referenceIssueId?: string | null;
  referenceEnabled?: boolean;
  deck: DeckType;
  hideSelectButton?: boolean;
  rounds?: VotingRound[];
  participants?: Participant[];
  // Atalho externo (ex: onboarding da sala vazia): incrementar esse número
  // abre o dialog de import do Jira direto, sem passar pelo dropdown Importar.
  autoOpenJiraImportSignal?: number;
  // Idem, para o formulário de nova tarefa.
  autoOpenAddFormSignal?: number;
}

const TYPE_ICONS: Record<string, LucideIcon> = { dev: Code, qa: Bug, design: Palette, other: Layers };

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Na fila' },
  { id: 'estimated', label: 'Estimadas' },
  { id: 'out', label: 'Fora' },
];

const MENU_ITEM = 'gap-2.5 rounded-lg px-2.5 py-2 text-[13px]';

export function TopicQueue({
  issues,
  activeIssueId,
  isFacilitator,
  onAddIssue,
  onBulkAddIssues,
  onSelectIssue,
  onDeleteIssue,
  onUnskipIssue,
  onCancelIssue,
  onUncancelIssue,
  onRevoteIssue,
  onSetReference,
  referenceIssueId,
  referenceEnabled,
  deck,
  rounds = [],
  participants = [],
  autoOpenJiraImportSignal,
  autoOpenAddFormSignal,
}: TopicQueueProps) {
  const { toast } = useToast();
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isJiraOpen, setIsJiraOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<VotingRound | null>(null);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [itemToCancel, setItemToCancel] = useState<Issue | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [sort, setSort] = useState<QueueSort>('none');

  // Atalhos do onboarding da sala vazia: cada incremento abre a janela certa.
  useEffect(() => {
    if (autoOpenJiraImportSignal) setIsJiraOpen(true);
  }, [autoOpenJiraImportSignal]);
  useEffect(() => {
    if (autoOpenAddFormSignal) setIsTaskOpen(true);
  }, [autoOpenAddFormSignal]);

  const stats = useMemo(() => queueStats(issues, activeIssueId), [issues, activeIssueId]);
  const visible = useMemo(() => filterQueue(issues, { query, filter, sort }, activeIssueId), [issues, query, filter, sort, activeIssueId]);

  const unit = deck === 'hours' ? 'h' : deck === 'tshirt' ? '' : ' SP';
  const counted = stats.estimated + stats.pending;
  const counts: Record<QueueFilter, number> = { all: stats.total, pending: stats.pending, estimated: stats.estimated, out: stats.out };

  const roundOf = (issue: Issue) => rounds.find((r) => r.issueId === issue.id || r.topic === issue.title) ?? null;

  const handleJiraImport = (selectedIssues: JiraIssue[]) => {
    const items = selectedIssues.map(jiraIssueToQueueItem);
    const { count, skipped } = importSummary(items.length, onBulkAddIssues(items), { one: 'issue', many: 'issues' });
    setIsJiraOpen(false);
    toast({
      title: count > 0 ? 'Importado com sucesso!' : 'Nada novo para importar',
      description: count > 0
        ? `${count} issue${count > 1 ? 's' : ''} do Jira adicionada${count > 1 ? 's' : ''} à fila${skipped > 0 ? ` (${skipped} já estava${skipped > 1 ? 'm' : ''} na fila)` : ''}.`
        : 'Todas as issues selecionadas já estavam na fila.',
    });
  };

  const noteTip = (note: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label="Ver o motivo" className={cn('flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-muted text-muted-foreground', FOCUS_RING)}>
            <MessageSquare className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">{note}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const statusChip = (issue: Issue, status: QueueStatus) => {
    switch (status) {
      case 'voting':
        return <StatusChip dot>Votando</StatusChip>;
      case 'estimated':
        return <StatusChip tone="success"><CheckCircle2 className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {issue.estimatedPoints || '??'}{unit}</StatusChip>;
      case 'skipped':
        return <StatusChip tone="warn"><SkipForward className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Pulada</StatusChip>;
      case 'cancelled':
        return <StatusChip tone="danger"><Ban className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Cancelada</StatusChip>;
      case 'parked':
        return <StatusChip tone="neutral"><Hourglass className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Adiada</StatusChip>;
      default:
        return <StatusChip tone="neutral">Na fila</StatusChip>;
    }
  };

  const renderRow = (issue: Issue) => {
    const status = queueStatus(issue, activeIssueId);
    const isActive = status === 'voting';
    const isDone = status === 'estimated' || status === 'skipped' || status === 'cancelled';
    const round = isDone ? roundOf(issue) : null;
    const Icon = TYPE_ICONS[issue.type || 'dev'] || Code;
    const note = status === 'cancelled' || status === 'skipped' ? issue.note : status === 'parked' ? issue.parkedNote : null;
    const canPutOnTable = isFacilitator && !isActive && !isDone;
    const jiraHref = toSafeExternalUrl(issue.jiraLink ?? undefined);
    const isReference = referenceIssueId === issue.id;
    const canReference = status === 'estimated' && !!issue.estimatedPoints && !!referenceEnabled && isFacilitator && !!onSetReference;
    const canRevote = status === 'estimated' && isFacilitator && !!onRevoteIssue;
    const canCancel = !isDone && isFacilitator && !!onCancelIssue;

    // Toque na linha: facilitador coloca na mesa; estimada abre o relatório; o resto abre o detalhe.
    const primary = () => {
      if (canPutOnTable) onSelectIssue(issue.id);
      else if (round) setSelectedRound(round);
      else setDetailIssue(issue);
    };
    const primaryHint = canPutOnTable ? 'Colocar na mesa' : round ? 'Ver relatório' : 'Ver detalhes';

    return (
      <li
        key={issue.id}
        className={cn(
          'group relative flex items-start gap-2.5 rounded-xl border p-2.5 transition-[background-color,border-color] duration-fast motion-reduce:transition-none',
          isActive ? 'border-primary/50 bg-primary/10 dark:bg-primary/15' : 'border-transparent hover:border-border hover:bg-accent/40'
        )}
      >
        <IconTile icon={Icon} tone={isActive ? 'brand' : 'neutral'} size="sm" className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={primary}
            title={primaryHint}
            className={cn('flex min-w-0 flex-col items-start gap-1 rounded-md text-left', FOCUS_RING)}
          >
            <span className="flex w-full min-w-0 items-center gap-1.5 text-[11px]">
              {isValidJiraKey(issue.key) && <span className="font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{issue.key}</span>}
              {issue.jiraType && <span className="truncate text-muted-foreground">{issue.jiraType}</span>}
            </span>
            <span
              className={cn(
                'line-clamp-2 break-words text-[13px] leading-snug text-foreground',
                isActive ? 'font-semibold' : 'font-medium',
                status === 'cancelled' && 'text-muted-foreground line-through'
              )}
            >
              {issue.title}
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            {statusChip(issue, status)}
            {note && noteTip(note)}
          </div>
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Mais ações: ${issue.title}`}
              className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground data-[state=open]:bg-accent', FOCUS_RING)}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
            {canPutOnTable && (
              <DropdownMenuItem onSelect={() => onSelectIssue(issue.id)} className={MENU_ITEM}>
                <Play strokeWidth={1.5} /> Colocar na mesa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDetailIssue(issue)} className={MENU_ITEM}>
              <FileText strokeWidth={1.5} /> Ver detalhes
            </DropdownMenuItem>
            {round && (
              <DropdownMenuItem onSelect={() => setSelectedRound(round)} className={MENU_ITEM}>
                <Search strokeWidth={1.5} /> Ver relatório
              </DropdownMenuItem>
            )}
            {jiraHref && (
              <DropdownMenuItem asChild className={MENU_ITEM}>
                <a href={jiraHref} target="_blank" rel="noopener noreferrer"><ExternalLink strokeWidth={1.5} /> Abrir no Jira</a>
              </DropdownMenuItem>
            )}
            {(canReference || canRevote) && <DropdownMenuSeparator />}
            {canReference && (
              <DropdownMenuItem onSelect={() => onSetReference?.(isReference ? null : issue.id)} className={MENU_ITEM}>
                <Pin strokeWidth={1.5} className={cn(isReference && 'fill-current')} /> {isReference ? 'Remover referência' : 'Definir como referência'}
              </DropdownMenuItem>
            )}
            {canRevote && (
              <DropdownMenuItem onSelect={() => onRevoteIssue?.(issue.id)} className={MENU_ITEM}>
                <RotateCcw strokeWidth={1.5} /> Votar novamente
              </DropdownMenuItem>
            )}
            {isFacilitator && (status === 'cancelled' || status === 'skipped' || canCancel) && <DropdownMenuSeparator />}
            {isFacilitator && status === 'cancelled' && onUncancelIssue && (
              <DropdownMenuItem onSelect={() => onUncancelIssue(issue.id)} className={MENU_ITEM}>
                <RotateCcw strokeWidth={1.5} /> Reativar tarefa
              </DropdownMenuItem>
            )}
            {isFacilitator && status === 'skipped' && onUnskipIssue && (
              <DropdownMenuItem onSelect={() => onUnskipIssue(issue.id)} className={MENU_ITEM}>
                <RotateCcw strokeWidth={1.5} /> Voltar para a fila
              </DropdownMenuItem>
            )}
            {canCancel && (
              <DropdownMenuItem onSelect={() => { setItemToCancel(issue); setCancelNote(''); }} className={MENU_ITEM}>
                <Ban strokeWidth={1.5} /> Cancelar no refinamento
              </DropdownMenuItem>
            )}
            {isFacilitator && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setIdToDelete(issue.id)}
                  className={cn(MENU_ITEM, 'text-red-700 focus:bg-red-500/10 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300')}
                >
                  <Trash2 strokeWidth={1.5} /> Excluir da fila
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

      </li>
    );
  };

  const deleting = issues.find((i) => i.id === idToDelete);
  const deletingStatus = deleting ? queueStatus(deleting, activeIssueId) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 text-[13px] text-muted-foreground">
            <span className="text-2xl font-bold tabular-nums text-foreground">{stats.estimated}</span> de <span className="tabular-nums">{counted}</span> estimadas
          </p>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{stats.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da fila">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-slow ease-room motion-reduce:transition-none" style={{ width: `${stats.progress}%` }} />
        </div>

        {isFacilitator && (
          <div className="flex gap-2">
            <ModalButton variant="primary" onClick={() => setIsTaskOpen(true)} className="h-9 flex-1 gap-1.5 text-[13px]">
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova tarefa
            </ModalButton>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ModalButton className="h-9 gap-1.5 text-[13px]">
                  <CloudDownload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={1.5} aria-hidden="true" />
                </ModalButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                <DropdownMenuItem onSelect={() => setIsJiraOpen(true)} className={MENU_ITEM}>
                  <CloudDownload strokeWidth={1.5} /> Do Jira
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsBulkOpen(true)} className={MENU_ITEM}>
                  <Import strokeWidth={1.5} /> Em lote (texto ou CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {issues.length > 0 && (
      <div className="flex shrink-0 flex-col gap-2.5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <input
              aria-label="Filtrar fila"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título ou chave"
              className={cn(FIELD, 'h-9 pl-9 pr-14 text-xs')}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-[11px] font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}>
                Limpar
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSort((s) => nextQueueSort(s))}
            aria-label="Ordenar por número"
            aria-pressed={sort !== 'none'}
            title={sort === 'none' ? 'Sem ordenação' : sort === 'num-asc' ? 'Número: menor para maior' : 'Número: maior para menor'}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-fast',
              FOCUS_RING,
              sort !== 'none' ? 'border-primary/60 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-foreground hover:bg-accent'
            )}
          >
            <ArrowUpDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div role="group" aria-label="Situação das tarefas" className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'flex min-w-0 flex-col items-center rounded-lg py-1.5 transition-colors duration-fast',
                  FOCUS_RING,
                  on ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="text-sm font-bold tabular-nums leading-none">{counts[f.id]}</span>
                <span className={cn('mt-1 max-w-full truncate text-[11px] leading-none', on && 'font-semibold')}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 px-2.5 pb-6">
          {visible.length === 0 ? (
            <li className="mx-1.5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-5 py-8 text-center">
              {issues.length === 0 ? (
                <>
                  <IconTile icon={ListPlus} tone="neutral" size="lg" />
                  <p className="m-0 text-sm font-semibold text-foreground">Fila vazia</p>
                  {isFacilitator && (
                    <div className="flex w-full flex-col gap-2">
                      <ModalButton variant="primary" onClick={() => setIsJiraOpen(true)} className="w-full gap-2 text-[13px]">
                        <CloudDownload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar do Jira
                      </ModalButton>
                      <ModalButton onClick={() => setIsTaskOpen(true)} className="w-full gap-2 text-[13px]">
                        <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova tarefa
                      </ModalButton>
                      <ModalButton variant="ghost" onClick={() => setIsBulkOpen(true)} className="w-full gap-2 text-[13px]">
                        <Import className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Em lote
                      </ModalButton>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <p className="m-0 text-sm font-semibold text-foreground">Nada encontrado</p>
                  <ModalButton variant="ghost" onClick={() => { setQuery(''); setFilter('all'); }} className="h-8 text-xs">Limpar filtros</ModalButton>
                </>
              )}
            </li>
          ) : (
            visible.map(renderRow)
          )}
        </ul>
      </ScrollArea>

      <RoundReportDialog round={selectedRound} onClose={() => setSelectedRound(null)} participants={participants} />

      <IssueDetail
        issue={detailIssue ? issueToDetail(detailIssue) : null}
        isOpen={!!detailIssue}
        onClose={() => setDetailIssue(null)}
      />

      <QueueTaskModal open={isTaskOpen} onOpenChange={setIsTaskOpen} issues={issues} onAdd={onAddIssue} />
      <QueueBulkModal open={isBulkOpen} onOpenChange={setIsBulkOpen} issues={issues} onImport={onBulkAddIssues} />
      <JiraImportModal open={isJiraOpen} onClose={() => setIsJiraOpen(false)} onImport={handleJiraImport} />

      <ConfirmDialog
        open={!!idToDelete}
        onOpenChange={(open) => { if (!open) setIdToDelete(null); }}
        tone="danger"
        icon={Trash2}
        title="Excluir tarefa da fila?"
        description={
          deletingStatus === 'voting'
            ? 'Esta tarefa está sendo votada agora. A exclusão não pode ser desfeita.'
            : deletingStatus === 'estimated'
              ? 'Esta tarefa já foi estimada. A exclusão não pode ser desfeita.'
              : 'A exclusão não pode ser desfeita.'
        }
        cancelLabel="Manter"
        confirmLabel="Excluir tarefa"
        onConfirm={() => {
          if (idToDelete) {
            onDeleteIssue(idToDelete);
            setIdToDelete(null);
          }
        }}
      />

      <Modal
        open={!!itemToCancel}
        onOpenChange={(open) => { if (!open) { setItemToCancel(null); setCancelNote(''); } }}
        size="md"
        tone="warn"
        iconTone="neutral"
        icon={Ban}
        title="Cancelar no refinamento?"
        dismissible={false}
        footer={
          <>
            <ModalButton onClick={() => setItemToCancel(null)}>Voltar</ModalButton>
            <ModalButton
              variant="danger"
              onClick={() => {
                if (itemToCancel && onCancelIssue) {
                  onCancelIssue(itemToCancel.id, cancelNote.trim() || undefined);
                  setItemToCancel(null);
                  setCancelNote('');
                }
              }}
            >
              Cancelar tarefa
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="queue-cancel-why" className="text-[13px] font-semibold text-foreground">Motivo</label>
          <textarea
            id="queue-cancel-why"
            rows={3}
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="Ex.: descartada pelo PO, escopo duplicado, descontinuada"
            className={cn(FIELD, 'min-h-[88px] resize-none py-2.5')}
          />
        </div>
      </Modal>
    </div>
  );
}
