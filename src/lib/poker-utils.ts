import { DECKS, ROLES, Participant, Vote, DeckType, Role, GlobalRole, IssueType, TshirtEquivalent, TSHIRT_UNIT_HOURS, VotingRound, Issue } from './types';
import { CARGO_DEV, CARGO_QA, canonicalCargo } from './cargo';

/**
 * Configurações que uma sala NOVA já nasce com ligadas. Antes tudo nascia
 * desligado e a sala só rendia dado/opção se o facilitador lembrasse de
 * garimpar os toggles — na prática, quase ninguém ligava.
 *
 * Só entram aqui recursos que acrescentam informação ou uma ação a mais.
 * Automação (auto-revelar, auto-consenso) e mudança de regra (revelação anônima) continuam fora: essas precisam de decisão explícita.
 *
 * Vale apenas na criação — salas já existentes não são tocadas.
 */
export const DEFAULT_ROOM_SETTINGS = {
  // Revelação: as cartas só viram quando o facilitador clica em "Revelar". Gravado de propósito (false)
  // para a sala nascer com a escolha explícita; "Revelar automaticamente" é opt-in.
  autoReveal: false,
  // Dados e visão
  perTopicTime: true,
  showDistribution: true,
  showVelocity: true,
  decisionNotes: true,
  refinementNotes: true,
  // Opções do facilitador
  cancelTask: true,
  parkTask: true,
  referenceStory: true,
  roundNudge: true,
  suggestRevote: true,
  // Ritual de votação
  confidenceVote: true,
  outlierPrompt: true,
} as const;

/**
 * Todos os ajustes de liga/desliga que o facilitador enxerga em "Configurações
 * da cerimônia". Usado por "Restaurar padrão": o que está em DEFAULT_ROOM_SETTINGS
 * volta ligado; o resto volta desligado.
 */
export const CEREMONY_TOGGLE_KEYS = [
  'confidenceVote', 'groomingFlag', 'autoConsensus', 'reactions', 'referenceStory',
  'roundNudge', 'cancelTask', 'parkTask', 'autoReveal', 'blindVotes', 'anonymousReveal', 'outlierPrompt',
  'showDistribution', 'suggestRevote', 'groupVotesByRole', 'autoTimer', 'turnNotification', 'decisionNotes',
  'refinementNotes', 'perTopicTime', 'showVelocity',
] as const;

/** Patch de configurações que devolve a sala ao padrão (não mexe em escala nem equivalência de camisetas). */
export function buildDefaultSettingsPatch(): Record<string, boolean | number | string | string[] | { warn: number; high: number }> {
  const defaults = DEFAULT_ROOM_SETTINGS as Record<string, boolean>;
  const patch: Record<string, boolean | number | string | string[] | { warn: number; high: number }> = {};
  for (const key of CEREMONY_TOGGLE_KEYS) patch[key] = !!defaults[key];
  patch.maxRounds = 3;
  patch.roundingMode = 'up';
  patch.divergenceThresholds = { warn: 2, high: 5 };
  patch.votingCargos = [...DEFAULT_VOTING_CARGOS];
  return patch;
}

/**
 * Como a média dos votos vira o valor salvo. 'up' (padrão, sempre foi assim) arredonda para cima;
 * 'nearest' para o inteiro mais próximo; 'down' para baixo; 'deck' para a carta mais próxima do
 * baralho da sala (empate vai para a carta maior). Opt-in do facilitador: sala sem a opção = 'up'.
 */
export type RoundingMode = 'up' | 'nearest' | 'down' | 'deck';
export const ROUNDING_MODES: readonly RoundingMode[] = ['up', 'nearest', 'down', 'deck'];

export function resolveRoundingMode(value?: string | null): RoundingMode {
  return (ROUNDING_MODES as readonly string[]).includes(value || '') ? (value as RoundingMode) : 'up';
}

export function roundEstimate(value: number, mode: RoundingMode = 'up', deck?: DeckType): number {
  if (!isFinite(value)) return value;
  switch (mode) {
    case 'nearest':
      return Math.round(value);
    case 'down':
      return Math.floor(value);
    case 'deck': {
      const cards = (deck ? DECKS[deck] : [])
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      if (cards.length === 0) return Math.ceil(value);
      let best = cards[0];
      for (const c of cards) {
        if (Math.abs(c - value) <= Math.abs(best - value)) best = c;
      }
      return best;
    }
    default:
      return Math.ceil(value);
  }
}

