"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { type Issue, type DeckType, type Participant } from '@/lib/types';
import { getParticipantCategory, TECHNICAL_CATEGORIES, formatRoleForCopy, formatEstimateCopy, mapJiraTypeToIssueType } from '@/lib/poker-utils';
import { ConfirmDialog, FIELD, Modal, ModalButton, ROLE_STYLES, StatusChip, roleToneOf } from '@/components/room-kit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ExternalLink, CheckCircle2, Play, Circle, Import, Trash2, Code, Bug, Palette, Layers, Search, Shield, AlertTriangle, CloudDownload, FileUp, Lightbulb, Info, ChevronDown, RotateCcw, MessageSquare, Copy, ClipboardCopy, Sparkles, ArrowUpDown, Pin, Hourglass, Ban } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatExternalUrl } from '@/lib/utils';
import { pokerDialogContent, pokerDialogTitleCls, pokerDialogDescCls, pokerDialogFooterCls } from '@/lib/poker-ui';
import { Badge } from '@/components/ui/badge';
import { isValidJiraKey } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { JiraIssue } from '@/services/jiraService';


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
  rounds?: any[];
  participants?: any[];
  // Atalho externo (ex: onboarding da sala vazia): incrementar esse número
  // abre o dialog de import do Jira direto, sem passar pelo dropdown Importar.
  autoOpenJiraImportSignal?: number;
  // Idem, mas para o formulário de criação manual — sem isso o painel fica
  // colapsado atrás de um ícone "+" sem rótulo e o facilitador não acha onde
  // criar a primeira tarefa.
  autoOpenAddFormSignal?: number;
}

