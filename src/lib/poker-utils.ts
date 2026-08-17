import { Participant, Vote, DeckType, Role, GlobalRole, IssueType, TshirtEquivalent, TSHIRT_UNIT_HOURS, VotingRound, Issue } from './types';

/**
 * Configurações que uma sala NOVA já nasce com ligadas. Antes tudo nascia
 * desligado e a sala só rendia dado/opção se o facilitador lembrasse de
 * garimpar os toggles — na prática, quase ninguém ligava.
 *
 * Só entram aqui recursos que acrescentam informação ou uma ação a mais.
 * Automação (auto-revelar, auto-consenso) e mudança de regra (voto da gestão,
 * revelação anônima) continuam fora: essas precisam de decisão explícita.
 *
 * Vale apenas na criação — salas já existentes não são tocadas.
 */
export const DEFAULT_ROOM_SETTINGS = {
  // Dados e visão
  perTopicTime: true,
  showDistribution: true,
  showVelocity: true,
  decisionNotes: true,
  refinementNotes: true,
  // Opções do facilitador
  parkTask: true,
  referenceStory: true,
  roundNudge: true,
  suggestRevote: true,
  // Ritual de votação
  confidenceVote: true,
  outlierPrompt: true,
} as const;

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

  let estimated = 0, discussed = 0, skipped = 0, parked = 0, untouched = 0;
  (issues || []).forEach(i => {
    if (i.skipped) skipped++;
    else if (i.status === 'completed') estimated++;
    else untouched++;

    if (issuesWithVotes.has(i.id)) discussed++;
    if ((i.parkCount || 0) > 0 || i.parked) parked++;
  });

  return { estimated, discussed, skipped, parked, untouched, total: (issues || []).length };
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
  if (t.includes('design') || t.includes('ux') || t.includes('ui')) return 'design';
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
  const gRole = participant.globalRole;
  if (gRole) {
    if (gRole === 'Developer' || gRole.includes('Desenvolvedor')) return 'Developer';
    if (gRole === 'QA' || gRole.includes('Analista de QA')) return 'QA';
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
 * Fonte única de verdade para "este participante pode votar?".
 * Espectador nunca vota; gestão só vota se o facilitador liberar.
 * Usado tanto pelo gate do Controls quanto pelo denominador de progresso,
 * evitando as duas listas de MANAGEMENT_ROLES divergentes de antes.
 */
export function canParticipantVote(
  participant: { role: Role; globalRole?: GlobalRole },
  allowManagementToVote = false
): boolean {
  if (participant.role === 'spectator') return false;
  if (getParticipantCategory(participant) === 'Management') return allowManagementToVote;
  return true;
}

/**
 * Votos que contam para as métricas de resultado (consenso, média, piso, teto).
 * Mantém só categorias técnicas — exclui gestão (Management) e espectadores
 * (categoria null). Alinha o card de resumo do Results e o stats persistido
 * em handleReveal com o detalhamento por papel e com calculateRoleEfforts,
 * que já ignoram gestão. Usa a identidade viva do participante e, se ele já
 * saiu, o fallback congelado no próprio voto ("votos são fatos").
 */
export function getEligibleStatsVotes(
  votes: Vote[],
  participants: Participant[],
  allowManagementToVote = false
): Vote[] {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  return votes.filter(vote => {
    const p = participantMap.get(vote.participantId);
    const category = p
      ? getParticipantCategory(p)
      : (vote.participantRole
          ? getParticipantCategory({ role: vote.participantRole, globalRole: vote.participantGlobalRole })
          : null);
    if (category === null) return false;               // espectador nunca conta
    if (category === 'Management') return allowManagementToVote; // gestão só quando liberada
    return true;
  });
}

/**
 * Calcula as médias por categoria técnica para uma rodada de votos.
 */
export function calculateRoleEfforts(
  votes: Vote[],
  participants: Participant[],
  deck: DeckType,
  tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>
) {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const categoryVotes: Record<string, number[]> = {};

  votes.forEach(vote => {
    // 1. Tentar encontrar o participante atual na sala
    let p = participantMap.get(vote.participantId);
    
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
      const avg = Math.ceil(values.reduce((a, b) => a + b, 0) / values.length);
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