export type TopicTimingRow = {
  title: string;
  mins: number;
  /** Pausa descartada ANTES do tópico começar (sala aberta cedo, café, almoço). */
  idleMins: number;
  /** Tópico finalizado como pulado (rodada com skipped=true). */
  skipped?: boolean;
  /** Teve pelo menos um voto registrado — i.e. foi debatido de fato. */
  discussed?: boolean;
};

/**
 * Janela de ociosidade: intervalo entre o fim do tópico anterior (ou o início
 * da sessão) e a primeira atividade real do tópico seguinte. Acima disso o
 * intervalo é considerado pausa e NÃO entra no tempo do tópico.
 *
 * Motivo: o organizador costuma criar a sala e importar os itens de manhã para
 * uma sessão que só acontece à tarde. Como o primeiro item já ficava ativo na
 * importação, o relatório mostrava "item 1: 5h de refinamento". Ancorar no
 * primeiro VOTO do tópico corta esse tempo morto.
 */
export const TOPIC_IDLE_GAP_MS = 15 * 60 * 1000;

/**
 * Tempo real gasto por tópico, derivado dos timestamps das rodadas: pra cada
 * tópico usa a ÚLTIMA rodada (caso houve revotação) como conclusão, e o tempo
 * é o delta entre conclusões consecutivas (a primeira conta a partir do início
 * da sessão). Usado tanto na visão ao vivo (TopicTiming) quanto no relatório
 * exportado — mesma conta nos dois lugares.
 *
 * Pausas longas (> TOPIC_IDLE_GAP_MS) entre o fim de um tópico e a primeira
 * atividade do próximo são descontadas e reportadas em `idleMins`.
 */
export function computeTopicTiming(
  rounds: VotingRound[],
  issues: Issue[],
  sessionStartedAt?: string
): TopicTimingRow[] {
  if (!rounds || rounds.length === 0) return [];

  type Agg = { title: string; end: number; firstActivity: number; startedAt: number | null; skipped: boolean; discussed: boolean };
  const byIssue = new Map<string, Agg>();

  rounds.forEach(r => {
    const key = r.issueId || r.topic;
    const ts = new Date(r.timestamp).getTime();
    if (isNaN(ts)) return;

    const voteTimes = (r.votes || [])
      .map(v => new Date(v.timestamp).getTime())
      .filter(t => !isNaN(t));
    // Primeira atividade real do tópico: primeiro voto da rodada. Rodada sem
    // voto (pulo) cai no próprio timestamp da rodada.
    const firstActivity = voteTimes.length > 0 ? Math.min(...voteTimes) : ts;
    const issue = issues.find(i => i.id === r.issueId);
    const title = issue?.title || r.topic || 'Tópico';
    // Marco explícito de entrada na mesa (só existe depois que a sessão foi
    // iniciada). É o mais fiel: conta o debate que acontece ANTES do primeiro
    // voto — 10 min discutindo antes de alguém votar não somem mais.
    const startedAtMs = issue?.startedAt ? new Date(issue.startedAt).getTime() : NaN;

    const prev = byIssue.get(key);
    if (!prev) {
      byIssue.set(key, {
        title,
        end: ts,
        firstActivity,
        startedAt: isNaN(startedAtMs) ? null : startedAtMs,
        skipped: !!r.skipped,
        discussed: voteTimes.length > 0,
      });
      return;
    }
    prev.firstActivity = Math.min(prev.firstActivity, firstActivity);
    prev.discussed = prev.discussed || voteTimes.length > 0;
    if (ts >= prev.end) {
      prev.end = ts;
      prev.title = title;
      prev.skipped = !!r.skipped;
    }
  });

  const ordered = [...byIssue.values()].sort((a, b) => a.end - b.end);
  const sessionStartMs = sessionStartedAt ? new Date(sessionStartedAt).getTime() : NaN;
  let prevEnd = isNaN(sessionStartMs) ? (ordered[0]?.firstActivity ?? 0) : sessionStartMs;

  return ordered.map(o => {
    let start = prevEnd;
    let idleMs = 0;
    if (o.startedAt !== null && o.startedAt >= prevEnd) {
      // Caminho preferido: marco explícito de entrada na mesa. Nada de heurística.
      idleMs = o.startedAt - prevEnd;
      start = o.startedAt;
    } else if (o.firstActivity - start > TOPIC_IDLE_GAP_MS) {
      // Fallback (sessões antigas, sem `startedAt`): corta pausa longa antes do
      // primeiro voto. Perde o debate pré-voto, mas evita a distorção de horas.
      idleMs = o.firstActivity - start;
      start = o.firstActivity;
    }
    const mins = Math.max(0, Math.round((o.end - start) / 60000));
    prevEnd = Math.max(o.end, start);
    return {
      title: o.title,
      mins,
      idleMins: Math.round(idleMs / 60000),
      skipped: o.skipped,
      discussed: o.discussed,
    };
  });
}

