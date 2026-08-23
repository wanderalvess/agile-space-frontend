'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { feedbackApi, FeedbackData } from '@/app/feedback/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Search,
  Trash2,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

interface Feedback extends FeedbackData {
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  OPEN: { label: 'Novo', color: 'bg-blue-500', icon: Clock },
  REVIEWED: { label: 'Em Análise', color: 'bg-amber-500', icon: AlertCircle },
  ADDRESSED: { label: 'Resolvido', color: 'bg-emerald-500', icon: CheckCircle2 },
  ARCHIVED: { label: 'Arquivado', color: 'bg-slate-400', icon: Trash2 },
};

const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;

export function FeedbackManager() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await feedbackApi.listFeedbacks();
        if (!cancelled) {
          setFeedbacks(data.map(f => ({ ...f, status: f.status || 'OPEN' })));
        }
      } catch (e) {
        console.error('FeedbackManager: error loading feedbacks:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const tools = useMemo(() => {
    const set = new Set(feedbacks.map(f => f.toolName));
    return Array.from(set).sort();
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(f => {
      const matchSearch = (f.comment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (f.userId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchTool = toolFilter === 'all' || f.toolName === toolFilter;

      let matchScore = true;
      if (scoreFilter === 'promoters') matchScore = f.score >= 9;
      else if (scoreFilter === 'neutrals') matchScore = f.score >= 7 && f.score <= 8;
      else if (scoreFilter === 'detractors') matchScore = f.score >= 0 && f.score <= 6;
      else if (scoreFilter === 'suggestions') matchScore = f.score === -1;

      return matchSearch && matchStatus && matchTool && matchScore;
    });
  }, [feedbacks, searchTerm, statusFilter, toolFilter, scoreFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await feedbackApi.updateStatus(id, status);
      setFeedbacks(prev => prev.map(f => (f.id === id ? { ...f, status } : f)));
      toast({ title: "Status atualizado", description: `Feedback marcado como ${getStatusConfig(status).label}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este feedback?")) return;
    try {
      await feedbackApi.deleteFeedback(id);
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      toast({ title: "Feedback excluído" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const exportToCSV = () => {
    if (filteredFeedbacks.length === 0) return;
    const headers = ["Data", "Ferramenta", "Nota", "Status", "Usuário", "Comentário"];
    const rows = filteredFeedbacks.map(f => {
      const date = f.createdAt ? new Date(f.createdAt).toLocaleString('pt-BR') : 'N/A';
      return [
        date,
        f.toolName,
        f.score === -1 ? "Sugestão" : f.score,
        f.status,
        f.userId || 'N/A',
        `"${(f.comment || '').replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `feedbacks_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando Feedbacks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros Premium */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar em comentários ou usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 bg-white border-slate-200 rounded-xl shadow-sm"
          />
        </div>

        <Select value={toolFilter} onValueChange={setToolFilter}>
          <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest">
            <SelectValue placeholder="Ferramenta" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Todas Ferramentas</SelectItem>
            {tools.map(t => (
              <SelectItem key={t} value={t} className="text-[10px] font-bold uppercase tracking-widest">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Todos Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-[10px] font-bold uppercase tracking-widest">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={exportToCSV} variant="outline" className="h-12 border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* Tabs Rápidas de NPS */}
      <div className="flex flex-wrap gap-2">
         {[
           { id: 'all', label: 'Todos', count: feedbacks.length },
           { id: 'promoters', label: 'Promotores', count: feedbacks.filter(f => f.score >= 9).length, color: 'text-emerald-600 bg-emerald-50' },
           { id: 'neutrals', label: 'Neutros', count: feedbacks.filter(f => f.score >= 7 && f.score <= 8).length, color: 'text-amber-600 bg-amber-50' },
           { id: 'detractors', label: 'Detratores', count: feedbacks.filter(f => f.score >= 0 && f.score <= 6).length, color: 'text-rose-600 bg-rose-50' },
           { id: 'suggestions', label: 'Sugestões', count: feedbacks.filter(f => f.score === -1).length, color: 'text-blue-600 bg-blue-50' }
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setScoreFilter(tab.id)}
             className={cn(
               "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
               scoreFilter === tab.id
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105"
                : cn("bg-white border-slate-200 text-slate-400 hover:border-primary/40", tab.color)
             )}
           >
             {tab.label} ({tab.count})
           </button>
         ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="w-[120px] pl-8 h-14 font-black uppercase text-[10px] tracking-widest text-slate-500">Data</TableHead>
              <TableHead className="w-[150px] h-14 font-black uppercase text-[10px] tracking-widest text-slate-500">Ferramenta</TableHead>
              <TableHead className="w-[80px] h-14 font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Score</TableHead>
              <TableHead className="h-14 font-black uppercase text-[10px] tracking-widest text-slate-500">Comentário</TableHead>
              <TableHead className="w-[140px] h-14 font-black uppercase text-[10px] tracking-widest text-slate-500">Status</TableHead>
              <TableHead className="w-[80px] h-14 font-black uppercase text-[10px] tracking-widest text-slate-500 text-right pr-8">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {filteredFeedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum feedback encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : filteredFeedbacks.map((f) => (
                <TableRow key={f.id} className="group hover:bg-slate-50/50 border-slate-100 transition-colors">
                  <TableCell className="py-4 pl-8">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-900 italic">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'Agora'}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight">
                        {f.createdAt ? new Date(f.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter truncate max-w-[140px] block">{f.toolName}</span>
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    {f.score === -1 ? (
                      <Badge className="bg-blue-100 text-blue-600 border-none text-[8px] font-black">SUGESTÃO</Badge>
                    ) : (
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black text-white shadow-sm",
                        f.score >= 9 ? 'bg-emerald-500 shadow-emerald-500/20' : f.score >= 7 ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'
                      )}>
                        {f.score}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-1 max-w-md">
                      <p className="text-[12px] font-medium text-slate-700 leading-snug line-clamp-2 italic group-hover:line-clamp-none transition-all">
                        {f.comment ? `"${f.comment}"` : <span className="text-slate-300">Sem comentário</span>}
                      </p>
                      <span className="text-[8px] font-bold text-slate-400 truncate">{f.userId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn(
                          "h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest gap-2 border border-transparent hover:border-slate-200 transition-all",
                          getStatusConfig(f.status).color.replace('bg-', 'text-')
                        )}>
                          {React.createElement(getStatusConfig(f.status).icon, { className: "h-3.5 w-3.5" })}
                          {getStatusConfig(f.status).label}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-xl border-slate-200 shadow-2xl p-1">
                        <DropdownMenuLabel className="text-[8px] font-black uppercase tracking-widest text-slate-400 p-2">Alterar Status</DropdownMenuLabel>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => handleUpdateStatus(f.id!, key)}
                            className="rounded-lg text-[10px] font-bold uppercase tracking-widest gap-3 p-2 cursor-pointer"
                          >
                             <div className={cn("w-2 h-2 rounded-full", config.color)} />
                             {config.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="py-4 text-right pr-8">
                    <div className="flex items-center justify-end gap-1">
                       <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(f.id!)}
                        className="h-9 w-9 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center px-4">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           Exibindo {filteredFeedbacks.length} de {feedbacks.length} feedbacks
         </p>
         <div className="flex gap-2">
            <Button variant="ghost" className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400" disabled>Anterior</Button>
            <Button variant="ghost" className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400" disabled>Próximo</Button>
         </div>
      </div>
    </div>
  );
}
