import { describe, expect, it } from 'vitest';
import { decideAutoSync, type AutoSyncInput } from '../painel-sync';

const base: AutoSyncInput = { loading: false, hasSquad: true, hasData: false, alreadyTried: false, jiraLoading: false, hasJira: true };

describe('decideAutoSync', () => {
  it('sincroniza quando a squad está vazia e há Jira configurado', () => {
    expect(decideAutoSync(base)).toBe('sync');
  });

  it('sem Jira configurado não chama o servidor: vira convite', () => {
    expect(decideAutoSync({ ...base, hasJira: false })).toBe('no-jira');
  });

  it('espera a configuração do Jira carregar antes de decidir', () => {
    expect(decideAutoSync({ ...base, jiraLoading: true, hasJira: false })).toBe('wait');
  });

  it('não faz nada com dados, sem squad, carregando ou já tentado', () => {
    expect(decideAutoSync({ ...base, hasData: true })).toBe('skip');
    expect(decideAutoSync({ ...base, hasSquad: false })).toBe('skip');
    expect(decideAutoSync({ ...base, loading: true })).toBe('skip');
    expect(decideAutoSync({ ...base, alreadyTried: true })).toBe('skip');
  });
});
