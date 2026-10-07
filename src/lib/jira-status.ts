// Nomes padrão do Jira em inglês viram português; qualquer outro status do workflow aparece como veio.
const STATUS_LABEL_PT: Record<string, string> = {
  OPEN: 'Aberto',
  'TO DO': 'A fazer',
  'IN PROGRESS': 'Em andamento',
  DONE: 'Concluído',
  CLOSED: 'Concluído',
  RESOLVED: 'Resolvido',
};

export function statusLabelPt(status?: string | null): string {
  const raw = (status || '').trim();
  return STATUS_LABEL_PT[raw.toUpperCase()] ?? (raw || 'Sem status');
}

/** Status que o time considera fim de linha (Done, Closed, Resolved e equivalentes em português). */
export function isDoneStatus(status?: string | null): boolean {
  return /^(done|closed|resolved|conclu[ií]d[oa]|finalizad[oa]|entregue|resolvid[oa]|fechad[oa])$/i.test((status || '').trim());
}
