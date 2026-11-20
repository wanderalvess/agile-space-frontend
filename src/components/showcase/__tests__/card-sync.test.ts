import { describe, expect, it } from 'vitest';
import type { ShowcaseSession, ShowcaseTask } from '../types';
import {
  applyChanges,
  applyServerCard,
  conflictSummary,
  deepEqual,
  diffCard,
  fieldLabel,
  findCollisions,
  mergeChanges,
  parseCardConflict,
  parseDecisionRestricted,
  previewValue,
  revertDecisions,
  staleCardsMessage,
  supportsPatch,
  toPatchBody,
  withoutDecisionChanges,
} from '../card-sync';

function card(over: Partial<ShowcaseTask> = {}): ShowcaseTask {
  return {
    id: 'c1', key: 'PTV-1', title: 'Título', description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 3,
    assignee: '', url: '',
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: '', video: '', timeSpent: 0, timeEstimate: 0, planned: null },
    decision: 'open', preparationStatus: 'doing', feedback: '', version: 3, ...over,
  } as ShowcaseTask;
}
const session = (tasks: ShowcaseTask[]): ShowcaseSession => ({ id: 's1', name: 'R', sprintName: 'S', tasks, createdAt: null, status: 'planning' });

describe('diff do card', () => {
  it('só lista o que mudou, com evidência por subcampo', () => {
    const prev = card();
    const next = { ...prev, title: 'Novo', evidence: { ...prev.evidence, solution: 'nova' } };
    expect(diffCard(prev, next)).toEqual([
      { path: 'title', value: 'Novo', base: 'Título' },
      { path: 'evidence.solution', value: 'nova', base: 's' },
    ]);
  });

  it('não lista campos do servidor (decidedBy, approvedAt, version, anexos)', () => {
    const prev = card();
    const next = { ...prev, decidedBy: 'u1', decidedByName: 'Ana', approvedAt: 'x', decidedAt: 'y', version: 9, attachments: [] };
    expect(diffCard(prev, next)).toEqual([]);
  });

  it('métricas entram por inteiro', () => {
    const prev = card({ metrics: [{ field: 'A', value: 1 }] });
    const next = { ...prev, metrics: [{ field: 'A', value: 2 }] };
    expect(diffCard(prev, next)).toEqual([{ path: 'metrics', value: [{ field: 'A', value: 2 }], base: [{ field: 'A', value: 1 }] }]);
  });

  it('applyChanges é o inverso do diff e não mexe no original', () => {
    const prev = card();
    const changes = [{ path: 'title', value: 'X', base: 'Título' }, { path: 'evidence.qa', value: 'Caio', base: 'Bruno' }];
    const next = applyChanges(prev, changes);
    expect(next.title).toBe('X');
    expect(next.evidence.qa).toBe('Caio');
    expect(next.evidence.dev).toBe('Ana');
    expect(prev.title).toBe('Título');
  });
});

describe('juntar alterações pendentes', () => {
  it('o valor é o mais novo e a base é a da primeira alteração', () => {
    const merged = mergeChanges(
      [{ path: 'title', value: 'B', base: 'A' }],
      [{ path: 'title', value: 'C', base: 'B' }, { path: 'feedback', value: 'f', base: '' }],
    );
    expect(merged).toEqual([{ path: 'title', value: 'C', base: 'A' }, { path: 'feedback', value: 'f', base: '' }]);
  });
});

describe('corpo do PATCH', () => {
  it('leva a versão lida, agrupa a evidência e troca undefined por null', () => {
    const body = toPatchBody(3, [
      { path: 'title', value: 'Novo', base: 'x' },
      { path: 'evidence.solution', value: 'nova', base: 's' },
      { path: 'evidence.qa', value: 'Caio', base: 'Bruno' },
      { path: 'chartType', value: undefined, base: 'bar' },
    ]);
    expect(body).toEqual({ version: 3, title: 'Novo', evidence: { solution: 'nova', qa: 'Caio' }, chartType: null });
  });

  it('sem evidência não manda o objeto evidence', () => {
    expect(toPatchBody(1, [{ path: 'title', value: 'a', base: 'b' }])).not.toHaveProperty('evidence');
  });
});

describe('colisões no 409', () => {
  const mine = [
    { path: 'title', value: 'Meu título', base: 'Título' },
    { path: 'evidence.solution', value: 'minha solução', base: 's' },
  ];

  it('campos diferentes: nada colide (reaplica sozinho)', () => {
    const server = card({ version: 4, evidence: { ...card().evidence, qa: 'Outro' } });
    expect(findCollisions(server, mine)).toEqual([]);
  });

  it('o mesmo campo mudou dos dois lados: colide', () => {
    const server = card({ version: 4, title: 'Título do outro' });
    expect(findCollisions(server, mine).map((c) => c.path)).toEqual(['title']);
  });

  it('o outro escreveu exatamente o mesmo texto: não colide', () => {
    const server = card({ version: 4, title: 'Meu título' });
    expect(findCollisions(server, mine)).toEqual([]);
  });
});

