'use client';

import { useCallback, useState } from 'react';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import { teamApi } from '@/app/squad/api';
import type { SquadMember } from '@/lib/types';
import { MAX_DAILY_HOURS } from '@/lib/roster/constants';
import { systemHoursOf, realHoursOf, type CapacityRule } from '@/lib/roster/calc';
import { formatHours, parseDecimal } from '@/lib/roster/numbers';

/** Edição ainda não salva de uma linha: só o que a pessoa mexeu (o resto vem do integrante). */
interface RowEdit {
  capacityText?: string;
  role?: string;
}

export interface RowDraft {
  capacityText: string;
  /** Horas por dia já convertidas; NaN quando o texto não é um número válido (1 a 24). */
  capacity: number;
  valid: boolean;
  role: string;
  dirty: boolean;
}

/**
 * Rascunhos por linha. Ficam separados do integrante e só guardam o que foi alterado: salvar uma pessoa não apaga
 * o que está sendo digitado nas outras (antes cada gravação refazia todos os rascunhos a partir do servidor).
 */
export function useMemberEdits(args: {
  squadId: string;
  rule: CapacityRule;
  canManageTeam: boolean;
  refreshMembers: () => Promise<boolean>;
}) {
  const { squadId, rule, canManageTeam, refreshMembers } = args;
  const { toast } = useToast();
  const saveMemberCapacity = useSquadStore((s) => s.saveMemberCapacity);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const draftOf = useCallback(
    (m: SquadMember): RowDraft => {
      const e = edits[m.jiraAccountId];
      const capacityText = e?.capacityText ?? formatHours(realHoursOf(m, rule.baseHours));
      const parsed = parseDecimal(capacityText);
      const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_DAILY_HOURS;
      return {
        capacityText,
        capacity: valid ? parsed : NaN,
        valid,
        role: e?.role ?? (m.role || 'Developer'),
        dirty: !!e,
      };
    },
    [edits, rule.baseHours]
  );

  const patch = (id: string, p: RowEdit) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  const setCapacityText = (id: string, text: string) => patch(id, { capacityText: text });
  const setRole = (id: string, role: string) => patch(id, { role });
  const clear = (id: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  /** "Salvar" da linha: o cargo muda por endpoint próprio (validado e auditado); aqui também as horas. */
  const saveRow = useCallback(
    async (m: SquadMember) => {
      const draft = draftOf(m);
      if (!draft.valid) return;
      setSavingId(m.jiraAccountId);
      try {
        const systemVal = systemHoursOf(m, rule);
        const overrideType = draft.capacity !== systemVal ? 'MANUAL_OVERRIDE' : 'SYSTEM';
        if (canManageTeam && draft.role !== (m.role || 'Developer')) {
          await teamApi.changeRole(squadId, m.jiraAccountId, draft.role);
          setEdits((prev) => ({ ...prev, [m.jiraAccountId]: { ...prev[m.jiraAccountId], role: undefined } }));
          await refreshMembers();
        }
        await saveMemberCapacity(squadId, m.jiraAccountId, {
          displayName: m.displayName,
          capacityHoursPerDay: draft.capacity,
          systemCalculatedCapacityHoursPerDay: systemVal,
          calibrationNotes: m.calibrationNotes || '',
          overrideType,
        });
        clear(m.jiraAccountId);
        toast({ title: 'Hora real salva', description: `Carga horária de ${m.displayName} definida para ${formatHours(draft.capacity)}h/dia.` });
      } catch (err: unknown) {
        toast({ title: 'Erro ao salvar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
      } finally {
        setSavingId(null);
      }
    },
    [draftOf, rule, canManageTeam, squadId, refreshMembers, saveMemberCapacity, toast]
  );

  /** Volta a pessoa para a hora sugerida pelo sistema e limpa a observação. */
  const restoreRow = useCallback(
    async (m: SquadMember) => {
      const systemVal = systemHoursOf(m, rule);
      setSavingId(m.jiraAccountId);
      try {
        await saveMemberCapacity(squadId, m.jiraAccountId, {
          displayName: m.displayName,
          capacityHoursPerDay: systemVal,
          systemCalculatedCapacityHoursPerDay: systemVal,
          calibrationNotes: '',
          overrideType: 'SYSTEM',
        });
        // Descarta só as horas digitadas; um cargo ainda não salvo continua no rascunho.
        setEdits((prev) => {
          const cur = prev[m.jiraAccountId];
          if (!cur) return prev;
          const next = { ...prev, [m.jiraAccountId]: { ...cur, capacityText: undefined } };
          if (next[m.jiraAccountId].role === undefined) delete next[m.jiraAccountId];
          return next;
        });
        toast({ title: 'Restaurado para sugestão padrão', description: `${m.displayName} voltou à hora sugerida (${formatHours(systemVal)}h/dia).` });
      } catch (err: unknown) {
        toast({ title: 'Erro ao restaurar', description: (err as Error)?.message || 'Falha ao atualizar.', variant: 'destructive' });
      } finally {
        setSavingId(null);
      }
    },
    [rule, squadId, saveMemberCapacity, toast]
  );

  return { draftOf, setCapacityText, setRole, saveRow, restoreRow, savingId };
}
