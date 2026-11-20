import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JiraImportConferir } from '../JiraImportConferir';
import { buildIssueSources } from '../../../services/jiraService';
import type { JiraIssue } from '../../../services/jiraService';
import { fieldValue } from '../../../services/jiraProvenance';

const issue = (key: string, description: string, comments: { body: string; author?: string; created?: string }[] = []): JiraIssue => {
  const sources = buildIssueSources({ description, comments });
  return {
    key, title: `Título de ${key}`, description, type: 'História', status: 'Concluído', priority: 'Alta', points: 0, url: `https://jira/browse/${key}`,
    acceptanceCriteria: fieldValue(sources.acceptanceCriteria), problem: fieldValue(sources.problem), solution: fieldValue(sources.solution), sources,
  };
};

describe('JiraImportConferir', () => {
  it('mostra a issue em dúvida primeiro, com a fonte sugerida e a opção de deixar vazio', () => {
    const html = renderToStaticMarkup(
      <JiraImportConferir
        issues={[
          issue('PTV-1', 'Problema:\nA fila é montada à mão.\nSolução:\nOrdenar pela prioridade.'),
          issue('PTV-2', 'O painel não mostra quantas horas a squad tem livres.'),
        ]}
        choices={{}}
        onChoose={() => undefined}
      />,
    );
    expect(html).toContain('1 certas');
    expect(html).toContain('1 para revisar');
    // a issue com palpite é a aberta
    expect(html).toContain('Título de PTV-2');
    expect(html).toContain('Descrição, início do texto');
    expect(html).toContain('Sugerida');
    expect(html).toContain('Deixar vazio');
    // palpite não entra: o campo diz que está vazio até a escolha
    expect(html).toContain('Aceite a sugestão ou deixe o campo vazio');
  });

  it('com a escolha feita, a issue deixa de pedir revisão e o campo mostra a fonte', () => {
    const html = renderToStaticMarkup(
      <JiraImportConferir
        issues={[issue('PTV-2', 'O painel não mostra quantas horas a squad tem livres.')]}
        choices={{ 'PTV-2': { problem: 'descricao-inicio' } }}
        onChoose={() => undefined}
      />,
    );
    expect(html).not.toContain('para revisar');
    expect(html).toContain('Escolhida por você');
    expect(html).toContain('Fonte:');
  });

  it('issue vinda do XML avisa que não tem como mostrar a origem', () => {
    const xml: JiraIssue = { key: 'X-1', title: 'Do arquivo', description: '', type: 'Task', status: '', priority: '', points: 0, url: '', acceptanceCriteria: '' };
    const html = renderToStaticMarkup(<JiraImportConferir issues={[xml]} choices={{}} onChoose={() => undefined} />);
    expect(html).toContain('arquivo XML');
  });
});
