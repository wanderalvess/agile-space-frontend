import { describe, expect, it } from 'vitest';
import { buildIssueSources } from '../jiraService';
import type { JiraIssue } from '../jiraService';
import {
  applyChoice, applyChoices, classify, fieldValue, pendingFields, summarize, withFallbackSources, type TextSource,
} from '../jiraProvenance';

const src = (id: string, text: string, explicit = true, kind: TextSource['kind'] = 'comentario'): TextSource =>
  ({ id, kind, label: id, text, explicit });

const baseIssue = (over: Partial<JiraIssue> = {}): JiraIssue => ({
  key: 'PTV-1', title: 't', description: '', type: 'História', status: 'Concluído', priority: 'Alta', points: 0, url: '', acceptanceCriteria: '',
  ...over,
});

describe('classify', () => {
  it('uma única fonte explícita é certa e entra sozinha', () => {
    const p = classify([src('c0', 'Texto do problema')]);
    expect(p.confidence).toBe('certa');
    expect(fieldValue(p)).toBe('Texto do problema');
  });

  it('duas fontes explícitas diferentes pedem revisão e o campo fica vazio', () => {
    const p = classify([src('c0', 'Primeiro texto'), src('c1', 'Outro texto')]);
    expect(p.confidence).toBe('revisar');
    expect(p.sourceId).toBeUndefined();
    expect(fieldValue(p)).toBe('');
  });

  it('o mesmo texto em duas fontes conta uma vez', () => {
    const p = classify([src('c0', 'Mesmo  texto'), src('d', 'mesmo texto', true, 'descricao')]);
    expect(p.confidence).toBe('certa');
    expect(p.candidates).toHaveLength(1);
  });

  it('só palpite não preenche o campo: fica para revisar, com a sugestão na lista', () => {
    const p = classify([src('guess', 'Começo da descrição', false, 'descricao')]);
    expect(p.confidence).toBe('revisar');
    expect(fieldValue(p)).toBe('');
    expect(p.candidates).toHaveLength(1);
  });

  it('palpite igual a uma fonte explícita não vira conflito', () => {
    const p = classify([src('guess', 'Texto', false, 'descricao'), src('c0', 'Texto')]);
    expect(p.confidence).toBe('certa');
    expect(p.sourceId).toBe('c0');
  });

  it('sem nenhum texto é vazio', () => {
    expect(classify([src('c0', '   ')]).confidence).toBe('vazio');
  });
});

describe('withFallbackSources', () => {
  it('soma subtarefa e pai só quando a issue não tem texto explícito', () => {
    const own = classify([src('c0', 'Do comentário')]);
    expect(withFallbackSources(own, [src('subtarefa-1', 'Da subtarefa', true, 'subtarefa')])).toBe(own);

    const guessOnly = classify([src('guess', 'Palpite', false, 'descricao')]);
    const merged = withFallbackSources(guessOnly, [src('subtarefa-1', 'Da subtarefa', true, 'subtarefa')]);
    expect(merged.confidence).toBe('certa');
    expect(fieldValue(merged)).toBe('Da subtarefa');
  });
});

