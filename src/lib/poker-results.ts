import type { DeckType, Participant, TshirtEquivalent, Vote } from './types';
import {
  TECHNICAL_CATEGORIES,
  calculateRoleEfforts,
  formatEstimateCopy,
  formatRoleForCopy,
  getEligibleStatsVotes,
  getParticipantCategory,
  resolveTshirtHours,
  roundEstimate,
  type RoundingMode,
  type TechnicalCategory,
} from './poker-utils';

/**
 * Resultado de uma rodada revelada: média/piso/teto, consenso e resultado por
 * papel. É a lógica que o card de resultados já usava, agora pura (testável) e
 * compartilhada pela mesa, pelo painel por papel e pelo "Copiar estimativa".
 */

const T_SHIRT_ORDER = ['PP', 'P', 'M', 'G', 'GG'] as const;

export interface RoleResult {
  category: TechnicalCategory;
  votes: string[];
  /** Valor do papel (média arredondada, ou o mais votado em camisetas sem equivalência). */
  resultValue: string;
  resultLabel: 'MÉDIA' | 'MÉDIA (H)' | 'MAIS VOTADO';
}

export interface RoundSummary {
  consensus: boolean;
  avg: string;
  min: string;
  max: string;
  rolePoints: Record<string, string>;
  totalHours: string;
  tshirtNumeric: boolean;
  unmappedTshirt: number;
  byRole: Partial<Record<TechnicalCategory, RoleResult>>;
  /** Papéis técnicos que votaram, na ordem canônica. */
  activeRoles: TechnicalCategory[];
}

export function summarizeRound(
  votes: Vote[],
  participants: Participant[],
  deck: DeckType,
  options: { allowManagementToVote?: boolean; tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>; roundingMode?: RoundingMode } = {}
): RoundSummary {
  const { allowManagementToVote = false, tshirtEquivalents, roundingMode = 'up' } = options;

  // Consenso/média/piso/teto só sobre votos técnicos — gestão e espectador não entram.
  const eligibleVotes = getEligibleStatsVotes(votes, participants, allowManagementToVote);
  const allVoteValues = eligibleVotes.map(v => v.value);
  const numericVotes = allVoteValues.filter((v): v is string => v !== null && !isNaN(Number(v))).map(Number);
  const consensus = allVoteValues.length > 1 && new Set(allVoteValues).size === 1;

  let avg = 'N/A', min = 'N/A', max = 'N/A';
  let tshirtNumeric = false;

  const efforts = calculateRoleEfforts(votes, participants, deck, tshirtEquivalents, roundingMode);

  if (allVoteValues.length > 0) {
    if (deck === 'tshirt') {
      // Equivalência configurada: média/piso/teto de verdade em horas. Só votos com tamanho mapeado.
      const numericTshirtVotes = allVoteValues.map(v => resolveTshirtHours(v, tshirtEquivalents)).filter(n => !isNaN(n));
      if (numericTshirtVotes.length > 0) {
        tshirtNumeric = true;
        const sum = numericTshirtVotes.reduce((acc, val) => acc + val, 0);
        avg = String(roundEstimate(sum / numericTshirtVotes.length, roundingMode, deck));
        min = String(Math.min(...numericTshirtVotes));
        max = String(Math.max(...numericTshirtVotes));
      } else {
        // Sem equivalência: comportamento histórico — moda categórica.
        const valid = allVoteValues.filter(v => (T_SHIRT_ORDER as readonly string[]).includes(v));
        if (valid.length > 0) {
          const counts = valid.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
          avg = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
          const indexes = valid.map(v => (T_SHIRT_ORDER as readonly string[]).indexOf(v));
          min = T_SHIRT_ORDER[Math.min(...indexes)];
          max = T_SHIRT_ORDER[Math.max(...indexes)];
        }
      }
    } else if (numericVotes.length > 0) {
      const sum = numericVotes.reduce((acc, val) => acc + val, 0);
      avg = String(roundEstimate(sum / numericVotes.length, roundingMode, deck));
      min = String(Math.min(...numericVotes));
      max = String(Math.max(...numericVotes));
    }
  }

  // Camisetas com equivalência parcial: votos em tamanho sem equivalência não entram na média.
  const unmappedTshirt = deck === 'tshirt' && tshirtNumeric
    ? allVoteValues.filter(v => v !== '?' && v !== '☕' && isNaN(resolveTshirtHours(v, tshirtEquivalents))).length
    : 0;

  // Resultado por papel.
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const raw: Record<string, string[]> = {};
  votes.forEach(vote => {
    const participant = participantMap.get(vote.participantId);
    let category: TechnicalCategory | 'Management' | null = null;
    if (participant) category = getParticipantCategory(participant);
    else if (vote.participantRole) {
      // "Votos são fatos": usa a identidade congelada no voto.
      category = getParticipantCategory({ role: vote.participantRole, globalRole: vote.participantGlobalRole });
    }
    if (category && category !== 'Management') (raw[category] ||= []).push(vote.value);
  });

  const byRole: Partial<Record<TechnicalCategory, RoleResult>> = {};
  (Object.keys(raw) as TechnicalCategory[]).forEach(category => {
    const roleVotes = raw[category];
    let resultValue = 'N/A';
    let resultLabel: RoleResult['resultLabel'] = 'MÉDIA';
    if (deck === 'hours' && efforts.rolePoints[category]) {
      resultValue = efforts.rolePoints[category];
    } else if (deck === 'tshirt' && tshirtNumeric && efforts.rolePoints[category]) {
      resultValue = efforts.rolePoints[category];
      resultLabel = 'MÉDIA (H)';
    } else if (deck === 'tshirt') {
      const vals = roleVotes.filter(v => (T_SHIRT_ORDER as readonly string[]).includes(v));
      if (vals.length > 0) {
        const counts = vals.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
        resultValue = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
        resultLabel = 'MAIS VOTADO';
      }
    } else {
      const nums = roleVotes.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) resultValue = String(roundEstimate(nums.reduce((a, b) => a + b, 0) / nums.length, roundingMode, deck));
    }
    byRole[category] = { category, votes: roleVotes, resultValue, resultLabel };
  });

  const activeRoles = TECHNICAL_CATEGORIES.filter(c => byRole[c] && byRole[c]!.votes.length > 0);

  return { consensus, avg, min, max, rolePoints: efforts.rolePoints, totalHours: efforts.totalPoints, tshirtNumeric, unmappedTshirt, byRole, activeRoles };
}

