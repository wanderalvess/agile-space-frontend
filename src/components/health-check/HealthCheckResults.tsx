'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HealthCheckVote,
  HealthCheckDimension,
  HealthCheckScaleType
} from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Copy, 
  ArrowLeft,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  KanbanSquare,
  ExternalLink,
  Target,
  Quote
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HealthCheckRadarChart } from './HealthCheckRadarChart';
import { ExportHealthCheckDialog } from './ExportHealthCheckDialog';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { ToastAction } from "@/components/ui/toast";
import { Logo } from '../Logo';
import { useFirebase } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import { EliteSpinner } from '../ui/EliteSpinner';
import Link from 'next/link';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { HeartPulse, LayoutDashboard, Calendar, Users as UsersIcon, ChevronRight, MessageSquareQuote } from 'lucide-react';

interface HealthCheckResultsProps {
  boardId: string;
  isCreator: boolean;
  onLeave: () => void;
  dimensions: HealthCheckDimension[];
  roomTitle?: string;
  votes: HealthCheckVote[];
  results: any[];
  onOpenFeedback: () => void;
  scaleType?: HealthCheckScaleType;
}

const chartConfig = {
  green: { label: 'Positivo', color: '#10b981' }, // emerald-500
  yellow: { label: 'Neutro', color: '#f59e0b' },  // amber-500
  red: { label: 'Crítico', color: '#ef4444' },    // rose-500
};

