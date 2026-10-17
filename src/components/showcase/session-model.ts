/**
 * Modelo da sessão da Review no cliente: normalização do que vem do servidor, cards novos (manual e de
 * métricas), chave MANUAL-NNN e o veredito que vai para os work items da squad. Tudo puro, sem rede.
 */
import type { CardKind, Decision, ShowcaseSession, ShowcaseTask } from './types';

/**
 * Traz a sessão do servidor para o formato que a UI espera. Campos de evidência só caem para o
 * valor legado quando vierem ausentes (null/undefined): um campo que a pessoa apagou continua
 * vazio em vez de voltar com o texto antigo da descrição.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSession(raw: any): ShowcaseSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = (raw.tasks || []).map((t: any) => {
    const ev = t.evidence || {};
    return {
      ...t,
      key: t.key ?? '',
      title: t.title ?? '',
      type: t.type ?? '',
      description: t.description ?? '',
      acceptanceCriteria: t.acceptanceCriteria ?? '',
      evidence: {
        problem: ev.problem ?? t.description ?? '',
        solution: ev.solution ?? ev.execution ?? '',
        dev: ev.dev ?? t.assignee ?? '',
        qa: ev.qa ?? '',
        screenshot: ev.screenshot ?? ev.docLink ?? '',
        video: ev.video ?? ev.videoLink ?? '',
        evidencePreference: ev.evidencePreference,
        techDocUrl: ev.techDocUrl ?? '',
        tdnUrl: ev.tdnUrl ?? '',
        timeSpent: ev.timeSpent || 0,
        timeEstimate: ev.timeEstimate || 0,
        planned: ev.planned || null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metrics: t.metrics ? t.metrics.map((m: any) => ({ ...m, field: m.field ?? '', value: m.value ?? 0 })) : t.metrics,
      attachments: t.attachments || [],
      project: t.project ?? '',
      versionSuporte: t.versionSuporte ?? '',
      versionMaster: t.versionMaster ?? '',
      versionRelease: t.versionRelease ?? '',
      versionDevelop: t.versionDevelop ?? '',
      preparationStatus: t.preparationStatus || 'todo',
      decision: t.decision || 'open',
      feedback: t.feedback || '',
    };
  });
  return {
    ...raw,
    tasks,
    coverImage: raw.coverImage || '',
    squadName: raw.squadName || '',
    period: raw.period || '',
    description: raw.description || '',
    members: raw.members || [],
  } as ShowcaseSession;
}

/** Chave dos cards criados à mão: MANUAL-001, MANUAL-002... */
export const MANUAL_KEY = /^MANUAL-(\d+)$/;
/** Só chaves reais do Jira entram no work_items; cards manuais (MANUAL-001) não existem lá. */
export const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

/** Card criado à mão (id `manual_…` ou chave `MANUAL-…`). */
export function isManualTask(task: Pick<ShowcaseTask, 'id' | 'key'>): boolean {
  return task.id.startsWith('manual_') || (task.key || '').startsWith('MANUAL-');
}

/** Próxima chave MANUAL: o maior número já usado + 1 (contar cards repetia MANUAL-002 depois de remover o 001). */
export function nextManualKey(tasks: readonly Pick<ShowcaseTask, 'key'>[]): string {
  const highest = tasks.reduce((max, t) => {
    const match = MANUAL_KEY.exec(t.key || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `MANUAL-${String(highest + 1).padStart(3, '0')}`;
}

/** Card novo, vazio, para a chave e o tipo pedidos. O de métricas nasce com uma linha campo/valor aberta. */
export function buildManualTask(opts: { id: string; key: string; cardKind: CardKind; author: string }): ShowcaseTask {
  const isMetrics = opts.cardKind === 'metrics';
  return {
    id: opts.id,
    key: opts.key,
    title: isMetrics ? 'Nova Métrica de Impacto' : 'Nova Tarefa Manual',
    description: '',
    acceptanceCriteria: '',
    type: 'Evolução',
    status: 'In Progress',
    priority: 'Medium',
    points: 0,
    cardKind: opts.cardKind,
    // Card de métricas nasce com uma linha campo/valor aberta: é o conteúdo principal desse tipo.
    metrics: isMetrics ? [{ field: '', value: 0 }] : undefined,
    assignee: opts.author,
    url: '',
    evidence: {
      problem: '',
      solution: '',
      dev: opts.author,
      qa: '',
      screenshot: '',
      video: '',
      timeSpent: 0,
      timeEstimate: 0,
      planned: null,
    },
    decision: 'open',
    preparationStatus: 'todo',
    feedback: '',
    project: '',
    versionSuporte: '',
    versionMaster: '',
    versionRelease: '',
    versionDevelop: '',
  };
}

/** Veredito da Review → status do work item (aprovada=entregue, rejeitada=rejeitada, ajuste=carregada). */
export function workItemStatusFor(decision: Decision): 'delivered' | 'rejected' | 'carried_over' | 'committed' {
  if (decision === 'approved') return 'delivered';
  if (decision === 'rejected') return 'rejected';
  if (decision === 'needs_adjustment') return 'carried_over';
  return 'committed';
}

/** O veredito só vai para os work items de cards que existem no Jira (chave real, não manual). */
export function syncsToWorkItems(task: Pick<ShowcaseTask, 'key'>): boolean {
  return !!task.key && JIRA_KEY.test(task.key) && !MANUAL_KEY.test(task.key);
}

/** Squad do work item: a da Review, senão o projeto da chave da issue, senão a ativa da pessoa. */
export function workItemSquad(task: Pick<ShowcaseTask, 'key'>, sessionSquad?: string, activeSquad?: string): string {
  const issueProjectKey = (task.key || '').split('-')[0].toUpperCase();
  return sessionSquad || issueProjectKey || activeSquad || '';
}

/** Cards novos de uma importação: só as chaves que a Review ainda não tem. */
export function newIssueKeys<T extends { key: string }>(issues: readonly T[], existing: readonly { key: string }[]): T[] {
  const known = new Set(existing.map((t) => t.key));
  return issues.filter((i) => !known.has(i.key));
}

/** Aplica uma mudança de cards sem duplicar a chave (outra pessoa pode ter importado a mesma issue nesse meio-tempo). */
export function appendUnique(tasks: readonly ShowcaseTask[], incoming: readonly ShowcaseTask[]): ShowcaseTask[] {
  const keys = new Set(tasks.map((t) => t.key));
  return [...tasks, ...incoming.filter((t) => !keys.has(t.key))];
}