export type SessionBreakdown = {
  /** Itens com estimativa salva. */
  estimated: number;
  /** Itens que tiveram pelo menos uma rodada com votos (debate real). */
  discussed: number;
  /** Itens finalizados como pulados. */
  skipped: number;
  /** Itens cancelados durante o refinamento. */
  cancelled: number;
  /** Itens adiados ao menos uma vez durante a sessão (park). */
  parked: number;
  /** Itens que nunca chegaram à mesa (sessão encerrada com fila pendente). */
  untouched: number;
  total: number;
};

/**
 * Consolidação honesta do que aconteceu na sessão: quantos itens foram de fato
 * debatidos, quantos foram pulados e quantos foram adiados. Antes o relatório
 * contava "tarefas refinadas" = todos os itens não-pulados, o que inflava o
 * número com itens que ninguém discutiu.
 */
export function computeSessionBreakdown(issues: Issue[], rounds: VotingRound[]): SessionBreakdown {
  const issuesWithVotes = new Set<string>();
  (rounds || []).forEach(r => {
    if (r.issueId && (r.votes || []).length > 0) issuesWithVotes.add(r.issueId);
  });

  let estimated = 0, discussed = 0, skipped = 0, cancelled = 0, parked = 0, untouched = 0;
  (issues || []).forEach(i => {
    if (i.cancelled) cancelled++;
    else if (i.skipped) skipped++;
    else if (i.status === 'completed') estimated++;
    else untouched++;

    if (issuesWithVotes.has(i.id)) discussed++;
    if ((i.parkCount || 0) > 0 || i.parked) parked++;
  });

  return { estimated, discussed, skipped, cancelled, parked, untouched, total: (issues || []).length };
}

/**
 * Converte um voto de camiseta (PP/P/M/G/GG) pra horas usando a equivalência
 * configurada pelo facilitador. NaN se o tamanho não tem equivalência definida
 * (vota "?"/"☕", ou facilitador não configurou aquele tamanho) — quem chama
 * já sabe filtrar NaN, igual faz com Number() nos decks numéricos.
 */
export function resolveTshirtHours(
  value: string,
  equivalents?: Partial<Record<string, TshirtEquivalent>>
): number {
  const eq = equivalents?.[value];
  if (!eq || !eq.value) return NaN;
  return eq.value * (TSHIRT_UNIT_HOURS[eq.unit] || 1);
}

/**
 * Mapeia o tipo de issue do Jira para o tipo interno da tarefa. Antes toda
 * issue importada virava 'dev' independentemente do tipo real.
 */
export function mapJiraTypeToIssueType(jiraType?: string): IssueType {
  const t = (jiraType || '').toLowerCase();
  if (t.includes('bug') || t.includes('defect')) return 'qa';
  if (t.includes('design') || /\b(ux|ui)\b/.test(t)) return 'design';
  if (t.includes('story') || t.includes('história') || t.includes('historia') || t.includes('task') || t.includes('tarefa') || t.includes('sub')) return 'dev';
  return 'other';
}

export const MANAGEMENT_ROLES = [
  'Agile Master',
  'Scrum Master',
  'Product Owner',
  'Tech Lead',
  'People Lead',
  'SME',
  'Stakeholder / Observador'
];

export const TECHNICAL_CATEGORIES = [
  'Developer',
  'QA',
  'UX',
  'Designer'
] as const;

export type TechnicalCategory = (typeof TECHNICAL_CATEGORIES)[number];

/**
 * Resolve a categoria técnica funcional de um participante baseado no seu role na sala
 * e no seu GlobalRole do perfil.
 */
