/**
 * Textos de exportação da Review (log em Markdown, tabela de aprovações e lista de links das issues).
 * Puros: o resumo e o diálogo de exportação só escolhem e entregam o arquivo.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ShowcaseSession, ShowcaseTask } from './types';
import { DECISION } from './types';
import { getEvidenceUrls } from './utils';

/** Nome de arquivo seguro: sem acento, barra ou dois-pontos. */
export const fileSlug = (name: string, fallback: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

/** Célula de tabela markdown: "|" e quebra de linha quebrariam a tabela. */
export const mdCell = (value?: string) => (value || '—').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/** "17/10 às 10:42"; vazio se a data não existir ou for inválida. */
export const decidedWhen = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
};

/** "Projeto: x | Suporte: y | Master: z..." só com o que existe. */
export const versionsText = (t: ShowcaseTask) => [
  t.project ? `Projeto: ${t.project}` : '',
  t.versionSuporte ? `Suporte: ${t.versionSuporte}` : '',
  t.versionMaster ? `Master: ${t.versionMaster}` : '',
  t.versionRelease ? `Release: ${t.versionRelease}` : '',
  t.versionDevelop ? `Develop: ${t.versionDevelop}` : '',
].filter(Boolean).join(' | ');

export interface DecisionGroups {
  approved: ShowcaseTask[];
  adjustments: ShowcaseTask[];
  rejected: ShowcaseTask[];
  pending: ShowcaseTask[];
}

export function groupByDecision(tasks: readonly ShowcaseTask[]): DecisionGroups {
  return {
    approved: tasks.filter((t) => t.decision === 'approved'),
    adjustments: tasks.filter((t) => t.decision === 'needs_adjustment'),
    rejected: tasks.filter((t) => t.decision === 'rejected'),
    pending: tasks.filter((t) => !t.decision || t.decision === 'open'),
  };
}

/** Log em Markdown: participantes (quando houver), aprovadas, pendências com motivo e cards sem decisão. */
export function buildLogMarkdown(session: Pick<ShowcaseSession, 'members'> | null, sessionName: string, tasks: readonly ShowcaseTask[], now: Date = new Date()): string {
  const { approved, adjustments, rejected, pending } = groupByDecision(tasks);
  return [
    `# Relatório de Sprint Review — ${sessionName}`,
    `Data: ${now.toLocaleString('pt-BR')}\n`,
    session?.members && session.members.length > 0
      ? `## Squad\n${session.members.map((m) => `- ${m.name} (${m.role})`).join('\n')}\n`
      : '',
    `\n## Entregas Aprovadas (${approved.length})`,
    ...approved.map((t) => [
      `### ${t.key} — ${t.title}`,
      `**Problema:** ${t.evidence.problem}`,
      `**Solução:** ${t.evidence.solution}`,
      `**Time:** Dev: ${t.evidence.dev} / QA: ${t.evidence.qa}`,
      versionsText(t) ? `**Projeto & Versões:** ${versionsText(t)}` : '',
      `**Evidência${getEvidenceUrls(t.evidence).length > 1 ? 's' : ''}:** ${getEvidenceUrls(t.evidence).join(' | ') || 'Sem link'}`,
      t.attachments && t.attachments.length > 0 ? `**Arquivos anexados:** ${t.attachments.map((a) => a.name).join(', ')}` : '',
      t.decidedByName ? `**Aprovado por:** ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : '',
      `---`,
    ].filter(Boolean).join('\n')),
    `\n## Pendências (${adjustments.length + rejected.length})`,
    ...[...adjustments, ...rejected].map((t) => [
      `- [${t.key}] ${t.title}`,
      versionsText(t) ? `  → Projeto & Versões: ${versionsText(t)}` : '',
      `  → Motivo: ${t.feedback || 'Sem feedback registrado'}`,
      t.decidedByName ? `  → Decidido por: ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : '',
    ].filter(Boolean).join('\n')),
    `\n## Sem decisão (${pending.length})`,
    ...pending.map((t) => `- [${t.key}] ${t.title}`),
  ].join('\n');
}

/** Tabela Markdown das aprovadas: issue, link, dev, QA, projeto e versões. */
export function buildApprovalsTable(sessionName: string, tasks: readonly ShowcaseTask[], now: Date = new Date()): string {
  const { approved } = groupByDecision(tasks);
  const header = [
    `# Resumo de Aprovações — ${sessionName}`,
    `Data: ${now.toLocaleString('pt-BR')}\n`,
    `| Issue | URL | Dev | QA | Projeto | Suporte | Master | Release | Develop |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
  ];
  const rows = approved.map(
    (t) => `| ${mdCell(t.key)} | ${mdCell(t.url)} | ${mdCell(t.evidence.dev)} | ${mdCell(t.evidence.qa)} | ${mdCell(t.project)} | ${mdCell(t.versionSuporte)} | ${mdCell(t.versionMaster)} | ${mdCell(t.versionRelease)} | ${mdCell(t.versionDevelop)} |`
  );
  return [...header, ...rows].join('\n');
}

export interface DecisionGroup {
  label: string;
  items: ShowcaseTask[];
}

/** Grupos da lista "Entregas por decisão": o que pede atenção primeiro (ajuste, rejeitadas, aguardando) e as aprovadas por último. */
export function decisionGroups(tasks: readonly ShowcaseTask[]): DecisionGroup[] {
  const g = groupByDecision(tasks);
  return [
    { label: 'Precisam de ajuste', items: g.adjustments },
    { label: 'Rejeitadas', items: g.rejected },
    { label: DECISION.open.label, items: g.pending },
    { label: 'Aprovadas', items: g.approved },
  ].filter((x) => x.items.length > 0);
}

/** Links das issues para o PO abrir no Jira: agrupados por decisão, um por linha. Só entram cards com link. */
export function buildLinksText(groups: readonly DecisionGroup[]): { text: string; count: number } {
  const withLinks = groups
    .map((g) => ({ ...g, items: g.items.filter((t) => t.url) }))
    .filter((g) => g.items.length > 0);
  const text = withLinks
    .map((g) => [`${g.label} (${g.items.length})`, ...g.items.map((t) => `${t.key} - ${t.title}\n${t.url}`)].join('\n'))
    .join('\n\n');
  return { text, count: withLinks.reduce((n, g) => n + g.items.length, 0) };
}

/** Eficiência = estimado ÷ gasto (acima de 100% a squad gastou menos do que estimou); `null` sem horas lançadas. */
export function efficiencyOf(tasks: readonly ShowcaseTask[]): number | null {
  const spent = tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);
  const estimate = tasks.reduce((acc, t) => acc + (t.evidence.timeEstimate || 0), 0);
  return spent > 0 ? Math.round((estimate / spent) * 100) : null;
}

/** Taxa de aprovação sobre o que já foi avaliado (mesma conta do hub); `null` se nada foi avaliado. */
export function approvalRateOf(tasks: readonly ShowcaseTask[]): number | null {
  const g = groupByDecision(tasks);
  const reviewed = g.approved.length + g.adjustments.length + g.rejected.length;
  return reviewed > 0 ? Math.round((g.approved.length / reviewed) * 100) : null;
}
