/**
 * Regras puras do /onboarding (sem React): chave da squad, token do convite, busca, ação de cada
 * linha da lista, endereço do Jira. Ficam aqui para serem testadas sem montar a tela.
 */

import type { OnboardingCandidate } from '@/services/onboardingService';
import { cleanJiraDomain } from '@/lib/jira-import';

/** Menor busca que o servidor atende; abaixo disso a tela pede mais letras em vez de listar nada. */
export const MIN_SEARCH_LENGTH = 2;

/** "Squad Fênix" -> "SQUADFENIX": a chave é só letras e números maiúsculos, até 12. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/** "abc, def  ghi;ABC" -> ["ABC", "DEF", "GHI"]. Repetidas contam uma vez. */
export function parseProjectKeys(raw: string): string[] {
  const keys = raw.split(/[\s,;]+/).map((k) => k.trim().toUpperCase()).filter(Boolean);
  return Array.from(new Set(keys));
}

/** Primeiro nome para a saudação ("Wanderson Alves" -> "Wanderson"); vazio se não houver nome. */
export function firstNameOf(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/**
 * Token de convite a partir do que a pessoa colou: o link inteiro (`https://.../invite/abc?x=1`),
 * o caminho (`/invite/abc`) ou só o token. Devolve null quando não há token utilizável.
 */
export function parseInviteToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const marker = text.toLowerCase().lastIndexOf('/invite/');
  const part = marker >= 0 ? text.slice(marker + '/invite/'.length) : text;
  const token = part.split(/[?#]/)[0].replace(/\/+$/, '').split('/')[0].trim();
  // Token é uma sequência sem espaços nem pontuação de caminho; qualquer outra coisa não é convite.
  return /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

export type SearchPhase = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

/** Texto da busca já sem espaços sobrando. */
export function normalizeQuery(query: string): string {
  return query.trim();
}

/** Busca curta demais não consulta o servidor. */
export function isSearchable(query: string): boolean {
  return normalizeQuery(query).length >= MIN_SEARCH_LENGTH;
}

/** O que a lista de resultados mostra, dado o estado da última consulta. */
export function searchPhaseOf(input: { query: string; loading: boolean; failed: boolean; count: number }): SearchPhase {
  if (!isSearchable(input.query)) return 'idle';
  if (input.loading) return 'loading';
  if (input.failed) return 'error';
  return input.count > 0 ? 'ok' : 'empty';
}

export type RosterRowAction =
  /** Botão "Sou eu": o servidor reconhece a linha como sua. */
  | 'claim'
  /** Já é você (conta ligada à sua). */
  | 'mine'
  /** Outra conta já está ligada a esta pessoa. */
  | 'linked'
  /** Liderança: não se autodeclara; só com vínculo aprovado por admin. */
  | 'request'
  /** Linha livre que o servidor não aceitou como sua. Dá para pedir vínculo se for engano. */
  | 'not-you';

/** Ação de cada linha da lista da squad. Liderança sempre cai em "Pedir vínculo" (o papel dá governança). */
export function rosterRowAction(m: Pick<OnboardingCandidate, 'claimable' | 'claimed' | 'claimedByMe' | 'leadership'>): RosterRowAction {
  if (m.claimable) return 'claim';
  if (m.claimedByMe) return 'mine';
  if (m.leadership) return 'request';
  if (m.claimed) return 'linked';
  return 'not-you';
}

/** Linha de apoio sob o nome, na lista da squad. */
export function rosterRowHint(m: Pick<OnboardingCandidate, 'claimed' | 'claimedByMe' | 'emailHint'>): string {
  if (m.claimedByMe) return 'já é você';
  if (m.claimed) return 'já está no Portal Tech V&D';
  return m.emailHint || 'ainda não entrou';
}

const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/** Endereço do Jira já limpo (sem https:// nem barra final), ou vazio se não parecer um endereço. */
export function jiraHostOf(raw: string): string {
  const host = cleanJiraDomain(raw || '');
  return HOST_PATTERN.test(host) && host.includes('.') ? host : '';
}

/** Página do perfil no Jira Data Center, onde ficam os tokens de acesso pessoal. Vazio sem endereço válido. */
export function jiraProfileUrl(rawDomain: string): string {
  const host = jiraHostOf(rawDomain);
  return host ? `https://${host}/secure/ViewProfile.jspa` : '';
}

export interface JiraFormErrors {
  domain?: string;
  keys?: string;
  token?: string;
}

/** Valida o formulário da importação. O domínio é obrigatório: sem ele o servidor usa um endereço que não existe. */
export function validateJiraForm(input: { domain: string; keys: string; token: string }): JiraFormErrors {
  const errors: JiraFormErrors = {};
  if (!jiraHostOf(input.domain)) errors.domain = input.domain.trim() ? 'Confira o endereço do Jira' : 'Informe o endereço do Jira';
  if (parseProjectKeys(input.keys).length === 0) errors.keys = 'Informe ao menos uma chave';
  if (!input.token.trim()) errors.token = 'Informe o seu token';
  return errors;
}

export const hasJiraFormErrors = (e: JiraFormErrors) => Object.keys(e).length > 0;

/** Título do aviso quando o formulário do Jira falha na validação. */
export function jiraFormToastTitle(e: JiraFormErrors): string {
  const missing = [e.domain && 'o endereço do Jira', e.keys && 'a chave do projeto', e.token && 'seu token do Jira'].filter(Boolean) as string[];
  if (missing.length === 0) return '';
  if (missing.length === 1) return `Informe ${missing[0]}`;
  return `Informe ${missing.slice(0, -1).join(', ')} e ${missing[missing.length - 1]}`;
}

/** Sem acesso à squad (403): o caminho passa a ser convite ou pedido de vínculo. */
export function isAccessRefused(status?: number): boolean {
  return status === 403;
}

export const MSG_CLAIM_REFUSED =
  'Não foi possível confirmar que essa linha é você: o e-mail ou a conta do Jira não bate com o seu login. Peça um link de convite a quem lidera a squad.';
export const MSG_JOIN_REFUSED =
  'Você não consta na lista desta squad. Peça um link de convite a quem lidera a squad ou fale com um administrador.';
export const MSG_CREATE_REFUSED =
  'Só Agile Master ou People Lead cadastram squads. Peça a quem lidera a sua squad para importá-la, ou use um link de convite.';

/** Mensagem para a pessoa: no 403 vale o texto do caminho (convite); nos demais, o que o servidor disse. */
export function refusalMessage(status: number | undefined, serverMessage: string | undefined, whenRefused: string): string {
  if (isAccessRefused(status)) return whenRefused;
  return serverMessage?.trim() || whenRefused;
}
