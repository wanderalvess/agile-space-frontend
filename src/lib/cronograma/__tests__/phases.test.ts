import { describe, expect, it } from 'vitest';
import { resolveWorkflowPhase } from '../phases';

const task = (type: string) => ({ type });
const order = (type: string) => resolveWorkflowPhase(task(type)).order;

describe('ordem das fases da cascata sem fases configuradas', () => {
  it('Codificação (DEV) abre a sequência: Codificação, Testes Auto, Code Review, Teste QA, Execução TI', () => {
    expect(order('Codificação')).toBe(0);
    expect(order('Testes Automatizados')).toBe(1);
    expect(order('Code Review')).toBe(2);
    expect(order('Teste QA')).toBe(3);
    expect(order('Execução TI')).toBe(4);
  });

  it('Desenvolvimento e Dev também são Codificação', () => {
    expect(order('Desenvolvimento')).toBe(0);
    expect(order('Dev')).toBe(0);
    expect(resolveWorkflowPhase(task('Codificação')).shortLabel).toBe('DEV');
  });

  it('tipo genérico (Sub-task) continua por último, sem corromper a sequência', () => {
    expect(order('Sub-task')).toBe(99);
    expect(order('')).toBe(99);
    expect(resolveWorkflowPhase(task('Sub-task')).matched).toBe(false);
  });

  it('"dev" dentro de outra palavra não vira Codificação', () => {
    expect(order('Devolução')).toBe(99);
  });

  it('"ti" dentro de outra palavra não vira Execução de TI', () => {
    expect(resolveWorkflowPhase(task('Testes Automatizados')).kind).toBe('Auto');
    expect(order('Notificação')).toBe(99);
  });

  it('fases configuradas pela squad mandam na ordem e na cor', () => {
    const phases = [
      { id: 'a', label: 'Teste', kind: 'QA', color: 'bg-amber-600', issueTypes: ['Teste QA'] },
      { id: 'b', label: 'Código', kind: 'DEV', color: 'bg-blue-600', issueTypes: ['Codificação'] },
    ] as never;
    expect(resolveWorkflowPhase(task('Teste QA'), phases).order).toBe(0);
    expect(resolveWorkflowPhase(task('Codificação'), phases).order).toBe(1);
    expect(resolveWorkflowPhase(task('Codificação'), phases).configuredColor).toBe('bg-blue-600');
  });

  it('tipo fora da config cai na heurística', () => {
    const phases = [{ id: 'a', label: 'Teste', kind: 'QA', color: 'bg-amber-600', issueTypes: ['Teste QA'] }] as never;
    expect(resolveWorkflowPhase(task('Code Review'), phases).order).toBe(2);
  });
});
