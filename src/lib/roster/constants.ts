/** Constantes do "Time da squad" (roster). Os papéis espelham o catálogo do servidor (SquadTeamService). */

/** Horas por dia padrão da squad (o servidor semeia o roster com 6 h quando a squad não define outro valor). */
export const DEFAULT_DAILY_HOURS = 6;

/** Maior valor aceito para "horas por dia" ao importar uma planilha (acima disso mantém o valor atual). */
export const MAX_DAILY_HOURS = 24;

/** Dias úteis considerados no cálculo semanal e no da sprint. */
export const WEEK_DAYS = 5;
export const SPRINT_DAYS = 10;

export const SQUAD_ROLES = [
  'Developer',
  'QA',
  'Tech Lead',
  'Product Owner',
  'Agile Master',
  'Scrum Master',
  'People Lead',
  'UX/Designer',
  'SME',
  'Tribe Lead',
] as const;

/** Agile Master, Scrum Master e People Lead dão o poder de gerir equipes: só administrador atribui (o servidor também recusa). */
export const MANAGER_ROLES: readonly string[] = ['Agile Master', 'Scrum Master', 'People Lead'];

/** Convite não concede liderança (o servidor recusa): só papéis de contribuidor. */
export const INVITE_ROLES = ['Developer', 'QA', 'UX/Designer', 'SME'] as const;

/** Validade do convite, fixa no servidor (InviteService.EXPIRATION_DAYS). */
export const INVITE_EXPIRATION_DAYS = 7;

export type CalcMethod = 'STANDARD' | 'JIRA_WORKLOG_AVERAGE' | 'CUSTOM_FORMULA';

export const CALC_METHOD_LABELS: Record<CalcMethod, string> = {
  STANDARD: 'Padrão fixo',
  JIRA_WORKLOG_AVERAGE: 'Média de worklogs',
  CUSTOM_FORMULA: 'Fator de foco',
};

/** Fator de foco usado quando o valor digitado não é legível (15% de reuniões e cerimônias). */
export const DEFAULT_FOCUS_FACTOR = 0.85;
