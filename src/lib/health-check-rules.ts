/**
 * Regras do Radar de clima, sem React e sem rede. UMA regra de "em atenção" para a tela, o resultado, o CSV,
 * o PDF e o plano de ação (antes cada um tinha a sua e o plano discordava da lista de "Faróis de Atenção").
 *
 * Nota de clima, de 0 a 10: (média − 1) ÷ (máximo − 1) × 10, em que a média é a dos votos (semáforo e
 * emocional: 1 a 3; escala numérica: 1 a 5) e o máximo é o da escala. A pior resposta vale 0 e a melhor, 10,
 * nas três escalas (antes o menor valor possível era 3,3 no semáforo e 2,0 na escala de 1 a 5).
 *
 * Situação de cada dimensão:
 * - crítica: 30% ou mais dos votos no pior valor, OU nota abaixo de 4;
 * - alerta: nota abaixo de 6;
 * - forte: nota de 7,5 ou mais;
 * - as demais ficam "no caminho".
 *
 * O servidor calcula o resumo ao encerrar (`HealthCheckService.buildSummary`) com limites antigos (média 2,5 e
 * 1,8). Aqui o cálculo parte das CONTAGENS por valor que o servidor grava, não da média dele. Quando o backend
 * ganhar a regra equivalente, troca-se só a fonte (`summarizeResults` continua igual).
 */
import type { HealthCheckDimension, HealthCheckScaleType, HealthCheckVote, HealthCheckVoteValue } from './types';

export type HealthTone = 'good' | 'mid' | 'bad';

export interface ScaleOption {
  value: HealthCheckVoteValue;
  /** Texto do botão e da legenda. */
  label: string;
  /** Nota do voto na escala do servidor (1 a 3, ou 1 a 5). */
  score: number;
  tone: HealthTone;
}

const TRAFFIC: ScaleOption[] = [
  { value: 'green', label: 'Ótimo', score: 3, tone: 'good' },
  { value: 'yellow', label: 'Atenção', score: 2, tone: 'mid' },
  { value: 'red', label: 'Ruim', score: 1, tone: 'bad' },
];
const MOOD: ScaleOption[] = [
  { value: 'happy', label: 'Bom', score: 3, tone: 'good' },
  { value: 'neutral', label: 'Médio', score: 2, tone: 'mid' },
  { value: 'sad', label: 'Ruim', score: 1, tone: 'bad' },
];
const NUMBERS: ScaleOption[] = [
  { value: '5', label: '5', score: 5, tone: 'good' },
  { value: '4', label: '4', score: 4, tone: 'good' },
  { value: '3', label: '3', score: 3, tone: 'mid' },
  { value: '2', label: '2', score: 2, tone: 'bad' },
  { value: '1', label: '1', score: 1, tone: 'bad' },
];

/** Opções da melhor para a pior resposta. */
export function scaleOptions(scale: HealthCheckScaleType | undefined): ScaleOption[] {
  return scale === 'numbers_5' ? NUMBERS : scale === 'emojis' ? MOOD : TRAFFIC;
}

export const SCALE_LABELS: Record<HealthCheckScaleType, string> = {
  traffic_light: 'Semáforo',
  numbers_5: 'Numérica de 1 a 5',
  emojis: 'Emocional',
};

export function scaleLabel(scale: HealthCheckScaleType | undefined): string {
  return SCALE_LABELS[scale ?? 'traffic_light'] ?? SCALE_LABELS.traffic_light;
}

/** Maior nota possível da escala. */
export function scaleMax(scale: HealthCheckScaleType | undefined): number {
  return scale === 'numbers_5' ? 5 : 3;
}

/** O pior valor da escala (a regra de "crítico" olha a fatia de votos nele). */
export function worstValue(scale: HealthCheckScaleType | undefined): HealthCheckVoteValue {
  return scale === 'numbers_5' ? '1' : scale === 'emojis' ? 'sad' : 'red';
}

const VALUE_SCORE: Record<string, number> = {
  green: 3, yellow: 2, red: 1, happy: 3, neutral: 2, sad: 1, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
};

/** Nota do voto (como o servidor): 0 para valor desconhecido. */
export function valueScore(value: string): number {
  return VALUE_SCORE[value] ?? 0;
}

/** Média de votos (1 a máx.) -> nota de 0 a 10. Fora do intervalo, limita. */
export function normalizeScore(average: number, scale: HealthCheckScaleType | undefined): number {
  const max = scaleMax(scale);
  const n = ((average - 1) / (max - 1)) * 10;
  return Math.min(10, Math.max(0, n));
}

export const CRITICAL_WORST_SHARE = 0.3;
export const CRITICAL_BELOW = 4;
export const ALERT_BELOW = 6;
export const STRONG_FROM = 7.5;

export type AttentionLevel = 'critical' | 'alert' | 'ok' | 'strong' | 'empty';

export const LEVEL_LABELS: Record<AttentionLevel, string> = {
  critical: 'Crítico',
  alert: 'Alerta',
  ok: 'No caminho',
  strong: 'Forte',
  empty: 'Sem respostas',
};

