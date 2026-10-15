import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  getAnnouncements: vi.fn(),
  listRooms: vi.fn(),
  listBoards: vi.fn(),
  getSessions: vi.fn(),
  healthList: vi.fn(),
  brainList: vi.fn(),
  getRollup: vi.fn(),
  getSquad: vi.fn(),
}));

vi.mock('../../../lib/auth-client', () => ({ authFetch: mocks.authFetch }));
vi.mock('../../../app/admin/api', () => ({ publicApi: { getAnnouncements: mocks.getAnnouncements } }));
vi.mock('../../../app/room/api', () => ({ pokerApi: { listRooms: mocks.listRooms } }));
vi.mock('../../../app/retro/api', () => ({ retroApi: { listBoards: mocks.listBoards } }));
vi.mock('../../../app/showcase/api', () => ({ showcaseApi: { getSessions: mocks.getSessions } }));
vi.mock('../../../app/health-check/api', () => ({ healthCheckApi: { listBoards: mocks.healthList } }));
vi.mock('../../../app/brainstorming/api', () => ({ brainstormingApi: { listBoards: mocks.brainList } }));
vi.mock('../../../app/squad/api', () => ({ squadApi: { getRollup: mocks.getRollup, getSquad: mocks.getSquad } }));

import {
  clearAnnouncementsCache,
  clearContractCache,
  clearSquadSnapshotCache,
  clearToolSessionCache,
  dismissAnnouncement,
  fetchAnnouncements,
  fetchConversations,
  fetchLiveSessions,
  fetchMessages,
  fetchNotifications,
  fetchRitualHistory,
  fetchSquadInfos,
  fetchSquadSnapshot,
  loadDismissedAnnouncements,
  loadReadNotifications,
  markNotificationsRead,
  openConversation,
  sendMessage,
} from '../sources';
import type { HomeAnnouncement } from '../types';

const NOW = new Date('2026-10-14T15:00:00');
const iso = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
const squad = { id: 'phoenix', name: 'Phoenix' };

interface Reply {
  status?: number;
  body?: unknown;
}
/** Rotas do "servidor" no teste: chave "METODO /caminho?query" (sem o /api). Sem rota = 404, como no servidor antigo. */
let routes: Map<string, Reply | ((body: unknown) => Reply)>;
let calls: string[];

function serve(key: string, reply: Reply | ((body: unknown) => Reply)) {
  routes.set(key, reply);
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  clearAnnouncementsCache();
  clearContractCache();
  clearToolSessionCache();
  clearSquadSnapshotCache();
  localStorage.clear();
  routes = new Map();
  calls = [];
  mocks.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^.*?\/api/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    calls.push(key);
    const route = routes.get(key);
    const reply = typeof route === 'function' ? route(init?.body ? JSON.parse(String(init.body)) : undefined) : route;
    if (!reply) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? null), { status });
  });
  mocks.listRooms.mockResolvedValue([]);
  mocks.listBoards.mockResolvedValue([]);
  mocks.getSessions.mockResolvedValue([]);
  mocks.healthList.mockResolvedValue([]);
  mocks.brainList.mockResolvedValue([]);
  mocks.getAnnouncements.mockResolvedValue([]);
});

