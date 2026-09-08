import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { workItemsApi } from '@/app/work-items-api';
import { useUserContext } from '@/context/UserContext';
import { Activity, TrendingUp, CheckCircle2, AlertTriangle, Sparkles, Loader2, Bug, Clock, PieChart, ExternalLink, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface SprintStatsDialogProps {
  open: boolean;
  onClose: () => void;
  squadId?: string;
  sprintId?: string;
}

export function SprintStatsDialog({ open, onClose, squadId, sprintId }: SprintStatsDialogProps) {
  const { userProfile } = useUserContext();
  const [stats, setStats] = useState<any>(null);
  const [jiraDashData, setJiraDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeSquad = squadId || userProfile?.squadId || '';
  const activeSprint = sprintId || 'active';

  useEffect(() => {
    if (open) {
      setLoading(true);

      // Sincroniza dados exportados pelo JiraDash para esta squad
      if (typeof window !== 'undefined' && activeSquad) {
        try {
          const slug = activeSquad.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const raw = localStorage.getItem(`retro-data:${slug}`) || localStorage.getItem(`retro-data:${activeSquad}`);
          if (raw) {
            setJiraDashData(JSON.parse(raw));
          } else {
            setJiraDashData(null);
          }
        } catch (e) {
          console.error("Erro ao carregar dados do JiraDash:", e);
          setJiraDashData(null);
        }
      }

      workItemsApi.getSprintStats(activeSquad, activeSprint)
        .then(setStats)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, activeSquad, activeSprint]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/50 font-black text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Métricas Automatizadas
            </Badge>
            {jiraDashData && (
              <Badge variant="outline" className="bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50 font-black text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                JiraDash Sincronizado
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
            Resumo Analítico da Sprint
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-400">
            Dados consolidados de <span className="font-bold text-slate-600 dark:text-slate-300">{activeSquad}</span> via <span className="font-mono text-indigo-500">work_items</span> e JiraDash.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sincronizando métricas da sprint...</p>
          </div>
        ) : (
          <Tabs defaultValue="cerimonias" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-slate-100 dark:bg-slate-800/60">
              <TabsTrigger value="cerimonias" className="rounded-xl text-xs font-bold">
                Cerimônias & Poker
              </TabsTrigger>
              <TabsTrigger value="jiradash" className="rounded-xl text-xs font-bold flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> JiraDash Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cerimonias" className="space-y-4 pt-3">
              {stats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Velocity Real</span>
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.velocityReal || stats.entregue || 0} <span className="text-xs font-bold text-slate-400">pts</span></p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Prev. vs Entr.</span>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.entregue ?? stats.velocityReal ?? 0} <span className="text-xs font-bold text-slate-400">/ {stats.previsto || 0}</span></p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Carry-overs</span>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.carryOvers || 0} <span className="text-xs font-bold text-slate-400">pts</span></p>
                    </div>
                  </div>

                  {stats.previsto > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500">Taxa de Aderência (Say/Do Ratio):</span>
                      <span className="font-black text-slate-900 dark:text-slate-100">
                        {Math.round(((stats.entregue ?? stats.velocityReal ?? 0) / (stats.previsto || 1)) * 100)}%
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-xs font-black uppercase tracking-wider text-rose-500">
                  Não foi possível carregar as métricas de cerimônia da sprint.
                </div>
              )}
            </TabsContent>

            <TabsContent value="jiradash" className="space-y-4 pt-3">
              {jiraDashData ? (
                <div className="space-y-4">
                  {/* Qualidade e Bugs */}
                  {jiraDashData.qualidade && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wide">
                        <Bug className="h-4 w-4" /> Qualidade & Defeitos
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                            {(jiraDashData.qualidade.q1?.criados || 0) + (jiraDashData.qualidade.q2?.criados || 0)}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Criados</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {(jiraDashData.qualidade.q1?.resolvidos || 0) + (jiraDashData.qualidade.q2?.resolvidos || 0)}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Resolvidos</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-lg font-black text-amber-500">
                            {(jiraDashData.qualidade.q1?.horas || 0) + (jiraDashData.qualidade.q2?.horas || 0)}h
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Horas Defeito</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Distribuição de Horas */}
                  {jiraDashData.horas && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wide">
                        <PieChart className="h-4 w-4" /> Distribuição de Esforço (Horas)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.horas.inovacao || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Inovação</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.horas.sustentacao || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Sustentação</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.horas.teste || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Testes</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.horas.participativo || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Cerimônias/Gestão</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cycle Time */}
                  {jiraDashData.cycle && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-black text-xs uppercase tracking-wide">
                        <Clock className="h-4 w-4" /> Cycle Time Médio (Horas Úteis)
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.cycle.codificacao || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Codificação</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.cycle.revisao || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Code Review</p>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{jiraDashData.cycle.teste || 0}h</p>
                          <p className="text-[9px] text-slate-400 uppercase">Testes / QA</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-3">
                  <BarChart3 className="h-8 w-8 text-indigo-500 mx-auto opacity-70" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Nenhum dado exportado do JiraDash ainda
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Você pode integrar Cycle Time, horas por categoria e defeitos da sprint atual abrindo o JiraDash e clicando em <strong>Enviar para Retro</strong>.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl text-xs font-bold gap-1.5"
                    onClick={() => window.open('/jiradash', '_blank')}
                  >
                    Abrir JiraDash <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
