'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SquadMember } from '@/lib/types';
import { effectiveOverrideType, realHoursOf, systemHoursOf, type CapacityRule } from '@/lib/roster/calc';
import { downloadTextFile } from '@/lib/roster/csv';
import { buildRosterExportCsv } from '@/lib/roster/import';
import type { RowDraft } from './useMemberEdits';

/** "Exportar planilha": o time inteiro (não só o filtrado), com o que está digitado nas linhas. */
export function useRosterExport(args: {
  squadId: string;
  members: SquadMember[];
  rule: CapacityRule;
  draftOf: (m: SquadMember) => RowDraft;
}) {
  const { squadId, members, rule, draftOf } = args;
  const { toast } = useToast();

  return useCallback(() => {
    if (members.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhum integrante para exportar.', variant: 'destructive' });
      return;
    }
    const rows = members.map((m) => {
      const draft = draftOf(m);
      const real = draft.valid ? draft.capacity : realHoursOf(m, rule.baseHours);
      const suggested = systemHoursOf(m, rule);
      return {
        member: m,
        role: draft.role,
        suggested,
        real,
        source: m.overrideType || (real !== suggested ? 'MANUAL_OVERRIDE' : effectiveOverrideType(m, rule.baseHours)),
        notes: m.calibrationNotes || '',
      };
    });
    downloadTextFile(`capacidade_equipe_${squadId}_${new Date().toISOString().split('T')[0]}.csv`, buildRosterExportCsv(rows));
    toast({ title: 'Exportação concluída', description: `Planilha com ${members.length} integrantes exportada em CSV.` });
  }, [members, rule, draftOf, squadId, toast]);
}
