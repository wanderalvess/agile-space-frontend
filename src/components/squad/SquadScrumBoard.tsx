'use client';

import { SquadDataState } from '@/components/squad/SquadDataState';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  SlidersHorizontal,
  Search,
  Filter,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  Bug,
  ListTodo,
  CheckSquare,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Copy,
  Check,
  Flame,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Modal, ModalButton } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings, getJiraCredentials } from '@/hooks/useJiraSettings';
import {
  fetchGreenhopperWorkData,
  EMPTY_GREENHOPPER_DATA,
  fetchScrumBoards,
  type GreenhopperWorkData,
  type GreenhopperIssue,
  type GreenhopperColumn,
  type GreenhopperSwimlane,
  type GreenhopperQuickFilter,
} from '@/services/greenhopperService';
import { BoardConfigModal } from './BoardConfigModal';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { squadApi } from '@/app/squad/api';
import { matchesPersonFilter } from '@/lib/board-filters';

interface SquadScrumBoardProps {
  squadId?: string;
  jiraProjectKey?: string;
  rapidViewId?: number | string;
  jiraDomain?: string;
  /** Abre as configurações da squad (conexão com o Jira, chave do projeto, ID do quadro). */
  onOpenSettings?: () => void;
}

interface ColumnWipOverride {
  id: string | number;
  min: number | null;
  max: number | null;
}

const FALLBACK_REASON_LABELS: Record<string, string> = {
  'missing-config': 'Não encontrei um quadro Scrum para este projeto no Jira. Confira a chave do projeto, o domínio e o token em Configurações da squad, ou informe o ID do quadro.',
  'invalid-rapid-view-id': 'O ID do quadro (rapidViewId) configurado não é válido.',
  'auth-error': 'Sessão do Jira expirada ou sem permissão para este quadro. Reconecte suas credenciais.',
  timeout: 'O Jira demorou demais para responder.',
  'network-error': 'Não foi possível conectar ao Jira.',
  'empty-response': 'O Jira retornou uma resposta inesperada.',
};

/** Aplica overrides salvos localmente (filtros/raias/limites de WIP) por cima dos dados do quadro,
 *  independentemente de terem vindo do fetch ou do fixture de fallback. */
function applyLocalOverrides(data: GreenhopperWorkData, squadId: string): GreenhopperWorkData {
  if (typeof window === 'undefined') return data;
  let next = data;

  try {
    const savedFilters = localStorage.getItem(`agile_quick_filters_${squadId}`);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (Array.isArray(parsed) && parsed.length > 0) {
        next = { ...next, quickFiltersData: { quickFilters: parsed } };
      }
    }
  } catch {}

  try {
    const savedSwimlanes = localStorage.getItem(`agile_swimlanes_${squadId}`);
    if (savedSwimlanes) {
      const parsed = JSON.parse(savedSwimlanes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        next = { ...next, swimlanesData: { swimlanes: parsed } };
      }
    }
  } catch {}

  try {
    const savedColumns = localStorage.getItem(`agile_columns_${squadId}`);
    if (savedColumns) {
      const overrides: ColumnWipOverride[] = JSON.parse(savedColumns);
      if (Array.isArray(overrides) && overrides.length > 0) {
        const byId = new Map(overrides.map(o => [String(o.id), o]));
        next = {
          ...next,
          columnsData: {
            columns: next.columnsData.columns.map(c => {
              const ov = byId.get(String(c.id));
              return ov ? { ...c, min: ov.min, max: ov.max } : c;
            }),
          },
        };
      }
    }
  } catch {}

  return next;
}

