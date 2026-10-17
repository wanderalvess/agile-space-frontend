/**
 * Consultas JQL guardadas no servidor para a squad (backend com a V81, docs/ceremony-review-api.md). O servidor só guarda
 * o TEXTO da consulta; a busca no Jira continua rodando no navegador de cada pessoa, com a conta dela. Regras puras.
 */
import type { ShowcaseJqlQuery } from './types';

export type SquadJqlVisibility = ShowcaseJqlQuery['visibility'];

export const SQUAD_JQL_NAME_MAX = 120;
export const SQUAD_JQL_TEXT_MAX = 4000;

/** Textos honestos da visibilidade: o que cada escolha compartilha de verdade. */
export const SQUAD_JQL_HELP = {
  squad: 'A squad vê o texto da consulta. A busca roda no navegador de cada pessoa.',
  private: 'Só você vê, em qualquer navegador.',
  note: 'Da squad: só o texto da consulta é compartilhado. A busca roda no seu navegador, com a sua conta do Jira.',
} as const;

export const SQUAD_JQL_VISIBILITY_LABEL: Record<SquadJqlVisibility, string> = {
  SQUAD: 'Da squad',
  PRIVATE: 'Só minha',
};

/** Mais recentes primeiro (o servidor já ordena; aqui garante a ordem se vier embaralhado) e só o que tem nome e texto. */
export function orderSquadJqls(items: readonly ShowcaseJqlQuery[] | null | undefined): ShowcaseJqlQuery[] {
  return (items ?? [])
    .filter((q) => q && q.id && q.name?.trim() && q.jql?.trim())
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** Dica ao passar o mouse: visibilidade, quem criou e a consulta. */
export function squadJqlTitle(q: ShowcaseJqlQuery): string {
  const who = q.mine ? 'criada por você' : q.createdByName ? `criada por ${q.createdByName}` : 'criada por outra pessoa';
  return `${SQUAD_JQL_VISIBILITY_LABEL[q.visibility]} · ${who}\n${q.jql}`;
}

/** Valida o formulário de salvar: mensagem em português ou `null` quando está tudo certo. */
export function validateSquadJql(name: string, jql: string): string | null {
  if (!name.trim()) return 'Dê um nome à consulta.';
  if (name.trim().length > SQUAD_JQL_NAME_MAX) return `O nome vai até ${SQUAD_JQL_NAME_MAX} caracteres.`;
  if (!jql.trim()) return 'Preencha a consulta JQL.';
  if (jql.trim().length > SQUAD_JQL_TEXT_MAX) return `A consulta vai até ${SQUAD_JQL_TEXT_MAX} caracteres.`;
  return null;
}

/** Mensagem do erro ao salvar ou apagar: usa a do servidor (já em português) e cai numa padrão. */
export function squadJqlErrorMessage(error: unknown, fallback: string): string {
  const e = error as { status?: number; body?: Record<string, unknown> | null } | null | undefined;
  const message = e?.body?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (e?.status === 403) return 'Você não tem permissão para isso nesta squad.';
  if (e?.status === 409) return 'Já existe uma consulta sua com esse nome nesta squad, ou o limite de consultas foi atingido.';
  return fallback;
}
