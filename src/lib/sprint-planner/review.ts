/**
 * Apoio da etapa Revisar e enviar (E5), só para exibição. Contagens, severidade, `canSend` e a prévia vêm do
 * servidor; aqui só se agrupa, se escolhe o destino do atalho "Ir para" e se escreve o texto em PT-BR.
 */
import type { JiraChange, PreviewKind, ReviewPending, ReviewView } from './api';
import type { StepId } from './format';

export function pendingsOf(view: ReviewView, severity: ReviewPending['severity']): ReviewPending[] {
  return view.pendings.filter((p) => p.severity === severity);
}

/** "5 pendências impedem o envio · 2 avisos"; sem nada: "Tudo certo para enviar". */
export function summaryLine(view: ReviewView): string {
  const b = view.blockingCount;
  const w = view.warningCount;
  if (b === 0 && w === 0) return 'Tudo certo, sem pendências';
  const parts: string[] = [];
  if (b > 0) parts.push(b === 1 ? '1 pendência impede o envio' : `${b} pendências impedem o envio`);
  if (w > 0) parts.push(w === 1 ? '1 aviso' : `${w} avisos`);
  return parts.join(' · ');
}

/** Contador curto do rótulo da seção: "5 · 2 impedem enviar". */
export function pendingsCounter(view: ReviewView): string {
  const b = view.blockingCount;
  const w = view.warningCount;
  if (b === 0 && w === 0) return '0';
  return b > 0 ? `${b + w} · ${b} ${b === 1 ? 'impede' : 'impedem'} enviar` : `${w}`;
}

export interface JumpTarget { step: StepId; focus: string | null }

/** Para onde o atalho leva: subtarefa → Distribuição; pessoa → Capacidade; tarefa → Escopo. Sem alvo, null. */
export function jumpTarget(p: Pick<ReviewPending, 'subtaskKey' | 'accountId' | 'itemId'>): JumpTarget | null {
  if (p.subtaskKey) return { step: 'distribuicao', focus: p.subtaskKey };
  if (p.accountId) return { step: 'capacidade', focus: p.accountId };
  if (p.itemId) return { step: 'escopo', focus: p.itemId };
  return null;
}

export function jumpLabel(p: Pick<ReviewPending, 'subtaskKey' | 'accountId' | 'itemId'>): string {
  const t = jumpTarget(p);
  if (!t) return '';
  return t.step === 'distribuicao' ? `Ir para ${t.focus}` : t.step === 'capacidade' ? 'Ir para a capacidade' : 'Ir para o escopo';
}

export const KIND_LABEL: Record<PreviewKind, string> = { SET: 'Definir', CHANGE: 'Alterar', UNCHANGED: 'Igual' };

export const FIELD_LABEL: Record<JiraChange['field'], string> = {
  assignee: 'Responsável',
  sprint: 'Sprint',
  plannedStart: 'Data de início',
  plannedEnd: 'Data de fim',
};

/** Nome do campo no Jira, ou "campo a definir" enquanto as regras de escrita não o escolhem. */
export function jiraFieldLabel(c: Pick<JiraChange, 'field' | 'jiraFieldName'>): string | null {
  if (c.field === 'assignee' || c.field === 'sprint') return null; // campos nativos: o servidor manda null
  return c.jiraFieldName?.trim() || 'campo a definir';
}

/** A mudança de `sprint` também vem para a issue PAI; este rótulo diferencia pai de subtarefa. */
export function issueKindLabel(issueKey: string, view: Pick<ReviewView, 'tasks'>): 'Tarefa' | 'Subtarefa' {
  return view.tasks.some((t) => t.parentKey === issueKey) ? 'Tarefa' : 'Subtarefa';
}

/** Para a tarefa, o alvo do atalho no Escopo é a chave da issue (os cartões do Escopo usam a chave, não o id). */
export function resolveJumpFocus(t: JumpTarget, view: Pick<ReviewView, 'tasks'>): string | null {
  if (t.step !== 'escopo' || !t.focus) return t.focus;
  return view.tasks.find((k) => k.itemId === t.focus)?.parentKey ?? t.focus;
}

/** Valor da prévia: datas ISO viram dd/mm/aaaa; vazio vira "vazio". */
export function previewValue(v: string | null | undefined): string {
  if (v == null || v === '') return 'vazio';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Por que o envio está travado; null quando liberado. Texto único usado também em aria-describedby. */
export function sendBlockReason(view: ReviewView, canEdit: boolean): string | null {
  if (view.status === 'ENVIADO') return 'Este planejamento já foi enviado ao Jira.';
  if (!canEdit) return 'Só a liderança envia ao Jira.';
  if (view.blockingCount > 0) return view.blockingCount === 1 ? 'Resolva a pendência vermelha para enviar.' : `Resolva as ${view.blockingCount} pendências vermelhas para enviar.`;
  if (!view.writeRulesDefined) return 'As regras de escrita no Jira ainda estão em definição.';
  if (!view.canSend) return 'O servidor ainda não liberou o envio.';
  return null;
}

/** "3 de 4 com datas". */
export function datedLabel(dated: number, total: number): string {
  return `${dated} de ${total} com datas`;
}
