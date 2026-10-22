/**
 * Sugestão de início e fim pelas HORAS das subtarefas (o portal só lê o Jira; nada é gravado nele).
 *
 *  - as fases de uma história seguem a ordem do fluxo (config da squad ou DEV > Auto > Review > QA > TI);
 *    uma fase só começa depois que a anterior TERMINA (QA espera DEV); fases da mesma ordem rodam em paralelo;
 *  - cada pessoa executa as suas subtarefas em fila, uma por vez;
 *  - a duração vem das horas: tempo restante quando a issue está em andamento, estimativa original nas demais,
 *    divididas pela capacidade diária da PESSOA (um dia útil dela = a jornada 9h-18h inteira);
 *  - nunca sugere no passado (respeita "agora") nem antes do início da sprint; pula finais de semana.
 */
import type { SquadMember } from '@/lib/types';
import { JORNADA, nextBusinessDayOnOrAfter, normalizeStart, ptNum, type Pt } from './dates';

export interface SuggestTask {
  key: string;
  storyKey: string;
  /** Ordem da fase. */
  order: number;
  /** Desempate dentro do tier. */
  tie: number;
  /** Quem executa (id ou nome); null = sem responsável, sem fila. */
  person: string | null;
  /** Horas a distribuir; 0 ou ausente = sem sugestão. */
  hours: number;
  inProgress: boolean;
  done: boolean;
  /** Fim já conhecido de uma fase concluída (data real ou de resolução), para a fase seguinte esperar. */
  doneEnd?: Pt | null;
  /**
   * Data e hora REAIS do Jira (compromisso da pessoa): nunca são recalculadas. Ocupam a fila da pessoa nesse
   * horário e as demais fases contornam o bloco; a fase seguinte espera o fim delas.
   */
  fixed?: { start: Pt; end: Pt } | null;
}

export interface Suggestion {
  start: Pt;
  end: Pt;
  hours: number;
  capacityHours: number;
  person: string | null;
}

export interface SuggestOptions {
  now: Pt;
  /** Início da sprint (número do dia); nada é sugerido antes dele. */
  sprintStartDay?: number | null;
  capacityOf: (person: string | null) => number;
}

const EPS = 1e-9;

/** Anda `workDays` (fração de jornada, 1 = um dia útil inteiro) a partir de `start`, pulando fim de semana. */
export function advance(start: Pt, workDays: number): Pt {
  let day = start.day;
  let frac = start.frac;
  let left = workDays;
  while (left > EPS) {
    const avail = 1 - frac;
    if (left <= avail + EPS) {
      frac = Math.min(1, frac + left);
      left = 0;
    } else {
      left -= avail;
      day = nextBusinessDayOnOrAfter(day + 1);
      frac = 0;
    }
  }
  return { day, frac };
}

/** Horas que valem para a sugestão: restante se a issue está em andamento (e ainda tem restante), senão a estimativa. */
export function hoursForSuggestion(t: { inProgress: boolean; estimateSec: number; remainingSec: number }): number {
  const sec = t.inProgress && t.remainingSec > 0 ? t.remainingSec : t.estimateSec;
  return sec > 0 ? sec / 3600 : 0;
}

