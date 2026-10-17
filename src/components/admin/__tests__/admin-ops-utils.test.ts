import { describe, it, expect } from 'vitest';
import {
  bulkDeleteSummary,
  buildCsv,
  buildNameIndex,
  canSelectWholeFilter,
  computeNps,
  csvField,
  distinctSorted,
  filterAuditLogs,
  filterFeedbacks,
  filterSessions,
  formatNps,
  nextChunk,
  npsSubtitle,
  ownerLabel,
  renewMessage,
  resolveName,
  sessionOpenPath,
  sessionParticipants,
  sortSessions,
  type AdminSession,
} from '../admin-ops-utils';

const NOW = new Date('2026-10-16T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('Sessões: rota de abrir a sala', () => {
  it('usa as rotas reais de cada ferramenta', () => {
    expect(sessionOpenPath('poker', 'abc')).toBe('/room/abc');
    expect(sessionOpenPath('retro', 'abc')).toBe('/retro/abc');
    expect(sessionOpenPath('health', 'abc')).toBe('/health-check/abc');
    expect(sessionOpenPath('brainstorm', 'abc')).toBe('/brainstorming/abc');
  });
  it('Planning e tipos desconhecidos não têm sala', () => {
    expect(sessionOpenPath('sprint_planning', 'x')).toBeNull();
    expect(sessionOpenPath('outro', 'x')).toBeNull();
  });
  it('codifica o id na rota', () => {
    expect(sessionOpenPath('poker', 'a/b c')).toBe('/room/a%2Fb%20c');
  });
});

describe('Sessões: filtros e ordem', () => {
  const sessions: AdminSession[] = [
    { id: 's1', type: 'poker', title: 'Refinamento', createdAt: daysAgo(1), participantCount: 9 },
    { id: 's2', type: 'retro', title: 'Retro 42', createdAt: daysAgo(20), participantCount: 0 },
    { id: 's3', type: 'poker', title: 'Sala de teste', createdAt: null, participantCount: 2 },
    { id: 'ID-XYZ', type: 'health', title: 'Clima', createdAt: daysAgo(40), participantCount: 5 },
  ];
  const f = (over: Partial<{ search: string; type: string; range: string }>) =>
    filterSessions(sessions, { search: '', type: 'all', range: 'all', ...over }, NOW).map((s) => s.id);

  it('busca por título ou id sem diferenciar caixa', () => {
    expect(f({ search: 'refin' })).toEqual(['s1']);
    expect(f({ search: 'id-xyz' })).toEqual(['ID-XYZ']);
  });
  it('filtra por tipo e por período', () => {
    expect(f({ type: 'poker' })).toEqual(['s1', 's3']);
    expect(f({ range: '7d' })).toEqual(['s1']);
    expect(f({ range: '30d' })).toEqual(['s1', 's2']);
  });
  it('sessão sem data não entra em recorte de período', () => {
    expect(f({ range: '30d' })).not.toContain('s3');
    expect(f({ range: 'all' })).toContain('s3');
  });
  it('ordena por participantes (padrão) e por data', () => {
    expect(sortSessions(sessions, { key: 'participantCount', direction: 'desc' }).map((s) => s.id)).toEqual(['s1', 'ID-XYZ', 's3', 's2']);
    expect(sortSessions(sessions, { key: 'createdAt', direction: 'asc' }).map((s) => s.id)).toEqual(['s3', 'ID-XYZ', 's2', 's1']);
    expect(sortSessions(sessions, { key: 'title', direction: 'asc' }).map((s) => s.id)[0]).toBe('ID-XYZ');
  });
  it('retro mostra traço e não zero', () => {
    expect(sessionParticipants({ type: 'retro', participantCount: 0 })).toEqual({ value: '—', note: 'não registra' });
    expect(sessionParticipants({ type: 'poker', participantCount: 9 })).toEqual({ value: '9', note: '' });
  });
});

