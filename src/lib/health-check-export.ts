/**
 * Relatório do Radar de clima: um modelo só (`buildReport`) alimenta o Markdown, o CSV e o PDF, para os três
 * dizerem a mesma coisa (antes só o semáforo era contado, e o PDF lia campos que o servidor não envia).
 * Sem React e sem rede.
 */
import { format } from 'date-fns';
import type { HealthCheckBoard, HealthCheckDimension, HealthCheckScaleType, HealthCheckVote } from './types';
import {
  BAND_LABELS,
  LEVEL_LABELS,
  formatScore,
  resultsFromVotes,
  scaleLabel,
  scaleMax,
  summarizeResults,
  worstVotesText,
  type AttentionLevel,
  type HealthTone,
  type ResultRow,
} from './health-check-rules';

export interface ReportDimension {
  key: string;
  title: string;
  /** Rótulo e contagem de cada valor da escala, da melhor para a pior resposta. */
  counts: { value: string; label: string; count: number; tone: HealthTone }[];
  total: number;
  average: number | null;
  score: number | null;
  level: AttentionLevel;
  levelLabel: string;
  worstText: string;
  /** Comentários anônimos (sem texto vazio). */
  comments: string[];
}

export interface HealthReport {
  title: string;
  squad: string;
  scale: HealthCheckScaleType;
  scaleLabel: string;
  scaleMax: number;
  /** Data do relatório (dd/MM/yyyy). */
  date: string;
  isoDate: string;
  climate: number | null;
  bandLabel: string;
  totalVotes: number;
  respondents: { min: number; max: number };
  dimensions: ReportDimension[];
  strong: string[];
  attention: { title: string; level: AttentionLevel; text: string }[];
}

export interface ReportInput {
  board: Pick<HealthCheckBoard, 'sprintName' | 'team' | 'scaleType' | 'summary'>;
  dimensions: readonly HealthCheckDimension[];
  votes: readonly HealthCheckVote[];
  /** Nome da squad para mostrar (o radar guarda a chave). */
  squadName?: string;
  now?: Date;
}

/** Rótulo do valor nos cabeçalhos de tabela: "Ótimo", "Atenção", "Ruim" ou "Nota 5". */
function columnLabel(scale: HealthCheckScaleType, label: string): string {
  return scale === 'numbers_5' ? `Nota ${label}` : label;
}

export function buildReport({ board, dimensions, votes, squadName, now = new Date() }: ReportInput): HealthReport {
  const scale = board.scaleType ?? 'traffic_light';
  const results: ResultRow[] = board.summary?.results ?? resultsFromVotes(dimensions, votes);
  const summary = summarizeResults(dimensions, results, scale);
  const rows: ReportDimension[] = summary.stats.map((s) => ({
    key: s.key,
    title: s.title,
    counts: s.counts.map((c) => ({ value: c.option.value, label: columnLabel(scale, c.option.label), count: c.count, tone: c.option.tone })),
    total: s.total,
    average: s.average,
    score: s.score,
    level: s.level,
    levelLabel: LEVEL_LABELS[s.level],
    worstText: worstVotesText(s),
    comments: votes.filter((v) => v.dimensionKey === s.key && !!v.comment && v.comment.trim() !== '').map((v) => (v.comment as string).trim()),
  }));
  return {
    title: board.sprintName?.trim() || 'Radar de clima',
    squad: squadName || board.team || '',
    scale,
    scaleLabel: scaleLabel(scale),
    scaleMax: scaleMax(scale),
    date: format(now, 'dd/MM/yyyy'),
    isoDate: format(now, 'yyyy-MM-dd'),
    climate: summary.climate,
    bandLabel: summary.band ? BAND_LABELS[summary.band] : '',
    totalVotes: summary.totalVotes,
    respondents: summary.respondents,
    dimensions: rows,
    strong: summary.strong.map((s) => s.title),
    attention: summary.attention.map((s) => ({ title: s.title, level: s.level, text: `${worstVotesText(s)}, nota ${formatScore(s.score)}` })),
  };
}