const TYPE_ICONS: Record<string, any> = {
  dev: Code,
  qa: Bug,
  design: Palette,
  other: Layers
};

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
  hideSelectButton,
  rounds = [],
  participants = [],
  autoOpenJiraImportSignal,
  autoOpenAddFormSignal,
}: TopicQueueProps) {
  const { toast } = useToast();
  const [selectedRound, setSelectedRound] = useState<any | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newType, setNewType] = useState<Issue['type']>('dev');
  // Prep opcional no add manual: descrição/objetivo + critérios de aceite,
  // pra manual ter o mesmo contexto que item importado do Jira.
  const [newDescription, setNewDescription] = useState('');
  const [newAcceptanceCriteria, setNewAcceptanceCriteria] = useState('');
  const [showAddDetails, setShowAddDetails] = useState(false);

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreviewItems, setBulkPreviewItems] = useState<{ id: string; key: string; title: string; link: string; type: Issue['type']; duplicate: boolean }[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [isBulkPreview, setIsBulkPreview] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [itemToCancel, setItemToCancel] = useState<Issue | null>(null);
  const [cancelModalNote, setCancelModalNote] = useState('');

  // --- Jira Import State (Managed by Dialog) ---
  const [isJiraImportOpen, setIsJiraImportOpen] = useState(false);

  // Atalho do onboarding: cada incremento do sinal externo abre o dialog do
  // Jira direto, sem o facilitador precisar navegar pelo dropdown Importar.
  useEffect(() => {
    if (autoOpenJiraImportSignal) setIsJiraImportOpen(true);
  }, [autoOpenJiraImportSignal]);
  // --- Search & UI Control State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isManagementOpen, setIsManagementOpen] = useState(false);

  // Mesmo atalho, mas pro formulário de criação manual.
  useEffect(() => {
    if (autoOpenAddFormSignal) setIsManagementOpen(true);
  }, [autoOpenAddFormSignal]);
  const [sortOrder, setSortOrder] = useState<'none' | 'num-asc' | 'num-desc'>('none');

  const handleJiraImport = (selectedIssues: JiraIssue[]) => {
    const items = selectedIssues.map((r) => {
      // Se o summary já contiver a key ou estiver vazio, usamos o summary
      let displayTitle = '';
      if (!r.title || r.title === r.key || r.title.includes(r.key)) {
        displayTitle = r.title || r.key;
      } else {
        displayTitle = `${r.key} - ${r.title}`;
      }

      return {
        title: displayTitle,
        key: r.key,
        jiraLink: r.url,
        description: r.description || '',
        jiraType: r.type || '',
        jiraStatus: r.status || '',
        jiraPriority: r.priority || '',
        jiraAssignee: r.assignee || '',
        jiraUpdated: r.updated || '',
        jiraLabels: r.labels || [],
        // Antes descartados na importação por API:
        acceptanceCriteria: r.acceptanceCriteria || '',
        jiraPoints: r.points ? String(r.points) : '',
        type: mapJiraTypeToIssueType(r.type),
      };
    });

    const added = onBulkAddIssues(items);
    setIsJiraImportOpen(false);
    // O pai descarta o que já está na fila; o aviso conta só o que entrou de fato.
    const count = typeof added === 'number' ? added : items.length;
    const skipped = items.length - count;
    toast({
      title: count > 0 ? 'Importado com sucesso!' : 'Nada novo para importar',
      description: count > 0
        ? `${count} issue${count > 1 ? 's' : ''} do Jira adicionada${count > 1 ? 's' : ''} à fila${skipped > 0 ? ` (${skipped} já estava${skipped > 1 ? 'm' : ''} na fila)` : ''}.`
        : 'Todas as issues selecionadas já estavam na fila.',
    });
  };

  // Detecta o tipo da tarefa por palavras-chave (título/chave), para o preview
  // da importação já vir classificado. Default 'dev', igual ao form manual.
  const detectBulkType = (text: string): Issue['type'] => {
    const t = text.toLowerCase();
    if (/\b(bug|defeito|defect|erro|hotfix|qa|teste|test)\b/.test(t)) return 'qa';
    if (/\b(design|ux|ui|prot[oó]tipo|figma|layout|wireframe)\b/.test(t)) return 'design';
    if (/\b(doc|documenta|spike|infra|deploy)\b/.test(t)) return 'other';
    return 'dev';
  };

  // Marca duplicatas (contra a fila atual e dentro do próprio lote) e classifica
  // o tipo. Duplicatas entram desmarcadas por padrão — mas quem decide é o
  // facilitador, então continuam visíveis e selecionáveis.
  const decorateBulkPreview = (
    raw: { id: string; key: string; title: string; link: string }[]
  ) => {
    const existingKeys = new Set(issues.map(i => (i.key || '').toUpperCase()).filter(Boolean));
    const existingTitles = new Set(issues.map(i => i.title.trim().toLowerCase()));
    const seenKeys = new Set<string>();
    const seenTitles = new Set<string>();
    return raw.map((it, idx) => {
      const keyU = it.key.toUpperCase();
      const titleN = it.title.trim().toLowerCase();
      const dupExisting = (!!keyU && existingKeys.has(keyU)) || (!!titleN && existingTitles.has(titleN));
      const dupBatch = (!!keyU && seenKeys.has(keyU)) || (!!titleN && seenTitles.has(titleN));
      if (keyU) seenKeys.add(keyU);
      if (titleN) seenTitles.add(titleN);
      return {
        ...it,
        id: `${it.key || 'row'}-${idx}`, // id único: evita colidir seleção de linhas iguais
        type: detectBulkType(`${it.key} ${it.title}`),
        duplicate: dupExisting || dupBatch,
      };
    });
  };

  const applyBulkPreview = (raw: { id: string; key: string; title: string; link: string }[]) => {
    const decorated = decorateBulkPreview(raw);
    setBulkPreviewItems(decorated);
    setBulkSelected(new Set(decorated.filter(i => !i.duplicate).map(i => i.id)));
    setIsBulkPreview(true);
  };

  const parseBulkLine = (line: string) => {
    const parts = line.split('|').map(p => p.trim());
    let key = '';
    let title = '';
    let link = '';

    if (parts.length === 1) {
      if (isValidJiraKey(parts[0])) {
        key = parts[0];
        title = parts[0];
      } else {
        title = parts[0];
        key = ''; // No visible key for simple text
      }
    } else if (parts.length === 2) {
      key = parts[0];
      title = parts[1];
    } else if (parts.length >= 3) {
      key = parts[0];
      title = parts[1];
      link = parts[2];
    }

    return {
      id: key || `ID-${Math.random().toString(36).substr(2, 8)}`,
      key: isValidJiraKey(key) ? key : '',
      title,
      link
    };
  };

  const handleBulkCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const previewItems = lines.map(line => {
        // Detect delimiter: , or ;
        const delimiter = line.includes(';') ? ';' : ',';
        const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

        const key = isValidJiraKey(cols[0]) ? cols[0] : '';
        const title = cols[1] || cols[0] || 'Sem Título';
        const link = cols[2] || '';

        return {
          id: key || `CSV-${Math.random().toString(36).substr(2, 8)}`,
          key,
          title,
          link
        };
      });

      applyBulkPreview(previewItems);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmitPreview = () => {
    const lines = bulkText.split('\n').filter(l => l.trim());
    const previewItems = lines.map(parseBulkLine);

    if (previewItems.length === 0) {
      toast({ title: "Nenhuma tarefa encontrada", description: "Certifique-se de que o texto não está vazio.", variant: "destructive" });
      return;
    }

    applyBulkPreview(previewItems);
  };

  const handleConfirmBulkAdd = () => {
    const selectedItems = bulkPreviewItems
      .filter(item => bulkSelected.has(item.id))
      .map(item => ({
        title: item.title,
        jiraLink: item.link,
        key: item.key || undefined,
        type: item.type,
      }));

    if (selectedItems.length > 0) {
      const added = onBulkAddIssues(selectedItems);
      setIsBulkImportOpen(false);
      setBulkText('');
      setBulkPreviewItems([]);
      setIsBulkPreview(false);
      const count = typeof added === 'number' ? added : selectedItems.length;
      toast({
        title: count > 0 ? 'Importado!' : 'Nada novo para importar',
        description: count > 0
          ? `${count} tarefa${count > 1 ? 's' : ''} adicionada${count > 1 ? 's' : ''}.`
          : 'Todas as tarefas já estavam na fila.',
      });
    }
  };

  const handleBulkToggleSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkToggleAll = () => {
    if (bulkSelected.size === bulkPreviewItems.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(bulkPreviewItems.map(i => i.id)));
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      const extra: Partial<Issue> = {};
      if (newDescription.trim()) extra.description = newDescription.trim();
      if (newAcceptanceCriteria.trim()) extra.acceptanceCriteria = newAcceptanceCriteria.trim();
      onAddIssue(newTitle.trim(), newLink.trim() || "", newType, Object.keys(extra).length ? extra : undefined);
      setNewTitle('');
      setNewLink('');
      setNewType('dev');
      setNewDescription('');
      setNewAcceptanceCriteria('');
      setShowAddDetails(false);
    }
  };

  const handleBulkSubmit = () => {
    handleBulkSubmitPreview();
  };

  const getUnit = () => {
    if (deck === 'hours') return 'H';
    if (deck === 'tshirt') return '';
    return 'SP';
  };

  const getTaskNumber = (issue: Issue) => {
    if (issue.key) {
      const match = issue.key.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    const matchTitle = issue.title.match(/\d+/);
    if (matchTitle) {
      return parseInt(matchTitle[0], 10);
    }
    return null;
  };

  const filteredIssues = useMemo(() => {
    let result = issues.filter(issue => {
      const searchLower = searchQuery.toLowerCase();
      return (
        issue.title.toLowerCase().includes(searchLower) ||
        (issue.key && issue.key.toLowerCase().includes(searchLower))
      );
    });

    if (sortOrder !== 'none') {
      result = [...result].sort((a, b) => {
        const numA = getTaskNumber(a);
        const numB = getTaskNumber(b);

        if (numA === null && numB === null) return 0;
        if (numA === null) return 1;
        if (numB === null) return -1;

        return sortOrder === 'num-asc' ? numA - numB : numB - numA;
      });
    }

    return result;
  }, [issues, searchQuery, sortOrder]);

  const estimatedCount = issues.filter(i => i.status === 'completed' && !i.skipped && !i.cancelled).length;
  const progress = issues.length ? Math.round((estimatedCount / issues.length) * 100) : 0;
  const unit = getUnit();

  const openReport = (issue: Issue) => {
    const round = rounds.find(r => r.issueId === issue.id || r.topic === issue.title);
    if (round) setSelectedRound(round);
  };

  const noteTip = (note: string, tone: string) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label="Ver o motivo" className={cn('flex h-5 w-5 cursor-help items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', tone)}>
            <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">{note}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const rowAction = 'h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {isFacilitator && (
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="flex-1 text-xs text-muted-foreground tabular-nums">{estimatedCount} de {issues.length} estimadas</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs">
                  <CloudDownload className="h-3.5 w-3.5" strokeWidth={1.5} /> Importar <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuItem onClick={() => setIsJiraImportOpen(true)} className="gap-2.5 py-2.5 text-sm">
                  <CloudDownload className="h-4 w-4" strokeWidth={1.5} /> Do Jira
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBulkImportOpen(true)} className="gap-2.5 py-2.5 text-sm">
                  <Import className="h-4 w-4" strokeWidth={1.5} /> Em lote (texto ou CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsManagementOpen(!isManagementOpen)}
              aria-expanded={isManagementOpen}
              aria-label={isManagementOpen ? 'Recolher formulário' : 'Adicionar tarefa'}
              title={isManagementOpen ? 'Recolher formulário' : 'Adicionar tarefa'}
              className={cn('h-8 w-8 rounded-lg', isManagementOpen && 'border-primary/60 bg-primary/10')}
            >
              <Plus className={cn('h-4 w-4 transition-transform duration-base', isManagementOpen && 'rotate-45')} strokeWidth={1.5} />
            </Button>
          </div>
          <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da fila">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-slow ease-room" style={{ width: `${progress}%` }} />
          </div>

          {isManagementOpen && (
            <form onSubmit={handleAdd} className="room-rise flex flex-col gap-2.5 border-t border-border p-4">
              <div className="flex gap-2">
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger aria-label="Tipo da tarefa" className={cn(FIELD, 'h-10 w-[64px] shrink-0 px-2')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev"><Code className="h-4 w-4" strokeWidth={1.5} /></SelectItem>
                    <SelectItem value="qa"><Bug className="h-4 w-4" strokeWidth={1.5} /></SelectItem>
                    <SelectItem value="design"><Palette className="h-4 w-4" strokeWidth={1.5} /></SelectItem>
                    <SelectItem value="other"><Layers className="h-4 w-4" strokeWidth={1.5} /></SelectItem>
                  </SelectContent>
                </Select>
                <input
                  aria-label="Chave ou título"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Chave ou título da tarefa"
                  className={cn(FIELD, 'h-10 min-w-0 flex-1 text-[13px]')}
                />
              </div>
              <input
                aria-label="Link do cartão"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Link do cartão (opcional)"
                className={cn(FIELD, 'h-10 text-[13px]')}
              />
              <button
                type="button"
                onClick={() => setShowAddDetails(v => !v)}
                aria-expanded={showAddDetails}
                className="flex items-center gap-1.5 self-start rounded text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform duration-base', showAddDetails && 'rotate-180')} strokeWidth={1.5} />
                {showAddDetails ? 'Ocultar detalhes' : 'Detalhes (opcional)'}
              </button>
              {showAddDetails && (
                <div className="room-rise flex flex-col gap-2">
                  <textarea aria-label="Descrição" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição ou objetivo" rows={2} className={cn(FIELD, 'resize-none py-2 text-[13px]')} />
                  <textarea aria-label="Critérios de aceite" value={newAcceptanceCriteria} onChange={(e) => setNewAcceptanceCriteria(e.target.value)} placeholder="Critérios de aceite" rows={2} className={cn(FIELD, 'resize-none py-2 text-[13px]')} />
                </div>
              )}
              <ModalButton variant="primary" type="submit" disabled={!newTitle.trim()} className="h-10 w-full gap-2 text-[13px]">
                <Plus className="h-4 w-4" strokeWidth={1.5} /> Adicionar tarefa
              </ModalButton>
            </form>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <input
            aria-label="Filtrar fila"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por título ou chave"
            className={cn(FIELD, 'h-9 pl-9 pr-14 text-xs')}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-[11px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Limpar
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(prev => (prev === 'none' ? 'num-asc' : prev === 'num-asc' ? 'num-desc' : 'none'))}
          aria-label="Ordenar por número"
          className={cn('h-9 w-9 shrink-0 rounded-lg', sortOrder !== 'none' && 'border-primary/60 bg-primary/10')}
          title={sortOrder === 'none' ? 'Sem ordenação' : sortOrder === 'num-asc' ? 'Número: menor para maior' : 'Número: maior para menor'}
        >
          <ArrowUpDown className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 px-3 pb-6">
          {filteredIssues.length === 0 ? (
            <li className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-5 py-10 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <p className="m-0 text-sm font-semibold">{searchQuery ? 'Nada encontrado' : 'Fila vazia'}</p>
              {!searchQuery && <p className="m-0 text-xs text-muted-foreground">Importe ou adicione as tarefas desta sessão.</p>}
            </li>
          ) : (
            filteredIssues.map((issue) => {
              const isActive = issue.id === activeIssueId;
              const isCompleted = issue.status === 'completed';
              const Icon = TYPE_ICONS[issue.type || 'dev'] || Code;
              const clickable = (isFacilitator && !isActive && !isCompleted) || isCompleted;

              return (
                <li
                  key={issue.id}
                  onClick={() => {
                    if (isFacilitator && !isActive && !isCompleted) onSelectIssue(issue.id);
                    else if (isCompleted) openReport(issue);
                  }}
                  className={cn(
                    'group relative flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-fast',
                    isActive ? 'border-primary/50 bg-primary/10 dark:bg-primary/15' : 'border-transparent hover:border-border hover:bg-accent/40',
                    clickable && 'cursor-pointer'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    {isValidJiraKey(issue.key) && <span className="truncate text-[11px] font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{issue.key}</span>}
                    <span className="ml-auto flex items-center gap-1.5">
                      {isCompleted ? (
                        issue.cancelled ? (
                          <>
                            <StatusChip tone="danger"><Ban className="h-3 w-3" strokeWidth={1.5} /> Cancelada</StatusChip>
                            {issue.note && noteTip(issue.note, 'bg-red-500/10 text-red-700 dark:text-red-300')}
                            {isFacilitator && onUncancelIssue && (
                              <Button variant="ghost" size="icon" aria-label="Reativar tarefa" title="Reativar tarefa" onClick={(e) => { e.stopPropagation(); onUncancelIssue(issue.id); }} className={rowAction}>
                                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </Button>
                            )}
                          </>
                        ) : issue.skipped ? (
                          <>
                            <StatusChip tone="warn"><AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Pulada</StatusChip>
                            {issue.note && noteTip(issue.note, 'bg-amber-500/10 text-amber-700 dark:text-amber-300')}
                            {isFacilitator && onUnskipIssue && (
                              <Button variant="ghost" size="icon" aria-label="Voltar para a fila" title="Voltar para a fila" onClick={(e) => { e.stopPropagation(); onUnskipIssue(issue.id); }} className={rowAction}>
                                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </Button>
                            )}
                          </>
                        ) : (
                          <StatusChip tone="success"><CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> {issue.estimatedPoints || '??'}{unit.toLowerCase() === 'h' ? 'h' : unit ? ` ${unit}` : ''}</StatusChip>
                        )
                      ) : isActive ? (
                        <StatusChip dot>Votando</StatusChip>
                      ) : issue.parked ? (
                        <>
                          <StatusChip tone="neutral"><Hourglass className="h-3 w-3" strokeWidth={1.5} /> Adiada</StatusChip>
                          {issue.parkedNote && noteTip(issue.parkedNote, 'bg-muted text-muted-foreground')}
                        </>
                      ) : (
                        <StatusChip tone="neutral"><Circle className="h-2.5 w-2.5" strokeWidth={1.5} /> Pendente</StatusChip>
                      )}
                    </span>
                  </div>

                  <h3 className={cn('m-0 line-clamp-2 break-words text-[13px] leading-snug', isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground/85', issue.cancelled && 'line-through opacity-70')}>
                    {issue.title}
                  </h3>

                  <div className="flex items-center justify-end gap-0.5">
                    {issue.jiraLink && (
                      <a
                        href={formatExternalUrl(issue.jiraLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn('flex items-center justify-center', rowAction)}
                        title="Ver no Jira"
                        aria-label="Ver no Jira"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </a>
                    )}
                    {isCompleted && !issue.skipped && issue.estimatedPoints && referenceEnabled && isFacilitator && onSetReference && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onSetReference(referenceIssueId === issue.id ? null : issue.id); }}
                        className={cn(rowAction, referenceIssueId === issue.id && 'bg-primary/10 text-primary')}
                        title={referenceIssueId === issue.id ? 'Remover referência' : 'Definir como referência'}
                        aria-label={referenceIssueId === issue.id ? 'Remover referência' : 'Definir como referência'}
                        aria-pressed={referenceIssueId === issue.id}
                      >
                        <Pin className={cn('h-3.5 w-3.5', referenceIssueId === issue.id && 'fill-current')} strokeWidth={1.5} />
                      </Button>
                    )}
                    {isCompleted && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openReport(issue); }} className={rowAction} title="Ver relatório" aria-label="Ver relatório">
                        <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                    {isCompleted && isFacilitator && onRevoteIssue && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRevoteIssue(issue.id); }} className={rowAction} title="Votar novamente" aria-label="Votar novamente">
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                    {!isCompleted && isFacilitator && onCancelIssue && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setItemToCancel(issue); setCancelModalNote(''); setIsCancelModalOpen(true); }}
                        className={rowAction}
                        title="Cancelar no refinamento"
                        aria-label="Cancelar no refinamento"
                      >
                        <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                    {isFacilitator && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); if (isActive || isCompleted) setIdToDelete(issue.id); else onDeleteIssue(issue.id); }}
                        className={cn(rowAction, 'hover:text-red-700 dark:hover:text-red-300')}
                        title="Excluir da fila"
                        aria-label="Excluir da fila"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>

      <ConsolidatedReportDialog
        round={selectedRound}
        onClose={() => setSelectedRound(null)}
        participants={participants}
      />

      <Modal
        open={isBulkImportOpen}
        onOpenChange={(open) => {
          setIsBulkImportOpen(open);
          if (!open) {
            setIsBulkPreview(false);
            setBulkPreviewItems([]);
            setBulkText('');
          }
        }}
        size={isBulkPreview ? 'lg' : 'md'}
        icon={Import}
        title={isBulkPreview ? 'Revisar importação' : 'Importar em lote'}
        description={isBulkPreview
          ? `${bulkPreviewItems.length} ${bulkPreviewItems.length === 1 ? 'tarefa detectada' : 'tarefas detectadas'}${bulkPreviewItems.filter(i => i.duplicate).length > 0 ? ` · ${bulkPreviewItems.filter(i => i.duplicate).length} possível(is) duplicata(s) desmarcada(s)` : ''}`
          : 'Uma tarefa por linha. Tipo e duplicatas são detectados sozinhos.'}
        footerStart={isBulkPreview ? <ModalButton variant="ghost" onClick={() => setIsBulkPreview(false)}>Voltar ao texto</ModalButton> : undefined}
        footer={!isBulkPreview ? (
          <>
            <ModalButton onClick={() => setIsBulkImportOpen(false)}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleBulkSubmitPreview} disabled={!bulkText.trim()}>Visualizar itens</ModalButton>
          </>
        ) : (
          <>
            <ModalButton onClick={() => setIsBulkImportOpen(false)}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleConfirmBulkAdd} disabled={bulkSelected.size === 0}>
              Importar {bulkSelected.size} {bulkSelected.size === 1 ? 'selecionada' : 'selecionadas'}
            </ModalButton>
          </>
        )}
      >
        {!isBulkPreview ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bulk-text" className="text-[13px] font-semibold text-foreground">Lista de tarefas</label>
              <textarea
                id="bulk-text"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'EX-101 | Ajustar botões | https://jira.com/101\nEX-102 | Refatorar API\nApenas um título sem chave'}
                className={cn(FIELD, 'min-h-[180px] resize-none py-2.5 font-code text-xs')}
              />
              <p className="text-xs text-muted-foreground">
                Por linha: <code className="rounded bg-muted px-1.5 py-0.5 font-code">CHAVE | Título | Link</code>. Chave e link são opcionais.
              </p>
            </div>
            <input
              type="file"
              id="csv-upload"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBulkCsvUpload(file);
              }}
            />
            <ModalButton onClick={() => document.getElementById('csv-upload')?.click()} className="w-full justify-center gap-2 border-dashed">
              <FileUp className="h-4 w-4" strokeWidth={1.5} /> Carregar arquivo CSV
            </ModalButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">{bulkSelected.size} de {bulkPreviewItems.length} selecionadas</span>
              <button type="button" onClick={handleBulkToggleAll} className="text-xs font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground">
                {bulkSelected.size === bulkPreviewItems.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
              </button>
            </div>
            <ul className="m-0 flex max-h-[320px] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
              {bulkPreviewItems.map((item) => {
                const TypeIcon = TYPE_ICONS[item.type || 'dev'] || Code;
                const checked = bulkSelected.has(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-fast',
                        checked ? 'border-primary/40 bg-primary/5' : item.duplicate ? 'border-amber-500/30 bg-amber-500/5' : 'border-border hover:bg-accent/40'
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => handleBulkToggleSelect(item.id)} className="mt-0.5" />
                      <span className="mt-0.5 shrink-0 rounded-md bg-muted p-1 text-muted-foreground" title={item.type}>
                        <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          {item.key && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{item.key}</span>}
                          <span className="truncate text-[13px] font-semibold">{item.title}</span>
                          {item.duplicate && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              <Copy className="h-3 w-3" strokeWidth={1.5} /> Duplicada
                            </span>
                          )}
                        </span>
                        {item.link && (
                          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                            <span className="truncate">{item.link}</span>
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>

      <JiraImportDialog
        open={isJiraImportOpen}
        onClose={() => setIsJiraImportOpen(false)}
        onImport={(selectedIssues: any[]) => handleJiraImport(selectedIssues)}
        title="Sincronizar Jira"
        description="Puxe as tarefas da squad diretamente para a rodada de votação."
      />

      <ConfirmDialog
        open={!!idToDelete}
        onOpenChange={(open) => { if (!open) setIdToDelete(null); }}
        tone="danger"
        icon={Trash2}
        title="Excluir tarefa da fila?"
        description={`Esta tarefa ${issues.find(i => i.id === idToDelete)?.id === activeIssueId ? 'está sendo votada agora' : 'já foi estimada'}. A exclusão não pode ser desfeita.`}
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
        open={isCancelModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCancelModalOpen(false);
            setItemToCancel(null);
            setCancelModalNote('');
          }
        }}
        size="md"
        tone="warn"
        iconTone="neutral"
        icon={Ban}
        title="Cancelar no refinamento?"
        description="A tarefa sai da estimativa desta sessão e vai para as descartadas. Dá para reativar pela fila."
        dismissible={false}
        footer={
          <>
            <ModalButton onClick={() => setIsCancelModalOpen(false)}>Voltar</ModalButton>
            <ModalButton
              variant="danger"
              onClick={() => {
                if (itemToCancel && onCancelIssue) {
                  onCancelIssue(itemToCancel.id, cancelModalNote.trim() || undefined);
                  setIsCancelModalOpen(false);
                  setItemToCancel(null);
                  setCancelModalNote('');
                }
              }}
            >
              Cancelar tarefa
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="queue-cancel-why" className="text-[13px] font-semibold text-foreground">Por que esta tarefa foi cancelada?</label>
          <textarea
            id="queue-cancel-why"
            rows={3}
            value={cancelModalNote}
            onChange={(e) => setCancelModalNote(e.target.value)}
            placeholder="Ex.: descartada pelo PO, escopo duplicado, descontinuada"
            className={cn(FIELD, 'min-h-[88px] resize-none py-2.5')}
          />
        </div>
      </Modal>
    </div>
  );
}

function ConsolidatedReportDialog({ round, onClose, participants }: { round: any, onClose: () => void, participants: any[] }) {
  const { toast } = useToast();
  if (!round) return null;

  const participantMap = new Map((participants || []).map(p => [p.id, p]));

  const handleCopyResults = () => {
    let text = `Relatório: ${round.topic}\nEstimativa Final: ${round.stats.avg}${round.deckType === 'hours' ? 'h' : ''}\n`;

    if (round.deckType === 'hours') {
      const rolePoints = round.rolePoints || {
        'Developer': round.devPoints || '0',
        'QA': round.qaPoints || '0'
      };

      const effortsParts = Object.entries(rolePoints)
        .filter(([_, val]) => val !== '0')
        .map(([role, val]) => `${role}: ${val}h`);

      if (effortsParts.length > 0) {
        text += effortsParts.join('\n') + '\n';
      } else if (round.stats.avg && round.stats.avg !== 'N/A') {
        text += `Esforço Total: ${round.stats.avg}h\n`;
      }
    }

    text += '\nVotos:\n';
    (round.votes || []).forEach((v: any) => {
      const p = participantMap.get(v.participantId);
      if (p) {
        const category = getParticipantCategory(p);
        const roleLabel = category || p.role;
        text += `${p.nickname} (${roleLabel}): ${v.value}\n`;
      }
    });

    navigator.clipboard.writeText(text);
    toast({ title: "Relatório Copiado!", description: "Dados completos da rodada copiados." });
  };

  const handleCopyHoursOnly = () => {
    if (round.deckType !== 'hours') return;

    const rolePoints = round.rolePoints || {
      'Developer': round.devPoints || '0',
      'QA': round.qaPoints || '0'
    };

    // Mesmo formato do "Copiar estimativa" da revelação: (DEV 10h / QA 4h / UX 2h).
    let copyText = formatEstimateCopy(
      Object.entries(rolePoints).map(([role, value]) => ({ role, value: String(value ?? '') })),
      'h',
      { skipZero: true }
    );
    if (!copyText) {
      const total = round.stats.avg !== 'N/A' ? round.stats.avg : '0';
      copyText = `(${total}h)`;
    }

    navigator.clipboard.writeText(copyText);
    toast({ title: "Horas Copiadas!", description: `"${copyText}" pronto para colar.` });
  };

  return (
    <Modal
      open={!!round}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      tone="success"
      icon={CheckCircle2}
      title={round.topic}
      description="Estimativa consolidada da tarefa"
      footer={
        <>
          {round.deckType === 'hours' && (
            <ModalButton onClick={handleCopyHoursOnly} className="gap-2">
              <ClipboardCopy className="h-4 w-4" strokeWidth={1.5} /> Copiar estimativa
            </ModalButton>
          )}
          <ModalButton variant="primary" onClick={handleCopyResults} className="gap-2">
            <Copy className="h-4 w-4" strokeWidth={1.5} /> Copiar relatório
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-xl bg-primary p-4 text-primary-foreground">
            <span className="text-[11px] font-semibold opacity-80">Total</span>
            <span className="text-2xl font-bold tabular-nums">{round.stats.avg}{round.deckType === 'hours' ? 'h' : ''}</span>
          </div>
          {round.deckType === 'hours' ? (
            TECHNICAL_CATEGORIES.map(category => {
              const rolePoints = round.rolePoints || { 'Developer': round.devPoints, 'QA': round.qaPoints };
              const value = rolePoints[category];
              if (!value || value === '0') return null;
              return (
                <div key={category} className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                  <span className={cn('text-[11px] font-bold', ROLE_STYLES[roleToneOf(category)].text)}>{formatRoleForCopy(category)}</span>
                  <span className="text-2xl font-bold tabular-nums">{value}h</span>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-[11px] font-semibold text-muted-foreground">Menor</span>
                <span className="text-xl font-bold tabular-nums">{round.stats.min}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-[11px] font-semibold text-muted-foreground">Maior</span>
                <span className="text-xl font-bold tabular-nums">{round.stats.max}</span>
              </div>
            </>
          )}
        </div>

        <section aria-label="Votos da rodada" className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-foreground">Votos</h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {(round.votes || []).map((vote: any) => {
              const p = participantMap.get(vote.participantId);
              const category = p ? getParticipantCategory(p) : null;
              return (
                <li key={vote.participantId} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted/30 px-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{p?.nickname || 'Participante'}</span>
                    <span className={cn('truncate text-[11px] font-bold', ROLE_STYLES[roleToneOf(category)].text)}>
                      {p ? (category ? formatRoleForCopy(category) : (p.globalRole || p.role)) : ''}
                    </span>
                  </span>
                  <span className="rounded-md border border-border bg-card px-2 py-0.5 text-sm font-bold tabular-nums">{vote.value}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
