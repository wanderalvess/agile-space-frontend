// Regras de status da issue e o agrupamento usado no donut e nas métricas.
//
// ⚠️ `issueRules` usa `this` nos métodos que compõem outros (`isClosed`,
// `getStatusBadgeClass`): `this` é o próprio objeto, então não desmembre esses métodos
// nem os passe soltos como callback.
//
// `STATUS_GROUPS` fica privado — a ordem das entradas é significativa e quem precisa do
// resultado usa `getStatusGroup`. `state` é só LIDO (`state.flaggedFieldId`).
import { normalize } from '../core/helpers.js';
import { state } from '../core/state.js';

const STATUS_GROUPS = [
  { label: 'Comprometidas', tokens: ['comprometido', 'committed'] },
  { label: 'Code Review', tokens: ['code review', 'revisão', 'revisao'] },
  {
    label: 'Em Teste / Aceitação',
    tokens: ['teste', 'aceitação', 'aceitacao', 'homologação', 'homologacao', 'qa']
  },
  {
    label: 'Em Desenvolvimento',
    tokens: [
      'em andamento',
      'em desenvolvimento',
      'desenvolvendo',
      'in progress',
      'em execução',
      'em execucao'
    ]
  },
  // "Refinamento Concluído" vem ANTES de "Refinamento": o token genérico 'refinamento'
  // casaria com ambos (includes), então o grupo mais específico precisa ser checado primeiro.
  { label: 'Refinamento Concluído', tokens: ['refinamento concluido', 'refinamento concluído'] },
  { label: 'Refinamento', tokens: ['refinamento', 'refinement', 'análise', 'analise', 'backlog'] }
];
export const STATUS_GROUP_ORDER = [
  'Concluídas',
  'Em Teste / Aceitação',
  'Code Review',
  'Em Desenvolvimento',
  'Refinamento Concluído',
  'Refinamento',
  'Comprometidas',
  'Cancelado',
  'Outros'
];
// Importante: checa "cancelado" ANTES de resolutiondate. Issue cancelada tem resolutiondate
// setado (Jira marca igual concluído), mas não é entrega — agrupa separado pra não inflar
// o "Concluídas" no donut e nas métricas.
export const getStatusGroup = issue => {
  const statusName = issue.fields.status?.name;
  if (issueRules.isCancelled(statusName)) return 'Cancelado';
  if (issue.fields.resolutiondate) return 'Concluídas';
  const n = normalize(statusName);
  for (const group of STATUS_GROUPS) {
    if (group.tokens.some(token => n.includes(token))) return group.label;
  }
  return 'Outros';
};

export const issueRules = {
  isDone(status) {
    const s = normalize(status);
    return ['done', 'closed', 'resolved', 'resolvido', 'fechado'].includes(s) || s.startsWith('concluí');
  },
  // Cancelada/Rejeitada: trabalho descartado, não conta como entregue.
  // Jira marca resolutiondate igual concluído, então precisamos checar pelo nome do status.
  isCancelled(status) {
    const s = normalize(status);
    return s.includes('cancel') || s.includes('rejeit');
  },
  // "Fechada" no sentido amplo: saiu da WIP por qualquer motivo (entregue OU descartada).
  // Útil pra filtros que querem "issue não está mais ativa" (aging, cycle time por status).
  isClosed(status) {
    return this.isDone(status) || this.isCancelled(status);
  },
  isInProgress(status) {
    const s = normalize(status);
    return (
      s.includes('progress') ||
      s.includes('andamento') ||
      s.includes('desenvolvimento') ||
      s.includes('doing')
    );
  },
  isBlocked(status) {
    const s = normalize(status);
    return s.includes('block') || s.includes('impedid');
  },
  isReview(status) {
    const s = normalize(status);
    return (
      s.includes('review') ||
      s.includes('revisão') ||
      s.includes('teste') ||
      s.includes('homolog') ||
      s.includes('qa')
    );
  },
  isImpediment(issue) {
    const flagged = issue.fields[state.flaggedFieldId];
    if (!flagged) return false;
    if (Array.isArray(flagged)) {
      return flagged.some(value => normalize(value?.value || value).includes('impediment'));
    }
    return normalize(flagged).includes('impediment');
  },
  getStatusBadgeClass(status) {
    if (this.isCancelled(status)) return 'b-cancel';
    if (this.isDone(status)) return 'b-done';
    if (this.isInProgress(status)) return 'b-progress';
    if (this.isBlocked(status)) return 'b-blocked';
    if (this.isReview(status)) return 'b-review';
    return 'b-todo';
  }
};
