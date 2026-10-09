import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { workItemsApi } from '@/app/work-items-api';
import { useUserContext } from '@/context/UserContext';
import { useProjectEstimationUnit, type EstimationUnit } from '@/components/ui/DashboardFilters';
import { TrendingUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface SprintStatsDialogProps {
  open: boolean;
  onClose: () => void;
  squadId?: string;
  sprintId?: string;
}

// Sufixo curto da unidade que a squad configurou (antes era sempre "pts").
const UNIT_SUFFIX: Record<EstimationUnit, string> = {
  SP: 'pts',
  HOURS: 'h',
  TSHIRT: 'tamanhos',
  COUNT: 'itens',
};

export function SprintStatsDialog({ open, onClose, squadId, sprintId }: SprintStatsDialogProps) {
  const { userProfile } = useUserContext();
  const { unit, isConfigured } = useProjectEstimationUnit();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeSquad = squadId || userProfile?.squadId || '';
  const activeSprint = sprintId || 'active';
  // Sem unidade configurada pela squad, não assume "pts": mostra só o número.
  const suffix = isConfigured ? UNIT_SUFFIX[unit] : '';

  useEffect(() => {
    if (open) {
      setLoading(true);
      setStats(null); // não mostrar os números da squad/sprint anterior enquanto carrega ou se falhar

      let cancelled = false;
      workItemsApi.getSprintStats(activeSquad, activeSprint)
        .then(result => { if (!cancelled) setStats(result); })
        .catch(console.error)
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [open, activeSquad, activeSprint]);

  const delivered = stats ? (stats.entregue ?? stats.velocityReal ?? 0) : 0;
  const planned = stats?.previsto || 0;
  const hasAnyData = !!stats && (delivered > 0 || planned > 0 || (stats.carryOvers || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] rounded-[2rem] border border-border bg-card text-card-foreground shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-2xl font-black tracking-tight leading-none">Números da sprint</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            O que a squad <span className="font-semibold text-foreground">{activeSquad}</span> planejou e entregou, com dados do Jira.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">Carregando os números da sprint…</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {stats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5">
                    <div className="flex items-center justify-between text-indigo-500 mb-2">
                      <span className="text-xs font-bold">Entregue na sprint</span>
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-black">{delivered} <span className="text-sm font-semibold text-muted-foreground">{suffix}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Total concluído (velocidade).</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center justify-between text-emerald-500 mb-2">
                      <span className="text-xs font-bold">Entregue do previsto</span>
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-black">{delivered} <span className="text-sm font-semibold text-muted-foreground">de {planned}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">O que estava no planejamento.</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center justify-between text-amber-500 mb-2">
                      <span className="text-xs font-bold">Ficou para a próxima</span>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-black">{stats.carryOvers || 0} <span className="text-sm font-semibold text-muted-foreground">{suffix}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Itens que passaram de sprint.</p>
                  </div>
                </div>

                {planned > 0 && (
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cumprimento do planejado</span>
                    <span className="font-black">{Math.round((delivered / (planned || 1)) * 100)}%</span>
                  </div>
                )}

                {!hasAnyData && (
                  <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-3.5">
                    Ainda não há dados desta sprint. Conecte o Jira e sincronize a squad no Painel para os números aparecerem aqui.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-rose-500 text-center py-6">
                Não foi possível carregar os números desta sprint. Tente de novo em instantes.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