export function SquadScrumBoard({
  squadId = '',
  jiraProjectKey = '',
  rapidViewId: initialRapidViewId,
  jiraDomain: initialDomain,
  onOpenSettings,
}: SquadScrumBoardProps) {
  const { toast } = useToast();
  const { settings: jiraSettings } = useJiraSettings();

  const [rapidViewId, setRapidViewId] = useState<number | string>(
    initialRapidViewId || ''
  );
  const [boardData, setBoardData] = useState<GreenhopperWorkData>(EMPTY_GREENHOPPER_DATA);
  const [isLoading, setIsLoading] = useState(false);
  // Só mostra o quadro depois da primeira tentativa de carga: antes disso não há o que exibir.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'filters' | 'columns' | 'swimlanes'>('filters');
  const [selectedIssue, setSelectedIssue] = useState<GreenhopperIssue | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [swimlaneStrategy, setSwimlaneStrategy] = useState<'queries' | 'parents' | 'assignees' | 'epics' | 'none'>(() => {
    if (typeof window === 'undefined') return 'queries';
    try {
      const saved = localStorage.getItem(`agile_swimlane_strategy_${squadId}`);
      const validStrategies = ['queries', 'parents', 'assignees', 'epics', 'none'] as const;
      return validStrategies.includes(saved as typeof validStrategies[number]) ? (saved as typeof validStrategies[number]) : 'queries';
    } catch { return 'queries'; }
  });

  const activeDomain = initialDomain || jiraSettings?.domain || '';
  const activeToken = jiraSettings?.token || '';

  // Aplica overrides salvos localmente (filtros/raias/WIP) assim que monta, antes do primeiro fetch
  useEffect(() => {
    setBoardData(prev => applyLocalOverrides(prev, squadId));
  }, [squadId]);

  // Só a resposta da carga mais recente vale: trocar de squad/quadro (ou clicar em atualizar de novo) enquanto uma
  // busca está em voo deixava a resposta velha sobrescrever o quadro novo.
  const loadSeqRef = useRef(0);

  // Busca dados do quadro
  const loadBoardData = async (showToast = false) => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    try {
      // Sem ID de quadro configurado: descobre pelo projeto no Jira e guarda na configuração da squad,
      // assim quem já conectou o Jira não precisa digitar o número do quadro.
      let boardId: number | string = rapidViewId;
      if (!boardId && activeDomain && activeToken && jiraProjectKey) {
        const boards = await fetchScrumBoards({ domain: activeDomain, token: activeToken, projectKey: jiraProjectKey });
        if (boards.length > 0) {
          boardId = boards[0].id;
          setRapidViewId(boardId);
          if (squadId) {
            squadApi.saveSquad(squadId, { rapidViewId: String(boardId) } as any).catch(() => {});
          }
        }
      }
      const data = await fetchGreenhopperWorkData({
        domain: activeDomain,
        token: activeToken,
        rapidViewId: boardId || '',
        selectedProjectKey: jiraProjectKey,
      });
      if (seq !== loadSeqRef.current) return;
      // Reaplica os overrides locais por cima do fetch — sem isso, qualquer
      // filtro/raia/WIP customizado salvo era descartado a cada refresh.
      setBoardData(applyLocalOverrides(data, squadId));

      if (data.isFallback) {
        // Sem quadro real: a tela mostra o estado vazio com o motivo (nada de dados de exemplo).
        if (showToast) {
          toast({
            title: 'Quadro indisponível',
            description: FALLBACK_REASON_LABELS[data.fallbackReason || ''] || 'Não foi possível carregar o quadro ao vivo do Jira.',
            variant: 'destructive',
          });
        }
      } else if (showToast) {
        toast({
          title: 'Quadro Atualizado',
          description: `${data.issuesData.issues.length} itens sincronizados com o Jira.`,
        });
      }
    } catch (err: any) {
      // fetchGreenhopperWorkData já captura suas próprias falhas e retorna um
      // fixture de fallback — chegar aqui significa que algo além dela quebrou.
      console.error('Erro inesperado ao carregar quadro Scrum:', err);
      toast({
        title: 'Erro ao Carregar Quadro',
        description: err?.message || 'Não foi possível carregar o quadro.',
        variant: 'destructive',
      });
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    }
  };

  useEffect(() => {
    loadBoardData(false);
  }, [squadId, rapidViewId, jiraProjectKey, activeDomain, activeToken]);

  // Alterna filtro rápido
  const toggleFilter = (filterName: string) => {
    setActiveFilters(prev =>
      prev.includes(filterName)
        ? prev.filter(f => f !== filterName)
        : [...prev, filterName]
    );
  };

  // Alterna recolhimento de swimlane
  const toggleSwimlane = (swimlaneId: string | number) => {
    setCollapsedSwimlanes(prev => ({
      ...prev,
      [String(swimlaneId)]: !prev[String(swimlaneId)],
    }));
  };

  // Copia chave da issue
  const copyIssueKey = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({
      title: 'Chave copiada',
      description: `${key} copiado para a área de transferência.`,
      duration: 1800,
    });
  };

  // Filtra as issues avaliando as regras de JQL dos filtros ativos
  const filteredIssues = useMemo(() => {
    const issues = boardData.issuesData.issues || [];
    const allQuickFilters = boardData.quickFiltersData.quickFilters || [];

    return issues.filter(issue => {
      // 1. Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesSummary = issue.summary.toLowerCase().includes(q);
        const matchesAssignee = (issue.assigneeName || '').toLowerCase().includes(q);
        const matchesTags = (issue.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesKey && !matchesSummary && !matchesAssignee && !matchesTags) {
          return false;
        }
      }

      // 2. Filtros rápidos ativos (com avaliação de JQL)
      if (activeFilters.length > 0) {
        const matchesAnyActiveFilter = activeFilters.some(filterName => {
          const filterObj = allQuickFilters.find(f => f.name === filterName);
          const qLower = (filterObj?.query || '').toLowerCase();
          const fn = filterName.toLowerCase();

          // A. Sprint Goal (labels = Sprint_goal)
          if (fn === 'sprint goal' || qLower.includes('sprint_goal')) {
            return (issue.tags || []).some(
              t => t.toLowerCase().includes('goal') ||
                   t.toLowerCase().includes('warroom') ||
                   t.toLowerCase().includes('sprint_goal')
            );
          }

          // B. Abertas (status not in (Cancelado, Closed, Concluído, Recusada))
          if (fn === 'abertas' || qLower.includes('status not in')) {
            const isClosed = ['cancelado', 'closed', 'concluído', 'recusada', 'done'].includes(
              (issue.statusName || '').toLowerCase()
            );
            return !isClosed && issue.statusCategory !== 'done';
          }

          // C. CausaOC (issuetype in (Manutenção,"Rejeição - Manutenção") and priority = Crítica)
          if (fn === 'causaoc' || qLower.includes('causaoc') || qLower.includes('manutenção')) {
            const isCrit = issue.priorityName === 'Critical' || issue.priorityName === 'Blocker';
            const isManut = (issue.typeName || '').toLowerCase().includes('manut') || (issue.typeName || '').toLowerCase().includes('rejeição');
            const hasTag = (issue.tags || []).some(t => t.toLowerCase().includes('causaoc'));
            return isCrit || isManut || hasTag;
          }

          // D. Data Acordo ("Data Acordo Entrega" ou "Data Interna Acordada")
          if (fn === 'data acordo' || qLower.includes('data acordo')) {
            return !!issue.dueDate && issue.statusCategory !== 'done';
          }

          // E. Filtros por pessoa (o nome do filtro é o da pessoa na squad) e F. filtros customizados por etiqueta.
          // Nenhum nome fica fixo no código: compara com quem de fato é responsável pela issue.
          if (matchesPersonFilter(filterName, issue)) return true;
          if ((issue.tags || []).some(t => t.toLowerCase().includes(fn))) return true;

          return false;
        });

        if (!matchesAnyActiveFilter) return false;
      }

      return true;
    });
  }, [boardData, searchQuery, activeFilters]);

  // Determina a raia de cada issue via as regras de query configuradas (estratégia "queries")
  const getIssueSwimlaneIdByQuery = (issue: GreenhopperIssue, allSwimlanes: GreenhopperSwimlane[]) => {
    const querySwimlanes = allSwimlanes.filter(s => !s.isDefault);
    const defaultSwimlane = allSwimlanes.find(s => s.isDefault) || allSwimlanes[allSwimlanes.length - 1];

    for (const sl of querySwimlanes) {
      const qLower = (sl.query || '').toLowerCase();
      const nameLower = sl.name.toLowerCase();

      // 1. Prioridades ( WarRoom): priority in ( Crítica, Alta) OR labels in (prioridade)
      if (nameLower.includes('prioridade') || nameLower.includes('warroom') || qLower.includes('prioridade')) {
        const isCrit = ['critical', 'crítica', 'major', 'alta', 'blocker', 'urgente'].includes(
          (issue.priorityName || '').toLowerCase()
        );
        const hasPrioridadeTag = (issue.tags || []).some(t => {
          const tl = t.toLowerCase();
          return tl.includes('prioridade') || tl.includes('warroom') || tl.includes('regressivo');
        });
        if (isCrit || hasPrioridadeTag || issue.swimlaneId === sl.id) {
          return sl.id;
        }
      }

      // 2. Reforma Tributária: labels in (Entrega_Cadastros, Entrega_HomologSEFAZ, Entrega_ProdSEFAZ)
      if (nameLower.includes('reforma') || nameLower.includes('tribut') || qLower.includes('entrega_')) {
        const hasSefazTag = (issue.tags || []).some(t => {
          const tl = t.toLowerCase();
          return (
            tl.includes('entrega_cadastros') ||
            tl.includes('entrega_homologsefaz') ||
            tl.includes('entrega_prodsefaz') ||
            tl.includes('reforma') ||
            tl.includes('tribut') ||
            tl.includes('anp') ||
            tl.includes('sefaz')
          );
        });
        if (hasSefazTag || issue.swimlaneId === sl.id) {
          return sl.id;
        }
      }

      // 3. Pausada: labels in (Pausada,pausada)
      if (nameLower.includes('pausada') || qLower.includes('pausada')) {
        const isPaused =
          (issue.tags || []).some(t => t.toLowerCase().includes('pausad')) ||
          (issue.statusName || '').toLowerCase().includes('imped') ||
          issue.swimlaneId === sl.id;
        if (isPaused) {
          return sl.id;
        }
      }

      // 4. Se a issue já tiver o swimlaneId correspondente
      if (issue.swimlaneId === sl.id) {
        return sl.id;
      }
    }

    return defaultSwimlane ? defaultSwimlane.id : 104;
  };

  // Agrupa issues por swimlane e por coluna
  const columns = boardData.columnsData.columns || [];
  const swimlanes = boardData.swimlanesData.swimlanes || [
    { id: 104, name: 'Todo o Resto', isDefault: true },
  ];

  // Raias exibidas de fato, conforme a estratégia escolhida em "Configurar Raias".
  // Antes a estratégia era salva mas nunca lida em lugar nenhum, então trocar o
  // seletor (queries/pais/responsáveis/épicos/nenhuma) não mudava o quadro.
  const displaySwimlanes = useMemo(() => {
    if (swimlaneStrategy === 'none') {
      return [{ id: 'all', name: 'Todos os Itens', isDefault: true } as GreenhopperSwimlane];
    }
    if (swimlaneStrategy === 'queries') {
      return swimlanes;
    }

    const groupOf = (issue: GreenhopperIssue): { id: string; name: string } | null => {
      if (swimlaneStrategy === 'parents') {
        if (!issue.parentKey) return null;
        return { id: issue.parentKey, name: issue.parentTitle || issue.parentKey };
      }
      if (swimlaneStrategy === 'assignees') {
        const name = issue.assigneeName || issue.assignee;
        if (!name) return null;
        return { id: name, name };
      }
      // epics
      const epicName = issue.epicField?.summary || issue.epicField?.key || issue.epic;
      if (!epicName) return null;
      return { id: epicName, name: epicName };
    };

    const seen = new Map<string, string>();
    for (const issue of filteredIssues) {
      const group = groupOf(issue);
      if (group && !seen.has(group.id)) seen.set(group.id, group.name);
    }

    const fallbackName =
      swimlaneStrategy === 'parents' ? 'Sem Item Pai' :
      swimlaneStrategy === 'assignees' ? 'Sem Responsável' : 'Sem Épico';

    return [
      ...Array.from(seen.entries()).map(([id, name]) => ({ id, name, isDefault: false } as GreenhopperSwimlane)),
      { id: '__none__', name: fallbackName, isDefault: true } as GreenhopperSwimlane,
    ];
  }, [swimlaneStrategy, swimlanes, filteredIssues]);

  const getIssueSwimlaneId = (issue: GreenhopperIssue): string | number => {
    if (swimlaneStrategy === 'none') return 'all';
    if (swimlaneStrategy === 'queries') return getIssueSwimlaneIdByQuery(issue, swimlanes);
    if (swimlaneStrategy === 'parents') return issue.parentKey || '__none__';
    if (swimlaneStrategy === 'assignees') return issue.assigneeName || issue.assignee || '__none__';
    return issue.epicField?.summary || issue.epicField?.key || issue.epic || '__none__';
  };

  // Determina, para cada issue, exatamente UMA coluna — antes o fallback por nome
  // de coluna ("A Fazer"/"Finalizado") era avaliado independente do match por
  // statusIds, permitindo que a mesma issue contasse em duas colunas ao mesmo tempo.
  const getColumnForIssue = (issue: GreenhopperIssue, allColumns: GreenhopperColumn[]): GreenhopperColumn | undefined => {
    const byStatusId = allColumns.find(c =>
      c.statusIds.includes(issue.statusId) || c.statusIds.includes(Number(issue.statusId))
    );
    if (byStatusId) return byStatusId;
    // Fallback só quando nenhuma coluna mapeia o statusId explicitamente.
    return allColumns.find(c =>
      (c.name === 'A Fazer' && issue.statusCategory === 'new') ||
      (c.name === 'Finalizado' && issue.statusCategory === 'done')
    );
  };

  const activeSprint = boardData.sprintsData?.sprints?.[0];

  // Cores de badge por status ou prioridade
  const getPriorityIcon = (priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p.includes('blocker') || p.includes('urgente')) {
      return <Flame className="h-3 w-3 text-rose-600 fill-rose-600 animate-pulse" />;
    }
    if (p.includes('critical') || p.includes('crítica')) {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    if (p.includes('major') || p.includes('alta')) {
      return <ChevronDown className="h-3 w-3 text-orange-500 rotate-180" />;
    }
    if (p.includes('minor') || p.includes('baixa')) {
      return <ChevronDown className="h-3 w-3 text-blue-400" />;
    }
    return <Bookmark className="h-3 w-3 text-emerald-500" />;
  };

  const getTypeIcon = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('bug') || t.includes('defeito')) {
      return <Bug className="h-3 w-3 text-rose-500" />;
    }
    if (t.includes('story') || t.includes('história')) {
      return <Bookmark className="h-3 w-3 text-emerald-500" />;
    }
    if (t.includes('task') || t.includes('tarefa')) {
      return <CheckSquare className="h-3 w-3 text-blue-500" />;
    }
    return <ListTodo className="h-3 w-3 text-muted-foreground" />;
  };

  const getAssigneeAvatar = (issue: GreenhopperIssue) => {
    const name = issue.assigneeName || issue.assignee || 'Não atribuído';
    const assigned = !!(issue.assigneeName || issue.assignee);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {assigned ? (
              <span className="inline-flex shrink-0 cursor-pointer">
                <InitialsAvatar name={name} className="h-6 w-6 text-xs ring-1 ring-background" />
              </span>
            ) : (
              <div className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-background">
                <User className="h-3 w-3" />
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent className="text-xs font-bold bg-foreground text-background p-2 rounded-xl">
            {name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Primeira carga ainda em andamento
  if (!hasLoadedOnce) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-3xl border border-border bg-card/70 p-10 text-sm font-semibold text-muted-foreground" role="status">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Carregando o quadro do Jira…
      </div>
    );
  }

  // Sem quadro real: explica o motivo em vez de mostrar dados de exemplo
  if (boardData.isFallback) {
    const reason = boardData.fallbackReason || '';
    const kind = !jiraSettings?.token ? 'no-jira' : reason === 'missing-config' || reason === 'invalid-rapid-view-id' ? 'no-board' : 'sync-error';
    return (
      <SquadDataState
        kind={kind}
        subject="o Quadro"
        isSyncing={isLoading}
        errorMessage={FALLBACK_REASON_LABELS[reason] || 'Não foi possível carregar o quadro ao vivo do Jira.'}
        onConnect={onOpenSettings}
        onSync={() => loadBoardData(true)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ═══════════════════════════════════════════════════════════════════
          CABEÇALHO DO QUADRO SCRUM (JIRA GREENHOPPER STYLE)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-card/90 border border-border/70 rounded-3xl p-5 md:p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary/10 text-primary border-none font-semibold text-xs px-2.5 py-0.5">
                QUADRO SCRUM
              </Badge>
              <span className="text-xs text-muted-foreground font-code">
                {jiraProjectKey}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight font-headline text-foreground">
              {boardData.boardName || `SCRUM ${jiraProjectKey}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-code">
              {activeSprint?.name || 'Sprint ativa'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dias restantes: só aparece quando o Jira informa; antes caía num "1" inventado */}
            {typeof activeSprint?.daysRemaining === 'number' && (
              <div className="flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3.5 py-1.5 rounded-2xl text-xs font-bold">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse motion-reduce:animate-none" />
                <span>{activeSprint.daysRemaining} {activeSprint.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}</span>
              </div>
            )}

            {/* Ação Concluir Sprint / Ver no Jira */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const jiraUrl = `https://${activeDomain}/secure/RapidBoard.jspa?rapidView=${rapidViewId}&selectedProjectKey=${jiraProjectKey}`;
                window.open(jiraUrl, '_blank');
              }}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 border-border text-foreground hover:bg-muted/50"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              Ver no Jira
            </Button>

            {/* Configuração de Colunas & WIP */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfigModalTab('columns');
                setIsConfigModalOpen(true);
              }}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 border-primary/30 text-primary bg-primary/10 hover:bg-primary/10"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Configurar Quadro & WIP
            </Button>

            {/* Sincronização */}
            <Button
              size="sm"
              onClick={() => loadBoardData(true)}
              disabled={isLoading}
              className="h-8 text-xs font-semibold rounded-xl bg-foreground hover:bg-foreground/90 text-background gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BARRA DE FILTROS RÁPIDOS (QUICK FILTERS)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-5 pt-4 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtros Rápidos:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfigModalTab('filters');
                  setIsConfigModalOpen(true);
                }}
                className="h-6 px-2 text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg gap-1"
                title="Configurar consultas JQL e filtros rápidos"
              >
                <SlidersHorizontal className="h-2.5 w-2.5" />
                Configurar
              </Button>
            </div>
            <div className="flex items-center gap-1.5 flex-nowrap">
              {boardData.quickFiltersData.quickFilters.map(filter => {
                const isActive = activeFilters.includes(filter.name);
                return (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.name)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold tracking-tight transition-all shrink-0 cursor-pointer border ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary/40 shadow-xs'
                        : 'bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted'
                    }`}
                  >
                    {filter.name}
                  </button>
                );
              })}
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilters([])}
                  className="h-6 text-xs text-rose-500 hover:text-rose-600 font-bold px-2"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative shrink-0 w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por chave, dev ou texto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-muted/50 border-border/70"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CABEÇALHOS DAS COLUNAS COM LIMITES DE WIP
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="overflow-x-auto pb-3">
        <div className="min-w-[1200px]">
          {/* Header das Colunas */}
          <div className="grid gap-3 mb-2 px-1" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
            {columns.map(col => {
              // Conta total de issues nesta coluna (exatamente uma coluna por issue)
              const colIssues = filteredIssues.filter(i => getColumnForIssue(i, columns)?.id === col.id);
              const count = colIssues.length;
              const hasMax = col.max !== null && col.max !== undefined && col.max > 0;
              const isOverWip = hasMax && count > (col.max as number);
              const isNearWip = hasMax && count === (col.max as number);
              const hasMin = col.min !== null && col.min !== undefined && col.min > 0;
              const isUnderMin = hasMin && count < (col.min as number);

              return (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/50 border border-border/60"
                >
                  <span className="text-xs font-semibold text-foreground truncate">
                    {col.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-semibold text-foreground">
                      {count}
                    </span>
                    {hasMin && (
                      <Badge
                        variant="outline"
                        title={isUnderMin ? `Abaixo do mínimo de ${col.min} itens` : `Mínimo de ${col.min} itens`}
                        className={`text-xs font-bold px-1 py-0 ${
                          isUnderMin
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        MÍN {col.min}
                      </Badge>
                    )}
                    {hasMax && (
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold px-1 py-0 ${
                          isOverWip
                            ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 animate-pulse'
                            : isNearWip
                            ? 'bg-amber-500/20 text-amber-600 border-amber-500/40'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        MÁX {col.max}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RAIAS (SWIMLANES) & CARDS
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            {displaySwimlanes.map(swimlane => {
              const isCollapsed = collapsedSwimlanes[String(swimlane.id)];
              const swimlaneIssues = filteredIssues.filter(
                i => getIssueSwimlaneId(i) === swimlane.id
              );

              return (
                <div
                  key={swimlane.id}
                  className="rounded-3xl border border-border/80 bg-muted/50 overflow-hidden shadow-xs"
                >
                  {/* Cabeçalho da Swimlane */}
                  <div
                    onClick={() => toggleSwimlane(swimlane.id)}
                    className="flex items-center justify-between p-3.5 px-4 bg-muted/50 cursor-pointer hover:bg-muted transition-colors border-b border-border/50"
                  >
                    <div className="flex items-center gap-2.5">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="text-xs font-semibold tracking-tight text-foreground">
                        {swimlane.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {swimlaneIssues.length} itens
                      </Badge>
                    </div>
                  </div>

                  {/* Colunas dentro da Swimlane */}
                  {!isCollapsed && (
                    <div className="grid gap-3 p-3 min-h-[140px]" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
                      {columns.map(col => {
                        const colIssues = swimlaneIssues.filter(i => getColumnForIssue(i, columns)?.id === col.id);

                        return (
                          <div
                            key={col.id}
                            className="bg-card/40 rounded-2xl p-1.5 flex flex-col gap-2 min-h-[120px] border border-dashed border-border/70"
                          >
                            {colIssues.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center p-4">
                                <span className="text-xs font-medium text-muted-foreground">
                                  —
                                </span>
                              </div>
                            ) : (
                              colIssues.map(issue => {
                                const isDone = issue.statusCategory === 'done';

                                return (
                                  <Card
                                    key={issue.id}
                                    onClick={() => setSelectedIssue(issue)}
                                    className={`p-3 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between gap-2.5 relative overflow-hidden ${
                                      issue.color ? `border-l-4` : ''
                                    }`}
                                    style={{
                                      borderLeftColor: issue.color || undefined,
                                    }}
                                  >
                                    <div>
                                      {/* Topo do Card: Chave + Ações + Avatar */}
                                      <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <div className="flex items-center gap-1.5 truncate">
                                          {getTypeIcon(issue.typeName)}
                                          <button
                                            onClick={e => copyIssueKey(issue.key, e)}
                                            className="text-xs font-semibold font-code text-primary hover:underline flex items-center gap-1"
                                            title="Clique para copiar a chave"
                                          >
                                            {issue.key}
                                            {copiedKey === issue.key ? (
                                              <Check className="h-2.5 w-2.5 text-emerald-500" />
                                            ) : (
                                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                            )}
                                          </button>
                                        </div>
                                        {getAssigneeAvatar(issue)}
                                      </div>

                                      {/* Título / Resumo */}
                                      <p className="text-xs font-bold text-foreground line-clamp-3 leading-snug">
                                        {issue.summary}
                                      </p>

                                      {/* Tags / Badges Coloridas */}
                                      {issue.tags && issue.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {issue.tags.map((tag, idx) => (
                                            <span
                                              key={idx}
                                              className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground truncate max-w-full"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Rodapé do Card: Prioridade + Subtarefas + Prazos */}
                                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        {getPriorityIcon(issue.priorityName)}
                                        {issue.dueDate && (
                                          <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                            <Calendar className="h-2.5 w-2.5" />
                                            {issue.dueDate}
                                          </span>
                                        )}
                                      </div>

                                      {/* Indicador de Subtarefas */}
                                      {issue.subTasks && issue.subTasks.length > 0 && (
                                        <div className="flex items-center gap-1 font-code">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          <span>
                                            {issue.subTasks.filter(st => st.isDone).length}/
                                            {issue.subTasks.length}
                                          </span>
                                        </div>
                                      )}

                                      {/* Estimativa / Story Points */}
                                      {issue.estimateStatistic?.statFieldValue?.value && (
                                        <span className="font-semibold text-muted-foreground">
                                          {issue.estimateStatistic.statFieldValue.value} SP
                                        </span>
                                      )}
                                    </div>
                                  </Card>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL DE DETALHES RÁPIDOS DA ISSUE
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!selectedIssue}
        onOpenChange={open => !open && setSelectedIssue(null)}
        size="lg"
        icon={ListTodo}
        title={selectedIssue?.summary ?? 'Tarefa'}
        description="Detalhes e metadados sincronizados da tarefa no Jira."
        headerExtra={selectedIssue && (
          <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
            <Badge variant="outline" className="font-code text-xs font-semibold text-primary">
              {selectedIssue.key}
            </Badge>
            <Badge variant="secondary" className="text-xs font-bold">
              {selectedIssue.statusName || 'Status'}
            </Badge>
          </div>
        )}
        footer={selectedIssue && (
          <ModalButton
            onClick={() => window.open(`https://${activeDomain}/browse/${selectedIssue.key}`, '_blank')}
            className="gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir no Jira
          </ModalButton>
        )}
      >
          {selectedIssue && (
            <div>
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border/60">
                    <p className="text-xs font-semibold text-muted-foreground">Responsável</p>
                    <p className="text-xs font-bold text-foreground mt-1">
                      {selectedIssue.assigneeName || 'Não atribuído'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border/60">
                    <p className="text-xs font-semibold text-muted-foreground">Prioridade</p>
                    <p className="text-xs font-bold text-foreground mt-1 flex items-center gap-1">
                      {getPriorityIcon(selectedIssue.priorityName)}
                      {selectedIssue.priorityName || 'Normal'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-muted/50 border border-border/60">
                    <p className="text-xs font-semibold text-muted-foreground">Tipo de Item</p>
                    <p className="text-xs font-bold text-foreground mt-1 flex items-center gap-1">
                      {getTypeIcon(selectedIssue.typeName)}
                      {selectedIssue.typeName || 'Tarefa'}
                    </p>
                  </div>
                </div>

                {selectedIssue.tags && selectedIssue.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Tags e Rótulos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedIssue.tags.map((t, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-bold">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          PAINEL / MODAL DE CONFIGURAÇÃO DO QUADRO (FILTROS JQL & COLUNAS WIP)
         ═══════════════════════════════════════════════════════════════════ */}
      <BoardConfigModal
        open={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        columns={columns}
        issues={boardData.issuesData.issues}
        quickFilters={boardData.quickFiltersData.quickFilters}
        swimlanes={boardData.swimlanesData.swimlanes}
        swimlaneStrategy={swimlaneStrategy}
        rapidViewId={rapidViewId}
        boardName={boardData.boardName}
        initialTab={configModalTab}
        onSaveQuickFilters={updatedFilters => {
          setBoardData(prev => ({
            ...prev,
            quickFiltersData: { quickFilters: updatedFilters },
          }));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `agile_quick_filters_${squadId}`,
                JSON.stringify(updatedFilters)
              );
            } catch {}
          }
          toast({
            title: 'Filtros Rápidos Salvos',
            description: `${updatedFilters.length} filtros atualizados no quadro.`,
          });
        }}
        onSaveSwimlanes={(updatedSwimlanes, strategy) => {
          setBoardData(prev => ({
            ...prev,
            swimlanesData: { swimlanes: updatedSwimlanes },
          }));
          setSwimlaneStrategy(strategy as typeof swimlaneStrategy);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `agile_swimlanes_${squadId}`,
                JSON.stringify(updatedSwimlanes)
              );
              localStorage.setItem(`agile_swimlane_strategy_${squadId}`, strategy);
            } catch {}
          }
          toast({
            title: 'Raias Atualizadas',
            description: `${updatedSwimlanes.length} raias configuradas no quadro.`,
          });
        }}
        onSaveColumns={updatedColumns => {
          const overrides: ColumnWipOverride[] = updatedColumns.map(c => ({ id: c.id, min: c.min, max: c.max }));
          setBoardData(prev => ({
            ...prev,
            columnsData: {
              columns: prev.columnsData.columns.map(c => {
                const ov = overrides.find(o => String(o.id) === String(c.id));
                return ov ? { ...c, min: ov.min, max: ov.max } : c;
              }),
            },
          }));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`agile_columns_${squadId}`, JSON.stringify(overrides));
            } catch {}
          }
          toast({
            title: 'Colunas Atualizadas',
            description: `${updatedColumns.length} colunas configuradas no quadro.`,
          });
        }}
      />
    </div>
  );
}
