'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { squadApi, type ResolvedPersonConfig } from '@/app/squad/api';
import { parseDecimal, roundTo } from '@/lib/roster/numbers';

export interface PersonConfigDraft {
  /** '' = não definido; 'DEV' ou 'QA'. */
  papel: string;
  diasCodificacaoTeste: string;
  diasRegressivo: string;
  horasProdutivas: string;
}

export const PERSON_LIMITS = { dias: { min: 0, max: 31 }, horas: { min: 0, max: 24 } } as const;

function toDraft(r: ResolvedPersonConfig): PersonConfigDraft {
  return {
    papel: r.papel || '',
    diasCodificacaoTeste: String(r.diasCodificacaoTeste ?? 0),
    diasRegressivo: String(r.diasRegressivo ?? 0),
    horasProdutivas: String(r.horasProdutivas ?? 0).replace('.', ','),
  };
}

export interface PersonConfigNumbers {
  dias1: number;
  dias2: number;
  horas: number;
  valid: boolean;
}

export function personConfigNumbers(d: PersonConfigDraft): PersonConfigNumbers {
  const dias1 = parseDecimal(d.diasCodificacaoTeste);
  const dias2 = parseDecimal(d.diasRegressivo);
  const horas = parseDecimal(d.horasProdutivas);
  const inRange = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
  return {
    dias1,
    dias2,
    horas,
    valid:
      inRange(dias1, PERSON_LIMITS.dias.min, PERSON_LIMITS.dias.max) &&
      inRange(dias2, PERSON_LIMITS.dias.min, PERSON_LIMITS.dias.max) &&
      inRange(horas, PERSON_LIMITS.horas.min, PERSON_LIMITS.horas.max),
  };
}

/** Capacidade total no período = horas produtivas por dia x (dias de codificação/teste + dias de regressivo). */
export function personConfigTotal(n: PersonConfigNumbers): number {
  return Number.isFinite(n.horas) ? roundTo(n.horas * ((n.dias1 || 0) + (n.dias2 || 0)), 2) : 0;
}

/**
 * Papel & Capacidade por pessoa (DEV/QA, dias por fase, horas produtivas), com herança da sprint anterior.
 * Carregado sob demanda ao abrir a linha; só uma linha fica aberta por vez.
 */
export function usePersonConfig(squadId: string, sprintId: string | undefined) {
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, ResolvedPersonConfig>>({});
  const [drafts, setDrafts] = useState<Record<string, PersonConfigDraft>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggle = useCallback(
    async (id: string) => {
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      if (resolved[id]) return;
      setLoadingId(id);
      try {
        const r = await squadApi.getPersonConfig(squadId, id, sprintId);
        setResolved((prev) => ({ ...prev, [id]: r }));
        setDrafts((prev) => ({ ...prev, [id]: toDraft(r) }));
      } catch (err: unknown) {
        toast({ title: 'Erro ao carregar papel/capacidade', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
        setOpenId(null);
      } finally {
        setLoadingId(null);
      }
    },
    [openId, resolved, squadId, sprintId, toast]
  );

  const patch = (id: string, p: Partial<PersonConfigDraft>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  const save = useCallback(
    async (id: string) => {
      const draft = drafts[id];
      if (!draft) return;
      const n = personConfigNumbers(draft);
      if (!n.valid) return;
      setSavingId(id);
      try {
        await squadApi.savePersonConfig(squadId, id, sprintId, {
          papel: draft.papel,
          diasCodificacaoTeste: Math.round(n.dias1),
          diasRegressivo: Math.round(n.dias2),
          horasProdutivas: n.horas,
        });
        const r = await squadApi.getPersonConfig(squadId, id, sprintId);
        setResolved((prev) => ({ ...prev, [id]: r }));
        toast({ title: 'Papel & capacidade salvos', description: 'Valor definido para esta sprint.' });
      } catch (err: unknown) {
        toast({ title: 'Erro ao salvar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
      } finally {
        setSavingId(null);
      }
    },
    [drafts, squadId, sprintId, toast]
  );

  return { openId, resolved, drafts, loadingId, savingId, toggle, patch, save };
}
