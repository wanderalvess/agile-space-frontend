import { describe, expect, it } from 'vitest';
import type { BrainstormingGroup, BrainstormingIdea } from '../../../lib/types';
import {
  PLAN_DEFAULT_COUNT,
  buildPlanTask,
  defaultPlanSelection,
  planCandidates,
  planEffort,
  planLockKey,
  planSourceLabel,
  planTitle,
  planWhy,
  readPlanLock,
  writePlanLock,
} from '../brainstorm-plan';
import { CSV_HEADER, buildCsv, buildMarkdown, csvCell, csvFileName } from '../brainstorm-export';

function idea(over: Partial<BrainstormingIdea> = {}): BrainstormingIdea {
  return {
    id: 'i1', boardId: 'b1', content: 'texto', authorId: 'u1', votes: [], position: { x: 0, y: 0 },
    parentId: null, groupId: null, createdAt: '2026-10-13T10:00:00Z', ...over,
  };
}

const groups: BrainstormingGroup[] = [
  { id: 'g2', boardId: 'b1', title: 'Convites', order: 1 },
  { id: 'g1', boardId: 'b1', title: 'Primeiros passos', order: 0 },
];

describe('plano de ação a partir do Plano', () => {
  const list = [
    idea({ id: 'a', content: 'A', votes: ['1'], qualifiers: { roi: 80, effort: 20 } }),
    idea({ id: 'b', content: 'B', votes: ['1', '2', '3'], qualifiers: { roi: 80, effort: 80 } }),
    idea({ id: 'c', content: 'C', votes: ['1', '2'], qualifiers: { roi: 20, effort: 80 } }), // descartada
    idea({ id: 'd', content: '', hidden: true, votes: [] }), // oculta
    idea({ id: 'e', content: 'E', votes: [] }), // a classificar
    idea({ id: 'f', content: 'F', votes: ['1', '2'], qualifiers: { roi: 20, effort: 20 } }),
    idea({ id: 'g', content: 'G', votes: [], qualifiers: { roi: 80, effort: 20 } }),
    idea({ id: 'h', content: 'H', votes: [], qualifiers: { roi: 80, effort: 20 } }),
  ];

  it('candidatas: sem descartadas nem ocultas, mais votadas primeiro', () => {
    expect(planCandidates(list).map((i) => i.id)).toEqual(['b', 'f', 'a', 'e', 'g', 'h']);
  });

  it('entram marcadas as cinco primeiras', () => {
    expect(PLAN_DEFAULT_COUNT).toBe(5);
    const picked = defaultPlanSelection(planCandidates(list));
    expect(picked).toEqual(['b', 'f', 'a', 'e', 'g']);
    expect(defaultPlanSelection(planCandidates(list), 2)).toEqual(['b', 'f']);
    expect(defaultPlanSelection([])).toEqual([]);
  });

  it('título do plano', () => {
    expect(planTitle('Redesenho do onboarding')).toBe('Plano de Ação: Redesenho do onboarding');
    expect(planTitle('  ')).toBe('Plano de Ação: Brainstorming');
    expect(planTitle(undefined)).toBe('Plano de Ação: Brainstorming');
  });

  it('"por quê" cita os votos; "quanto" diz o esforço em palavras', () => {
    expect(planWhy(idea({ votes: ['1'] }))).toBe('Ideia priorizada no Brainstorming, 1 voto');
    expect(planWhy(idea({ votes: ['1', '2', '3', '4', '5'] }))).toBe('Ideia priorizada no Brainstorming, 5 votos');
    expect(planEffort(idea({ qualifiers: { roi: 80, effort: 20 } }))).toBe('Esforço baixo');
    expect(planEffort(idea({ qualifiers: { roi: 80, effort: 80 } }))).toBe('Esforço alto');
    expect(planEffort(idea({ qualifiers: { roi: 50, effort: 50 } }))).toBe('');
    expect(planEffort(idea())).toBe('');
  });

  it('cada ação leva o texto da ideia, o grupo e deixa quem, quando e como em branco', () => {
    const task = buildPlanTask(idea({ content: 'Checklist', votes: ['1', '2'], qualifiers: { roi: 80, effort: 20 } }), { title: 'Primeiros passos' }, 3);
    expect(task).toEqual({
      what: 'Checklist',
      why: 'Ideia priorizada no Brainstorming, 2 votos',
      where: 'Primeiros passos',
      when: '',
      who: '',
      how: '',
      howMuch: 'Esforço baixo',
      status: 'todo',
      order: 3,
      sourceItemId: 'i1',
      sourceLabel: 'Primeiros passos',
    });
    expect(buildPlanTask(idea(), undefined, 0).where).toBe('Squad');
  });

  it('a origem da ação é o grupo da ideia ou, sem grupo, o começo do texto', () => {
    expect(planSourceLabel(idea({ content: 'Automatizar o deploy' }), undefined)).toBe('Automatizar o deploy');
    expect(planSourceLabel(idea({ content: 'x' }), { title: '  Entrega  ' })).toBe('Entrega');
    const longo = planSourceLabel(idea({ content: 'a'.repeat(300) }), undefined);
    expect(longo.length).toBe(120);
    expect(longo.endsWith('…')).toBe(true);
  });

  it('trava local: guarda o plano criado e o lê de volta', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readPlanLock(storage, 'b1')).toBeNull();
    writePlanLock(storage, 'b1', { planId: 'p9', title: 'Plano de Ação: X', createdAt: '2026-10-17T10:00:00Z' });
    expect(store.has(planLockKey('b1'))).toBe(true);
    expect(readPlanLock(storage, 'b1')).toEqual({ planId: 'p9', title: 'Plano de Ação: X', createdAt: '2026-10-17T10:00:00Z' });
    expect(readPlanLock(storage, 'outro')).toBeNull();
  });

  it('trava local: valor estragado ou storage que falha não derruba a tela', () => {
    expect(readPlanLock({ getItem: () => '{nao e json' }, 'b1')).toBeNull();
    expect(readPlanLock({ getItem: () => '{"planId":3}' }, 'b1')).toBeNull();
    expect(readPlanLock({ getItem: () => { throw new Error('bloqueado'); } }, 'b1')).toBeNull();
    expect(readPlanLock(undefined, 'b1')).toBeNull();
    expect(() => writePlanLock({ setItem: () => { throw new Error('cheio'); } }, 'b1', { planId: 'p', title: '', createdAt: '' })).not.toThrow();
  });
});