describe('card do servidor na sessão', () => {
  it('troca só aquele card e mantém por cima o que ainda não foi gravado', () => {
    const s = session([card(), card({ id: 'c2', key: 'PTV-2' })]);
    const pending = [{ path: 'title', value: 'Meu título', base: 'Título' }];
    const next = applyServerCard(s, { ...card(), version: 4, description: 'do servidor', title: 'Título' }, pending);
    expect(next?.tasks[0].version).toBe(4);
    expect(next?.tasks[0].description).toBe('do servidor');
    expect(next?.tasks[0].title).toBe('Meu título');
    expect(next?.tasks[1]).toBe(s.tasks[1]);
  });

  it('evento com versão igual ou menor é ignorado (devolve a mesma sessão)', () => {
    const s = session([card({ version: 5 })]);
    expect(applyServerCard(s, { ...card(), version: 5, title: 'x' }, [], { ignoreOlder: true })).toBe(s);
    expect(applyServerCard(s, { ...card(), version: 4, title: 'x' }, [], { ignoreOlder: true })).toBe(s);
    expect(applyServerCard(s, { ...card(), version: 6, title: 'x' }, [], { ignoreOlder: true })?.tasks[0].title).toBe('x');
  });

  it('card que não existe aqui devolve null (a sala recarrega)', () => {
    expect(applyServerCard(session([card()]), { ...card(), id: 'novo' })).toBeNull();
  });

  it('mantém os anexos da tela quando o card do servidor não os traz', () => {
    const files = [{ id: 'f1', taskId: 'c1', name: 'a.png', contentType: 'image/png', size: 1 }];
    const s = session([card({ attachments: files })]);
    const raw: Record<string, unknown> = { ...card({ version: 4 }) };
    delete raw.attachments;
    expect(applyServerCard(s, raw)?.tasks[0].attachments).toEqual(files);
  });
});

describe('trava de decisão', () => {
  it('lê o 403 DECISION_RESTRICTED com os cards recusados', () => {
    const err = { status: 403, code: 'DECISION_RESTRICTED', body: { cardIds: ['c1', 'c7'] } };
    expect(parseDecisionRestricted(err)).toEqual({ cardIds: ['c1', 'c7'] });
    expect(parseDecisionRestricted({ status: 403, code: 'OUTRO' })).toBeNull();
    expect(parseDecisionRestricted({ status: 500, code: 'DECISION_RESTRICTED' })).toBeNull();
    expect(parseDecisionRestricted(null)).toBeNull();
  });

  it('tira veredito e feedback das alterações', () => {
    const changes = [{ path: 'decision', value: 'approved', base: 'open' }, { path: 'title', value: 'a', base: 'b' }, { path: 'feedback', value: 'f', base: '' }];
    expect(withoutDecisionChanges(changes).map((c) => c.path)).toEqual(['title']);
  });

  it('revertDecisions devolve a decisão do servidor só nos cards recusados', () => {
    const latest = session([card({ decision: 'needs_adjustment', feedback: 'ajuste', decidedByName: 'Pat' }), card({ id: 'c2' })]);
    const mine = session([
      card({ decision: 'approved', feedback: '', decidedByName: 'Eu', title: 'editado' }),
      card({ id: 'c2', decision: 'approved' }),
    ]);
    const next = revertDecisions(mine, latest, ['c1']);
    expect(next.tasks[0]).toMatchObject({ decision: 'needs_adjustment', feedback: 'ajuste', decidedByName: 'Pat', title: 'editado' });
    expect(next.tasks[1].decision).toBe('approved');
  });

  it('card novo recusado nasce sem decisão', () => {
    const next = revertDecisions(session([card({ id: 'novo', decision: 'approved', feedback: 'x' })]), session([]), ['novo']);
    expect(next.tasks[0]).toMatchObject({ decision: 'open', feedback: '' });
  });
});

describe('409 CARD_VERSION_CONFLICT', () => {
  it('devolve o card atual já normalizado', () => {
    const err = { status: 409, code: 'CARD_VERSION_CONFLICT', body: { card: { id: 'c1', version: 5, title: 'T', evidence: { problem: null } } } };
    const c = parseCardConflict(err);
    expect(c?.version).toBe(5);
    expect(c?.evidence.problem).toBe('');
    expect(parseCardConflict({ status: 409, code: 'CARD_VERSION_CONFLICT', body: {} })).toBeNull();
    expect(parseCardConflict({ status: 409 })).toBeNull();
  });
});

describe('textos', () => {
  it('versão do card existe só no backend novo', () => {
    expect(supportsPatch(card())).toBe(true);
    expect(supportsPatch(card({ version: undefined }))).toBe(false);
    expect(supportsPatch(undefined)).toBe(false);
  });

  it('cards mantidos no servidor, no singular e no plural', () => {
    expect(staleCardsMessage(1)).toBe('1 card foi mantido como estava no servidor');
    expect(staleCardsMessage(3)).toBe('3 cards foram mantidos como estavam no servidor');
  });

  it('resumo do conflito e rótulos dos campos', () => {
    expect(conflictSummary('PTV-12', [{ path: 'title', value: '', base: '' }, { path: 'evidence.solution', value: '', base: '' }]))
      .toBe('Outra pessoa alterou PTV-12 ao mesmo tempo: título, solução. Sua versão não foi gravada.');
    expect(fieldLabel('evidence.qa')).toBe('QA');
    expect(fieldLabel('algo.novo')).toBe('algo.novo');
  });

  it('prévia curta do valor digitado', () => {
    expect(previewValue('')).toBe('(vazio)');
    expect(previewValue('a\n  b')).toBe('a b');
    expect(previewValue('x'.repeat(200), 10)).toBe('xxxxxxxxx…');
    expect(previewValue([{ field: 'A', value: 2 }])).toBe('A: 2');
  });

  it('deepEqual compara estruturas', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });
});
