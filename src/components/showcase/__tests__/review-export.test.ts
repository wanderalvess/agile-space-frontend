import { afterEach, describe, expect, it } from 'vitest';
import type { ShowcaseTask } from '../types';
import {
  approvalRateOf,
  buildApprovalsTable,
  buildLinksText,
  buildLogMarkdown,
  decidedWhen,
  decisionGroups,
  efficiencyOf,
  fileSlug,
  groupByDecision,
  mdCell,
  participantNames,
  versionsText,
} from '../review-export';
import { PDF_COLORS, decisionRGB } from '../review-pdf';

function task(key: string, over: Partial<ShowcaseTask> = {}): ShowcaseTask {
  return {
    id: key, key, title: `Título ${key}`, description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 0,
    assignee: '', url: `https://jira/${key}`,
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: '', video: '', timeSpent: 3600, timeEstimate: 7200 },
    decision: 'open', preparationStatus: 'done', feedback: '', ...over,
  } as ShowcaseTask;
}

const tasks = [
  task('A-1', { decision: 'approved', decidedByName: 'Carla', project: 'repo', versionMaster: '1.0' }),
  task('A-2', { decision: 'needs_adjustment', feedback: 'Mostrar a ordem original' }),
  task('A-3', { decision: 'rejected' }),
  task('A-4'),
];

describe('exportação', () => {
  it('nome de arquivo sem acento nem caracteres especiais', () => {
    expect(fileSlug('Review da Sprint 42 — Série A/B', 'x')).toBe('review-da-sprint-42-serie-a-b');
    expect(fileSlug('###', 'review')).toBe('review');
  });

  it('célula de tabela escapa "|" e quebra de linha', () => {
    expect(mdCell('a|b\nc')).toBe('a\\|b c');
    expect(mdCell('')).toBe('—');
  });

  it('versões só com o que existe', () => {
    expect(versionsText(tasks[0])).toBe('Projeto: repo | Master: 1.0');
    expect(versionsText(tasks[1])).toBe('');
  });

  it('agrupa por decisão e ordena o que pede atenção primeiro', () => {
    const g = groupByDecision(tasks);
    expect([g.approved.length, g.adjustments.length, g.rejected.length, g.pending.length]).toEqual([1, 1, 1, 1]);
    expect(decisionGroups(tasks).map((x) => x.label)).toEqual(['Precisam de ajuste', 'Rejeitadas', 'Aguardando', 'Aprovadas']);
  });

  it('log em Markdown: aprovadas, pendências com motivo e sem decisão', () => {
    const md = buildLogMarkdown(null, 'Review 42', tasks, new Date('2026-10-17T10:00:00'));
    expect(md).toContain('# Relatório de Sprint Review — Review 42');
    expect(md).toContain('## Entregas Aprovadas (1)');
    expect(md).toContain('**Aprovado por:** Carla');
    expect(md).toContain('## Pendências (2)');
    expect(md).toContain('→ Motivo: Mostrar a ordem original');
    expect(md).toContain('→ Motivo: Sem feedback registrado');
    expect(md).toContain('## Sem decisão (1)');
    expect(md).not.toContain('## Squad');
  });

  it('o log lista os participantes só quando a Review os traz', () => {
    const md = buildLogMarkdown({ members: [{ id: '1', name: 'Ana', role: 'Dev' }] }, 'R', tasks);
    expect(md).toContain('## Squad\n- Ana (Dev)');
  });

  it('tabela de aprovações só com as aprovadas', () => {
    const t = buildApprovalsTable('Review 42', tasks);
    expect(t).toContain('| A-1 | https://jira/A-1 | Ana | Bruno | repo |');
    expect(t).not.toContain('A-2');
  });

  it('links das issues agrupados por decisão; card sem link não entra', () => {
    const withoutLink = [...tasks, task('A-5', { url: '' })];
    const { text, count } = buildLinksText(decisionGroups(withoutLink));
    expect(count).toBe(4);
    expect(text.startsWith('Precisam de ajuste (1)\nA-2 - Título A-2\nhttps://jira/A-2')).toBe(true);
    expect(text).not.toContain('A-5');
  });

  it('taxa de aprovação sobre avaliadas e estimado ÷ gasto', () => {
    expect(approvalRateOf(tasks)).toBe(33);
    expect(approvalRateOf([task('B-1')])).toBeNull();
    expect(efficiencyOf(tasks)).toBe(200);
    expect(efficiencyOf([task('B-1', { evidence: { ...tasks[0].evidence, timeSpent: 0 } })])).toBeNull();
  });
});

describe('paleta do PDF', () => {
  it('é a da TOTVS (azul institucional e ciano), sem violeta', () => {
    expect(PDF_COLORS.navy).toEqual([0, 34, 51]);
    expect(PDF_COLORS.cyan).toEqual([0, 219, 255]);
    const violet = [[76, 29, 149], [139, 92, 246], [124, 58, 237], [216, 180, 254]];
    const all = Object.values(PDF_COLORS).map((c) => JSON.stringify(c));
    for (const v of violet) expect(all).not.toContain(JSON.stringify(v));
  });
  it('cor da decisão', () => {
    expect(decisionRGB('approved')).toEqual(PDF_COLORS.approved);
    expect(decisionRGB('rejected')).toEqual(PDF_COLORS.rejected);
    expect(decisionRGB('open')).toEqual(PDF_COLORS.open);
  });
});

describe('participantes do resumo', () => {
  const participants = [
    { userId: 'u1', displayName: 'Ana Souza' },
    { userId: 'u2', displayName: ' Caio Lima ' },
    { userId: 'u3', displayName: 'ana souza' },
    { userId: 'u4', displayName: '' },
  ];

  it('lista os nomes sem repetir nem deixar vazio', () => {
    expect(participantNames({ participants })).toEqual(['Ana Souza', 'Caio Lima']);
  });

  it('sem a lista (backend antigo, Review não finalizada): vazio', () => {
    expect(participantNames({ participants: [] })).toEqual([]);
    expect(participantNames({})).toEqual([]);
    expect(participantNames(null)).toEqual([]);
  });

  it('o log em Markdown ganha a linha Participantes, e só quando há nomes', () => {
    const now = new Date('2026-10-17T12:00:00');
    const withLine = buildLogMarkdown({ participants }, 'Sprint 42', tasks, now);
    expect(withLine).toContain('Participantes: Ana Souza, Caio Lima');
    const without = buildLogMarkdown({ participants: [] }, 'Sprint 42', tasks, now);
    expect(without).not.toContain('Participantes');
    expect(buildLogMarkdown(null, 'Sprint 42', tasks, now)).not.toContain('Participantes');
  });
});

describe('decidedWhen (carimbo do servidor sem fuso vale UTC)', () => {
  const tzOriginal = process.env.TZ;
  afterEach(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });

  it('22:43 UTC sem fuso aparece como 19:43 em Brasília, e com Z ou offset dá o mesmo horário', () => {
    process.env.TZ = 'America/Sao_Paulo';
    expect(decidedWhen('2026-10-17T22:43:10.123456')).toBe('17/10 às 19:43');
    expect(decidedWhen('2026-10-17T22:43:10.123Z')).toBe('17/10 às 19:43');
    expect(decidedWhen('2026-10-17T19:43:10-03:00')).toBe('17/10 às 19:43');
  });

  it('vazio ou inválido devolve texto vazio', () => {
    expect(decidedWhen(undefined)).toBe('');
    expect(decidedWhen('')).toBe('');
    expect(decidedWhen('ontem')).toBe('');
  });
});