export function suggestSchedule(tasks: SuggestTask[], opts: SuggestOptions): Map<string, Suggestion> {
  const out = new Map<string, Suggestion>();
  const floor: Pt = normalizeStart(
    opts.sprintStartDay != null && opts.sprintStartDay > opts.now.day ? { day: opts.sprintStartDay, frac: 0 } : opts.now,
  );

  // Ordem das histórias = ordem em que aparecem (rank do Jira).
  const storyOrder = new Map<string, number>();
  tasks.forEach((t) => { if (!storyOrder.has(t.storyKey)) storyOrder.set(t.storyKey, storyOrder.size); });

  const byStory = new Map<string, SuggestTask[]>();
  for (const t of tasks) {
    const list = byStory.get(t.storyKey);
    if (list) list.push(t); else byStory.set(t.storyKey, [t]);
  }
  byStory.forEach((list) => list.sort((a, b) => a.order - b.order || a.tie - b.tie));

  const cursor = new Map<string, Pt>();
  const ends = new Map<string, Pt>(); // key -> fim já definido (sugerido ou de fase concluída)
  for (const t of tasks) if (t.done && t.doneEnd) ends.set(t.key, t.doneEnd);

  // Blocos ocupados por fase com data real, por pessoa.
  const blocks = new Map<string, { start: Pt; end: Pt }[]>();
  for (const t of tasks) {
    if (t.done || !t.fixed) continue;
    ends.set(t.key, t.fixed.end);
    if (t.person) {
      const list = blocks.get(t.person);
      if (list) list.push(t.fixed); else blocks.set(t.person, [t.fixed]);
    }
  }

  const place = (t: SuggestTask, respectPhases: boolean) => {
    if (t.done || t.fixed || t.hours <= 0) return;
    const cap = Math.max(opts.capacityOf(t.person), 0.5);
    let startNum = floor;
    const consider = (p: Pt | undefined) => {
      if (p && ptNum(p) > ptNum(startNum)) startNum = p;
    };
    if (respectPhases) {
      for (const o of byStory.get(t.storyKey) ?? []) {
        if (o.order < t.order) consider(ends.get(o.key));
      }
    }
    if (t.person) consider(cursor.get(t.person));
    const need = t.hours / cap;
    let start = normalizeStart(startNum);
    let end = advance(start, need);
    const mine = t.person ? blocks.get(t.person) : undefined;
    if (mine) {
      for (let guard = 0; guard <= mine.length * 2; guard += 1) {
        const hit = mine.find((b) => ptNum(b.start) < ptNum(end) - EPS && ptNum(b.end) > ptNum(start) + EPS);
        if (!hit) break;
        start = normalizeStart(ptNum(hit.end) > ptNum(start) ? hit.end : start);
        end = advance(start, need);
      }
    }
    if (t.person) cursor.set(t.person, end);
    ends.set(t.key, end);
    out.set(t.key, { start, end, hours: t.hours, capacityHours: cap, person: t.person });
  };

  const stories = [...byStory.entries()].sort((a, b) => (storyOrder.get(a[0]) ?? 0) - (storyOrder.get(b[0]) ?? 0));

  // 1ª passada: o que já está em andamento ocupa a fila de cada pessoa a partir de agora.
  for (const [, list] of stories) for (const t of list) if (t.inProgress) place(t, false);
  // 2ª passada: o resto, história por história, fase por fase.
  for (const [, list] of stories) for (const t of list) if (!t.inProgress) place(t, true);

  return out;
}

// ---------- Capacidade diária ----------

export type CapacitySource = 'pessoa' | 'squad' | 'padrao';

export interface ResolvedCapacity {
  hours: number;
  source: CapacitySource;
}

export type ResolvedCapacityFn = (assigneeId: string, assigneeName: string) => ResolvedCapacity;

const norm = (s?: string) => (s || '').trim().toLowerCase();
const positive = (n?: number | null): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Capacidade diária de cada pessoa: cadastro do time (`capacityHoursPerDay`, ou o valor calculado pelo sistema)
 * > padrão da squad (`defaultDailyCapacityHours`) > 8h12 (JORNADA.capacidadePadraoH).
 * A pessoa é achada pelo id do Jira e, na falta dele, pelo nome.
 */
export function buildCapacityResolver(
  members: Pick<SquadMember, 'jiraAccountId' | 'displayName' | 'capacityHoursPerDay' | 'systemCalculatedCapacityHoursPerDay'>[],
  squadDefaultHours?: number | null,
): ResolvedCapacityFn {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const m of members) {
    const cap = positive(m.capacityHoursPerDay) ? m.capacityHoursPerDay : positive(m.systemCalculatedCapacityHoursPerDay) ? m.systemCalculatedCapacityHoursPerDay : null;
    if (cap === null) continue;
    const v = Math.min(cap, 24);
    if (m.jiraAccountId) byId.set(m.jiraAccountId, v);
    if (m.displayName) byName.set(norm(m.displayName), v);
  }
  const squad = positive(squadDefaultHours) ? Math.min(squadDefaultHours, 24) : null;
  return (assigneeId, assigneeName) => {
    const own = (assigneeId && byId.get(assigneeId)) || (assigneeName && byName.get(norm(assigneeName))) || null;
    if (own) return { hours: own, source: 'pessoa' };
    if (squad !== null) return { hours: squad, source: 'squad' };
    return { hours: JORNADA.capacidadePadraoH, source: 'padrao' };
  };
}
