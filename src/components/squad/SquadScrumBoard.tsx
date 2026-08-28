'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings, getJiraCredentials } from '@/hooks/useJiraSettings';
import {
  fetchGreenhopperWorkData,
  SAMPLE_GREENHOPPER_DATA,
  type GreenhopperWorkData,
  type GreenhopperIssue,
  type GreenhopperColumn,
  type GreenhopperSwimlane,
  type GreenhopperQuickFilter,
} from '@/services/greenhopperService';
import { BoardConfigModal } from './BoardConfigModal';

interface SquadScrumBoardProps {
  squadId?: string;
  jiraProjectKey?: string;
  rapidViewId?: number | string;
  jiraDomain?: string;
}

export function SquadScrumBoard({
  squadId = 'MISSI',
  jiraProjectKey = 'DDWMISSI',
  rapidViewId: initialRapidViewId,
  jiraDomain: initialDomain,
}: SquadScrumBoardProps) {
  const { toast } = useToast();
  const { settings: jiraSettings } = useJiraSettings();

  const [rapidViewId, setRapidViewId] = useState<number | string>(
    initialRapidViewId || 11360
  );
  const [boardData, setBoardData] = useState<GreenhopperWorkData>(SAMPLE_GREENHOPPER_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'filters' | 'columns' | 'swimlanes'>('filters');
  const [selectedIssue, setSelectedIssue] = useState<GreenhopperIssue | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeDomain = initialDomain || jiraSettings?.domain || 'jiraproducao.totvs.com.br';
  const activeToken = jiraSettings?.token || '';

  // Carrega filtros e raias customizadas salvas localmente se existirem
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem(`agile_quick_filters_${squadId}`);
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBoardData(prev => ({
              ...prev,
              quickFiltersData: { quickFilters: parsed },
            }));
          }
        }

        const savedSwimlanes = localStorage.getItem(`agile_swimlanes_${squadId}`);
        if (savedSwimlanes) {
          const parsed = JSON.parse(savedSwimlanes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBoardData(prev => ({
              ...prev,
              swimlanesData: { swimlanes: parsed },
            }));
          }
        }
      } catch {}
    }
  }, [squadId]);

  // Busca dados do quadro
  const loadBoardData = async (showToast = false) => {
    setIsLoading(true);
    try {
      const data = await fetchGreenhopperWorkData({
        domain: activeDomain,
        token: activeToken,
        rapidViewId: rapidViewId || 11360,
        selectedProjectKey: jiraProjectKey,
      });
      setBoardData(data);
      if (showToast) {
        toast({
          title: 'Quadro Atualizado',
          description: `${data.issuesData.issues.length} itens sincronizados com o Jira.`,
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar quadro Scrum:', err);
      toast({
        title: 'Aviso',
        description: 'Utilizando snapshot recente do quadro.',
        variant: 'default',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData(false);
  }, [rapidViewId, jiraProjectKey, activeDomain, activeToken]);

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
      title: 'Chave copiada!',
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

          // E. Filtros por Pessoa / Desenvolvedor (ex: Helen, Marcio, Rhaynner, Nathan, Bruna, Anderson, Wanderson, Paulo Roberto)
          const memberAliases: Record<string, string[]> = {
            'helen': ['helen.crystina', 'helen.costa', 'helen'],
            'marcio': ['marcio.arueira', 'marcio.santos', 'marcio'],
            'rhaynner': ['rhaynner.costa', 'rhaynner.souza', 'rhaynner'],
            'nathan': ['nathan.caldas', 'nathan'],
            'bruna': ['bruna.balves', 'bruna.silva', 'bruna'],
            'anderson portuga': ['anderson.pereira', 'anderson.portuga', 'anderson'],
            'anderson': ['anderson.pereira', 'anderson.portuga', 'anderson'],
            'wanderson': ['wanderson.alves', 'wanderson'],
            'paulo roberto': ['paulo.queiroz', 'paulo.roberto', 'paulo'],
            'paulo': ['paulo.queiroz', 'paulo.roberto', 'paulo'],
          };

          for (const [key, aliases] of Object.entries(memberAliases)) {
            if (fn.includes(key) || qLower.includes(key)) {
              const assignee = (issue.assignee || '').toLowerCase();
              const assigneeName = (issue.assigneeName || '').toLowerCase();
              const extraDev = (issue.extraFields || [])
                .find(f => f.label.toLowerCase().includes('dev'))
                ?.value?.toLowerCase() || '';

              return aliases.some(
                a => assignee.includes(a) || assigneeName.includes(a) || extraDev.includes(a)
              );
            }
          }

          // F. Fallback genérico para filtros customizados criados pelo usuário
          const assignee = (issue.assignee || '').toLowerCase();
          const assigneeName = (issue.assigneeName || '').toLowerCase();
          if (assignee.includes(fn) || assigneeName.includes(fn)) return true;
          if ((issue.tags || []).some(t => t.toLowerCase().includes(fn))) return true;

          return false;
        });

        if (!matchesAnyActiveFilter) return false;
      }

      return true;
    });
  }, [boardData, searchQuery, activeFilters]);

  // Determina a raia de cada issue seguindo a ordem de precedência do Jira
  const getIssueSwimlaneId = (issue: GreenhopperIssue, allSwimlanes: GreenhopperSwimlane[]) => {
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
    return <ListTodo className="h-3 w-3 text-slate-400" />;
  };

  const getAssigneeAvatar = (issue: GreenhopperIssue) => {
    const name = issue.assigneeName || issue.assignee || 'Não atribuído';
    const initials = name
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('');

    // Cor determinística baseada no nome
    const colors = [
      'bg-orange-500 text-white',
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-purple-600 text-white',
      'bg-indigo-600 text-white',
      'bg-pink-600 text-white',
      'bg-teal-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colorClass = colors[Math.abs(hash) % colors.length];

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs cursor-pointer ring-1 ring-white dark:ring-slate-900 ${colorClass}`}
            >
              {initials || <User className="h-3 w-3" />}
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs font-bold bg-slate-900 text-white p-2 rounded-xl">
            {name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ═══════════════════════════════════════════════════════════════════
          CABEÇALHO DO QUADRO SCRUM (JIRA GREENHOPPER STYLE)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800/70 rounded-3xl p-5 md:p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none font-black uppercase tracking-wider text-[9px] px-2.5 py-0.5">
                QUADRO SCRUM
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                {jiraProjectKey}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase font-headline text-slate-900 dark:text-white">
              {boardData.boardName || `SCRUM ${jiraProjectKey}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {activeSprint?.name || `${jiraProjectKey} Missi - Sprint Ativa`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dias Restantes */}
            <div className="flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3.5 py-1.5 rounded-2xl text-xs font-bold">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
              <span>{activeSprint?.daysRemaining ?? 1} dia restante(s)</span>
            </div>

            {/* Ação Concluir Sprint / Ver no Jira */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const jiraUrl = `https://${activeDomain}/secure/RapidBoard.jspa?rapidView=${rapidViewId}&selectedProjectKey=${jiraProjectKey}`;
                window.open(jiraUrl, '_blank');
              }}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
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
              className="h-8 text-xs font-bold rounded-xl gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Configurar Quadro & WIP
            </Button>

            {/* Sincronização */}
            <Button
              size="sm"
              onClick={() => loadBoardData(true)}
              disabled={isLoading}
              className="h-8 text-xs font-black uppercase tracking-wider rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BARRA DE FILTROS RÁPIDOS (QUICK FILTERS)
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtros Rápidos:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfigModalTab('filters');
                  setIsConfigModalOpen(true);
                }}
                className="h-6 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg gap-1"
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
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold tracking-tight transition-all shrink-0 cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200/70 dark:hover:bg-slate-800'
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
                  className="h-6 text-[10px] text-rose-500 hover:text-rose-600 font-bold px-2"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative shrink-0 w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por chave, dev ou texto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/50 border-slate-200/70 dark:border-slate-800/70"
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
          <div className="grid grid-cols-8 gap-3 mb-2 px-1">
            {columns.map(col => {
              // Conta total de issues nesta coluna
              const colIssues = filteredIssues.filter(i =>
                col.statusIds.includes(i.statusId) ||
                col.statusIds.includes(Number(i.statusId)) ||
                (col.name === 'A Fazer' && i.statusCategory === 'new') ||
                (col.name === 'Finalizado' && i.statusCategory === 'done')
              );
              const count = colIssues.length;
              const hasMax = col.max !== null && col.max !== undefined && col.max > 0;
              const isOverWip = hasMax && count > (col.max as number);
              const isNearWip = hasMax && count === (col.max as number);

              return (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
                    {col.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {count}
                    </span>
                    {hasMax && (
                      <Badge
                        variant="outline"
                        className={`text-[8px] font-bold px-1 py-0 ${
                          isOverWip
                            ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 animate-pulse'
                            : isNearWip
                            ? 'bg-amber-500/20 text-amber-600 border-amber-500/40'
                            : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
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
            {swimlanes.map(swimlane => {
              const isCollapsed = collapsedSwimlanes[String(swimlane.id)];
              const swimlaneIssues = filteredIssues.filter(
                i => getIssueSwimlaneId(i, swimlanes) === swimlane.id
              );

              return (
                <div
                  key={swimlane.id}
                  className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden shadow-xs"
                >
                  {/* Cabeçalho da Swimlane */}
                  <div
                    onClick={() => toggleSwimlane(swimlane.id)}
                    className="flex items-center justify-between p-3.5 px-4 bg-slate-100/70 dark:bg-slate-900/60 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-colors border-b border-slate-200/50 dark:border-slate-800/50"
                  >
                    <div className="flex items-center gap-2.5">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                      <h3 className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">
                        {swimlane.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {swimlaneIssues.length} itens
                      </Badge>
                    </div>
                  </div>

                  {/* Colunas dentro da Swimlane */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-8 gap-3 p-3 min-h-[140px]">
                      {columns.map(col => {
                        const colIssues = swimlaneIssues.filter(i =>
                          col.statusIds.includes(i.statusId) ||
                          col.statusIds.includes(Number(i.statusId)) ||
                          (col.name === 'A Fazer' && i.statusCategory === 'new') ||
                          (col.name === 'Finalizado' && i.statusCategory === 'done')
                        );

                        return (
                          <div
                            key={col.id}
                            className="bg-white/40 dark:bg-slate-900/30 rounded-2xl p-1.5 flex flex-col gap-2 min-h-[120px] border border-dashed border-slate-200/70 dark:border-slate-800/70"
                          >
                            {colIssues.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center p-4">
                                <span className="text-[10px] font-medium text-slate-300 dark:text-slate-700">
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
                                    className={`p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/60 dark:hover:border-indigo-400/60 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between gap-2.5 relative overflow-hidden ${
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
                                            className="text-[11px] font-black font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                            title="Clique para copiar a chave"
                                          >
                                            {issue.key}
                                            {copiedKey === issue.key ? (
                                              <Check className="h-2.5 w-2.5 text-emerald-500" />
                                            ) : (
                                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                                            )}
                                          </button>
                                        </div>
                                        {getAssigneeAvatar(issue)}
                                      </div>

                                      {/* Título / Resumo */}
                                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 line-clamp-3 leading-snug">
                                        {issue.summary}
                                      </p>

                                      {/* Tags / Badges Coloridas */}
                                      {issue.tags && issue.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {issue.tags.map((tag, idx) => (
                                            <span
                                              key={idx}
                                              className="text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-full"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Rodapé do Card: Prioridade + Subtarefas + Prazos */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
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
                                        <div className="flex items-center gap-1 font-mono">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          <span>
                                            {issue.subTasks.filter(st => st.isDone).length}/
                                            {issue.subTasks.length}
                                          </span>
                                        </div>
                                      )}

                                      {/* Estimativa / Story Points */}
                                      {issue.estimateStatistic?.statFieldValue?.value && (
                                        <span className="font-black text-slate-600 dark:text-slate-300">
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
      <Dialog open={!!selectedIssue} onOpenChange={open => !open && setSelectedIssue(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          {selectedIssue && (
            <div>
              <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {selectedIssue.key}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {selectedIssue.statusName || 'Status'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const jiraUrl = `https://${activeDomain}/browse/${selectedIssue.key}`;
                      window.open(jiraUrl, '_blank');
                    }}
                    className="h-7 text-xs font-bold gap-1 rounded-xl"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir no Jira
                  </Button>
                </div>
                <DialogTitle className="text-base font-black text-slate-900 dark:text-white mt-2">
                  {selectedIssue.summary}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Detalhes e metadados sincronizados da tarefa no Jira.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[9px] font-black uppercase text-slate-400">Responsável</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                      {selectedIssue.assigneeName || 'Não atribuído'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[9px] font-black uppercase text-slate-400">Prioridade</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1">
                      {getPriorityIcon(selectedIssue.priorityName)}
                      {selectedIssue.priorityName || 'Normal'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                    <p className="text-[9px] font-black uppercase text-slate-400">Tipo de Item</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1">
                      {getTypeIcon(selectedIssue.typeName)}
                      {selectedIssue.typeName || 'Tarefa'}
                    </p>
                  </div>
                </div>

                {selectedIssue.tags && selectedIssue.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Tags e Rótulos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedIssue.tags.map((t, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-bold">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          PAINEL / MODAL DE CONFIGURAÇÃO DO QUADRO (FILTROS JQL & COLUNAS WIP)
         ═══════════════════════════════════════════════════════════════════ */}
      <BoardConfigModal
        open={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        columns={columns}
        quickFilters={boardData.quickFiltersData.quickFilters}
        swimlanes={boardData.swimlanesData.swimlanes}
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
        onSaveSwimlanes={updatedSwimlanes => {
          setBoardData(prev => ({
            ...prev,
            swimlanesData: { swimlanes: updatedSwimlanes },
          }));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `agile_swimlanes_${squadId}`,
                JSON.stringify(updatedSwimlanes)
              );
            } catch {}
          }
          toast({
            title: 'Raias Atualizadas',
            description: `${updatedSwimlanes.length} raias configuradas no quadro.`,
          });
        }}
      />
    </div>
  );
}
