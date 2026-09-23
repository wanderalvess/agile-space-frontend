/**
 * Cálculo da próxima ocorrência de uma cerimônia recorrente cadastrada à mão
 * (SquadConfig.ceremonies, modo 'manual' — ver .env.example / NextCeremonyCard
 * pro modo 'google_calendar', que lê a agenda de verdade em vez de recorrência).
 */

import type { CeremonyDayOfWeek, SquadCeremony } from './types';

// Date#getDay(): 0=domingo. Índice aqui bate 1:1 com isso.
export const CEREMONY_DAY_INDEX: CeremonyDayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const CEREMONY_DAY_LABEL: Record<CeremonyDayOfWeek, string> = {
  MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui', FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom',
};

function parseTime(startTime: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime || '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export interface CeremonyOccurrence {
  ceremony: SquadCeremony;
  start: Date;
  end: Date;
}

/**
 * Próxima ocorrência (a mais cedo, entre todas as cerimônias cadastradas) que ainda não
 * terminou — cobre tanto "vai começar" quanto "está rolando agora". Olha até 8 dias à
 * frente pra garantir que toda cerimônia semanal apareça pelo menos uma vez.
 */
export function computeNextOccurrence(ceremonies: SquadCeremony[], now: Date): CeremonyOccurrence | null {
  const candidates: CeremonyOccurrence[] = [];

  for (const ceremony of ceremonies) {
    const time = parseTime(ceremony.startTime);
    if (!time || !ceremony.daysOfWeek?.length || !ceremony.durationMinutes) continue;

    for (let offset = 0; offset <= 7; offset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      const dayCode = CEREMONY_DAY_INDEX[day.getDay()];
      if (!ceremony.daysOfWeek.includes(dayCode)) continue;

      const start = new Date(day);
      start.setHours(time.hours, time.minutes, 0, 0);
      const end = new Date(start.getTime() + ceremony.durationMinutes * 60000);
      if (end.getTime() <= now.getTime()) continue; // já passou hoje/nesse dia

      candidates.push({ ceremony, start, end });
      break; // achou a próxima ocorrência DESSA cerimônia — não precisa olhar mais dias
    }
  }

  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
  return candidates[0] || null;
}