/** Situação da dimensão pela regra única. */
export function attentionLevel(score: number | null, worstShare: number): AttentionLevel {
  if (score === null) return 'empty';
  if (worstShare >= CRITICAL_WORST_SHARE || score < CRITICAL_BELOW) return 'critical';
  if (score < ALERT_BELOW) return 'alert';
  if (score >= STRONG_FROM) return 'strong';
  return 'ok';
}

export interface DimensionStat {
  key: string;
  title: string;
  description: string;
  /** Contagem por valor da escala (todos os valores, inclusive os zerados). */
  counts: { option: ScaleOption; count: number }[];
  total: number;
  /** Média na escala do servidor (1 a 3, ou 1 a 5); `null` sem votos. */
  average: number | null;
  /** Nota de 0 a 10; `null` sem votos. */
  score: number | null;
  worstCount: number;
  worstShare: number;
  level: AttentionLevel;
}

/** Contagens por valor, como o servidor grava (`{ green: 6, red: 1 }`). */
export type VoteCounts = Record<string, number>;

export function dimensionStat(
  dimension: Pick<HealthCheckDimension, 'key' | 'title'> & { description?: string },
  values: VoteCounts | undefined,
  scale: HealthCheckScaleType | undefined,
): DimensionStat {
  const options = scaleOptions(scale);
  const counts = options.map((option) => ({ option, count: Math.max(0, Math.floor(Number(values?.[option.value]) || 0)) }));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const sumScore = counts.reduce((sum, c) => sum + c.count * c.option.score, 0);
  const average = total > 0 ? sumScore / total : null;
  const score = average === null ? null : normalizeScore(average, scale);
  const worst = worstValue(scale);
  const worstCount = counts.find((c) => c.option.value === worst)?.count ?? 0;
  const worstShare = total > 0 ? worstCount / total : 0;
  return {
    key: dimension.key,
    title: dimension.title,
    description: dimension.description ?? '',
    counts,
    total,
    average,
    score,
    worstCount,
    worstShare,
    level: attentionLevel(score, worstShare),
  };
}

export type ClimateBand = 'strong' | 'on_track' | 'attention';

export const BAND_LABELS: Record<ClimateBand, string> = {
  strong: 'Forte',
  on_track: 'No caminho',
  attention: 'Em atenção',
};

/** Faixa da nota geral: 7,5 ou mais é forte; de 5 a 7,5 está no caminho; abaixo de 5 pede atenção. */
export function climateBand(score: number): ClimateBand {
  if (score >= STRONG_FROM) return 'strong';
  if (score >= 5) return 'on_track';
  return 'attention';
}

/** Nota com uma casa e vírgula: 7,4. */
export function formatScore(score: number | null | undefined, digits = 1): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return '—';
  return score.toFixed(digits).replace('.', ',');
}

/** Um resultado de dimensão como o servidor grava no resumo. */
export interface ResultRow {
  dimensionKey: string;
  values: VoteCounts;
  average?: number;
}

/** Contagens por dimensão a partir dos votos (caso o resumo do servidor não exista). */
export function resultsFromVotes(dimensions: readonly Pick<HealthCheckDimension, 'key'>[], votes: readonly Pick<HealthCheckVote, 'dimensionKey' | 'value'>[]): ResultRow[] {
  return dimensions.map((d) => {
    const values: VoteCounts = {};
    for (const v of votes) {
      if (v.dimensionKey === d.key) values[v.value] = (values[v.value] ?? 0) + 1;
    }
    return { dimensionKey: d.key, values };
  });
}

const LEVEL_RANK: Record<AttentionLevel, number> = { critical: 0, alert: 1, ok: 2, strong: 3, empty: 4 };

export interface HealthSummary {
  stats: DimensionStat[];
  /** Nota de clima (média das notas das dimensões com respostas); `null` sem nenhuma resposta. */
  climate: number | null;
  band: ClimateBand | null;
  strong: DimensionStat[];
  /** Críticas primeiro, depois alertas; cada grupo da pior nota para a melhor. */
  attention: DimensionStat[];
  /** A dimensão que mais pede atenção, se houver. */
  focus: DimensionStat | null;
  totalVotes: number;
  /** Menor e maior contagem de respostas por dimensão (quantas pessoas responderam, no mínimo e no máximo). */
  respondents: { min: number; max: number };
}

export function summarizeResults(
  dimensions: readonly HealthCheckDimension[],
  results: readonly ResultRow[] | undefined,
  scale: HealthCheckScaleType | undefined,
): HealthSummary {
  const byKey = new Map((results ?? []).map((r) => [r.dimensionKey, r]));
  const stats = dimensions.map((d) => dimensionStat(d, byKey.get(d.key)?.values, scale));
  const answered = stats.filter((s) => s.score !== null);
  const climate = answered.length > 0 ? answered.reduce((sum, s) => sum + (s.score as number), 0) / answered.length : null;
  const attention = stats
    .filter((s) => s.level === 'critical' || s.level === 'alert')
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || (a.score as number) - (b.score as number));
  const strong = stats.filter((s) => s.level === 'strong').sort((a, b) => (b.score as number) - (a.score as number));
  const totals = stats.map((s) => s.total);
  return {
    stats,
    climate,
    band: climate === null ? null : climateBand(climate),
    strong,
    attention,
    focus: attention[0] ?? null,
    totalVotes: totals.reduce((a, b) => a + b, 0),
    respondents: { min: totals.length ? Math.min(...totals) : 0, max: totals.length ? Math.max(...totals) : 0 },
  };
}

