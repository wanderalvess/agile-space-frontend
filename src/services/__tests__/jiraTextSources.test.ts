import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraIssue } from '../jiraService';
import { buildIssueSources } from '../jiraService';
import { fieldValue, originsOf, sameText } from '../jiraProvenance';

const authFetch = vi.fn();
vi.mock('../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { refineSourcesWithServer } from '../jiraTextSources';

const issue = (key: string, description: string): JiraIssue => {
  const sources = buildIssueSources({ description, comments: [] });
  return {
    key, title: `Título ${key}`, description, type: 'História', status: 'Concluído', priority: 'Alta', points: 0, url: '',
    acceptanceCriteria: fieldValue(sources.acceptanceCriteria), problem: fieldValue(sources.problem), solution: fieldValue(sources.solution), sources,
    raw: { key, type: 'História', title: `Título ${key}`, description, criteriaField: '', comments: [] },
  };
};

const serverField = (confidence: string, sourceId: string | null, text: string) => ({
  confidence, sourceId,
  candidates: text ? [{ id: sourceId ?? 'descricao-inicio', kind: 'descricao', label: 'Descrição', text, explicit: confidence === 'certa' }] : [],
});

beforeEach(() => authFetch.mockReset());

describe('refineSourcesWithServer', () => {
  it('troca as fontes locais pelas do servidor e trata sourceId nulo como campo vazio', async () => {
    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [{
          key: 'PTV-1',
          problem: serverField('certa', 'descricao', 'Problema do servidor'),
          solution: serverField('vazio', null, ''),
          acceptanceCriteria: serverField('revisar', null, 'Linhas em Gherkin'),
        }],
      }),
    });

    const [out] = await refineSourcesWithServer([issue('PTV-1', 'Texto local solto.')]);

    expect(out.problem).toBe('Problema do servidor');
    expect(out.sources!.solution.sourceId).toBeUndefined();
    expect(out.acceptanceCriteria).toBe('');
    expect(out.sources!.acceptanceCriteria.confidence).toBe('revisar');
    const body = JSON.parse(authFetch.mock.calls[0][1].body);
    expect(body.issues[0].key).toBe('PTV-1');
    expect(body.issues[0].description).toBe('Texto local solto.');
    expect(authFetch.mock.calls[0][0]).toMatch(/\/jira\/text-sources$/);
  });

  it('backend antigo (404), erro de rede ou resposta de tamanho errado deixam as issues como estão', async () => {
    const original = [issue('PTV-1', 'Texto local solto.')];

    authFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await refineSourcesWithServer(original)).toBe(original);

    authFetch.mockRejectedValueOnce(new Error('rede'));
    expect(await refineSourcesWithServer(original)).toBe(original);

    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ issues: [] }) });
    expect(await refineSourcesWithServer(original)).toBe(original);
  });

  it('issue sem texto cru (XML) não vai ao servidor', async () => {
    const xml: JiraIssue = { key: 'X-1', title: 't', description: '', type: '', status: '', priority: '', points: 0, url: '', acceptanceCriteria: '' };
    expect(await refineSourcesWithServer([xml])).toEqual([xml]);
    expect(authFetch).not.toHaveBeenCalled();
  });
});

describe('originsOf e sameText', () => {
  it('guarda uma origem por campo que entrou preenchido, com o que o Jira tinha', () => {
    const i = issue('PTV-2', 'Problema:\nA fila é montada à mão.');
    const origins = originsOf(i);

    expect(origins).toHaveLength(1);
    expect(origins[0]).toMatchObject({ field: 'problem', sourceKind: 'descricao' });
    expect(origins[0].originalText).toContain('montada à mão');
  });

  it('campo vazio ou ainda em dúvida não gera origem; issue sem fontes também não', () => {
    expect(originsOf(issue('PTV-3', 'Texto solto sem título.'))).toEqual([]);
    expect(originsOf({ sources: undefined })).toEqual([]);
  });

  it('sameText ignora espaços e quebras repetidos', () => {
    expect(sameText('a  b\n c', ' a b c ')).toBe(true);
    expect(sameText('a b', 'a c')).toBe(false);
    expect(sameText(undefined, '')).toBe(true);
  });
});