describe('buildIssueSources', () => {
  it('título explícito no comentário vira Solução certa, com o autor na fonte', () => {
    const s = buildIssueSources({
      description: 'O painel não mostra a capacidade.',
      comments: [{ body: 'Solução:\nMostrar a capacidade por pessoa.', author: 'Carla Menezes', created: '2026-10-14T10:00:00.000-0300' }],
    });
    expect(s.solution.confidence).toBe('certa');
    expect(fieldValue(s.solution)).toContain('Mostrar a capacidade por pessoa');
    expect(s.solution.candidates[0].label).toContain('Carla Menezes');
  });

  it('descrição sem título "Problema" gera só um palpite, que não preenche', () => {
    const s = buildIssueSources({ description: 'O painel não mostra quantas horas a squad tem livres.', comments: [] });
    expect(s.problem.confidence).toBe('revisar');
    expect(fieldValue(s.problem)).toBe('');
    expect(s.problem.candidates[0].explicit).toBe(false);
  });

  it('título "Problema:" na descrição entra certo', () => {
    const s = buildIssueSources({ description: 'Problema:\nA fila é montada à mão.\nSolução:\nOrdenar pela prioridade.', comments: [] });
    expect(s.problem.confidence).toBe('certa');
    expect(fieldValue(s.problem)).toContain('montada à mão');
  });

  it('campo de critérios do Jira é certo; sem ele, linhas em Gherkin são palpite', () => {
    const withField = buildIssueSources({ criteriaField: 'A capacidade muda com as férias.', description: '', comments: [] });
    expect(withField.acceptanceCriteria.confidence).toBe('certa');

    const guess = buildIssueSources({ description: 'Dado que há férias\nQuando abro o painel\nEntão vejo a capacidade menor', comments: [] });
    expect(guess.acceptanceCriteria.confidence).toBe('revisar');
    expect(fieldValue(guess.acceptanceCriteria)).toBe('');
  });

  it('nada no Jira deixa os três campos vazios', () => {
    const s = buildIssueSources({ description: '', comments: [] });
    expect(s.problem.confidence).toBe('vazio');
    expect(s.solution.confidence).toBe('vazio');
    expect(s.acceptanceCriteria.confidence).toBe('vazio');
  });
});

describe('escolhas da conferência', () => {
  const issue = baseIssue({
    sources: buildIssueSources({ description: 'O painel não mostra a capacidade.', comments: [{ body: 'Contexto:\nAs horas livres não aparecem.', author: 'Ana', created: '2026-10-12T10:00:00.000-0300' }] }),
  });

  it('a issue com palpite e fonte explícita diferente aparece como pendente', () => {
    // palpite (descrição) + explícita (comentário) -> uma explícita só: certa
    expect(issue.sources!.problem.confidence).toBe('certa');
    expect(pendingFields(issue)).toEqual([]);
  });

  it('aplica a escolha da pessoa e deixa vazio quando ela escolhe vazio', () => {
    const guessOnly = baseIssue({ sources: buildIssueSources({ description: 'Texto solto.', comments: [] }) });
    expect(pendingFields(guessOnly)).toContain('problem');

    const accepted = applyChoice(guessOnly, 'problem', 'descricao-inicio');
    expect(accepted.problem).toBe('Texto solto.');
    expect(pendingFields(accepted)).not.toContain('problem');

    const empty = applyChoice(guessOnly, 'problem', null);
    expect(empty.problem).toBe('');
    expect(empty.sources!.problem.confidence).toBe('vazio');
  });

  it('ignora escolha de uma fonte que não existe', () => {
    const guessOnly = baseIssue({ sources: buildIssueSources({ description: 'Texto solto.', comments: [] }) });
    expect(applyChoice(guessOnly, 'problem', 'nao-existe')).toBe(guessOnly);
  });

  it('applyChoices e summarize contam certas, para revisar e sem texto', () => {
    const certa = baseIssue({ key: 'A', sources: buildIssueSources({ description: 'Problema:\nTexto.\nSolução:\nOutro.', comments: [] }) });
    const revisar = baseIssue({ key: 'B', sources: buildIssueSources({ description: 'Texto solto.', comments: [] }) });
    const vazia = baseIssue({ key: 'C', sources: buildIssueSources({ description: '', comments: [] }) });
    const list = [certa, revisar, vazia];
    expect(summarize(list)).toEqual({ certas: 1, revisar: 1, semTexto: 1 });
    expect(summarize(list, { B: { problem: 'descricao-inicio' } })).toEqual({ certas: 2, revisar: 0, semTexto: 1 });
    expect(applyChoices(list, { B: { problem: 'descricao-inicio' } })[1].problem).toBe('Texto solto.');
  });

  it('issue sem fontes (XML) conta como certa e não pede revisão', () => {
    expect(pendingFields(baseIssue())).toEqual([]);
    expect(summarize([baseIssue()])).toEqual({ certas: 1, revisar: 0, semTexto: 0 });
  });
});
