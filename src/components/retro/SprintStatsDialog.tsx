import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { workItemsApi } from '@/app/work-items-api';
import { useUserContext } from '@/context/UserContext';

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

  const activeSquad = squadId || userProfile?.squadId || 'DDWMISSI';
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Resumo da Sprint</DialogTitle>
          <DialogDescription>Dados atualizados do backend</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div>Carregando estatísticas...</div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="flex justify-between p-4 bg-slate-100 rounded-lg">
              <span>Velocity Real</span>
              <span className="font-bold">{stats.velocityReal} pts</span>
            </div>
            <div className="flex justify-between p-4 bg-slate-100 rounded-lg">
              <span>Previsto vs Entregue</span>
              <span className="font-bold">{stats.previsto} / {stats.entregue || stats.velocityReal} pts</span>
            </div>
            <div className="flex justify-between p-4 bg-slate-100 rounded-lg">
              <span>Carry-overs</span>
              <span className="font-bold">{stats.carryOvers} pts</span>
            </div>
          </div>
        ) : (
          <div>Erro ao carregar os dados.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
