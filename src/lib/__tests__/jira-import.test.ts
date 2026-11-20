import { describe, it, expect } from 'vitest';
import { JQL_PRESETS, EMPTY_FILTER, filterJiraResults, countDistinct, dedupeByKey, jiraStatusTone, stripHtml, cleanJiraDomain } from '../jira-import';

const r = (key: string, title: string, type: string, status: string, description = '') => ({ key, title, type, status, description });
const results = [
  r('A-1', 'Criar endpoint de saldo', 'História', 'Em desenvolvimento', '<p>Texto <b>rico</b> sobre saldo</p>'),
  r('A-2', 'Corrigir arredondamento', 'Bug', 'Aberto'),
  r('A-3', 'Spike de relatórios', 'Spike', 'Concluído'),
];

describe('filterJiraResults', () => {
  it('filtro vazio traz tudo', () => {
    expect(filterJiraResults(results, EMPTY_FILTER)).toHaveLength(3);
  });
  it('busca por chave, título e descrição sem as tags', () => {
    const f = (text: string) => filterJiraResults(results, { ...EMPTY_FILTER, text }).map((i) => i.key);
    expect(f('a-2')).toEqual(['A-2']);
    expect(f('RELATÓRIOS')).toEqual(['A-3']);
    expect(f('rico')).toEqual(['A-1']);
    expect(f('<b>')).toEqual([]);
  });
  it('combina tipo e status', () => {
    expect(filterJiraResults(results, { text: '', types: new Set(['Bug']), statuses: new Set() })).toHaveLength(1);
    expect(filterJiraResults(results, { text: '', types: new Set(['Bug']), statuses: new Set(['Concluído']) })).toHaveLength(0);
  });
});

describe('auxiliares', () => {
  it('countDistinct conta e ignora vazio', () => {
    expect(countDistinct([...results, r('A-4', 'x', '', 'Aberto')], (i) => i.status)).toEqual([['Em desenvolvimento', 1], ['Aberto', 2], ['Concluído', 1]]);
  });
  it('dedupeByKey mantém uma por chave', () => {
    expect(dedupeByKey([{ key: 'A', v: 1 }, { key: 'B', v: 2 }, { key: 'A', v: 3 }])).toEqual([{ key: 'A', v: 3 }, { key: 'B', v: 2 }]);
  });
  it('tom do status', () => {
    expect(jiraStatusTone('Concluído')).toBe('success');
    expect(jiraStatusTone('Em andamento')).toBe('brand');
    expect(jiraStatusTone('Bloqueado')).toBe('danger');
    expect(jiraStatusTone('Em revisão')).toBe('warn');
    expect(jiraStatusTone('Aberto')).toBe('neutral');
  });
  it('stripHtml e domínio', () => {
    expect(stripHtml('<p>a</p><p>b   c</p>')).toBe('a b c');
    expect(stripHtml('<p>Como <strong>facilitador</strong>, quero <a href="x">isso</a>.</p>')).toBe('Como facilitador, quero isso.');
    expect(stripHtml('a&nbsp;&amp;&nbsp;b &lt;c&gt;')).toBe('a & b <c>');
    expect(cleanJiraDomain(' https://jira.x.com/// ')).toBe('jira.x.com');
  });
  it('as consultas prontas continuam todas lá', () => {
    expect(JQL_PRESETS).toHaveLength(8);
    expect(new Set(JQL_PRESETS.map((p) => p.id)).size).toBe(8);
  });
});