/** "10 respostas por dimensão" ou "8 a 10 respostas por dimensão". */
export function respondentsText(r: { min: number; max: number }): string {
  if (r.max === 0) return 'Nenhuma resposta';
  const n = r.min === r.max ? `${r.max}` : `${r.min} a ${r.max}`;
  return `${n} ${r.max === 1 && r.min === r.max ? 'resposta' : 'respostas'} por dimensão`;
}

const mdCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function buildMarkdown(r: HealthReport): string {
  const labels = r.dimensions[0]?.counts.map((c) => c.label) ?? [];
  const lines: string[] = [];
  lines.push(`# Radar de clima: ${r.title}`);
  lines.push('');
  lines.push(`**Squad:** ${r.squad || '—'} · **Escala:** ${r.scaleLabel} · **Data:** ${r.date}`);
  lines.push(`**Nota de clima:** ${formatScore(r.climate)} de 10${r.bandLabel ? ` (${r.bandLabel})` : ''} · ${r.totalVotes} ${r.totalVotes === 1 ? 'voto' : 'votos'} · ${r.dimensions.length} ${r.dimensions.length === 1 ? 'dimensão' : 'dimensões'} · ${respondentsText(r.respondents)}`);
  lines.push('');
  lines.push(`| Dimensão | ${[...labels, 'Nota', 'Situação'].join(' | ')} |`);
  lines.push(`|${'---|'.repeat(labels.length + 3)}`);
  for (const d of r.dimensions) {
    lines.push(`| ${mdCell(d.title)} | ${[...d.counts.map((c) => String(c.count)), formatScore(d.score), d.levelLabel].join(' | ')} |`);
  }
  lines.push('');
  lines.push('**Pontos fortes (nota de 7,5 ou mais):**');
  lines.push(...(r.strong.length ? r.strong.map((t) => `- ${t}`) : ['- Nenhum ponto forte destacado.']));
  lines.push('');
  lines.push('**Em atenção (requer ação):**');
  lines.push(...(r.attention.length ? r.attention.map((a) => `- ${a.title} (${LEVEL_LABELS[a.level].toLowerCase()}): ${a.text}`) : ['- Nenhuma dimensão em atenção.']));
  const withComments = r.dimensions.filter((d) => d.comments.length > 0);
  if (withComments.length > 0) {
    lines.push('');
    lines.push('**Comentários anônimos:**');
    for (const d of withComments) {
      lines.push(`- ${d.title}`);
      for (const c of d.comments) lines.push(`  - ${c.replace(/\r?\n/g, ' ')}`);
    }
  }
  return lines.join('\n').trim();
}

/** Marca de ordem de bytes (UTF-8): o Excel reconhece os acentos. */
const BOM = String.fromCharCode(0xfeff);

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/** CSV com BOM (o Excel abre os acentos certos): uma coluna por valor da escala, votos, média, nota e situação. */
export function buildCsv(r: HealthReport): string {
  const labels = r.dimensions[0]?.counts.map((c) => c.label) ?? [];
  const header = ['Data', 'Radar', 'Squad', 'Dimensão', ...labels, 'Votos', `Média (1 a ${r.scaleMax})`, 'Nota de clima (0 a 10)', 'Situação'];
  const rows = r.dimensions.map((d) =>
    [
      r.date,
      r.title,
      r.squad,
      d.title,
      ...d.counts.map((c) => c.count),
      d.total,
      d.average === null ? '' : formatScore(d.average, 2),
      d.score === null ? '' : formatScore(d.score),
      d.levelLabel,
    ].map(csvCell).join(',')
  );
  return BOM + [header.map(csvCell).join(','), ...rows].join('\n');
}

/** Nome de arquivo seguro: `radar-<titulo>-<yyyy-mm-dd>.<ext>`. */
export function exportFileName(title: string, ext: string, isoDate: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `radar-${slug || 'clima'}-${isoDate}.${ext}`;
}

/** Convite em texto (compartilhar): o que é, quantas perguntas e o link. Editável na janela. */
export function buildInviteText({ title, squad, dimensionCount, url }: { title: string; squad: string; dimensionCount: number; url: string }): string {
  const questions = `${dimensionCount} ${dimensionCount === 1 ? 'pergunta' : 'perguntas'}`;
  return `Radar de clima: ${title}${squad ? ` da squad ${squad}` : ''}. Responda quando puder: são ${questions} e as respostas são anônimas. Link: ${url}`;
}
