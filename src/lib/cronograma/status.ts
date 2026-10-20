/** Rótulo e tom de um status do Jira. Nomes padrão em inglês viram português; os demais aparecem como vieram. */

const STATUS_LABEL_PT: Record<string, string> = {
  OPEN: 'Aberto',
  'TO DO': 'A fazer',
  'IN PROGRESS': 'Em andamento',
  DONE: 'Concluído',
  CLOSED: 'Concluído',
  RESOLVED: 'Resolvido',
};

export type StatusTone = 'done' | 'review' | 'progress' | 'neutral';

export function statusLabel(status: string): string {
  const raw = (status || '').trim();
  return STATUS_LABEL_PT[raw.toUpperCase()] ?? (raw || 'Sem status');
}

export function statusTone(status: string, category?: string): StatusTone {
  const norm = (status || '').trim().toUpperCase();
  if (category === 'done' || ['CONCLUÍDO', 'DONE', 'CLOSED', 'RESOLVED'].includes(norm)) return 'done';
  if (norm.includes('REVIEW') || norm.includes('ACEITAÇÃO')) return 'review';
  if (category === 'indeterminate' || ['EM ANDAMENTO', 'IN PROGRESS', 'EM DESENVOLVIMENTO'].includes(norm)) return 'progress';
  return 'neutral';
}