export function HealthCheckResults({ 
  boardId, 
  isCreator, 
  onLeave, 
  dimensions, 
  roomTitle, 
  votes,
  results,
  onOpenFeedback,
  scaleType = 'traffic_light',
}: HealthCheckResultsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const [isExporting, setIsExporting] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  // FIX: Use the robust copyToClipboard utility
  const handleCopyLink = async () => {
    const success = await copyToClipboard(window.location.href);
    if (success) {
      toast({ title: "Link Copiado!" });
    } else {
      toast({ title: "Falha ao copiar", description: "Não foi possível copiar o link para a área de transferência.", variant: "destructive" });
    }
  };

  const handleExportActionsToWorkspace = async () => {
    if (!results || !firestore || !user) return;
    setIsExporting(true);

    const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));
    
    // Identify attention results based on scaleType
    const attentionResults = results.filter(r => {
      const vals = r.values as Record<string, number>;
      if (scaleType === 'traffic_light') return (vals['red'] || 0) > 0 || (vals['yellow'] || 0) > (vals['green'] || 0);
      if (scaleType === 'emojis') return (vals['sad'] || 0) > 0 || (vals['neutral'] || 0) > (vals['happy'] || 0);
      if (scaleType === 'numbers_5') return (vals['1'] || 0) > 0 || (vals['2'] || 0) > 0 || (r.average || 0) < 3;
      return false;
    });

    if (attentionResults.length === 0) {
      toast({ title: "Tudo saudável!", description: "Não foram encontrados pontos de atenção para exportar." });
      setIsExporting(false);
      return;
    }

    try {
      for (const res of attentionResults) {
        const dimTitle = dimensionsMap.get(res.dimensionKey) || res.dimensionKey;
        const vals = res.values as Record<string, number>;
        
        let isCritical = false;
        if (scaleType === 'traffic_light') isCritical = (vals['red'] || 0) > 0;
        else if (scaleType === 'emojis') isCritical = (vals['sad'] || 0) > 0;
        else if (scaleType === 'numbers_5') isCritical = (vals['1'] || 0) > 0 || (vals['2'] || 0) > 0;

        const severity = isCritical ? 'critica' : 'media';
        const statusLabel = isCritical ? 'Crítico' : 'Alerta';
        
        const cardData = {
          title: `Melhorar: ${dimTitle}`,
          description: `Ação gerada pelo ${statusLabel} no Radar de Saúde.`,
          status: 'todo',
          priority: severity,
          tag: 'Saúde da Squad',
          originLink: `/health-check/${boardId}`,
          updatedAt: new Date().toISOString(),
          exportedAt: new Date().toISOString(),
        };

        addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'kanban'), cardData);
      }

      toast({ 
        title: "Plano de Ação Gerado!", 
        description: `${attentionResults.length} tarefas foram criadas no seu Kanban pessoal.`,
        action: (
          <ToastAction altText="Ir para Kanban" onClick={() => router.push('/workspace')}>
            Acessar Kanban
          </ToastAction>
        ),
      });
      setHasExported(true);
    } catch (e) {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const chartData = useMemo(() => {
    const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));
    return results.map(res => {
      const dimTitle = dimensionsMap.get(res.dimensionKey) || res.dimensionKey;
      const totalVotes = Object.values(res.values as Record<string, number>).reduce((a, b) => a + b, 0) || 1;
      
      // Standardize for the bar chart
      const data: any = { 
        title: dimTitle,
        values: res.values
      };

      if (scaleType === 'traffic_light') {
        data.green = Math.round(((res.values['green'] || 0) / totalVotes) * 100);
        data.yellow = Math.round(((res.values['yellow'] || 0) / totalVotes) * 100);
        data.red = Math.round(((res.values['red'] || 0) / totalVotes) * 100);
      } else if (scaleType === 'emojis') {
        data.green = Math.round(((res.values['happy'] || 0) / totalVotes) * 100);
        data.yellow = Math.round(((res.values['neutral'] || 0) / totalVotes) * 100);
        data.red = Math.round(((res.values['sad'] || 0) / totalVotes) * 100);
      } else {
        // numbers_5: group top (4,5), mid (3), low (1,2)
        data.green = Math.round((((res.values['4'] || 0) + (res.values['5'] || 0)) / totalVotes) * 100);
        data.yellow = Math.round(((res.values['3'] || 0) / totalVotes) * 100);
        data.red = Math.round((((res.values['1'] || 0) + (res.values['2'] || 0)) / totalVotes) * 100);
      }

      return data;
    }).reverse();
  }, [results, dimensions, scaleType]);

  const strengths = useMemo(() => {
    const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));
    const benchmark = scaleType === 'numbers_5' ? 4 : 2.5;
    return results
      .filter(r => (r.average || 0) >= benchmark)
      .map(r => dimensionsMap.get(r.dimensionKey) || r.dimensionKey);
  }, [results, dimensions, scaleType]);

  const weaknesses = useMemo(() => {
    const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));
    const benchmark = scaleType === 'numbers_5' ? 2.5 : 1.8;
    return results
      .filter(r => (r.average || 0) > 0 && (r.average || 0) < benchmark)
      .map(r => dimensionsMap.get(r.dimensionKey) || r.dimensionKey);
  }, [results, dimensions, scaleType]);

  const globalHealthScore = useMemo(() => {
    if (results.length === 0) return 0;
    const avgSum = results.reduce((acc, r) => acc + (r.average || 0), 0);
    const avg = avgSum / results.length;
    // Map to 10-point scale
    const max = scaleType === 'numbers_5' ? 5 : 3;
    return ((avg / max) * 10).toFixed(1);
  }, [results, scaleType]);

  return (
    <div className="flex flex-col flex-1 bg-[#fafafa] relative overflow-hidden font-sans h-screen">
      {/* Mesh Gradient Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-200/30 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100/30 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <RoomHeader 
        title={roomTitle || "Radar de Saúde"} 
        toolIcon={<HeartPulse className="h-4 w-4" />}
        toolColorClass="text-emerald-600 bg-emerald-50"
        onOpenFeedback={onOpenFeedback}
        actions={
          <div className="flex items-center gap-2">
            <ExportHealthCheckDialog 
              roomTitle={roomTitle} 
              dimensions={dimensions} 
              votes={votes} 
              results={results} 
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Copiar Link"
            >
              <Copy className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

            <Badge className="bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 border-none font-black uppercase text-[8px] h-8 px-4 rounded-xl flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Concluído
            </Badge>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto w-full space-y-6 px-4 md:px-6 pt-6 pb-12 overflow-y-auto min-h-0 flex-1">
        
        {/* HERO SUMMARY SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Card className="md:col-span-8 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] border-none shadow-2xl shadow-emerald-600/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            
            <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 space-y-4">
                <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-[0.2em] w-fit">Resultado Consolidado</div>
                <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter leading-tight">
                  Tudo pronto por aqui!<br />
                  <span className={cn(
                    "transition-colors duration-1000",
                    Number(globalHealthScore) >= 8 ? "text-emerald-200" : Number(globalHealthScore) >= 5 ? "text-amber-200" : "text-rose-200"
                  )}>Resultado Consolidado</span>
                </h2>
                <p className="text-sm font-medium opacity-80 max-w-md leading-relaxed">
                  O Radar coletou {votes.length} insights anônimos. A transparência técnica é a base para o crescimento da maturidade ágil.
                </p>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60 tracking-widest mb-1">Engajamento</span>
                    <span className="text-xl font-black">{Math.min(100, (votes.length / (dimensions.length * 5)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-60 tracking-widest mb-1">Categorias</span>
                    <span className="text-xl font-black">{dimensions.length}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 relative">
                <div className={cn(
                  "w-32 h-32 md:w-40 md:h-40 bg-white/10 backdrop-blur-md rounded-[2.5rem] border-2 flex flex-col items-center justify-center shadow-2xl transition-all duration-1000",
                  Number(globalHealthScore) >= 8 
                    ? "border-emerald-400/50 shadow-emerald-500/20" 
                    : Number(globalHealthScore) >= 5 
                      ? "border-amber-400/50 shadow-amber-500/20" 
                      : "border-rose-400/50 shadow-rose-500/20"
                )}>
                  <div className={cn(
                    "absolute -z-10 w-full h-full blur-2xl opacity-20",
                    Number(globalHealthScore) >= 8 ? "bg-emerald-400" : Number(globalHealthScore) >= 5 ? "bg-amber-400" : "bg-rose-400"
                  )} />
                  <HeartPulse className="h-10 w-10 md:h-12 md:w-12 text-white mb-2" />
                  <span className="text-3xl md:text-4xl font-black tracking-tighter italic">{globalHealthScore}</span>
                  <span className="text-[8px] font-black uppercase opacity-70">Health Score</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-4 bg-white rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between overflow-hidden relative group">
             <div className="p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <UsersIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-tight text-slate-800">Cultura de Feedback</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Métricas de Participantes</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Votos Totais</span>
                    <span className="font-black text-slate-900">{votes.length}</span>
                  </div>
                  <Separator className="bg-slate-50" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Data Inicial</span>
                    <span className="font-black text-slate-900">Sprint Atual</span>
                  </div>
                  <Separator className="bg-slate-50" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Status da Sala</span>
                    <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 shadow-none text-[8px] font-black uppercase">Finalizada</Badge>
                  </div>
                </div>
             </div>
             
             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/50 transition-colors">
                <span className="text-[9px] font-black uppercase text-slate-400">Snapshot Oficial</span>
                <Calendar className="h-3.5 w-3.5 text-slate-300" />
             </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-white border-slate-100 shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden flex flex-col shrink-0">
              <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                      <LayoutDashboard className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-tight italic text-slate-800">Mapa de Sentimento da Squad</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[8px] font-black uppercase bg-white border-slate-200 shadow-sm">{votes.length} Votos Totais</Badge>
                  </div>
              </div>
              <CardContent className="p-0">
                <Tabs defaultValue="results" className="w-full">
                    <TabsList className="w-full bg-slate-100/50 border-b rounded-none h-12 p-1">
                        <TabsTrigger value="results" className="flex-1 text-[10px] font-black uppercase h-10 rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                          Frequência de Faróis
                        </TabsTrigger>
                        <TabsTrigger value="radar" className="flex-1 text-[10px] font-black uppercase h-10 rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                          Gráfico Radar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="results" className="m-0 p-6">
                        <ChartContainer config={chartConfig} className="w-full h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical" stackOffset="expand" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                                  <XAxis type="number" hide domain={[0, 1]} />
                                  <YAxis type="category" dataKey="title" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 10, fontWeight: 'bold', fill: "hsl(var(--foreground))" }} />
                                  <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-background border-2 border-border/50 p-2 rounded-lg shadow-xl space-y-1">
                                          <p className="font-black text-[9px] uppercase tracking-widest border-b pb-1 mb-1">{data.title}</p>
                                          <div className="text-[9px] font-bold space-y-0.5">
                                            {Object.entries(data.values as Record<string, number>).map(([key, val]) => (
                                              <div key={key} className="flex justify-between gap-4">
                                                <span className="uppercase opacity-60">{key}:</span>
                                                <span>{val}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }} />
                                  <Bar dataKey="green" name="Tudo Bem" stackId="a" fill="var(--color-green)" />
                                  <Bar dataKey="yellow" name="Atenção" stackId="a" fill="var(--color-yellow)" />
                                  <Bar dataKey="red" name="Ruim" stackId="a" fill="var(--color-red)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </TabsContent>
                    <TabsContent value="radar" className="m-0 p-6">
                      <HealthCheckRadarChart 
                        round={{ votes } as any} 
                        dimensions={dimensions} 
                        scaleType={scaleType}
                      />
                    </TabsContent>
                </Tabs>
              </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-emerald-500/10 bg-emerald-500/[0.03] rounded-[2rem] overflow-hidden shadow-sm transition-all hover:bg-emerald-500/[0.06] border-l-4 border-l-emerald-500">
              <CardHeader className="py-4 px-6 border-b border-emerald-500/10 bg-emerald-50/80">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pontos Fortes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2.5">
                  {strengths.length > 0 ? strengths.map((s, i) => (
                    <Badge key={i} variant="outline" className="bg-white text-emerald-700 border-emerald-500/20 text-[10px] py-1.5 px-3 rounded-lg shadow-sm font-bold">{s}</Badge>
                  )) : <span className="text-[10px] italic text-slate-400 font-medium">Nenhum ponto forte destacado.</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-500/10 bg-rose-500/[0.03] rounded-[2rem] overflow-hidden shadow-sm transition-all hover:bg-rose-500/[0.06] border-l-4 border-l-rose-500">
              <CardHeader className="py-4 px-6 border-b border-rose-500/10 bg-rose-50/80">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Faróis de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2.5">
                  {weaknesses.length > 0 ? weaknesses.map((w, i) => (
                    <Badge key={i} variant="outline" className="bg-white text-rose-700 border-rose-500/20 text-[10px] py-1.5 px-3 rounded-lg shadow-sm font-bold">{w}</Badge>
                  )) : <span className="text-[10px] italic text-slate-400 font-medium">O time está saudável em todas as áreas!</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] overflow-hidden shadow-xl shadow-indigo-500/5 bg-indigo-600 text-white border-none relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
              <CardHeader className="py-5 px-6 border-b border-white/10">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100 flex items-center gap-2">
                  <Target className="h-3.5 w-3.5" /> Sugestão de Foco
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-[11px] text-indigo-50 leading-relaxed font-medium">
                  Para a próxima Sprint, sugerimos priorizar ações de melhoria nos itens listados em <strong>Faróis de Atenção</strong> para equilibrar a squad.
                </p>
                <div className="p-3 bg-white/10 rounded-xl flex items-center gap-3">
                  <MessageSquareQuote className="h-4 w-4 text-emerald-300 shrink-0" />
                  <p className="text-[9px] font-bold italic opacity-80">"A melhoria contínua é feita de pequenos ajustes diários."</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PLANO DE AÇÃO E EXPORTAÇÃO */}
        <Card className="bg-white border-slate-100 rounded-[2.5rem] overflow-hidden mt-8 shadow-2xl shadow-slate-200/40 group">
          <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-emerald-600 rounded-[1.5rem] text-white shadow-xl shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                <KanbanSquare className="h-8 w-8" />
              </div>
              <div className="text-center sm:text-left space-y-1">
                <h3 className="font-black uppercase text-sm tracking-[0.1em] text-slate-800">Plano de Ação Imediato</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Vincule os problemas identificados ao seu Kanban pessoal.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
              {!hasExported ? (
                <Button 
                  onClick={handleExportActionsToWorkspace} 
                  disabled={isExporting}
                  className="h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-initial rounded-2xl transition-all active:scale-95"
                >
                  {isExporting ? <EliteSpinner size="sm" variant="white" className="mr-2" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                  Gerar Plano de Ação
                </Button>
              ) : (
                <Button 
                  onClick={() => router.push('/workspace')}
                  className="h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-initial rounded-2xl transition-all active:scale-95 animate-in zoom-in-95 duration-300"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver no Workspace
                </Button>
              )}
              <Button variant="outline" onClick={onLeave} className="h-12 px-8 font-black uppercase tracking-widest text-[10px] border-2 rounded-2xl flex-1 sm:flex-initial bg-white hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2">
                Sair do Radar
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DETALHAMENTO POR DIMENSÃO */}
        <div className="space-y-6 pt-12 pb-20">
          <div className="flex items-center gap-4 px-2">
             <div className="h-px bg-slate-200 flex-1" />
             <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 shrink-0">Detalhamento Analítico</h2>
             <div className="h-px bg-slate-200 flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.map((res, i) => {
              const dim = dimensions.find(d => d.key === res.dimensionKey);
              const dimVotes = votes.filter(v => v.dimensionKey === res.dimensionKey);
              const comments = dimVotes.filter(v => v.comment && v.comment.trim() !== '');
              const vals = res.values as Record<string, number>;

              return (
                <Card key={res.dimensionKey} className="rounded-[2.5rem] border-slate-100 shadow-xl shadow-slate-200/40 bg-white overflow-hidden flex flex-col group hover:scale-[1.01] transition-all duration-300">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 opacity-60">Categoria {i + 1}</span>
                        <h3 className="text-base font-black uppercase tracking-tight text-slate-800">{dim?.title || res.dimensionKey}</h3>
                      </div>
                      <div className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black italic shadow-inner transition-colors",
                        (res.average || 0) >= 2.5 ? "bg-emerald-100 text-emerald-700" : (res.average || 0) >= 1.8 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                      )}>
                        Avg: {(res.average || 0).toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-6 flex-1">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição de Votos</p>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(vals).map(([key, val]) => (
                          <div key={key} className={cn(
                            "p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all",
                            key === 'green' || key === 'happy' || key === '5' || key === '4' ? "bg-emerald-50 border-emerald-100" :
                            key === 'red' || key === 'sad' || key === '1' || key === '2' ? "bg-rose-50 border-rose-100" : "bg-amber-50 border-amber-100"
                          )}>
                             <span className="text-lg font-black italic leading-none">{val}</span>
                             <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">{key}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="opacity-40" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentários Anônimos</p>
                         <Badge variant="outline" className="text-[8px] font-black py-0 px-2 h-5 bg-slate-50">{comments.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {comments.length > 0 ? comments.map((c, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 relative group/msg">
                             <Quote className="absolute -top-1.5 -left-1.5 h-4 w-4 text-emerald-500 opacity-20 group-hover/msg:opacity-100 transition-opacity" />
                             <p className="text-[11px] text-slate-600 font-medium italic italic leading-relaxed">"{c.comment}"</p>
                          </div>
                        )) : (
                          <p className="text-[10px] italic text-slate-400 text-center py-4">Nenhum comentário para esta dimensão.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="pb-12 text-center opacity-30 mt-8">
          <p className="text-[9px] font-black uppercase tracking-[0.3em]">Espaço Ágil Health Snapshot v2.5</p>
        </div>
      </div>
    </div>
  );
}