export function getParticipantCategory(participant: { role: Role; globalRole?: GlobalRole }): TechnicalCategory | 'Management' | null {
  if (participant.role === 'spectator') return null;

  // 1. Fonte Primária: GlobalRole (Perfil Profissional)
  const gRole = canonicalCargo(participant.globalRole);
  if (gRole) {
    // Exato pelo canônico; o "contém" abaixo só mantém o que já era dito para títulos livres (ex.: "Desenvolvedor Backend").
    if (gRole === CARGO_DEV || gRole.includes('Desenvolvedor')) return 'Developer';
    if (gRole === CARGO_QA || gRole.includes('Analista de QA')) return 'QA';
    if (gRole === 'UX' || gRole.includes('UI-UX')) return 'UX';
    if (gRole === 'Designer') return 'Designer';
    
    // Papéis de Gestão/Observação
    if (MANAGEMENT_ROLES.includes(gRole) || 
        gRole.includes('Master') || 
        gRole.includes('Lead') || 
        gRole.includes('Owner')) {
      return 'Management';
    }
  }

  // 2. Fallback: Role da Sala (Legado ou não preenchido)
  if (participant.role === 'dev') return 'Developer';
  if (participant.role === 'qa') return 'QA';
  if (participant.role === 'organizador') return 'Management';

  return null;
}

// Janela de presença: com heartbeat de 25s, 60s cobre 2 batidas perdidas
// antes de marcar offline (tolerante a lag/aba em background).
export const PRESENCE_STALE_MS = 60_000;

/**
 * Participante é considerado online se bateu heartbeat dentro da janela.
 * Sem lastSeen (docs antigos, antes do heartbeat) => tratado como online para
 * não penalizar salas/participantes anteriores à feature.
 */
export function isParticipantOnline(participant: { lastSeen?: string }, nowMs: number): boolean {
  if (!participant.lastSeen) return true;
  const t = new Date(participant.lastSeen).getTime();
  if (isNaN(t)) return true;
  return nowMs - t <= PRESENCE_STALE_MS;
}

/**
 * Online agora, com a melhor fonte disponível: se o servidor informa quem tem a sala aberta (`socketOnline`,
 * presença do WebSocket), ela manda (a saída aparece em segundos); sem ela (backend antigo, ainda sem snapshot)
 * vale o heartbeat de `lastSeen`, como sempre foi.
 */
export function isParticipantPresent(
  participant: { id: string; lastSeen?: string },
  nowMs: number,
  socketOnline?: ReadonlySet<string> | null,
): boolean {
  if (socketOnline) return socketOnline.has(participant.id);
  return isParticipantOnline(participant, nowMs);
}

/**
 * Revelação automática: só existe com `autoReveal` ligado de propósito (=== true; sala sem a opção,
 * antiga ou nova, nunca revela sozinha) e só no cliente do facilitador. Revela quando todos os
 * votantes elegíveis ONLINE já votaram na tarefa ativa; quem está offline não trava a rodada.
 * Observadores (cargo que não vota nesta sala, sem cargo, espectador) não entram na conta.
 */
export function shouldAutoReveal(input: {
  settings?: VotingSettings & { autoReveal?: boolean } | null;
  isFacilitator: boolean;
  votesRevealed?: boolean;
  activeIssueId?: string | null;
  participants: readonly Participant[];
  onlineIds: ReadonlySet<string>;
  votes: readonly Pick<Vote, 'participantId' | 'issueId'>[];
}): boolean {
  const { settings, isFacilitator, votesRevealed, activeIssueId, participants, onlineIds, votes } = input;
  if (settings?.autoReveal !== true || !isFacilitator) return false;
  if (votesRevealed || !activeIssueId) return false;
  if (votes.length === 0) return false;
  const cargos = votingCargosOf(settings);
  const eligible = participants.filter((p) => canParticipantVote(p, cargos) && onlineIds.has(p.id));
  if (eligible.length === 0) return false;
  const votedIds = new Set(votes.filter((v) => !v.issueId || v.issueId === activeIssueId).map((v) => v.participantId));
  return eligible.every((p) => votedIds.has(p.id));
}

/**
 * Cargos que votam por padrão numa sala: só desenvolvimento e QA. Os demais entram como observadores
 * (o facilitador escolhe outros em "Quem vota").
 */
export const DEFAULT_VOTING_CARGOS: readonly GlobalRole[] = [CARGO_DEV, CARGO_QA];

