'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Columns,
  Filter,
  Layers,
  SlidersHorizontal,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Info,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import type {
  GreenhopperColumn,
  GreenhopperQuickFilter,
  GreenhopperSwimlane,
  GreenhopperIssue,
} from '@/services/greenhopperService';

interface StatusMappingItem {
  id: string | number;
  name: string;
  count: number | string;
  hasWarning?: boolean;
}

interface ColumnConfigDetail {
  id: string | number;
  name: string;
  min: number | null;
  max: number | null;
  accentColor: string;
  statuses: StatusMappingItem[];
}

const DEFAULT_COLUMN_CONFIG: ColumnConfigDetail[] = [
  {
    id: 1,
    name: 'A Fazer',
    min: null,
    max: null,
    accentColor: 'bg-slate-700 dark:bg-slate-500',
    statuses: [
      { id: 101, name: 'COMPROMETIDO', count: '8 itens' },
      { id: 102, name: 'ABERTO', count: '28 itens' },
      { id: 103, name: 'IMPEDIMENTO', count: 'Sem itens' },
      { id: 104, name: 'REFINAMENTO CONCLUÍDO', count: '15 itens' },
      { id: 105, name: 'REFINAMENTO TÉCNICO', count: 'Sem itens' },
      { id: 106, name: 'EM ANÁLISE DO DEF...', count: 'Sem itens' },
    ],
  },
  {
    id: 2,
    name: 'Em Desenvolvimento',
    min: null,
    max: 11,
    accentColor: 'bg-blue-600 dark:bg-blue-500',
    statuses: [
      { id: 201, name: 'EM CODIFICAÇÃO', count: 'Sem itens' },
      { id: 202, name: 'EM DESENVOLVIMENTO', count: '2 itens' },
      { id: 203, name: 'EM ANDAMENTO', count: '11 itens' },
      { id: 204, name: 'AGUARDANDO TERCEIRO', count: 'Sem itens' },
    ],
  },
  {
    id: 3,
    name: 'Para Revisar',
    min: null,
    max: 2,
    accentColor: 'bg-indigo-600 dark:bg-indigo-500',
    statuses: [
      { id: 301, name: 'DESENVOLVIMENTO CONCLUÍDO', count: 'Sem itens' },
      { id: 302, name: 'CODIFIC. CONCLUÍDO', count: 'Sem itens' },
    ],
  },
  {
    id: 4,
    name: 'Em Revisão',
    min: null,
    max: null,
    accentColor: 'bg-blue-600 dark:bg-blue-500',
    statuses: [{ id: 401, name: 'EM CODE REVIEW', count: 'Sem itens' }],
  },
  {
    id: 5,
    name: 'Para Testar',
    min: null,
    max: 8,
    accentColor: 'bg-blue-600 dark:bg-blue-500',
    statuses: [
      { id: 501, name: 'CODE REVIEW CONCLUÍDO', count: '4 itens' },
      { id: 502, name: 'EM DOCUMENTAÇÃO', count: '1 item' },
    ],
  },
  {
    id: 6,
    name: 'Em Teste',
    min: null,
    max: 6,
    accentColor: 'bg-blue-600 dark:bg-blue-500',
    statuses: [{ id: 601, name: 'EM TESTE DE ACEITAÇÃO', count: '3 itens' }],
  },
  {
    id: 7,
    name: 'Aguardando Expedição',
    min: null,
    max: null,
    accentColor: 'bg-blue-600 dark:bg-blue-500',
    statuses: [
      { id: 701, name: 'TESTE DE ACEITAÇÃO CONCLUÍDO', count: '1 item' },
      { id: 702, name: 'REVISÃO DE DOCUMENTAÇÃO', count: 'Sem itens', hasWarning: true },
    ],
  },
  {
    id: 8,
    name: 'Finalizado',
    min: null,
    max: null,
    accentColor: 'bg-emerald-600 dark:bg-emerald-500',
    statuses: [
      { id: 801, name: 'RESOLVIDO', count: '5 itens' },
      { id: 802, name: 'CANCELADO', count: '427 itens' },
      { id: 803, name: 'EXPEDIDO', count: 'Sem itens' },
      { id: 804, name: 'ELIMINADO', count: 'Sem itens', hasWarning: true },
      { id: 805, name: 'CONCLUÍDO', count: '1596 itens' },
      { id: 806, name: 'NÃO OCORRIDO', count: 'Sem itens', hasWarning: true },
    ],
  },
];

