import { describe, expect, it } from 'vitest';
import {
  answersFromSummary,
  compareBoards,
  evolutionDelta,
  evolutionPoints,
  filterHealthRows,
  formatDelta,
  mergeHealthRows,
  normalizeBoardId,
  parseJoinInput,
  previousBoard,
  rowFromBoard,
  squadChoices,
  squadDisplayName,
  summaryOfBoard,
} from '../health-check-lobby';
import { summarizeResults } from '../health-check-rules';
import type { HealthCheckBoard } from '../types';

const ID = '7c1e5f0a-93b4-4b52-a1d2-0f6e3a9c8d41';

function board(over: Partial<HealthCheckBoard> & { id: string }): HealthCheckBoard {
  return {
    creatorId: 'u1',
    status: 'collecting',
    createdAt: '2026-10-01T10:00:00Z',
    dimensions: [{ key: 'a', title: 'Apoio', description: '' }, { key: 'b', title: 'Equipe', description: '' }],
    scaleType: 'traffic_light',
    sprintName: 'Radar',
    team: 'PHX',
    ...over,
  };
}

const finished = (id: string, createdAt: string, green: number, sprintName = id): HealthCheckBoard =>
  board({
    id,
    status: 'finished',
    createdAt,
    sprintName,
    summary: {
      topMetrics: [],
      lowMetrics: [],
      results: [
        { dimensionKey: 'a', values: { green, red: 10 - green } },
        { dimensionKey: 'b', values: { green: 10 } },
      ],
    },
  });

describe('entrar por ID ou link', () => {
  it('ID puro em UUID volta para minúsculas (a caixa antiga forçava maiúsculas e a sala não era achada)', () => {
    expect(parseJoinInput(ID.toUpperCase())).toEqual({ id: ID, fromLink: false });
    expect(normalizeBoardId(` ${ID.toUpperCase()} `)).toBe(ID);
  });

  it('ID que não é UUID (radar antigo) mantém as maiúsculas e minúsculas', () => {
    expect(parseJoinInput('AbC123xYz')).toEqual({ id: 'AbC123xYz', fromLink: false });
  });

  it('extrai o ID de um link inteiro, com parâmetros e âncora', () => {
    expect(parseJoinInput(`https://portal.espacoagil.com.br/health-check/${ID}`)).toEqual({ id: ID, fromLink: true });
    expect(parseJoinInput(`/health-check/${ID}?x=1#topo`)).toEqual({ id: ID, fromLink: true });
    expect(parseJoinInput(`  http://localhost:9002/health-check/${ID.toUpperCase()}/ `)).toEqual({ id: ID, fromLink: true });
  });

  it('link de outra ferramenta não vira rota quebrada', () => {
    expect(parseJoinInput('https://portal.espacoagil.com.br/retro/abc')).toBeNull();
    expect(parseJoinInput('dois ids')).toBeNull();
  });

  it('vazio não entra', () => {
    expect(parseJoinInput('')).toBeNull();
    expect(parseJoinInput('   ')).toBeNull();
  });
});

describe('linhas da lista', () => {
  it('radar encerrado leva a nota de clima; coletando não tem nota', () => {
    const row = rowFromBoard(finished('f1', '2026-09-01T10:00:00Z', 8));
    expect(row.status).toBe('finished');
    expect(row.score).toBeCloseTo((((8 * 3 + 2 * 1) / 10 - 1) / 2) * 5 + 5, 5);
    expect(rowFromBoard(board({ id: 'c1' })).score).toBeNull();
    expect(rowFromBoard(board({ id: 'c1' })).status).toBe('collecting');
  });

  it('resumo só existe para radar encerrado com resumo', () => {
    expect(summaryOfBoard(board({ id: 'x' }))).toBeNull();
    expect(summaryOfBoard(board({ id: 'x', status: 'finished' }))).toBeNull();
    expect(summaryOfBoard(finished('f', '2026-09-01T10:00:00Z', 9))?.climate).not.toBeNull();
  });

  it('junta o servidor e os radares abertos neste navegador, sem repetir, do mais novo para o mais antigo', () => {
    const rows = mergeHealthRows(
      [board({ id: 'a', createdAt: '2026-10-02T10:00:00Z' }), board({ id: 'b', createdAt: '2026-10-05T10:00:00Z' })],
      [
        { roomId: 'a', title: 'repetido', team: 'PHX', createdAt: '2026-10-02T10:00:00Z' },
        { roomId: 'c', title: 'só local', team: 'OUTRA', createdAt: '2026-10-09T10:00:00Z' },
      ],
      new Map([['b', 7]])
    );
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0].status).toBeNull();
    expect(rows[1].answers).toBe(7);
  });

  it('filtra por situação e busca sem diferenciar acentos nem caixa', () => {
    const rows = [
      rowFromBoard(board({ id: '1', sprintName: 'Radar Sprint 42' })),
      rowFromBoard(finished('2', '2026-09-01T10:00:00Z', 9, 'Maturidade Scrum')),
      rowFromBoard(finished('3', '2026-08-01T10:00:00Z', 9, 'Clima da squad · agosto')),
    ];
    expect(filterHealthRows(rows, 'all', '').map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(filterHealthRows(rows, 'collecting', '').map((r) => r.id)).toEqual(['1']);
    expect(filterHealthRows(rows, 'finished', '').map((r) => r.id)).toEqual(['2', '3']);
    expect(filterHealthRows(rows, 'all', 'MATURIDADE').map((r) => r.id)).toEqual(['2']);
    expect(filterHealthRows(rows, 'all', 'clima da squad · agosto').map((r) => r.id)).toEqual(['3']);
    expect(filterHealthRows(rows, 'all', 'maturidáde').map((r) => r.id)).toEqual(['2']);
  });

  it('lê "N respostas" do histórico e não inventa contagem quando falta', () => {
    expect(answersFromSummary('9 respostas')).toBe(9);
    expect(answersFromSummary('1 resposta')).toBe(1);
    expect(answersFromSummary(null)).toBeNull();
    expect(answersFromSummary('7 aprovadas')).toBeNull();
  });
});