/**
 * Cargos oferecidos em "Quem vota": a mesma lista de cargos da administração (ROLES), menos
 * "Stakeholder / Observador" — esse cargo entra na sala sempre como espectador, então marcá-lo não teria efeito.
 */
export const VOTING_CARGO_OPTIONS: readonly GlobalRole[] = ROLES.filter((r) => r !== 'Stakeholder / Observador');

/** Cargos que `getParticipantCategory` trata como gestão (usado só para ler salas antigas com "Gestão pode votar"). */
const LEGACY_MANAGEMENT_CARGOS: readonly GlobalRole[] = ROLES.filter(
  (r) => getParticipantCategory({ role: 'dev', globalRole: r }) === 'Management'
);

export type VotingSettings = {
  /** Cargos que votam nesta sala. Ausente = padrão (dev e QA). */
  votingCargos?: readonly string[] | null;
  /** Antigo "Gestão pode votar": só é lido em salas criadas antes de `votingCargos`; a interface não grava mais. */
  allowManagementToVote?: boolean;
};

const normalizeCargo = (c?: string | null) => canonicalCargo(c).toLowerCase();

/**
 * Política de voto da sala: a lista de cargos que votam. Sala com `votingCargos` usa a lista (vazia é tratada como
 * ausente, para a sala nunca ficar sem votantes); sala antiga usa o padrão e, se tinha "Gestão pode votar" ligado,
 * soma os cargos de gestão — o comportamento delas não muda.
 */
export function votingCargosOf(settings?: VotingSettings | null): readonly string[] {
  const own = settings?.votingCargos;
  if (Array.isArray(own) && own.length > 0) {
    // Salas antigas guardam as grafias de antes ("Developer", "QA"): cada entrada vira o cargo canônico.
    const canonical = [...new Set(own.map((c) => canonicalCargo(c)).filter(Boolean))];
    if (canonical.length > 0) return canonical;
  }
  return settings?.allowManagementToVote === true
    ? [...DEFAULT_VOTING_CARGOS, ...LEGACY_MANAGEMENT_CARGOS]
    : DEFAULT_VOTING_CARGOS;
}

/** O cargo está na lista de quem vota? (sem diferenciar maiúsculas/minúsculas; sem cargo nunca está) */
export function isVotingCargo(cargo: string | null | undefined, votingCargos: readonly string[] = DEFAULT_VOTING_CARGOS): boolean {
  const c = normalizeCargo(cargo);
  return !!c && votingCargos.some((v) => normalizeCargo(v) === c);
}

/**
 * Fonte única de verdade para "este participante pode votar?".
 * Vota quem tem cargo (o da administração, gravado em `globalRole`) dentro dos cargos que votam na sala e não está
 * marcado como espectador. Todos os demais — inclusive quem está sem cargo — são observadores: veem a mesa, não
 * recebem baralho e não entram no "x de y votaram", na revelação automática nem nas estatísticas.
 * Usado pelo gate do Controls, pelo denominador de progresso, pela mesa, pelas estatísticas etc.
 */
export function canParticipantVote(
  participant: { role: Role; globalRole?: GlobalRole },
  votingCargos: readonly string[] = DEFAULT_VOTING_CARGOS
): boolean {
  if (participant.role === 'spectator') return false;
  return isVotingCargo(participant.globalRole, votingCargos);
}

/** Por que alguém só observa: sem cargo na administração ou cargo que não vota nesta sala (dica da mesa e da lista). */
export function observerHintOf(participant: { globalRole?: string | null }): string {
  return participant.globalRole?.trim() ? 'cargo não vota nesta sala' : 'sem cargo na administração';
}

/**
 * Votos que contam para as métricas de resultado (consenso, média, piso, teto): só os de quem vota nesta sala
 * (`canParticipantVote`). Observador e espectador nunca contam. Usa a identidade viva do participante e, se ele já
 * saiu, o fallback congelado no próprio voto ("votos são fatos").
 */
export function getEligibleStatsVotes(
  votes: Vote[],
  participants: Participant[],
  votingCargos: readonly string[] = DEFAULT_VOTING_CARGOS
): Vote[] {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  return votes.filter(vote => {
    const p = participantMap.get(vote.participantId);
    const identity = p
      ? p
      : (vote.participantRole ? { role: vote.participantRole, globalRole: vote.participantGlobalRole } : null);
    return !!identity && canParticipantVote(identity, votingCargos);
  });
}