const COLUMN_ACCENT_PALETTE = [
  'bg-slate-700 dark:bg-slate-500',
  'bg-blue-600 dark:bg-blue-500',
  'bg-indigo-600 dark:bg-indigo-500',
  'bg-violet-600 dark:bg-violet-500',
  'bg-cyan-600 dark:bg-cyan-500',
  'bg-amber-600 dark:bg-amber-500',
  'bg-orange-600 dark:bg-orange-500',
  'bg-emerald-600 dark:bg-emerald-500',
];

// Constrói a lista de colunas editáveis a partir do board real (colunas + issues
// vivas), em vez do fixture fixo — antes a aba WIP sempre mostrava dados
// fabricados independente do squad conectado.
function buildColumnListFromLive(liveColumns: GreenhopperColumn[], issues: GreenhopperIssue[]): ColumnConfigDetail[] {
  return liveColumns.map((col, idx) => {
    const statusCounts = new Map<string, { name: string; count: number }>();
    for (const issue of issues) {
      const matchesColumn =
        col.statusIds.includes(issue.statusId) ||
        col.statusIds.includes(Number(issue.statusId)) ||
        (col.name === 'A Fazer' && issue.statusCategory === 'new') ||
        (col.name === 'Finalizado' && issue.statusCategory === 'done');
      if (!matchesColumn) continue;
      const key = String(issue.statusId);
      const entry = statusCounts.get(key);
      if (entry) entry.count += 1;
      else statusCounts.set(key, { name: issue.statusName || key, count: 1 });
    }
    const statuses: StatusMappingItem[] = Array.from(statusCounts.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      count: `${v.count} ${v.count === 1 ? 'item' : 'itens'}`,
    }));
    return {
      id: col.id,
      name: col.name,
      min: col.min ?? null,
      max: col.max ?? null,
      accentColor: COLUMN_ACCENT_PALETTE[idx % COLUMN_ACCENT_PALETTE.length],
      statuses,
    };
  });
}

export const DEFAULT_QUICK_FILTERS: GreenhopperQuickFilter[] = [
  {
    id: 1,
    name: 'Sprint Goal',
    query: 'labels = Sprint_goal',
    description: '',
  },
  {
    id: 2,
    name: 'Beatriz',
    query: 'assignee = beatriz.lima or issuetype IN ("Defeito (Sub-tarefa)") and creator = beatriz.lima',
    description: '',
  },
  {
    id: 3,
    name: 'Diego',
    query: 'assignee = diego.rocha or issuetype IN ("Defeito (Sub-tarefa)") and creator = diego.rocha',
    description: '',
  },
  {
    id: 4,
    name: 'Felipe',
    query: 'assignee = felipe.martins or issuetype IN ("Defeito (Sub-tarefa)") and creator = felipe.martins',
    description: '',
  },
  {
    id: 5,
    name: 'Gustavo',
    query: 'assignee = gustavo.pinto or issuetype IN ("Defeito (Sub-tarefa)") and creator = gustavo.pinto',
    description: '',
  },
  {
    id: 6,
    name: 'Alice',
    query: 'assignee = alice.souza OR (Desenvolvedor = alice.souza OR "Responsável (Codificação)" =alice.souza)',
    description: '',
  },
  {
    id: 7,
    name: 'Henrique Dias',
    query: 'assignee = henrique.dias OR (Desenvolvedor = henrique.dias OR "Responsável (Codificação)" =henrique.dias)',
    description: '',
  },
  {
    id: 8,
    name: 'Carlos',
    query: 'assignee = carlos.mendes OR (Desenvolvedor = carlos.mendes OR "Responsável (Codificação)" =carlos.mendes)',
    description: '',
  },
  {
    id: 9,
    name: 'Eduardo Nunes',
    query: 'assignee = eduardo.nunes OR (Desenvolvedor = eduardo.nunes OR "Responsável (Codificação)" =eduardo.nunes )',
    description: '',
  },
  {
    id: 10,
    name: 'Data Acordo',
    query: '( "Data Acordo Entrega" >= startOfWeek() AND "Data Acordo Entrega" <= endOfWeek() ) OR ( "Data Interna Acordada" >= startOfWeek() AND "Data Interna Acordada" <= endOfWeek() ) AND statusCategory != Done',
    description: '',
  },
  {
    id: 11,
    name: 'CausaOC',
    query: 'issuetype in (Manutenção,"Rejeição - Manutenção") and priority = Crítica',
    description: '',
  },
  {
    id: 12,
    name: 'Abertas',
    query: 'status not in (Cancelado, Closed, Concluído, Recusada)',
    description: '',
  },
];

