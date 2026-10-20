'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import { teamApi, type TeamCandidate } from '@/app/squad/api';
import { DEFAULT_DAILY_HOURS, MAX_DAILY_HOURS } from '@/lib/roster/constants';
import { formatHours, parseDecimal } from '@/lib/roster/numbers';

/** Mínimo de caracteres do e-mail para buscar contas existentes (o servidor devolve vazio abaixo disso). */
export const CANDIDATE_MIN_CHARS = 3;

/**
 * Adicionar integrante: busca contas por prefixo de e-mail, ou pré-cadastro por nome (sem conta). Squad criada do
 * zero não tem assignees para sincronizar, então precisa de um jeito de colocar gente na lista sem o Jira.
 */
export function useAddMember(args: { squadId: string; canManageTeam: boolean; refreshMembers: () => Promise<boolean> }) {
  const { squadId, canManageTeam, refreshMembers } = args;
  const { toast } = useToast();
  const saveMemberCapacity = useSquadStore((s) => s.saveMemberCapacity);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmailRaw] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState('Developer');
  const [hoursText, setHoursText] = useState(formatHours(DEFAULT_DAILY_HOURS));
  const [candidates, setCandidates] = useState<TeamCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  // Trava síncrona contra duplo clique: o `saving` só vale depois do próximo render.
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setName('');
    setEmailRaw('');
    setUserId(null);
    setCandidates([]);
    setRole('Developer');
    setHoursText(formatHours(DEFAULT_DAILY_HOURS));
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Escrever outro e-mail desfaz a conta escolhida.
  const setEmail = (v: string) => {
    setEmailRaw(v);
    setUserId(null);
  };

  const pick = (c: TeamCandidate) => {
    setUserId(c.userId);
    setName(c.name || '');
    setEmailRaw(c.email || '');
    setCandidates([]);
  };

  const query = email.trim();
  const shouldSearch = open && canManageTeam && query.length >= CANDIDATE_MIN_CHARS && !userId;

  useEffect(() => {
    if (!shouldSearch) return;
    const q = query;
    let alive = true;
    const t = setTimeout(() => {
      teamApi
        .searchCandidates(squadId, q)
        .then((r) => alive && setCandidates(r))
        .catch(() => alive && setCandidates([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [shouldSearch, query, squadId]);

  const hoursParsed = parseDecimal(hoursText);
  const hoursValid = Number.isFinite(hoursParsed) && hoursParsed > 0 && hoursParsed <= MAX_DAILY_HOURS;

  const submit = useCallback(async () => {
    if ((!name.trim() && !userId) || !squadId) {
      toast({ title: 'Informe o nome do integrante', variant: 'destructive' });
      return;
    }
    if (!hoursValid || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const added = await teamApi.addMember(squadId, {
        ...(userId ? { userId } : {}),
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        displayName: name.trim() || undefined,
        roleName: role,
      });
      // Horas por dia: gravação parcial da linha que acabou de nascer.
      await saveMemberCapacity(squadId, added.jiraAccountId, { capacityHoursPerDay: hoursParsed, overrideType: 'MANUAL_OVERRIDE' });
      await refreshMembers();
      toast({ title: 'Integrante adicionado', description: `${added.displayName} entrou na squad. Ajuste as horas se precisar.` });
      reset();
      setOpen(false);
    } catch (err: unknown) {
      toast({ title: 'Não foi possível adicionar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [name, userId, email, role, hoursParsed, hoursValid, squadId, saveMemberCapacity, refreshMembers, reset, toast]);

  return {
    open, setOpen, close,
    name, setName, email, setEmail, userId, role, setRole,
    hoursText, setHoursText, hoursValid,
    candidates: shouldSearch ? candidates : [], pick, saving, submit,
  };
}