describe('avisos', () => {
  it('backend novo: usa /announcements/active e marca como gerenciado pelo servidor', async () => {
    serve('GET /announcements/active', {
      body: [
        {
          id: 'a1', title: 'Manutenção', content: 'Sábado 22h', type: 'MAINTENANCE', audienceType: 'ALL', audienceSquadIds: [], audienceRoles: [],
          validFrom: iso(2), validUntil: null, link: '/changelog', createdBy: 'admin@totvs.com.br', createdByName: 'Admin', createdAt: iso(2), dismissed: false,
        },
      ],
    });
    const list = await fetchAnnouncements(NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'a1', kind: 'maintenance', publishedBy: 'Admin', learnMoreUrl: '/changelog', serverManaged: true, audienceLabel: 'para todas as squads' });
    expect(JSON.stringify(list)).not.toContain('admin@totvs');
    expect(mocks.getAnnouncements).not.toHaveBeenCalled();
  });

  it('servidor antigo (404): cai em /public/announcements e lembra de não tentar de novo', async () => {
    mocks.getAnnouncements.mockResolvedValue([{ id: '1', title: 'A', content: 'x', createdBy: 'Admin', createdAt: iso(1) }, { id: '2' }, null]);
    const list = await fetchAnnouncements(NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: '1', kind: 'info', publishedBy: 'Admin' });
    expect(list[0].serverManaged).toBeUndefined();

    clearAnnouncementsCache();
    await fetchAnnouncements(NOW);
    expect(calls.filter((c) => c === 'GET /announcements/active')).toHaveLength(1);
  });

  it('falha ou resposta estranha vira lista vazia', async () => {
    mocks.getAnnouncements.mockRejectedValue(new Error('rede'));
    expect(await fetchAnnouncements(NOW)).toEqual([]);
    clearAnnouncementsCache();
    mocks.getAnnouncements.mockResolvedValue({ erro: true });
    expect(await fetchAnnouncements(NOW)).toEqual([]);
  });

  it('erro 500 do endpoint novo não derruba: lista vazia', async () => {
    serve('GET /announcements/active', { status: 500 });
    expect(await fetchAnnouncements(NOW)).toEqual([]);
  });

  it('o banner e o sino compartilham uma só chamada', async () => {
    serve('GET /announcements/active', { body: [] });
    await Promise.all([fetchAnnouncements(NOW), fetchAnnouncements(NOW)]);
    expect(calls.filter((c) => c === 'GET /announcements/active')).toHaveLength(1);
  });

  it('dispensar aviso do servidor chama o POST; o antigo fica no navegador', async () => {
    serve('POST /announcements/a1/dismiss', { status: 204 });
    const server: HomeAnnouncement = { id: 'a1', kind: 'info', title: 't', text: '', serverManaged: true };
    await dismissAnnouncement('u1', server);
    expect(calls).toContain('POST /announcements/a1/dismiss');
    expect(loadDismissedAnnouncements('u1').size).toBe(0);

    await dismissAnnouncement('u1', { id: 'old', kind: 'info', title: 't', text: '' });
    expect([...loadDismissedAnnouncements('u1')]).toEqual(['old']);
  });

  it('se o POST de dispensa falhar, guarda no navegador', async () => {
    serve('POST /announcements/a1/dismiss', { status: 500 });
    await dismissAnnouncement('u1', { id: 'a1', kind: 'info', title: 't', text: '', serverManaged: true });
    expect(loadDismissedAnnouncements('u1').has('a1')).toBe(true);
  });

  it('storage corrompido não quebra', () => {
    localStorage.setItem('agileSpace_home_dismissed_u1', '{lixo');
    expect(loadDismissedAnnouncements('u1').size).toBe(0);
  });
});

describe('notificações', () => {
  const dto = (over: Record<string, unknown>) => ({
    id: 'n1', kind: 'REMINDER', title: null, text: 'falta seu voto', link: '/room/abc', actorId: null, actorName: null, squadId: 'phoenix', createdAt: iso(1), readAt: null, ...over,
  });

  it('sem endpoint (servidor antigo): devolve null', async () => {
    expect(await fetchNotifications()).toBeNull();
  });

  it('backend novo: junta Para você e Avisos, com os contadores do servidor', async () => {
    serve('GET /notifications?category=FOR_YOU&limit=30', {
      body: [dto({}), dto({ id: 'n2', kind: 'INVITE', actorName: 'Gabriela Nunes', text: 'convidou você', readAt: iso(0.5) })],
    });
    serve('GET /notifications?category=ANNOUNCEMENTS&limit=30', { body: [dto({ id: 'n3', kind: 'ANNOUNCEMENT', title: 'Nova versão', text: 'Detalhes', link: null })] });
    serve('GET /notifications/unread-count', { body: { forYou: 1, messages: 2, announcements: 1, total: 4 } });
    const feed = await fetchNotifications();
    expect(feed?.unread).toEqual({ foryou: 1, messages: 2, announcements: 1, total: 4 });
    expect(feed?.items.map((n) => [n.tab, n.id])).toEqual([
      ['foryou', 'notification:n1'],
      ['foryou', 'notification:n2'],
      ['announcements', 'notification:n3'],
    ]);
    expect(feed?.items[0]).toMatchObject({ unread: true, cta: { label: 'Votar agora', href: '/room/abc' } });
    expect(feed?.items[1]).toMatchObject({ unread: false, who: 'Gabriela Nunes', personName: 'Gabriela Nunes' });
    expect(feed?.items[2]).toMatchObject({ who: 'Nova versão', cta: undefined });
  });

  it('contador indisponível: calcula pelas listas', async () => {
    serve('GET /notifications?category=FOR_YOU&limit=30', { body: [dto({})] });
    serve('GET /notifications?category=ANNOUNCEMENTS&limit=30', { body: [] });
    const feed = await fetchNotifications();
    expect(feed?.unread).toEqual({ foryou: 1, messages: 0, announcements: 0, total: 1 });
  });

  it('marcar como lidas: itens do servidor vão no read-all; os de aviso antigo ficam no navegador', async () => {
    serve('POST /notifications/read-all', { status: 204 });
    await markNotificationsRead('u1', ['notification:n1', 'announcement:a2']);
    expect(calls).toContain('POST /notifications/read-all');
    expect([...loadReadNotifications('u1')]).toEqual(['announcement:a2']);
  });

  it('read-all falhando não lança', async () => {
    serve('POST /notifications/read-all', { status: 500 });
    await expect(markNotificationsRead('u1', ['notification:n1'])).resolves.toBeUndefined();
  });
});

