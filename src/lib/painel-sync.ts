export type AutoSyncDecision = 'wait' | 'skip' | 'no-jira' | 'sync';

export interface AutoSyncInput {
  /** Dados da squad ainda carregando. */
  loading: boolean;
  hasSquad: boolean;
  /** A squad já tem rollup ou issues. */
  hasData: boolean;
  /** Já tentou sincronizar esta squad nesta visita. */
  alreadyTried: boolean;
  /** Configuração do Jira da pessoa ainda carregando. */
  jiraLoading: boolean;
  /** Existe domínio e token do Jira salvos para a pessoa. */
  hasJira: boolean;
}

/**
 * Decide se o /painel dispara a sincronização automática com o Jira. Sem Jira configurado NÃO chama o servidor
 * (ele responderia 400): vira direto o convite para conectar. Sincronização manual ("Tentar de novo") não passa por aqui.
 */
export function decideAutoSync(i: AutoSyncInput): AutoSyncDecision {
  if (i.loading || !i.hasSquad || i.hasData || i.alreadyTried) return 'skip';
  if (i.jiraLoading) return 'wait';
  return i.hasJira ? 'sync' : 'no-jira';
}