export const DEFAULT_SWIMLANES: GreenhopperSwimlane[] = [
  {
    id: 101,
    name: 'Prioridades ( WarRoom)',
    query: 'priority in ( Crítica, Alta) OR labels in (prioridade)',
    description: 'Itens com prioridade Crítica/Alta ou label prioridade',
    isDefault: false,
  },
  {
    id: 102,
    name: 'Reforma Tributária',
    query: 'labels in (Entrega_Cadastros, Entrega_HomologSEFAZ, Entrega_ProdSEFAZ)',
    description: 'Itens vinculados às entregas da Reforma Tributária e SEFAZ',
    isDefault: false,
  },
  {
    id: 103,
    name: 'Pausada',
    query: 'labels in (Pausada,pausada)',
    description: 'Tarefas e histórias temporariamente pausadas',
    isDefault: false,
  },
  {
    id: 104,
    name: 'Todo o Resto',
    query: '',
    description: 'Demais tarefas e itens ativos da sprint',
    isDefault: true,
  },
];

interface BoardConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns?: GreenhopperColumn[];
  issues?: GreenhopperIssue[];
  quickFilters?: GreenhopperQuickFilter[];
  swimlanes?: GreenhopperSwimlane[];
  swimlaneStrategy?: 'queries' | 'parents' | 'assignees' | 'epics' | 'none';
  rapidViewId?: number | string;
  boardName?: string;
  initialTab?: 'filters' | 'columns' | 'swimlanes';
  onSaveQuickFilters?: (filters: GreenhopperQuickFilter[]) => void;
  onSaveColumns?: (columns: ColumnConfigDetail[]) => void;
  onSaveSwimlanes?: (swimlanes: GreenhopperSwimlane[], strategy: string) => void;
}

