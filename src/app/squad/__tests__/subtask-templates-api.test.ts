import { describe, expect, it } from 'vitest';
import { normalizeTypeName, roleDivergence, suggestionFor, type SuggestedRole } from '../subtask-templates-api';

const s = (typeName: string, role: SuggestedRole['role'], extra: Partial<SuggestedRole> = {}): SuggestedRole => ({
  typeId: typeName, typeName, subtaskClass: role === 'DEV' ? 'DEV' : role === 'QA' ? 'QA' : 'SEM_CLASSIFICACAO',
  role, origin: 'PADRAO', sprintKey: null, varyByTitle: false, ...extra,
});

describe('papel sugerido pelo Planejador', () => {
  const list = [s('Codificação', 'DEV'), s('Execução de TI', 'QA'), s('Reunião', null), s('Code Review', 'DEV', { varyByTitle: true })];

  it('casa o tipo sem ligar para acento, caixa e espaços', () => {
    expect(normalizeTypeName('  Execução   de TI ')).toBe('execucao de ti');
    expect(suggestionFor(list, 'codificacao')?.role).toBe('DEV');
    expect(suggestionFor(list, 'EXECUÇÃO DE TI')?.role).toBe('QA');
  });

  it('não sugere quando o Planejador não classificou o tipo ou ele é desconhecido', () => {
    expect(suggestionFor(list, 'Reunião')).toBeNull();
    expect(suggestionFor(list, 'Outro')).toBeNull();
    expect(suggestionFor(null, 'Codificação')).toBeNull();
    expect(suggestionFor(list, '')).toBeNull();
  });

  it('avisa só quando o papel configurado é diferente do sugerido', () => {
    const cod = suggestionFor(list, 'Codificação');
    expect(roleDivergence(cod, 'DEV')).toBeNull();
    expect(roleDivergence(cod, 'QA')?.role).toBe('DEV');
    expect(roleDivergence(cod, 'NONE')?.role).toBe('DEV');
    expect(roleDivergence(null, 'QA')).toBeNull();
  });

  it('Code Review depende do título, então nunca avisa', () => {
    expect(roleDivergence(suggestionFor(list, 'Code Review'), 'QA')).toBeNull();
  });
});