describe('Sessões: seleção e exclusão em massa', () => {
  it('"Selecionar as N do filtro" só aparece com a página inteira marcada e filtro maior', () => {
    expect(canSelectWholeFilter(['a', 'b'], ['a', 'b'], 100)).toBe(true);
    expect(canSelectWholeFilter(['a', 'b'], ['a'], 100)).toBe(false);
    expect(canSelectWholeFilter(['a', 'b'], ['a', 'b'], 2)).toBe(false);
    expect(canSelectWholeFilter(['a', 'b'], ['a', 'b', 'c'], 3)).toBe(false);
    expect(canSelectWholeFilter([], [], 10)).toBe(false);
  });
  it('o aviso final diz quantas falharam', () => {
    expect(bulkDeleteSummary(3, 0)).toMatchObject({ failedAny: false, description: '3 sessões removidas.' });
    expect(bulkDeleteSummary(1, 0).description).toBe('1 sessão removida.');
    expect(bulkDeleteSummary(2, 1)).toMatchObject({ failedAny: true, description: '2 removidas, 1 não foi removida.' });
    expect(bulkDeleteSummary(0, 3).description).toBe('0 removidas, 3 não foram removidas.');
  });
});

describe('Feedbacks: NPS e filtros', () => {
  it('NPS = % promotores - % detratores, sem as sugestões', () => {
    const scores = [...Array(21).fill(10), ...Array(11).fill(8), ...Array(9).fill(3), -1, -1, -1];
    const r = computeNps(scores);
    expect(r).toMatchObject({ promoters: 21, passives: 11, detractors: 9, total: 41 });
    expect(r.nps).toBe(29);
    expect(formatNps(r.nps)).toBe('+29');
    expect(npsSubtitle(r)).toBe('21 promotores e 9 detratores, em 41 notas');
  });
  it('sem notas não inventa número', () => {
    const r = computeNps([-1, -1]);
    expect(r.nps).toBeNull();
    expect(formatNps(r.nps)).toBe('—');
    expect(npsSubtitle(r)).toBe('Sem notas ainda');
  });
  it('NPS negativo e zero', () => {
    expect(formatNps(computeNps([0, 0, 10]).nps)).toBe('-33');
    expect(formatNps(computeNps([8, 8]).nps)).toBe('0');
  });
  const items = [
    { toolName: 'Poker', score: 10, comment: 'Ótimo', userId: 'u1', status: 'OPEN' },
    { toolName: 'Retro', score: 4, comment: 'Travou', userId: 'u2', status: 'REVIEWED' },
    { toolName: 'Portal', score: -1, comment: 'Filtrar por squad', userId: 'u3', status: 'OPEN' },
    { toolName: 'Poker', score: 8, comment: '', userId: 'u1', status: 'ARCHIVED' },
  ];
  const names = buildNameIndex([{ id: 'u1', name: 'Ana Ribeiro', email: 'ana@totvs.com.br' }]);
  const all = { search: '', status: 'all', tool: 'all', tab: 'all' as const };
  it('filtra por faixa, ferramenta, status e busca (inclusive pelo nome)', () => {
    expect(filterFeedbacks(items, { ...all, tab: 'promoters' }).length).toBe(1);
    expect(filterFeedbacks(items, { ...all, tab: 'neutrals' }).length).toBe(1);
    expect(filterFeedbacks(items, { ...all, tab: 'detractors' }).length).toBe(1);
    expect(filterFeedbacks(items, { ...all, tab: 'suggestions' }).length).toBe(1);
    expect(filterFeedbacks(items, { ...all, tool: 'Poker' }).length).toBe(2);
    expect(filterFeedbacks(items, { ...all, status: 'OPEN' }).length).toBe(2);
    expect(filterFeedbacks(items, { ...all, search: 'travou' }).length).toBe(1);
    expect(filterFeedbacks(items, { ...all, search: 'ribeiro' }, names).length).toBe(2);
    expect(filterFeedbacks(items, { ...all, search: 'ribeiro' }).length).toBe(0);
  });
});

