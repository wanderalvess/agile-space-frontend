'use client';

import React, { useState, useEffect } from 'react';
import { 
  doc, 
  deleteDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirebase } from '@/firebase';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  LayoutDashboard, 
  WalletCards, 
  Activity, 
  BrainCircuit,
  Search,
  ExternalLink,
  Users,
  Filter,
  ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAdminCacheStore, UnifiedSession } from '@/store/adminCacheStore';

export function SessionMonitor() {
  const { firestore } = useFirebase();
  const { 
    sessions, 
    isFetchingSessions, 
    totalSessionsCount, 
    fetchSessions, 
    removeSessionFromCache,
    removeMultipleSessionsFromCache 
  } = useAdminCacheStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'participantCount', direction: 'desc' });

  useEffect(() => {
    if (firestore) {
      fetchSessions(firestore);
    }
  }, [firestore, fetchSessions]);

  const handleRefresh = () => {
    if (firestore) {
      fetchSessions(firestore, true);
    }
  };

  const handleLoadMore = () => {
    setVisibleLimit(prev => prev + 20);
  };

  const handleDeleteSession = async (session: UnifiedSession) => {
    if (!firestore) return;
    if (!confirm(`Deseja realmente deletar a sessão "${session.title}"? Esta ação é irreversível.`)) return;

    const collectionMap: Record<string, string> = {
      poker: 'rooms',
      retro: 'retro_boards',
      health: 'health_checks',
      brainstorm: 'brainstorming_boards',
      sprint_planning: 'sprint_plannings'
    };

    try {
      await deleteDoc(doc(firestore, collectionMap[session.type], session.id));
      removeSessionFromCache(session.id);
      setSelectedIds(prev => prev.filter(id => id !== session.id));
      toast({
        title: "Sessão encerrada",
        description: "A sala foi deletada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao deletar sessão:", error);
      toast({
        variant: "destructive",
        title: "Falha na exclusão",
        description: "Ocorreu um erro ao tentar encerrar a sessão.",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.length === 0) return;
    if (!confirm(`Deseja excluir as ${selectedIds.length} sessões selecionadas? Esta ação é irreversível.`)) return;

    const collectionMap: Record<string, string> = {
      poker: 'rooms',
      retro: 'retro_boards',
      health: 'health_checks',
      brainstorm: 'brainstorming_boards',
      sprint_planning: 'sprint_plannings'
    };

    try {
      const batch = writeBatch(firestore);
      const selectedSessions = sessions.filter(s => selectedIds.includes(s.id));
      
      selectedSessions.forEach(s => {
        batch.delete(doc(firestore, collectionMap[s.type], s.id));
      });

      await batch.commit();
      removeMultipleSessionsFromCache(selectedIds);
      setSelectedIds([]);
      toast({
        title: "Exclusão em massa",
        description: `${selectedIds.length} sessões foram removidas.`,
      });
    } catch (error) {
      console.error("Erro na exclusão em massa:", error);
      toast({
        variant: "destructive",
        title: "Erro operacional",
        description: "Não foi possível remover todos os itens selecionados.",
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredCount: number, currentFilteredIds: string[]) => {
    if (selectedIds.length === filteredCount) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentFilteredIds);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <Filter className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowUpRight className="h-3 w-3 text-primary rotate-180" />;
  };

  const getToolTheme = (type: string) => {
    switch(type) {
      case 'poker': return { label: 'Scrum Poker', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: WalletCards };
      case 'retro': return { label: 'Retrospectiva', color: 'text-orange-600 bg-orange-50 border-orange-100', icon: LayoutDashboard };
      case 'health': return { label: 'Health Check', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Activity };
      case 'brainstorm': return { label: 'Brainstorm', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: BrainCircuit };
      case 'sprint_planning': return { label: 'Planning', color: 'text-violet-600 bg-violet-50 border-violet-100', icon: LayoutDashboard };
      default: return { label: 'Outro', color: 'text-slate-600 bg-slate-50 border-slate-100', icon: Search };
    }
  };

  // Aplicação dos Filtros Multiplos (Busca + Tipo + Data)
  const filtered = sessions.filter(s => {
    const matchSearch = s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = selectedType === 'all' || s.type === selectedType;
    
    let matchDate = true;
    if (selectedDateRange !== 'all') {
      const now = new Date();
      const sessionDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
      const diffTime = Math.abs(now.getTime() - sessionDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (selectedDateRange === '7d') matchDate = diffDays <= 7;
      if (selectedDateRange === '30d') matchDate = diffDays <= 30;
    }

    return matchSearch && matchType && matchDate;
  });

  // Ordenação dinâmica
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    // Tratamento especial para datas (Timestamp)
    if (sortConfig.key === 'createdAt') {
      valA = a.createdAt?.seconds || 0;
      valB = b.createdAt?.seconds || 0;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedFiltered = sorted.slice(0, visibleLimit);

  if (isFetchingSessions && sessions.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" variant="primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Varrendo Ecossistema no Cache...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Controles e Filtros Avançados */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="relative w-full xl:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Buscar por título ou ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 bg-slate-50/50 border-slate-200 rounded-2xl focus-visible:ring-primary/20 transition-all font-medium"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Filtro de Tipo */}
          <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto custom-scrollbar">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'poker', label: 'Poker' },
              { id: 'retro', label: 'Retro' },
              { id: 'health', label: 'Health' },
              { id: 'brainstorm', label: 'Brainstorm' },
              { id: 'sprint_planning', label: 'Planning' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  selectedType === type.id ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Filtro de Data */}
          <select 
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="all">Todo o Período</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          <Button 
            variant="ghost" 
            onClick={handleRefresh} 
            disabled={isFetchingSessions}
            className="h-10 w-10 p-0 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <Activity className={cn("h-4 w-4", isFetchingSessions && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Exibindo {paginatedFiltered.length} de {filtered.length} (Total DB: {totalSessionsCount})
        </p>
      </div>

      {/* Tabela de Resultados */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-100">
               <TableHead className="w-[50px] pl-8">
                <Checkbox 
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onCheckedChange={() => toggleSelectAll(filtered.length, filtered.map(s => s.id))}
                  className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </TableHead>
              <TableHead className="h-14 font-black uppercase text-[9px] tracking-widest text-slate-500">
                <button onClick={() => handleSort('type')} className="flex items-center gap-2 hover:text-primary transition-colors group">
                  Ferramenta {getSortIcon('type')}
                </button>
              </TableHead>
              <TableHead className="h-14 font-black uppercase text-[9px] tracking-widest text-slate-500">
                <button onClick={() => handleSort('title')} className="flex items-center gap-2 hover:text-primary transition-colors group">
                  Título / Nome {getSortIcon('title')}
                </button>
              </TableHead>
              <TableHead className="h-14 font-black uppercase text-[9px] tracking-widest text-slate-500">
                <button onClick={() => handleSort('createdAt')} className="flex items-center gap-2 hover:text-primary transition-colors group">
                  Criação {getSortIcon('createdAt')}
                </button>
              </TableHead>
              <TableHead className="h-14 font-black uppercase text-[9px] tracking-widest text-slate-500">
                <button onClick={() => handleSort('participantCount')} className="flex items-center gap-2 hover:text-primary transition-colors group">
                  Ops {getSortIcon('participantCount')}
                </button>
              </TableHead>
              <TableHead className="h-14 font-black uppercase text-[9px] tracking-widest text-slate-500 text-right pr-8">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {paginatedFiltered.map((s) => {
                const theme = getToolTheme(s.type);
                const date = (() => {
                  if (!s.createdAt) return 'Histórico';
                  const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                  return isNaN(d.getTime()) ? 'Histórico' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                })();
                const Icon = theme.icon;

                return (
                  <TableRow key={s.id} className={cn(
                    "group hover:bg-slate-50/50 border-slate-100 transition-colors",
                    selectedIds.includes(s.id) && "bg-primary/5"
                  )}>
                    <TableCell className="py-3 pl-8">
                       <Checkbox 
                        checked={selectedIds.includes(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                        className="border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell className="py-3">
                       <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-wider", theme.color)}>
                         <Icon className="h-3 w-3" />
                         {theme.label}
                       </div>
                    </TableCell>
                    <TableCell className="py-3">
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{s.title}</span>
                         <span className="text-[10px] font-medium text-slate-400 font-code tracking-tight italic">ID: {s.id}</span>
                       </div>
                    </TableCell>
                    <TableCell className="py-3">
                       <div className="flex flex-col">
                         <span className="text-[11px] font-bold text-slate-700">{date}</span>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{s.creatorId.slice(0, 10)}...</span>
                       </div>
                    </TableCell>
                    <TableCell className="py-3">
                       <div className="flex items-center gap-2 text-slate-400">
                          <Users className="h-4 w-4" />
                          <span className="text-xs font-black">{s.participantCount}</span>
                       </div>
                    </TableCell>
                    <TableCell className="py-3 text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/${s.type === 'poker' ? 'poker' : s.type === 'retro' ? 'retro' : s.type === 'health' ? 'health-check' : s.type === 'brainstorm' ? 'brainstorming' : 'sprint-planning'}/${encodeURIComponent(s.id)}`} target="_blank">
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSession(s)} className="h-10 w-10 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {paginatedFiltered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Filter className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-[11px] font-black uppercase tracking-widest">Nenhuma sessão encontrada com estes filtros.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center pt-2">
        {filtered.length > visibleLimit && (
           <Button 
            variant="outline" 
            onClick={handleLoadMore}
            className="h-12 px-10 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] border-slate-200 text-slate-500 hover:text-primary transition-all shadow-sm"
           >
             Exibir Mais Sessões
           </Button>
        )}
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 rounded-[2rem] px-8 py-5 flex items-center gap-10 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleção Ativa</span>
              <span className="text-white font-bold">{selectedIds.length} Itens selecionados</span>
            </div>
            <div className="h-10 w-[1px] bg-slate-800" />
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setSelectedIds([])} className="h-12 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-white hover:bg-white/5 rounded-xl">Cancelar</Button>
              <Button onClick={handleBulkDelete} className="h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-600/20 px-8">Excluir Tudo</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
