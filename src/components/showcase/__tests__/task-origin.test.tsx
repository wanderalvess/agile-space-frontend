import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaskCardContentFields } from '../TaskCardContentFields';
import { makeTask } from '../utils';
import { buildIssueSources } from '../../../services/jiraService';
import { fieldValue } from '../../../services/jiraProvenance';
import type { ShowcaseTask } from '../types';

const importedIssue = (description: string) => {
  const sources = buildIssueSources({ description, comments: [] });
  return {
    key: 'PTV-1', title: 'T', description, type: 'História', status: 'Concluído', priority: 'Alta', points: 0, url: '',
    acceptanceCriteria: fieldValue(sources.acceptanceCriteria), problem: fieldValue(sources.problem), solution: fieldValue(sources.solution), sources,
  };
};

describe('makeTask com origem dos textos', () => {
  it('palpite não aceito deixa o Problema vazio em vez de despejar a descrição inteira', () => {
    const task = makeTask(importedIssue('Texto solto sem título nenhum.'));
    expect(task.evidence.problem).toBe('');
    expect(task.origins).toEqual([]);
  });

  it('texto de título explícito entra e guarda a origem para o "Restaurar do Jira"', () => {
    const task = makeTask(importedIssue('Problema:\nA fila é montada à mão.\nSolução:\nOrdenar pela prioridade.'));
    expect(task.evidence.problem).toContain('montada à mão');
    expect(task.origins.map((o: { field: string }) => o.field).sort()).toEqual(['problem', 'solution']);
    expect(task.origins[0].originalText).toBeTruthy();
  });

  it('issue sem fontes (XML) mantém o comportamento de antes, sem origins', () => {
    const task = makeTask({ key: 'X-1', title: 'T', description: 'Descrição inteira', problem: '', solution: '' });
    expect(task.evidence.problem).toBe('Descrição inteira');
    expect('origins' in task).toBe(false);
  });
});

describe('selos de origem no card', () => {
  const base = (): ShowcaseTask => makeTask(importedIssue('Problema:\nA fila é montada à mão.\nSolução:\nOrdenar pela prioridade.')) as ShowcaseTask;
  const render = (task: ShowcaseTask) =>
    renderToStaticMarkup(<TaskCardContentFields task={task} isMetricsCard={false} onUpdate={() => undefined} />);

  it('mostra de onde veio o texto, sem "Restaurar" enquanto ninguém editou', () => {
    const html = render(base());
    expect(html).toContain('Do Jira · Descrição, seção');
    expect(html).not.toContain('Restaurar do Jira');
    expect(html).not.toContain('Editado por você');
  });

  it('texto editado mostra "Editado por você" e o caminho de volta', () => {
    const task = base();
    const html = render({ ...task, evidence: { ...task.evidence, problem: 'Outro texto escrito pela pessoa.' } });
    expect(html).toContain('Editado por você');
    expect(html).toContain('Restaurar do Jira');
  });

  it('card manual, sem origins, não mostra selo nenhum', () => {
    const task = base();
    const html = render({ ...task, origins: undefined });
    expect(html).not.toContain('Do Jira ·');
  });
});
