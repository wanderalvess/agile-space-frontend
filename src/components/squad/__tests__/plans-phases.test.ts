import { describe, expect, it } from 'vitest';
import { resolveWorkflowPhase, type PlansTask } from '../SquadPlansTimeline';

const task = (type: string): PlansTask => ({ id: type, jiraKey: 'X-1', title: '', type, status: '', statusCategory: 'new', assigneeName: '', targetStart: '', targetEnd: '' }) as unknown as PlansTask;
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
  });

  it('"dev" dentro de outra palavra não vira Codificação', () => {
    expect(order('Devolução')).toBe(99);
  });

  it('fases configuradas pela squad mandam na ordem', () => {
    const phases = [
      { id: 'a', label: 'Teste', kind: 'QA', color: 'bg-amber-600', issueTypes: ['Teste QA'] },
      { id: 'b', label: 'Código', kind: 'DEV', color: 'bg-blue-600', issueTypes: ['Codificação'] },
    ] as never;
    expect(resolveWorkflowPhase(task('Teste QA'), phases).order).toBe(0);
    expect(resolveWorkflowPhase(task('Codificação'), phases).order).toBe(1);
  });
});