/** Sufixo da unidade no texto copiado: horas ("h"), story points (" SP") ou nada (camisetas puras). */
export function copyUnitSuffix(deck: DeckType, tshirtNumeric: boolean): string {
  if (deck === 'hours' || (deck === 'tshirt' && tshirtNumeric)) return 'h';
  return deck === 'fibonacci' ? ' SP' : '';
}

/**
 * Texto de "Copiar estimativa" da rodada: "(DEV 10h / QA 4h / UX 2h)". Usa a mesma
 * formatação do relatório da fila (formatEstimateCopy). Vazio quando nada foi calculado.
 */
export function buildRoundCopyText(summary: RoundSummary, deck: DeckType): string {
  const suffix = copyUnitSuffix(deck, summary.tshirtNumeric);
  return formatEstimateCopy(
    summary.activeRoles.map(role => ({ role, value: summary.byRole[role]!.resultValue })),
    suffix
  );
}

/** Soma de horas por papel nas tarefas estimadas (relatório final). */
export function sumRoleHours(
  issues: ReadonlyArray<{ rolePoints?: Record<string, string> | null; devPoints?: string | null; qaPoints?: string | null }>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of issues) {
    const entries = i.rolePoints
      ? Object.entries(i.rolePoints)
      : ([['Developer', i.devPoints], ['QA', i.qaPoints]] as [string, string | null | undefined][]);
    for (const [role, value] of entries) {
      const n = parseFloat(value || '0');
      if (!isNaN(n) && n !== 0) totals[role] = (totals[role] || 0) + n;
    }
  }
  return totals;
}

/**
 * Aviso de divergência para o centro da mesa: "Divergência crítica no DEV · 6h a 16h".
 * `levels` diz o nível de cada papel (o mesmo mapa que pinta as cartas). Devolve o
 * pior caso; undefined se ninguém diverge.
 */
export function divergenceLabel(
  summary: RoundSummary,
  levels: Partial<Record<string, 'warning' | 'destructive'>>,
  deck: DeckType
): string | undefined {
  const rank = { destructive: 2, warning: 1 } as const;
  let worst: { role: TechnicalCategory; level: 'warning' | 'destructive' } | null = null;
  for (const role of summary.activeRoles) {
    const level = levels[role];
    if (level && (!worst || rank[level] > rank[worst.level])) worst = { role, level };
  }
  if (!worst) return undefined;
  const name = formatRoleForCopy(worst.role);
  const prefix = worst.level === 'destructive' ? 'Divergência crítica' : 'Divergência';
  if (deck === 'hours') {
    const nums = summary.byRole[worst.role]!.votes.map(Number).filter(n => !isNaN(n));
    if (nums.length > 1) return `${prefix} no ${name} · ${Math.min(...nums)}h a ${Math.max(...nums)}h`;
  }
  return `${prefix} no ${name}`;
}