/** "3 de 10 votos ruins" (ou "1 de 10 voto ruim"): o que sustenta o alerta. */
export function worstVotesText(stat: Pick<DimensionStat, 'worstCount' | 'total'>): string {
  const { worstCount, total } = stat;
  if (total === 0) return 'sem votos';
  return `${worstCount} de ${total} ${worstCount === 1 ? 'voto ruim' : 'votos ruins'}`;
}

/** Frase do topo do resultado, que muda com a nota e com o que está em atenção. */
export function headline(summary: Pick<HealthSummary, 'band' | 'focus' | 'climate'>): string {
  const { band, focus } = summary;
  if (band === null) return 'Ainda não há respostas para calcular o clima.';
  const mood = band === 'strong' ? 'O clima está forte' : band === 'on_track' ? 'O clima está bom' : 'O clima pede atenção';
  if (!focus) return `${mood} e nenhuma dimensão pede atenção.`;
  if (band === 'attention') return `${mood}, começando por ${focus.title}.`;
  return `${mood}, e ${focus.title} é o ponto que mais pede atenção.`;
}

/** Frase da "Sugestão de foco". */
export function focusSentence(focus: Pick<DimensionStat, 'title'> | null): string {
  return focus
    ? `Para a próxima sprint, escolha uma ação simples para ${focus.title} e combine um prazo com a squad.`
    : 'Nenhuma dimensão pede atenção agora. Mantenha o que está funcionando e compare com o próximo radar.';
}

// ───────────────────────── Plano de ação ─────────────────────────

export interface PlanItem {
  key: string;
  title: string;
  level: Extract<AttentionLevel, 'critical' | 'alert' | 'ok'>;
  /** Pré-selecionado (os dois mais urgentes). */
  suggested: boolean;
  what: string;
  why: string;
  /** Prioridade no Kanban pessoal. */
  priority: 'critica' | 'media';
}

export const PLAN_SUGGESTED = 2;

/**
 * Itens propostos para o plano: as dimensões em atenção (regra única), críticas primeiro. Os dois primeiros
 * vêm marcados; as demais em atenção e as que só têm algum voto ruim ficam como opcionais.
 */
export function planItems(summary: Pick<HealthSummary, 'stats' | 'attention'>, radarTitle: string): PlanItem[] {
  const toItem = (s: DimensionStat, index: number): PlanItem => ({
    key: s.key,
    title: s.title,
    level: s.level === 'critical' ? 'critical' : s.level === 'alert' ? 'alert' : 'ok',
    suggested: index < PLAN_SUGGESTED,
    what: `Melhorar: ${s.title}`,
    why: `${radarTitle}: ${worstVotesText(s)}, nota ${formatScore(s.score)}.`,
    priority: s.level === 'critical' ? 'critica' : 'media',
  });
  const attentionKeys = new Set(summary.attention.map((s) => s.key));
  const optional = summary.stats.filter((s) => !attentionKeys.has(s.key) && s.worstCount > 0);
  return [...summary.attention.map(toItem), ...optional.map((s, i) => ({ ...toItem(s, summary.attention.length + i), suggested: false }))];
}

// ───────────────────────── Agrupamento para a barra de frequência ─────────────────────────

export interface ToneGroup {
  tone: HealthTone;
  /** Legenda do grupo: "Ótimo", "Bom", "4 a 5"... */
  label: string;
  count: number;
}

const GROUP_LABELS: Record<HealthCheckScaleType, Record<HealthTone, string>> = {
  traffic_light: { good: 'Ótimo', mid: 'Atenção', bad: 'Ruim' },
  emojis: { good: 'Bom', mid: 'Médio', bad: 'Ruim' },
  numbers_5: { good: '4 a 5', mid: '3', bad: '1 a 2' },
};

/** Legenda dos três grupos da escala (melhor, meio, pior). */
export function groupLabels(scale: HealthCheckScaleType | undefined): Record<HealthTone, string> {
  return GROUP_LABELS[scale ?? 'traffic_light'];
}

/**
 * Votos agrupados em melhor, meio e pior, na ordem da barra empilhada. Semáforo e emocional têm um valor por
 * grupo; a escala de 1 a 5 junta 4–5, 3 e 1–2.
 */
export function toneGroups(stat: Pick<DimensionStat, 'counts'>, scale: HealthCheckScaleType | undefined): ToneGroup[] {
  const labels = groupLabels(scale);
  return (['good', 'mid', 'bad'] as const).map((tone) => ({
    tone,
    label: labels[tone],
    count: stat.counts.filter((c) => c.option.tone === tone).reduce((sum, c) => sum + c.count, 0),
  }));
}
