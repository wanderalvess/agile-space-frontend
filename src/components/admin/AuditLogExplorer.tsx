'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  Download,
  Terminal,
  Activity,
  History,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { adminApi, AuditLogData } from '@/app/admin/api';

export function AuditLogExplorer() {
  const [events, setEvents] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await adminApi.getAuditLogs();
      setEvents(logs || []);
    } catch (e) {
      console.error("Error fetching audit logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = (e.action || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.performedBy || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.details || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [events, searchTerm]);

  const exportToCSV = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["Data", "Ação", "Operador", "Detalhes"];
    const rows = filteredEvents.map(e => {
      const date = e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : 'N/A';
      return [
        date, 
        e.action, 
        e.performedBy || 'System',
        `"${(e.details || '').replace(/"/g, '""')}"`
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Registros de Auditoria (PostgreSQL)...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Buscar nos logs (Ação, Operador, Detalhes)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl shadow-sm focus-visible:ring-primary/20 transition-all font-medium"
          />
        </div>

        <Button onClick={fetchLogs} variant="outline" className="h-14 w-14 p-0 border-slate-200 rounded-2xl bg-white hover:bg-slate-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>

        <Button onClick={exportToCSV} variant="outline" className="h-14 border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white hover:bg-slate-50">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* Tabela de Auditoria */}
      <div className="bg-white/60 dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-xl shadow-slate-200/10 dark:shadow-slate-900/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-950/20">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800/50">
              <TableHead className="w-[180px] pl-8 h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Data / Hora</TableHead>
              <TableHead className="w-[180px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Ação</TableHead>
              <TableHead className="w-[200px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Operador</TableHead>
              <TableHead className="h-16 font-black uppercase text-[10px] tracking-widest text-slate-500 pr-8">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-50 dark:divide-slate-800/30">
            <AnimatePresence mode="popLayout">
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum registro de auditoria encontrado.
                  </TableCell>
                </TableRow>
              ) : filteredEvents.map((e) => (
                <TableRow key={e.id || Math.random()} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-slate-100 dark:border-slate-800/50 transition-colors">
                  <TableCell className="py-4 pl-8">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : 'Recent'}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase tracking-widest px-2.5 py-1">
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 lowercase italic">{e.performedBy}</span>
                  </TableCell>
                  <TableCell className="py-4 pr-8">
                    <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 leading-snug line-clamp-2 italic group-hover:line-clamp-none transition-all">
                      {e.details || '—'}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center px-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Exibindo {filteredEvents.length} registros (PostgreSQL)
        </p>
      </div>
    </div>
  );
}
