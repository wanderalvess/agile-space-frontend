'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  where
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
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
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  Filter, 
  Download,
  Terminal,
  Activity,
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';

interface AuditEvent {
  id: string;
  content: string;
  type: 'system' | 'admin' | 'security' | 'action';
  severity: 'info' | 'warning' | 'critical';
  userEmail?: string;
  module?: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

const TYPE_CONFIG = {
  system: { label: 'Sistema', color: 'text-blue-500', icon: Activity },
  admin: { label: 'Admin', color: 'text-indigo-500', icon: Terminal },
  security: { label: 'Segurança', color: 'text-rose-500', icon: ShieldCheck },
  action: { label: 'Ação', color: 'text-amber-500', icon: History },
};

const SEVERITY_CONFIG = {
  info: { label: 'Informativo', color: 'bg-blue-100 text-blue-600', icon: Info },
  warning: { label: 'Aviso', color: 'bg-amber-100 text-amber-600', icon: AlertTriangle },
  critical: { label: 'Crítico', color: 'bg-rose-100 text-rose-600', icon: AlertTriangle },
};

export function AuditLogExplorer() {
  const { firestore } = useFirebase();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    const q = query(collection(firestore, 'system_events'), orderBy('timestamp', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditEvent));
      setEvents(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = (e.content || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.module || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'all' || e.type === typeFilter;
      const matchSeverity = severityFilter === 'all' || e.severity === severityFilter;
      return matchSearch && matchType && matchSeverity;
    });
  }, [events, searchTerm, typeFilter, severityFilter]);

  const exportToCSV = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["Data", "Tipo", "Gravidade", "Módulo", "Conteúdo", "Usuário"];
    const rows = filteredEvents.map(e => {
      const date = e.timestamp instanceof Timestamp ? e.timestamp.toDate().toLocaleString('pt-BR') : 'N/A';
      return [
        date, 
        e.type, 
        e.severity, 
        e.module || 'Global', 
        `"${(e.content || '').replace(/"/g, '""')}"`,
        e.userEmail || 'System'
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
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Registros de Auditoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros Premium */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Buscar nos logs..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl shadow-sm focus-visible:ring-primary/20 transition-all font-medium"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-14 bg-white border-slate-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest">
            <SelectValue placeholder="Tipo de Evento" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Todos Tipos</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-[10px] font-bold uppercase tracking-widest">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-14 bg-white border-slate-200 rounded-2xl font-bold text-[10px] uppercase tracking-widest">
            <SelectValue placeholder="Gravidade" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Todas Gravidades</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-[10px] font-bold uppercase tracking-widest">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={exportToCSV} variant="outline" className="h-14 border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white hover:bg-slate-50">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* Tabela de Auditoria */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="w-[150px] pl-8 h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Timestamp</TableHead>
              <TableHead className="w-[120px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Tipo</TableHead>
              <TableHead className="w-[120px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Gravidade</TableHead>
              <TableHead className="w-[140px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Módulo</TableHead>
              <TableHead className="h-16 font-black uppercase text-[10px] tracking-widest text-slate-500">Ocorrência</TableHead>
              <TableHead className="w-[180px] h-16 font-black uppercase text-[10px] tracking-widest text-slate-500 pr-8">Operador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : filteredEvents.map((e) => {
                const TypeIcon = TYPE_CONFIG[e.type]?.icon || History;
                const severity = SEVERITY_CONFIG[e.severity] || SEVERITY_CONFIG.info;
                return (
                  <TableRow key={e.id} className="group hover:bg-slate-50/50 border-slate-100 transition-colors">
                    <TableCell className="py-4 pl-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-900 italic">
                          {e.timestamp instanceof Timestamp ? e.timestamp.toDate().toLocaleDateString('pt-BR') : 'Agora'}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                          {e.timestamp instanceof Timestamp ? e.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter", TYPE_CONFIG[e.type]?.color)}>
                        <TypeIcon className="h-3.5 w-3.5" />
                        {TYPE_CONFIG[e.type]?.label}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border-none", severity.color)}>
                        {severity.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">{e.module || 'Global'}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-[12px] font-medium text-slate-700 leading-snug line-clamp-2 italic group-hover:line-clamp-none transition-all">
                        {e.content}
                      </p>
                    </TableCell>
                    <TableCell className="py-4 pr-8">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-900 lowercase italic">{e.userEmail || 'system_process'}</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ID: {e.id.substring(0, 8)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center px-4">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           Exibindo {filteredEvents.length} registros recentes
         </p>
      </div>
    </div>
  );
}