/**
 * Calcula as médias por categoria técnica para uma rodada de votos.
 */
export function calculateRoleEfforts(
  votes: Vote[],
  participants: Participant[],
  deck: DeckType,
  tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>,
  rounding: RoundingMode = 'up'
) {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const categoryVotes: Record<string, number[]> = {};

  votes.forEach(vote => {
    // 1. Tentar encontrar o participante atual na sala
    const p = participantMap.get(vote.participantId);
    
    // 2. Se não encontrar (participante removido), usar os metadados embutidos no voto como fallback
    let category: TechnicalCategory | 'Management' | null = null;
    
    if (p) {
      category = getParticipantCategory(p);
    } else if (vote.participantRole) {
      // Fallback para "votos são fatos"
      category = getParticipantCategory({ 
        role: vote.participantRole, 
        globalRole: vote.participantGlobalRole 
      });
    }

    if (!category || category === 'Management') return;

    if (!categoryVotes[category]) {
      categoryVotes[category] = [];
    }

    const val = deck === 'tshirt' ? resolveTshirtHours(vote.value, tshirtEquivalents) : Number(vote.value);
    if (!isNaN(val)) {
      categoryVotes[category].push(val);
    }
  });

  const rolePoints: Record<string, string> = {};
  let totalSum = 0;

  Object.entries(categoryVotes).forEach(([category, values]) => {
    if (values.length > 0) {
      const avg = roundEstimate(values.reduce((a, b) => a + b, 0) / values.length, rounding, deck);
      rolePoints[category] = String(avg);
      totalSum += avg;
    }
  });

  return {
    rolePoints,
    totalPoints: String(totalSum),
    // Auxiliares para legado
    devPoints: rolePoints['Developer'] || '0',
    qaPoints: rolePoints['QA'] || '0'
  };
}

/**
 * Verifica se houve consenso em uma categoria específica ou geral.
 */
export function checkConsensus(votes: Vote[]) {
  if (votes.length <= 1) return false;
  const values = new Set(votes.map(v => v.value));
  return values.size === 1;
}

/**
 * Rótulo curto do valor final de um item para a história de referência
 * (baseline). Sufixo por deck: SP (fibonacci), h (horas), tamanho puro (tshirt).
 */
export function formatBaselineDisplay(points: string, deck: DeckType): string {
  const v = (points || '').trim();
  if (!v) return '—';
  if (deck === 'hours') return `${v}h`;
  if (deck === 'tshirt') return v;
  return `${v} SP`;
}

/**
 * Texto de "Copiar estimativa" para colar na issue pai do Jira, por papel:
 * "(DEV 10h / QA 4h / UX 2h)". Papéis na ordem canônica (DEV, QA, UX, Designer,
 * depois os demais, na ordem recebida); valores vazios ou "N/A" ficam de fora e
 * `skipZero` também descarta "0". Devolve '' se não sobrar nenhum papel.
 * Fonte única: o card de resultados da rodada e o relatório da fila usam esta função.
 */
export function formatEstimateCopy(
  entries: ReadonlyArray<{ role: string; value: string | null | undefined }>,
  suffix = 'h',
  options: { skipZero?: boolean } = {}
): string {
  const order = (r: string) => {
    const i = (TECHNICAL_CATEGORIES as readonly string[]).indexOf(r);
    return i === -1 ? TECHNICAL_CATEGORIES.length : i;
  };
  const parts = entries
    .map((e, idx) => ({ ...e, idx }))
    .filter(e => e.value && e.value !== 'N/A' && !(options.skipZero && Number(e.value) === 0))
    .sort((a, b) => order(a.role) - order(b.role) || a.idx - b.idx)
    .map(e => `${formatRoleForCopy(e.role)} ${e.value}${suffix}`);
  return parts.length > 0 ? `(${parts.join(' / ')})` : '';
}

/**
 * Formata o nome do papel para exibição resumida em cópias (Jira).
 */
export function formatRoleForCopy(role: string): string {
  const r = role.toLowerCase();
  if (r === 'developer') return 'DEV';
  if (r === 'qa') return 'QA';
  if (r === 'ux') return 'UX';
  if (r === 'designer') return 'DESIGNER';
  return role.toUpperCase();
}