export function BoardConfigModal({
  open,
  onOpenChange,
  columns,
  issues,
  quickFilters: initialQuickFilters,
  swimlanes: initialSwimlanes,
  swimlaneStrategy: initialSwimlaneStrategy = 'queries',
  rapidViewId = 11360,
  boardName = 'SCRUM Demo',
  initialTab = 'filters',
  onSaveQuickFilters,
  onSaveColumns,
  onSaveSwimlanes,
}: BoardConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'filters' | 'columns' | 'swimlanes'>(initialTab);
  const [columnList, setColumnList] = useState<ColumnConfigDetail[]>(() =>
    columns && columns.length > 0 ? buildColumnListFromLive(columns, issues || []) : DEFAULT_COLUMN_CONFIG
  );
  const [filterList, setFilterList] = useState<GreenhopperQuickFilter[]>(
    initialQuickFilters && initialQuickFilters.length > 0
      ? initialQuickFilters
      : DEFAULT_QUICK_FILTERS
  );
  const [swimlaneStrategy, setSwimlaneStrategy] = useState<'queries' | 'parents' | 'assignees' | 'epics' | 'none'>(initialSwimlaneStrategy);
  const [swimlaneList, setSwimlaneList] = useState<GreenhopperSwimlane[]>(
    initialSwimlanes && initialSwimlanes.length > 0
      ? initialSwimlanes
      : DEFAULT_SWIMLANES
  );

  // Ressincroniza com os dados reais do quadro toda vez que o modal reabre —
  // antes o estado só era lido na primeira montagem, então reabrir o modal
  // (ele nunca desmonta, só o Dialog fecha/abre) mostrava dados obsoletos de
  // uma abertura anterior, inclusive a aba em que o usuário tinha ficado.
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setColumnList(columns && columns.length > 0 ? buildColumnListFromLive(columns, issues || []) : DEFAULT_COLUMN_CONFIG);
    setFilterList(initialQuickFilters && initialQuickFilters.length > 0 ? initialQuickFilters : DEFAULT_QUICK_FILTERS);
    setSwimlaneStrategy(initialSwimlaneStrategy);
    setSwimlaneList(initialSwimlanes && initialSwimlanes.length > 0 ? initialSwimlanes : DEFAULT_SWIMLANES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Estado para edição inline de filtros
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuery, setEditQuery] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Estado para novo filtro
  const [isAddingFilter, setIsAddingFilter] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Estado para edição inline de raias
  const [editingSwimlaneId, setEditingSwimlaneId] = useState<string | number | null>(null);
  const [editSwimlaneName, setEditSwimlaneName] = useState('');
  const [editSwimlaneQuery, setEditSwimlaneQuery] = useState('');
  const [editSwimlaneDesc, setEditSwimlaneDesc] = useState('');

  // Estado para nova raia
  const [isAddingSwimlane, setIsAddingSwimlane] = useState(false);
  const [newSwimlaneName, setNewSwimlaneName] = useState('');
  const [newSwimlaneQuery, setNewSwimlaneQuery] = useState('');
  const [newSwimlaneDesc, setNewSwimlaneDesc] = useState('');

  const handleMinChange = (colId: string | number, val: string) => {
    const num = val === '' ? null : Number(val);
    setColumnList(prev =>
      prev.map(c => (c.id === colId ? { ...c, min: isNaN(num as number) ? null : num } : c))
    );
  };

  const handleMaxChange = (colId: string | number, val: string) => {
    const num = val === '' ? null : Number(val);
    setColumnList(prev =>
      prev.map(c => (c.id === colId ? { ...c, max: isNaN(num as number) ? null : num } : c))
    );
  };

  const startEdit = (filter: GreenhopperQuickFilter) => {
    setEditingId(filter.id);
    setEditName(filter.name);
    setEditQuery(filter.query || '');
    setEditDesc(filter.description || '');
  };

  const saveEdit = (id: string | number) => {
    setFilterList(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, name: editName.trim(), query: editQuery.trim(), description: editDesc.trim() }
          : f
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const deleteFilter = (id: string | number) => {
    setFilterList(prev => prev.filter(f => f.id !== id));
  };

  const moveFilter = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filterList.length) return;
    const updated = [...filterList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFilterList(updated);
  };

  const addFilter = () => {
    if (!newName.trim() || !newQuery.trim()) return;
    const newFilterItem: GreenhopperQuickFilter = {
      id: Date.now(),
      name: newName.trim(),
      query: newQuery.trim(),
      description: newDesc.trim(),
    };
    setFilterList(prev => [...prev, newFilterItem]);
    setNewName('');
    setNewQuery('');
    setNewDesc('');
    setIsAddingFilter(false);
  };

  const resetToDefaultFilters = () => {
    setFilterList(DEFAULT_QUICK_FILTERS);
  };

  const startEditSwimlane = (swimlane: GreenhopperSwimlane) => {
    setEditingSwimlaneId(swimlane.id);
    setEditSwimlaneName(swimlane.name);
    setEditSwimlaneQuery(swimlane.query || '');
    setEditSwimlaneDesc(swimlane.description || '');
  };

  const saveEditSwimlane = (id: string | number) => {
    setSwimlaneList(prev =>
      prev.map(s =>
        s.id === id
          ? {
              ...s,
              name: editSwimlaneName.trim(),
              query: editSwimlaneQuery.trim(),
              description: editSwimlaneDesc.trim(),
            }
          : s
      )
    );
    setEditingSwimlaneId(null);
  };

  const cancelEditSwimlane = () => {
    setEditingSwimlaneId(null);
  };

  const deleteSwimlane = (id: string | number) => {
    setSwimlaneList(prev => prev.filter(s => s.id !== id || s.isDefault));
  };

  const moveSwimlane = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= swimlaneList.length) return;
    // Não move além do default 'Todo o Resto'
    if (swimlaneList[index].isDefault || swimlaneList[targetIndex].isDefault) return;
    const updated = [...swimlaneList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSwimlaneList(updated);
  };

  const addSwimlane = () => {
    if (!newSwimlaneName.trim() || !newSwimlaneQuery.trim()) return;
    const newSwimlaneItem: GreenhopperSwimlane = {
      id: Date.now(),
      name: newSwimlaneName.trim(),
      query: newSwimlaneQuery.trim(),
      description: newSwimlaneDesc.trim(),
      isDefault: false,
    };
    // Insere antes do default 'Todo o Resto'
    const defaultIdx = swimlaneList.findIndex(s => s.isDefault);
    if (defaultIdx !== -1) {
      const updated = [...swimlaneList];
      updated.splice(defaultIdx, 0, newSwimlaneItem);
      setSwimlaneList(updated);
    } else {
      setSwimlaneList(prev => [...prev, newSwimlaneItem]);
    }
    setNewSwimlaneName('');
    setNewSwimlaneQuery('');
    setNewSwimlaneDesc('');
    setIsAddingSwimlane(false);
  };

  const resetToDefaultSwimlanes = () => {
    setSwimlaneList(DEFAULT_SWIMLANES);
  };

  const handleApplyChanges = () => {
    if (onSaveQuickFilters) onSaveQuickFilters(filterList);
    if (onSaveColumns) onSaveColumns(columnList);
    if (onSaveSwimlanes) onSaveSwimlanes(swimlaneList, swimlaneStrategy);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1680px] h-[92vh] max-h-[92vh] overflow-hidden rounded-3xl p-0 border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-[9.5px]">
                Configuração do Quadro
              </Badge>
              <span className="text-xs font-mono text-slate-400">
                {boardName} #{rapidViewId}
              </span>
            </div>
            <DialogTitle className="text-lg md:text-xl font-black tracking-tight uppercase font-headline text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
              Painel de Configuração Ágil
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie os filtros rápidos com consultas JQL, limites de WIP por coluna e o fluxo do time.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyChanges}
              className="rounded-xl h-8 text-xs font-bold px-4 bg-primary text-white hover:bg-primary/90"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Salvar & Aplicar
            </Button>
          </div>
        </div>

        {/* Layout com Sidebar e Área de Conteúdo */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
          {/* Sidebar lateral estilo Jira Settings */}
          <div className="w-full md:w-56 p-3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-2 hidden md:block">
              CONFIGURAÇÃO
            </span>

            <button
              onClick={() => setActiveTab('filters')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'filters'
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>Filtros Rápidos</span>
              <Badge variant="secondary" className="ml-auto text-[9px] font-bold px-1.5 py-0 hidden md:inline-flex">
                {filterList.length}
              </Badge>
            </button>

            <button
              onClick={() => setActiveTab('columns')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'columns'
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Columns className="h-3.5 w-3.5 shrink-0" />
              <span>Colunas & WIP</span>
            </button>

            <button
              onClick={() => setActiveTab('swimlanes')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'swimlanes'
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>Raias (Swimlanes)</span>
            </button>
          </div>

          {/* Área Principal */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(92vh-85px)]">
            {/* ═════════════════════════════════════════════════════════════════
                ABA: FILTROS RÁPIDOS (IMAGEM 3)
               ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'filters' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Filtros Rápidos
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Filtros Rápidos podem ser usados para filtrar ainda mais os itens do Quadro, baseado na consulta adicional JQL.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetToDefaultFilters}
                      className="h-8 text-xs font-bold gap-1 rounded-xl text-slate-600 dark:text-slate-300"
                      title="Restaura os 12 filtros padrões"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar Padrões
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsAddingFilter(true)}
                      className="h-8 text-xs font-bold gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Filtro
                    </Button>
                  </div>
                </div>

                {/* Formulário de Adicionar Novo Filtro */}
                {isAddingFilter && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                        Novo Filtro Rápido
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingFilter(false)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Nome do Filtro
                        </label>
                        <Input
                          placeholder="Ex: Minhas Tarefas"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="h-8 text-xs rounded-xl"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Consulta JQL
                        </label>
                        <Input
                          placeholder='Ex: assignee = currentUser() AND statusCategory != Done'
                          value={newQuery}
                          onChange={e => setNewQuery(e.target.value)}
                          className="h-8 text-xs rounded-xl font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Descrição (Opcional)
                      </label>
                      <Input
                        placeholder="Ex: Itens atribuídos diretamente ao usuário ativo"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        className="h-8 text-xs rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingFilter(false)}
                        className="h-7 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={addFilter}
                        disabled={!newName.trim() || !newQuery.trim()}
                        className="h-7 text-xs font-bold bg-indigo-600 text-white rounded-xl"
                      >
                        Salvar Filtro
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tabela de Filtros Rápidos */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="p-3 pl-4 w-40">Nome</th>
                          <th className="p-3">JQL</th>
                          <th className="p-3 w-48 hidden lg:table-cell">Descrição</th>
                          <th className="p-3 pr-4 w-28 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filterList.map((filter, index) => {
                          const isEditing = editingId === filter.id;

                          if (isEditing) {
                            return (
                              <tr key={filter.id} className="bg-indigo-50/40 dark:bg-indigo-950/20">
                                <td className="p-2 pl-4">
                                  <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="h-7 text-xs rounded-lg font-bold"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={editQuery}
                                    onChange={e => setEditQuery(e.target.value)}
                                    className="h-7 text-xs rounded-lg font-mono"
                                  />
                                </td>
                                <td className="p-2 hidden lg:table-cell">
                                  <Input
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    className="h-7 text-xs rounded-lg"
                                  />
                                </td>
                                <td className="p-2 pr-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => saveEdit(filter.id)}
                                      className="h-6 w-6 p-0 rounded-md bg-emerald-600 text-white"
                                      title="Salvar"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={cancelEdit}
                                      className="h-6 w-6 p-0 rounded-md"
                                      title="Cancelar"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={filter.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                            >
                              <td className="p-3 pl-4 font-bold text-slate-800 dark:text-slate-200">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                                  {filter.name}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all leading-relaxed">
                                {filter.query}
                              </td>
                              <td className="p-3 text-[11px] text-slate-400 hidden lg:table-cell">
                                {filter.description || '—'}
                              </td>
                              <td className="p-3 pr-4 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => moveFilter(index, 'up')}
                                    disabled={index === 0}
                                    className="h-6 w-6 p-0 rounded-md text-slate-400 hover:text-slate-600"
                                    title="Mover para cima"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => moveFilter(index, 'down')}
                                    disabled={index === filterList.length - 1}
                                    className="h-6 w-6 p-0 rounded-md text-slate-400 hover:text-slate-600"
                                    title="Mover para baixo"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEdit(filter)}
                                    className="h-6 w-6 p-0 rounded-md text-indigo-600 hover:text-indigo-700"
                                    title="Editar Filtro"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteFilter(filter.id)}
                                    className="h-6 w-6 p-0 rounded-md text-rose-500 hover:text-rose-600"
                                    title="Excluir Filtro"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                ABA: COLUNAS & WIP (IMAGEM 2)
               ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'columns' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Colunas e Limites de WIP
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mapeamento de colunas, limites mínimos/máximos e distribuição de status do fluxo do Jira.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 my-2 overflow-x-auto pb-4">
                  {columnList.map(col => {
                    const hasMax = col.max !== null && col.max > 0;
                    const hasMin = col.min !== null && col.min > 0;

                    return (
                      <div
                        key={col.id}
                        className="bg-white dark:bg-slate-900/95 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all min-w-[155px]"
                      >
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-2 leading-snug min-h-[28px] flex items-center">
                            {col.name}
                          </h4>

                          <div className="grid grid-cols-2 gap-1.5 mb-3">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 text-center">
                                MÍN
                              </span>
                              <Input
                                type="text"
                                placeholder="Sem Min"
                                value={col.min === null ? '' : col.min}
                                onChange={e => handleMinChange(col.id, e.target.value)}
                                className={`h-7 px-1 text-[10px] text-center font-bold rounded-lg ${
                                  hasMin
                                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                                    : 'border-amber-500/60 text-slate-500 dark:text-slate-400 placeholder:text-amber-700/60 dark:placeholder:text-amber-400/60'
                                }`}
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block mb-0.5 text-center">
                                MÁX
                              </span>
                              <Input
                                type="text"
                                placeholder="Sem Máx"
                                value={col.max === null ? '' : col.max}
                                onChange={e => handleMaxChange(col.id, e.target.value)}
                                className={`h-7 px-1 text-[10px] text-center font-bold rounded-lg ${
                                  hasMax
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5'
                                    : 'border-orange-500/60 text-slate-500 dark:text-slate-400 placeholder:text-orange-700/60 dark:placeholder:text-orange-400/60'
                                }`}
                              />
                            </div>
                          </div>

                          <div className={`h-1.5 w-full rounded-full ${col.accentColor} mb-3`} />

                          <div className="space-y-1.5">
                            {col.statuses.map(st => (
                              <div
                                key={st.id}
                                className={`p-2 rounded-xl border text-[9.5px] transition-all ${
                                  st.hasWarning
                                    ? 'bg-amber-500/5 border-amber-500/30'
                                    : 'bg-slate-50/90 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800/80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span
                                    className={`font-black uppercase tracking-wider leading-tight break-words ${
                                      st.hasWarning
                                        ? 'text-amber-700 dark:text-amber-300'
                                        : col.name === 'Finalizado'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    {st.name}
                                  </span>
                                  {st.hasWarning && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                  )}
                                </div>
                                <p className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                                  {st.count}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                ABA: RAIAS (SWIMLANES)
               ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'swimlanes' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Cabeçalho explicativo */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Raia
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Uma Raia é uma linha no Quadro que pode ser utilizada nos itens em grupo. O tipo de Raia pode ser alterado abaixo e será salvo automaticamente. <span className="font-semibold text-slate-600 dark:text-slate-300">Nota: consultas não vão ser perdidas quando alteradas por outro tipo de Raia.</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 shrink-0">
                        Basear as Raias no:
                      </label>
                      <select
                        value={swimlaneStrategy}
                        onChange={e => setSwimlaneStrategy(e.target.value as any)}
                        className="h-8 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="queries">Pesquisas (Consultas JQL)</option>
                        <option value="parents">Histórias (Itens Pai)</option>
                        <option value="assignees">Responsáveis</option>
                        <option value="epics">Épicos</option>
                        <option value="none">Nenhuma</option>
                      </select>
                    </div>

                    {swimlaneStrategy === 'queries' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetToDefaultSwimlanes}
                          className="h-8 text-xs font-bold gap-1 rounded-xl text-slate-600 dark:text-slate-300"
                          title="Restaura as 4 raias padrões (Prioridades, Reforma Tributária, Pausada, Todo o Resto)"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restaurar Padrões
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setIsAddingSwimlane(true)}
                          className="h-8 text-xs font-bold gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar Raia
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Se a estratégia for "Pesquisas", exibe a tabela JQL */}
                {swimlaneStrategy === 'queries' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 px-1 leading-relaxed">
                      Agrupar o item por pesquisas customizadas. Pesquisas são baseadas no JQL adicional salvo do Quadro. Por exemplo: para agrupar itens que têm uma prioridade bloqueante, utilize o JQL <code>priority in (Crítica, Alta)</code>.
                    </p>

                    {/* Formulário para Nova Raia */}
                    {isAddingSwimlane && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">
                            Nova Raia de Pesquisa
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingSwimlane(false)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              Nome da Raia
                            </label>
                            <Input
                              placeholder="Ex: Tarefas de Backend"
                              value={newSwimlaneName}
                              onChange={e => setNewSwimlaneName(e.target.value)}
                              className="h-8 text-xs rounded-xl"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              Consulta JQL
                            </label>
                            <Input
                              placeholder='Ex: labels in (backend, api)'
                              value={newSwimlaneQuery}
                              onChange={e => setNewSwimlaneQuery(e.target.value)}
                              className="h-8 text-xs rounded-xl font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Descrição (Opcional)
                          </label>
                          <Input
                            placeholder="Ex: Itens de integração e serviços backend"
                            value={newSwimlaneDesc}
                            onChange={e => setNewSwimlaneDesc(e.target.value)}
                            className="h-8 text-xs rounded-xl"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingSwimlane(false)}
                            className="h-7 text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={addSwimlane}
                            disabled={!newSwimlaneName.trim() || !newSwimlaneQuery.trim()}
                            className="h-7 text-xs font-bold bg-indigo-600 text-white rounded-xl"
                          >
                            Salvar Raia
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tabela de Raias */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                              <th className="p-3 pl-4 w-48">Nome</th>
                              <th className="p-3">JQL</th>
                              <th className="p-3 w-48 hidden lg:table-cell">Descrição</th>
                              <th className="p-3 pr-4 w-28 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {swimlaneList.map((swimlane, index) => {
                              const isEditing = editingSwimlaneId === swimlane.id;
                              const isDefault = !!swimlane.isDefault;

                              if (isEditing) {
                                return (
                                  <tr key={swimlane.id} className="bg-indigo-50/40 dark:bg-indigo-950/20">
                                    <td className="p-2 pl-4">
                                      <Input
                                        value={editSwimlaneName}
                                        onChange={e => setEditSwimlaneName(e.target.value)}
                                        disabled={isDefault}
                                        className="h-7 text-xs rounded-lg font-bold"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        value={editSwimlaneQuery}
                                        onChange={e => setEditSwimlaneQuery(e.target.value)}
                                        disabled={isDefault}
                                        placeholder={isDefault ? 'Filtro padrão para todos os demais itens' : ''}
                                        className="h-7 text-xs rounded-lg font-mono"
                                      />
                                    </td>
                                    <td className="p-2 hidden lg:table-cell">
                                      <Input
                                        value={editSwimlaneDesc}
                                        onChange={e => setEditSwimlaneDesc(e.target.value)}
                                        className="h-7 text-xs rounded-lg"
                                      />
                                    </td>
                                    <td className="p-2 pr-4 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          size="sm"
                                          onClick={() => saveEditSwimlane(swimlane.id)}
                                          className="h-6 w-6 p-0 rounded-md bg-emerald-600 text-white"
                                          title="Salvar"
                                        >
                                          <Check className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={cancelEditSwimlane}
                                          className="h-6 w-6 p-0 rounded-md"
                                          title="Cancelar"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr
                                  key={swimlane.id}
                                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                                >
                                  <td className="p-3 pl-4 font-bold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                                        {swimlane.name}
                                      </span>
                                      {isDefault && (
                                        <Badge variant="outline" className="text-[8px] font-bold text-slate-400">
                                          Padrão
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all leading-relaxed">
                                    {isDefault ? (
                                      <span className="text-slate-400 italic font-sans text-xs">
                                        Todos os itens que não corresponderem a nenhuma consulta acima
                                      </span>
                                    ) : (
                                      swimlane.query
                                    )}
                                  </td>
                                  <td className="p-3 text-[11px] text-slate-400 hidden lg:table-cell">
                                    {swimlane.description || '—'}
                                  </td>
                                  <td className="p-3 pr-4 text-right">
                                    {!isDefault && (
                                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => moveSwimlane(index, 'up')}
                                          disabled={index === 0}
                                          className="h-6 w-6 p-0 rounded-md text-slate-400 hover:text-slate-600"
                                          title="Mover para cima"
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => moveSwimlane(index, 'down')}
                                          disabled={index >= swimlaneList.length - 2}
                                          className="h-6 w-6 p-0 rounded-md text-slate-400 hover:text-slate-600"
                                          title="Mover para baixo"
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => startEditSwimlane(swimlane)}
                                          className="h-6 w-6 p-0 rounded-md text-indigo-600 hover:text-indigo-700"
                                          title="Editar Raia"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => deleteSwimlane(swimlane.id)}
                                          className="h-6 w-6 p-0 rounded-md text-rose-500 hover:text-rose-600"
                                          title="Excluir Raia"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <Layers className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                      {swimlaneStrategy === 'parents'
                        ? 'Agrupamento por Histórias (Itens Pai)'
                        : swimlaneStrategy === 'assignees'
                        ? 'Agrupamento por Responsáveis'
                        : swimlaneStrategy === 'epics'
                        ? 'Agrupamento por Épicos'
                        : 'Sem Divisão de Raias'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {swimlaneStrategy === 'parents'
                        ? 'Subtarefas são agrupadas sob seus itens Pai. Itens sem subtarefas serão apresentados no próprio grupo na parte inferior.'
                        : swimlaneStrategy === 'assignees'
                        ? 'Cada desenvolvedor/membro possui uma raia dedicada com todas as suas tarefas atribuídas.'
                        : swimlaneStrategy === 'epics'
                        ? 'As tarefas são agrupadas conforme seu vínculo de Épico Pai.'
                        : 'Todas as tarefas do quadro são renderizadas em um único fluxo contínuo sem divisões horizontais.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Exporta também com o nome anterior para retrocompatibilidade
export { BoardConfigModal as BoardColumnConfigModal };