describe('exportação', () => {
  const list = [
    idea({ id: 'a', content: 'Checklist\ninterativo', votes: ['1', '2'], groupId: 'g1', qualifiers: { roi: 80, effort: 20 } }),
    idea({ id: 'b', content: 'Vídeo curto', votes: ['1'], groupId: 'g1' }),
    idea({ id: 'c', content: 'Convite com link', votes: ['1', '2', '3'], groupId: 'g2', qualifiers: { roi: 80, effort: 80 } }),
    idea({ id: 'd', content: 'Mascote', votes: [], groupId: null }),
    idea({ id: 'e', content: '', hidden: true, votes: [], groupId: null }),
    idea({ id: 'f', content: 'Grupo apagado', votes: [], groupId: 'g-sumiu' }),
  ];

  it('Markdown: grupos pela ordem, ideias por votos, sem emojis, retorno e esforço em palavras', () => {
    const md = buildMarkdown({ title: 'Redesenho', date: '17/10/2026', ideas: list, groups });
    expect(md.split('\n')).toEqual([
      '# Brainstorming: Redesenho (17/10/2026)',
      '',
      '## Primeiros passos',
      '',
      '- [2 votos] Checklist interativo (retorno alto · esforço baixo)',
      '- [1 voto] Vídeo curto',
      '',
      '## Convites',
      '',
      '- [3 votos] Convite com link (retorno alto · esforço alto)',
      '',
      '## Sem grupo',
      '',
      '- [0 votos] Mascote',
      '- [0 votos] Grupo apagado',
    ]);
    expect(md).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('Markdown: título vazio e sessão sem ideias', () => {
    expect(buildMarkdown({ title: '', date: 'hoje', ideas: [], groups: [] })).toBe('# Brainstorming: Sem título (hoje)');
  });

  it('CSV: cabeçalho, uma linha por ideia lida e aspas escapadas uma vez só', () => {
    const csv = buildCsv(
      [idea({ content: 'disse "oi"', votes: ['1'], groupId: 'g1', qualifiers: { roi: 80, effort: 20 } }), idea({ id: 'x', hidden: true, content: '' })],
      groups
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(CSV_HEADER.map((h) => `"${h}"`).join(','));
    expect(lines[1].startsWith('"Primeiros passos","1","disse ""oi""","80","20","')).toBe(true);
  });

  it('CSV: grupo desconhecido e ideia sem grupo', () => {
    const csv = buildCsv([idea({ id: 'a', groupId: 'sumiu' }), idea({ id: 'b', groupId: null })], groups);
    const rows = csv.split('\n').slice(1);
    expect(rows[0].startsWith('"Desconhecido"')).toBe(true);
    expect(rows[1].startsWith('"Sem grupo"')).toBe(true);
  });

  it('CSV: texto que começa como fórmula não vira fórmula no Excel', () => {
    expect(csvCell('=SOMA(A1)')).toBe('"\'=SOMA(A1)"');
    expect(csvCell('+55 11')).toBe('"\'+55 11"');
    expect(csvCell('normal')).toBe('"normal"');
    expect(csvCell(12)).toBe('"12"');
  });

  it('nome do arquivo sem caracteres proibidos', () => {
    expect(csvFileName('Redesenho do onboarding')).toBe('brainstorming_Redesenho_do_onboarding.csv');
    expect(csvFileName('a/b:c*?')).toBe('brainstorming_abc.csv');
    expect(csvFileName('   ')).toBe('brainstorming_resumo.csv');
    expect(csvFileName(undefined)).toBe('brainstorming_resumo.csv');
  });
});
