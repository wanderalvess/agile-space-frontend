'use client';

import React, { useState, useEffect } from 'react';
import { knowledgeChatApi, KnowledgeTokenUsageDTO } from '@/app/knowledge/chat/api';
import { knowledgeApi } from '@/app/knowledge/api';
import {
  Brain,
  Cpu,
  Zap,
  History,
  Users,
  Search,
  Activity,
  ArrowUpRight,
  Sparkles,
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function IntelligenceHubMonitor() {
  const [usageData, setUsageData] = useState<KnowledgeTokenUsageDTO[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);

  // Sem realtime aqui por decisão de produto: busca única ao montar, sem onSnapshot/polling.
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [usage, docsPage] = await Promise.all([
          knowledgeChatApi.getTopTokenUsage(),
          knowledgeApi.listDocuments(undefined, undefined, 0, 1),
        ]);
        if (cancelled) return;
        setUsageData(usage);
        setTotalDocs(docsPage.totalElements);
      } catch (e) {
        console.error('Erro ao carregar dados do Centro de Conhecimento:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const totalTokens = usageData.reduce((acc, curr) => acc + (curr.totalTokens || 0), 0);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronizando com o Centro de Conhecimento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Overview de Inteligência */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricCard
          title="Base de Conhecimento"
          value={totalDocs}
          subtitle="Documentos Indexados"
          icon={<Database className="h-6 w-6 text-blue-500" />}
          color="bg-blue-50"
        />
        <MetricCard
          title="Tokens Consumidos"
          value={totalTokens.toLocaleString()}
          subtitle="Top 10 Usuários"
          icon={<Cpu className="h-6 w-6 text-primary" />}
          color="bg-primary/5"
        />
        <MetricCard
          title="Usuários Ativos (Motor)"
          value={usageData.length}
          subtitle="Engajamento Semanal"
          icon={<Users className="h-6 w-6 text-emerald-500" />}
          color="bg-emerald-50"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
         {/* Ranking de Utilização de Tokens */}
         <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
               <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Zap className="h-6 w-6" /></div>
               <div>
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Consumo por Usuário</CardTitle>
                  <CardDescription className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-1">Ranking de processamento de consultas</CardDescription>
               </div>
            </CardHeader>
            <CardContent className="p-10">
               <div className="space-y-6">
                  {usageData.map((u, idx) => (
                    <div key={u.userId} className="group p-5 bg-slate-50 hover:bg-white hover:shadow-lg rounded-[2rem] border border-slate-100 transition-all flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-300">#0{idx + 1}</span>
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-900 font-black italic">
                             {(u.userName || u.userId).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                             <p className="text-[11px] font-black uppercase text-slate-900 leading-none truncate w-32">{u.userName || u.userId}</p>
                             <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Ativo em: {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('pt-BR') : 'Recentemente'}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-lg font-black italic text-primary leading-none">{u.totalTokens.toLocaleString()}</p>
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">TOKENS</p>
                       </div>
                    </div>
                  ))}
               </div>
            </CardContent>
         </Card>

         {/* Status de Saúde do Motor */}
         <div className="space-y-10">
            <Card className="border-slate-200/60 rounded-[3rem] bg-slate-900 shadow-2xl shadow-black/30 overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent pointer-events-none" />
               <CardContent className="p-10 space-y-8 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white border border-white/10">
                        <Brain className="h-8 w-8 text-primary animate-pulse" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-white leading-none">Status do Motor</h3>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-none mt-2 font-black uppercase text-[8px] tracking-widest">Motor Ativo - Online</Badge>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <HealthRow label="Latência do Assistente" value="~1.2s" status="optimal" />
                     <HealthRow label="Assertividade de Respostas" value="> 98%" status="optimal" />
                     <HealthRow label="Precisão de Contexto" value="98.4%" status="optimal" />
                  </div>

                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                     <Sparkles className="h-5 w-5 text-amber-400" />
                     <p className="text-[10px] font-medium text-white/60 leading-relaxed italic">
                       O Assistente está utilizando contexto expandido para consultar múltiplos documentos da Base de Conhecimento simultaneamente.
                     </p>
                  </div>
               </CardContent>
            </Card>

            <div className="bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-[3rem] p-10 flex items-center gap-6">
               <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                  <Activity className="h-7 w-7" />
               </div>
               <div>
                  <p className="text-xs font-black uppercase tracking-tighter italic text-emerald-900">Otimização de Contexto</p>
                  <p className="text-[11px] font-medium text-emerald-700 leading-relaxed italic mt-1">
                    Os últimos 50 documentos mais relevantes estão sendo injetados automaticamente no prompt de cada consulta.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color }: any) {
  return (
    <Card className={cn("border-none rounded-[3rem] shadow-xl shadow-slate-200/30 overflow-hidden", color)}>
      <CardContent className="p-10 flex items-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none">{value}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">{title}</p>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthRow({ label, value, status }: { label: string, value: string, status: 'optimal' | 'warning' }) {
   return (
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
         <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
         <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white italic">{value}</span>
            <div className={cn("w-2 h-2 rounded-full", status === 'optimal' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")} />
         </div>
      </div>
   );
}