describe('mensagens diretas', () => {
  it('sem endpoint: conversas indisponíveis (null)', async () => {
    expect(await fetchConversations()).toBeNull();
  });

  it('lista, abre, lê e envia', async () => {
    serve('GET /conversations', {
      body: [{ id: 'c1', otherUser: { id: 'u2', name: 'Diego Alves', avatarUrl: null }, lastMessage: { id: 'm1', conversationId: 'c1', senderId: 'u2', body: 'oi', createdAt: iso(1) }, unreadCount: 2, updatedAt: iso(1) }],
    });
    const list = await fetchConversations();
    expect(list?.[0]).toMatchObject({ id: 'c1', unreadCount: 2, other: { id: 'u2', name: 'Diego Alves' } });
    expect(list?.[0].lastMessage?.body).toBe('oi');

    serve('POST /conversations', (body) => ({ body: { id: 'c9', otherUser: { id: (body as { userId: string }).userId, name: 'Ana' }, lastMessage: null, unreadCount: 0, updatedAt: iso(0) } }));
    expect((await openConversation('u3')).id).toBe('c9');

    serve('GET /conversations/c1/messages?limit=50', { body: [{ id: 'm1', conversationId: 'c1', senderId: 'u2', body: 'oi', createdAt: iso(1) }] });
    expect((await fetchMessages('c1'))[0].body).toBe('oi');

    serve('POST /conversations/c1/messages', (body) => ({ body: { id: 'm2', conversationId: 'c1', senderId: 'u1', body: (body as { body: string }).body, createdAt: iso(0) } }));
    const sent = await sendMessage('c1', '  Fechado!  ');
    expect(sent.body).toBe('Fechado!');
  });

  it('não envia mensagem vazia', async () => {
    await expect(sendMessage('c1', '   ')).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('erro do servidor vem com a mensagem dele', async () => {
    serve('POST /conversations', { status: 403, body: { message: 'Só é possível conversar com pessoas das suas squads.' } });
    await expect(openConversation('u9')).rejects.toThrow('Só é possível conversar');
  });
});

describe('sessões ao vivo', () => {
  const liveDto = (over: Record<string, unknown>) => ({
    tool: 'POKER', id: 'p1', title: 'Refinamento', squadId: 'phoenix', squadName: 'Phoenix', participantsCount: 7, status: 'LIVE', link: '/room/p1', startedAt: iso(1), updatedAt: iso(0), ...over,
  });

  it('backend novo, uma squad: filtra na consulta e traduz ferramenta e status', async () => {
    serve('GET /live-sessions?squadId=phoenix', {
      body: [liveDto({}), liveDto({ tool: 'HEALTH_CHECK', id: 'h1', status: 'ASYNC_OPEN', link: '/health-check/h1', title: 'Radar' })],
    });
    const live = await fetchLiveSessions([squad], NOW);
    expect(live.map((s) => [s.tool, s.status, s.href])).toEqual([
      ['poker', 'live', '/room/p1'],
      ['health', 'async', '/health-check/h1'],
    ]);
    expect(live[0]).toMatchObject({ participants: 7, squadName: 'Phoenix' });
    expect(mocks.listRooms).not.toHaveBeenCalled();
  });

  it('backend novo, várias squads: uma chamada e filtro local pelas squads pedidas', async () => {
    serve('GET /live-sessions', { body: [liveDto({}), liveDto({ id: 'x', squadId: 'fora' }), liveDto({ id: 'a1', squadId: 'atlas', squadName: null, tool: 'RETRO', link: '/retro/a1' })] });
    const live = await fetchLiveSessions([squad, { id: 'atlas', name: 'Atlas' }], NOW);
    expect(live.map((s) => s.id).sort()).toEqual(['a1', 'p1']);
    expect(live.find((s) => s.id === 'a1')?.squadName).toBe('Atlas');
  });

  it('backend novo: sala recém-criada (PLANNING) e assíncrona entram; encerrada não; squad em outra caixa casa com a pedida', async () => {
    serve('GET /live-sessions?squadId=phoenix', {
      body: [
        liveDto({ id: 'nova', status: 'PLANNING', startedAt: null, participantsCount: 1, squadId: 'PHOENIX' }),
        liveDto({ id: 'rodando' }),
        liveDto({ id: 'fim', status: 'FINISHED' }),
      ],
    });
    const live = await fetchLiveSessions([squad], NOW);
    expect(live.map((s) => [s.id, s.status])).toEqual([['rodando', 'live'], ['nova', 'planning']]);
    expect(live.every((s) => s.squadId === 'phoenix' && s.squadName === 'Phoenix')).toBe(true);
  });

  it('servidor antigo: sala de poker recém-criada (sem início) aparece como aguardando', async () => {
    mocks.listRooms.mockResolvedValue([
      { id: 'nova', title: 'Refinamento', createdAt: iso(0.1), issuesQueue: [] },
      { id: 'esquecida', title: 'Velha', createdAt: iso(40), issuesQueue: [] },
    ]);
    const live = await fetchLiveSessions([squad], NOW);
    expect(live.map((s) => [s.id, s.status])).toEqual([['nova', 'planning']]);
  });

  it('link inseguro do servidor é trocado pela rota da sessão', async () => {
    serve('GET /live-sessions?squadId=phoenix', { body: [liveDto({ link: 'javascript:alert(1)' })] });
    const live = await fetchLiveSessions([squad], NOW);
    expect(live[0].href).toBe('/room/p1');
  });

  it('servidor antigo: junta as listas de cada ritual, só o que está ao vivo, ignorando quem falhou', async () => {
    mocks.listRooms.mockResolvedValue([
      { id: 'p1', title: 'Refinamento', createdAt: iso(30), sessionStartedAt: iso(1), participantsCount: 5, issuesQueue: [] },
      { id: 'p2', title: 'Velha', createdAt: iso(100), sessionStartedAt: iso(99), sessionEndedAt: iso(98), issuesQueue: [] },
    ]);
    mocks.listBoards.mockRejectedValue(new Error('403'));
    mocks.getSessions.mockResolvedValue([{ id: 's1', name: 'Review', tasks: [], createdAt: iso(2), status: 'presenting' }]);
    const live = await fetchLiveSessions([squad], NOW);
    expect(live.map((s) => s.id).sort()).toEqual(['p1', 's1']);
  });

  it('sem squads não chama ninguém', async () => {
    expect(await fetchLiveSessions([], NOW)).toEqual([]);
    expect(calls).toEqual([]);
    expect(mocks.listRooms).not.toHaveBeenCalled();
  });

  it('tudo falhando devolve vazio, sem lançar', async () => {
    mocks.listRooms.mockRejectedValue(new Error('x'));
    mocks.listBoards.mockRejectedValue(new Error('x'));
    mocks.getSessions.mockRejectedValue(new Error('x'));
    mocks.healthList.mockRejectedValue(new Error('x'));
    mocks.brainList.mockRejectedValue(new Error('x'));
    expect(await fetchLiveSessions([squad], NOW)).toEqual([]);
  });

  it('servidor antigo: ao vivo e histórico reaproveitam as mesmas listas (cache curto)', async () => {
    await fetchLiveSessions([squad], NOW);
    await fetchRitualHistory([squad], NOW);
    expect(mocks.listRooms).toHaveBeenCalledTimes(1);
    expect(mocks.healthList).toHaveBeenCalledTimes(1);
  });

  it('servidor antigo: falha não fica no cache', async () => {
    mocks.listRooms.mockRejectedValueOnce(new Error('x'));
    await fetchLiveSessions([squad], NOW);
    await fetchLiveSessions([squad], NOW);
    expect(mocks.listRooms).toHaveBeenCalledTimes(2);
  });
});

describe('histórico dos rituais', () => {
  const hist = (over: Record<string, unknown>) => ({
    tool: 'POKER', id: 'h', title: 'Refinamento', squadId: 'phoenix', date: iso(50), participantsCount: 6, status: 'FINISHED', summary: '60h em 6 tarefas', durationMinutes: 72, link: '/room/h', ...over,
  });

  it('backend novo: uma chamada por ritual e squad, com o resumo do servidor', async () => {
    serve('GET /rituals/poker/history?squadId=phoenix&limit=10', { body: [hist({ id: 'old', date: iso(200) }), hist({ id: 'new' })] });
    serve('GET /rituals/health-check/history?squadId=phoenix&limit=10', { body: [hist({ tool: 'HEALTH_CHECK', id: 'r1', summary: '9 respostas', link: '/health-check/r1' })] });
    const history = await fetchRitualHistory([squad], NOW);
    expect(history.poker.map((s) => s.id)).toEqual(['new', 'old']);
    expect(history.poker[0]).toMatchObject({ result: '60h em 6 tarefas', status: 'done', participants: 6 });
    expect(history.health[0]).toMatchObject({ result: '9 respostas', href: '/health-check/r1' });
    expect(history.retro).toEqual([]);
    expect(mocks.listRooms).not.toHaveBeenCalled();
  });

  it('backend novo: um ritual falhar não derruba os outros', async () => {
    serve('GET /rituals/poker/history?squadId=phoenix&limit=10', { body: [hist({})] });
    serve('GET /rituals/retro/history?squadId=phoenix&limit=10', { status: 403 });
    const history = await fetchRitualHistory([squad], NOW);
    expect(history.poker).toHaveLength(1);
    expect(history.retro).toEqual([]);
  });

  it('servidor antigo: agrupa por ritual, mais recente primeiro, com squads misturadas', async () => {
    mocks.listRooms.mockImplementation(async (id: string) => [
      { id: `${id}-old`, createdAt: iso(100), sessionStartedAt: iso(100), sessionEndedAt: iso(99), issuesQueue: [] },
      { id: `${id}-new`, createdAt: iso(50), sessionStartedAt: iso(50), sessionEndedAt: iso(49), issuesQueue: [] },
    ]);
    const history = await fetchRitualHistory([squad, { id: 'atlas', name: 'Atlas' }], NOW);
    expect(history.poker).toHaveLength(4);
    expect(history.poker[0].createdAt! > history.poker[3].createdAt!).toBe(true);
    expect(history.retro).toEqual([]);
  });
});

describe('squads', () => {
  it('backend novo: o agregado /home cobre as squads numa chamada só', async () => {
    serve('GET /home', {
      body: {
        multiSquad: true,
        squads: [
          { squadId: 'phoenix', name: 'Phoenix', sprintName: 'Sprint 42', sprintDaysLeft: 6, sprintProgressPct: 58.4, liveCount: 1, nextCeremony: { name: 'Refinamento', startsAt: '2026-10-15T13:00:00Z' } },
          { squadId: 'atlas', name: 'Atlas', sprintName: null, sprintDaysLeft: null, sprintProgressPct: null, liveCount: 0, nextCeremony: null },
        ],
      },
    });
    const infos = await fetchSquadInfos([squad, { id: 'atlas', name: 'Atlas' }], NOW);
    expect(infos.phoenix).toMatchObject({ sprintName: 'Sprint 42', sprintPercent: 58, daysLeft: 6 });
    expect(infos.phoenix.nextCeremony?.title).toBe('Refinamento');
    expect(infos.atlas).toEqual({ sprintName: undefined, sprintPercent: null, daysLeft: null, nextCeremony: undefined });
    expect(mocks.getRollup).not.toHaveBeenCalled();
  });

  it('squad que o agregado não traz usa rollup e configuração', async () => {
    serve('GET /home', { body: { multiSquad: false, squads: [{ squadId: 'phoenix', name: 'Phoenix', sprintName: 'S1', sprintDaysLeft: 1, sprintProgressPct: 90, liveCount: 0, nextCeremony: null }] } });
    mocks.getRollup.mockResolvedValue({ squadId: 'atlas', sprintName: 'Sprint 18', workdaysTotal: 10, workdaysRemaining: 2 });
    mocks.getSquad.mockResolvedValue({ id: 'atlas', ceremonyMode: 'google_calendar' });
    const infos = await fetchSquadInfos([squad, { id: 'atlas', name: 'Atlas' }], NOW);
    expect(infos.phoenix.sprintPercent).toBe(90);
    expect(infos.atlas).toMatchObject({ sprintName: 'Sprint 18', sprintPercent: 80, daysLeft: 2 });
  });

  it('servidor antigo ou /home com erro: tudo pelo caminho por squad', async () => {
    serve('GET /home', { status: 500 });
    mocks.getRollup.mockResolvedValue(null);
    mocks.getSquad.mockRejectedValue(new Error('403'));
    const infos = await fetchSquadInfos([squad], NOW);
    expect(infos.phoenix).toMatchObject({ sprintPercent: null, daysLeft: null });
  });

  it('snapshot legado: rollup 204/ausente e config com erro viram null', async () => {
    mocks.getRollup.mockResolvedValue(null);
    mocks.getSquad.mockRejectedValue(new Error('403'));
    expect(await fetchSquadSnapshot('phoenix', NOW)).toEqual({ rollup: null, config: null });
  });
});