describe('evolução do clima', () => {
  const boards = [
    finished('c', '2026-09-01T10:00:00Z', 6),
    finished('a', '2026-07-01T10:00:00Z', 4),
    finished('b', '2026-08-01T10:00:00Z', 5),
    board({ id: 'aberto', createdAt: '2026-10-01T10:00:00Z' }),
  ];

  it('só radares encerrados, do mais antigo ao mais novo', () => {
    expect(evolutionPoints(boards).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('limita aos mais recentes', () => {
    const many = Array.from({ length: 12 }, (_, i) => finished(`f${i}`, `2026-0${(i % 9) + 1}-15T10:00:00Z`, 7));
    expect(evolutionPoints(many, 5)).toHaveLength(5);
  });

  it('variação sobre o anterior', () => {
    const points = evolutionPoints(boards);
    const d = evolutionDelta(points) as number;
    expect(d).toBeGreaterThan(0);
    expect(evolutionDelta(points.slice(0, 1))).toBeNull();
  });

  it('formata a variação com sinal e vírgula', () => {
    expect(formatDelta(0.6)).toBe('+0,6');
    expect(formatDelta(-0.34)).toBe('−0,3');
    expect(formatDelta(0)).toBe('0,0');
    expect(formatDelta(0.04)).toBe('0,0');
  });
});

describe('comparar com o radar anterior', () => {
  const current = finished('cur', '2026-10-01T10:00:00Z', 9);

  it('escolhe o encerrado mais recente anterior ao atual, na mesma squad', () => {
    const prev = previousBoard(current, [
      finished('old', '2026-07-01T10:00:00Z', 5),
      finished('mid', '2026-09-01T10:00:00Z', 6),
      finished('futuro', '2026-11-01T10:00:00Z', 7),
      board({ id: 'aberto', createdAt: '2026-09-20T10:00:00Z' }),
      current,
    ]);
    expect(prev?.id).toBe('mid');
  });

  it('sem pergunta em comum não há com o que comparar', () => {
    const other = { ...finished('x', '2026-09-01T10:00:00Z', 5), dimensions: [{ key: 'z', title: 'Outra', description: '' }] };
    expect(previousBoard(current, [other])).toBeNull();
  });

  it('só compara a mesma pergunta (mesma chave e mesmo título)', () => {
    const cur = finished('cur', '2026-10-01T10:00:00Z', 9);
    const prev = {
      ...finished('prev', '2026-09-01T10:00:00Z', 5),
      dimensions: [{ key: 'a', title: 'apoio', description: '' }, { key: 'b', title: 'Outro título', description: '' }],
    };
    const a = summarizeResults(cur.dimensions, cur.summary?.results, 'traffic_light');
    const b = summarizeResults(prev.dimensions, prev.summary?.results, 'traffic_light');
    const diffs = compareBoards(a, cur.dimensions, b, prev.dimensions);
    expect(diffs.map((d) => d.key)).toEqual(['a']);
    expect(diffs[0].delta).toBeGreaterThan(0);
  });
});

describe('squads para escolher', () => {
  it('usa os vínculos, sem repetir e em ordem alfabética', () => {
    const c = squadChoices([{ projectId: 'ZED', projectName: 'Zeta' }, { projectId: 'phx', projectName: 'Phoenix' }, { projectId: 'PHX', projectName: 'Outro' }], { squadId: 'X' });
    expect(c.map((x) => x.label)).toEqual(['Phoenix', 'Zeta']);
  });

  it('sem vínculos cai na squad ativa; sem nenhuma, vazio', () => {
    expect(squadChoices([], { squadId: 'PHX', squadName: 'Phoenix' })).toEqual([{ value: 'PHX', label: 'Phoenix' }]);
    expect(squadChoices(null, { squadId: '' })).toEqual([]);
  });

  it('mostra o nome da squad pela chave gravada no radar', () => {
    const c = squadChoices([{ projectId: 'PHX', projectName: 'Phoenix' }], {});
    expect(squadDisplayName('phx', c)).toBe('Phoenix');
    expect(squadDisplayName('OUTRA', c)).toBe('OUTRA');
    expect(squadDisplayName('', c)).toBe('');
  });
});

describe('atalho local de salas', () => {
  it('tira só a sala apagada e aguenta dado quebrado', async () => {
    const { removeLocalRoomMeta } = await import('../health-check-lobby');
    const mem = new Map<string, string>([['agileSpace_rooms_meta', JSON.stringify([{ roomId: 'a' }, { roomId: 'b' }])]]);
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    removeLocalRoomMeta('a', storage);
    expect(JSON.parse(mem.get('agileSpace_rooms_meta') as string)).toEqual([{ roomId: 'b' }]);
    mem.set('agileSpace_rooms_meta', '{quebrado');
    expect(() => removeLocalRoomMeta('b', storage)).not.toThrow();
    expect(() => removeLocalRoomMeta('b', undefined)).not.toThrow();
  });
});
