import type { JiraPublishEvent, JiraPublishJob, JiraPublishStep } from '@/app/room/jira-publish-api';

export type QueueFilter = 'ALL' | 'ERROR' | 'RUNNING' | 'DONE';

export const FILTER_LABEL: Record<QueueFilter, string> = {
  ALL: 'Todos',
  ERROR: 'Com erro',
  RUNNING: 'Em andamento',
  DONE: 'Concluídos',
};

/** Em andamento = na fila ou enviando, e não travado (travado conta como erro: precisa de gente). */
export function filterOf(job: JiraPublishJob): Exclude<QueueFilter, 'ALL'> {
  if (job.status === 'DONE') return 'DONE';
  if (job.status === 'ERROR' || job.stale) return 'ERROR';
  return 'RUNNING';
}

export function countByFilter(jobs: JiraPublishJob[]): Record<QueueFilter, number> {
  const out: Record<QueueFilter, number> = { ALL: jobs.length, ERROR: 0, RUNNING: 0, DONE: 0 };
  for (const j of jobs) out[filterOf(j)] += 1;
  return out;
}

/** Abre já no que precisa de atenção: erros primeiro, depois o que está andando, senão tudo. */
export function defaultFilter(counts: Record<QueueFilter, number>): QueueFilter {
  if (counts.ERROR > 0) return 'ERROR';
  if (counts.RUNNING > 0) return 'RUNNING';
  return 'ALL';
}

export function applyFilter(jobs: JiraPublishJob[], filter: QueueFilter): JiraPublishJob[] {
  return filter === 'ALL' ? jobs : jobs.filter(j => filterOf(j) === filter);
}

/** Pode tentar de novo: com erro, ou travado em andamento. */
export function canRetry(job: JiraPublishJob): boolean {
  return job.status === 'ERROR' || (!!job.stale && (job.status === 'RUNNING' || job.status === 'PENDING'));
}

/** Pode descartar: mesma regra do servidor (erro ou travado). */
export const canDiscard = canRetry;

/** Há algo concluído no Jira que vale conferir. */
export function canVerify(job: JiraPublishJob): boolean {
  return job.steps.some(s => s.status === 'DONE');
}

export function doneCount(job: JiraPublishJob): number {
  return job.steps.filter(s => s.status === 'DONE').length;
}

/** Endereço da issue no Jira, ou null sem domínio ou chave. */
export function jiraIssueUrl(domain: string | null | undefined, key: string | null | undefined): string | null {
  const d = (domain ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const k = (key ?? '').trim();
  if (!d || !/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(k)) return null;
  return `https://${d}/browse/${k.toUpperCase()}`;
}

/** Rótulo curto do passo, com a chave criada quando já existe. */
export function stepLabel(step: JiraPublishStep): string {
  switch (step.kind) {
    case 'RENAME_PARENT':
      return `Renomear ${step.targetKey ?? 'a issue pai'}`;
    case 'CREATE_SUBTASK':
      return `Criar sub-tarefa${step.issueType ? ` ${step.issueType}` : ''}`;
    case 'ADD_COMMENT':
      return `Comentar em ${step.targetKey ?? 'sub-tarefa'}`;
    default:
      return step.kind;
  }
}

/** O que o passo vai fazer ou fez, em uma linha (título novo, título da sub, começo do comentário). */
export function stepDetail(step: JiraPublishStep, max = 90): string {
  const raw = step.kind === 'ADD_COMMENT' ? step.comment : step.summary;
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const EVENT_LABEL: Record<JiraPublishEvent['action'], string> = {
  SUBMITTED: 'Envio criado',
  RETRY: 'Nova tentativa',
  STEP_DONE: 'Passo concluído',
  STEP_ERROR: 'Passo com erro',
  JOB_DONE: 'Envio concluído',
  VERIFIED: 'Conferência no Jira',
};

export function eventLabel(e: JiraPublishEvent): string {
  const base = EVENT_LABEL[e.action] ?? e.action;
  return e.stepPosition != null ? `${base} (passo ${e.stepPosition + 1})` : base;
}

export type EventTone = 'ok' | 'error' | 'neutral';

export function eventTone(e: JiraPublishEvent): EventTone {
  if (e.ok === true) return 'ok';
  if (e.ok === false) return 'error';
  return 'neutral';
}

/** "31/10 02:11": data e hora curtas no fuso do navegador; vazio se a data não for válida. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  // O servidor manda LocalDateTime sem fuso, em UTC: sem o Z o navegador leria como horário local.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}