describe('Auditoria: filtros no navegador', () => {
  const logs = [
    { action: 'ApiKeys', performedBy: 'ana@totvs.com.br', details: 'NOVA API KEY CRIADA', createdAt: daysAgo(0.5) },
    { action: 'ApiKeys', performedBy: 'bia@totvs.com.br', details: 'API KEY REVOGADA', createdAt: daysAgo(5) },
    { action: 'SystemConfig', performedBy: 'ana@totvs.com.br', details: 'Manutenção ativada', createdAt: daysAgo(20) },
    { action: 'admin', performedBy: 'system', details: '', createdAt: null },
  ];
  const base = { search: '', period: 'all', action: 'all', operator: 'all' };
  const f = (over: Partial<typeof base>, names?: ReturnType<typeof buildNameIndex>) =>
    filterAuditLogs(logs, { ...base, ...over }, NOW, names).map((l) => l.details);

  it('período, ação e operador', () => {
    expect(f({ period: '24h' })).toEqual(['NOVA API KEY CRIADA']);
    expect(f({ period: '7d' }).length).toBe(2);
    expect(f({ period: '30d' }).length).toBe(3);
    expect(f({ action: 'ApiKeys' }).length).toBe(2);
    expect(f({ operator: 'ana@totvs.com.br' }).length).toBe(2);
    expect(f({ action: 'ApiKeys', operator: 'ana@totvs.com.br', period: '7d' })).toEqual(['NOVA API KEY CRIADA']);
  });
  it('a busca olha ação, operador, nome e detalhes', () => {
    expect(f({ search: 'revogada' }).length).toBe(1);
    expect(f({ search: 'systemconfig' }).length).toBe(1);
    expect(f({ search: 'bia@' }).length).toBe(1);
    const names = buildNameIndex([{ id: 'x', email: 'bia@totvs.com.br', name: 'Bianca Dias' }]);
    expect(f({ search: 'bianca' }, names).length).toBe(1);
  });
  it('lista opções distintas e ordenadas', () => {
    expect(distinctSorted(['b', 'a', 'b', '', null, undefined])).toEqual(['a', 'b']);
  });
});

describe('CSV', () => {
  it('só aspas quando precisa (ou quando forçado)', () => {
    expect(csvField('simples')).toBe('simples');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField('linha\nnova')).toBe('"linha\nnova"');
    expect(csvField('livre', true)).toBe('"livre"');
    expect(csvField(null)).toBe('');
  });
  it('monta cabeçalho e linhas, comentário sempre entre aspas', () => {
    const csv = buildCsv(['Data', 'Nota', 'Comentário'], [['01/10/2026', 9, 'ok'], ['02/10/2026', 'Sugestão', 'tem, vírgula']], [2]);
    expect(csv).toBe('Data,Nota,Comentário\n01/10/2026,9,"ok"\n02/10/2026,Sugestão,"tem, vírgula"');
  });
});

describe('Nomes no lugar de ID', () => {
  const idx = buildNameIndex([
    { id: 'u1', name: 'Ana Ribeiro', email: 'Ana@totvs.com.br' },
    { id: 'u2', name: '  ' },
    { id: 'u3', name: 'Carla' },
  ]);
  it('resolve por id e por e-mail (sem diferenciar caixa)', () => {
    expect(resolveName(idx, 'u1')).toBe('Ana Ribeiro');
    expect(resolveName(idx, 'ana@TOTVS.com.br')).toBe('Ana Ribeiro');
    expect(resolveName(idx, 'u2')).toBeNull();
    expect(resolveName(idx, 'zzz')).toBeNull();
  });
  it('sem lista, devolve nulo e a tela mostra o ID', () => {
    expect(resolveName(null, 'u1')).toBeNull();
    expect(ownerLabel(null, 'u1')).toBeNull();
    expect(ownerLabel(idx, 'u3')).toBe('Carla');
    expect(ownerLabel(idx, undefined)).toBeNull();
  });
});

describe('Paginação e renovação de chave', () => {
  it('quantos itens o próximo "Exibir mais" soma', () => {
    expect(nextChunk(48, 20)).toBe(20);
    expect(nextChunk(48, 40)).toBe(8);
    expect(nextChunk(20, 20)).toBe(0);
  });
  it('mensagem de renovação por prazo', () => {
    expect(renewMessage('MCP', '180')).toContain('vale por mais 180 dias');
    expect(renewMessage('MCP', 'never')).toContain('vale sem expiração');
  });
});
