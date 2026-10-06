import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { workItemsApi } from '@/app/work-items-api';
import { useUserContext } from '@/context/UserContext';
import { TrendingUp, CheckCircle2, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SprintStatsDialogProps {
  open: boolean;
  onClose: () => void;
  squadId?: string;
  sprintId?: string;
}

export function SprintStatsDialog({ open, onClose, squadId, sprintId }: SprintStatsDialogProps) {
  const { userProfile } = useUserContext();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeSquad = squadId || userProfile?.squadId || '';
  const activeSprint = sprintId || 'active';

  useEffect(() => {
    if (open) {
      setLoading(true);

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
            <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/50 font-bold text-[11px] uppercase tracking-wide px-2.5 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Métricas Automatizadas
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase">
            Resumo Analítico da Sprint
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-400">
            Dados consolidados de <span className="font-bold text-slate-600 dark:text-slate-300">{activeSquad}</span> via <span className="font-code text-indigo-500">work_items</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sincronizando métricas da sprint...</p>
          </div>
        ) : (
          <div className="w-full mt-2">
            <div className="space-y-4 pt-3">
              {stats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Velocity Real</span>
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.velocityReal || stats.entregue || 0} <span className="text-xs font-bold text-slate-400">pts</span></p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Prev. vs Entr.</span>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.entregue ?? stats.velocityReal ?? 0} <span className="text-xs font-bold text-slate-400">/ {stats.previsto || 0}</span></p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/40 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Carry-overs</span>
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
