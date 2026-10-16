'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import type { SquadConfig, SquadMember } from '@/lib/types';
import { DEFAULT_DAILY_HOURS } from '@/lib/roster/constants';
import {
  focusFactorForSave,
  parseFocusFactor,
  recalculatedSystemHours,
  type CapacityRule,
} from '@/lib/roster/calc';
import { formatHours, parseDecimal } from '@/lib/roster/numbers';

const MAX_BASE_HOURS = 24;

/**
 * Regra de cálculo das horas sugeridas: método, carga base, JQL e fator de foco. O fator e a carga base são
 * guardados como texto (a pessoa pode digitar "0,85" ou "0.85") e convertidos aqui.
 */
export function useRosterRule(squadId: string, config: SquadConfig | null, members: SquadMember[]) {
  const { toast } = useToast();
  const saveSquadConfig = useSquadStore((s) => s.saveSquadConfig);
  const batchUpdateMembers = useSquadStore((s) => s.batchUpdateMembers);

  const [method, setMethod] = useState<string>('STANDARD');
  const [jql, setJql] = useState('');
  const [focusText, setFocusText] = useState('0.85');
  const [baseText, setBaseText] = useState(formatHours(DEFAULT_DAILY_HOURS));
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // A regra gravada na squad vira o ponto de partida dos campos (ajuste durante a renderização, sem efeito).
  const [syncedConfig, setSyncedConfig] = useState<SquadConfig | null>(null);
  if (config && config !== syncedConfig) {
    setSyncedConfig(config);
    setMethod(config.capacityCalculationMethod || 'STANDARD');
    setJql(config.capacityJql || '');
    setFocusText(config.capacityFormula || '0.85');
    setBaseText(formatHours(config.defaultDailyCapacityHours || DEFAULT_DAILY_HOURS));
  }
  const savedFormula = config?.capacityFormula;

  const baseParsed = parseDecimal(baseText);
  const baseValid = Number.isFinite(baseParsed) && baseParsed > 0 && baseParsed <= MAX_BASE_HOURS;
  const focusValid = parseFocusFactor(focusText) !== null;
  // A carga base vale no padrão fixo e no fator de foco; o fator, só no fator de foco.
  const needsBase = method === 'STANDARD' || method === 'CUSTOM_FORMULA';
  const canSubmit = (!needsBase || baseValid) && (method !== 'CUSTOM_FORMULA' || focusValid);

  const baseHours = baseValid ? baseParsed : config?.defaultDailyCapacityHours || DEFAULT_DAILY_HOURS;
  const rule: CapacityRule = useMemo(
    () => ({ method, baseHours, focusFactorText: focusText }),
    [method, baseHours, focusText]
  );

  const save = useCallback(async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      // Escrita parcial: só a regra de capacidade (antes reenviava chave do projeto, JQL e ranking lidos na abertura).
      await saveSquadConfig(squadId, {
        defaultDailyCapacityHours: baseHours,
        capacityCalculationMethod: method,
        capacityJql: jql,
        // O servidor lê com ponto: "0,85" digitado vira "0.85".
        capacityFormula: focusFactorForSave(focusText) ?? savedFormula ?? '0.85',
      });
      toast({ title: 'Regra de cálculo salva', description: 'A regra de capacidade do sistema foi atualizada.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar regra', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, saveSquadConfig, squadId, baseHours, method, jql, focusText, savedFormula, toast]);

  const recalculate = useCallback(async () => {
    if (!canSubmit) return;
    setIsRecalculating(true);
    try {
      const updated = members.map((m) => ({ ...m, systemCalculatedCapacityHoursPerDay: recalculatedSystemHours(m, rule) }));
      await batchUpdateMembers(squadId, updated);
      toast({ title: 'Coluna sugerida recalculada', description: 'Horas sugeridas atualizadas para todos.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao recalcular', description: (err as Error)?.message || 'Falha ao atualizar dados.', variant: 'destructive' });
    } finally {
      setIsRecalculating(false);
    }
  }, [canSubmit, members, rule, batchUpdateMembers, squadId, toast]);

  return {
    method, setMethod,
    jql, setJql,
    focusText, setFocusText,
    baseText, setBaseText,
    baseValid, focusValid, canSubmit,
    rule,
    save, recalculate,
    isSaving, isRecalculating,
  };
}
