import { describe, expect, it } from 'vitest';
import type { BrainstormingBoard, HealthCheckBoard, RetroBoard, Room, SquadMetricsRollup } from '@/lib/types';
import type { ShowcaseSession } from '@/components/showcase/types';
import {
  announcementKind,
  announcementMeta,
  announcementsToNotifications,
  firstName,
  formatRelative,
  formatShortDate,
  greetingFor,
  historyMeta,
  initialsOf,
  isLive,
  liveCountBySquad,
  liveMeta,
  liveSessionsOf,
  mapBrainstormingBoard,
  mapHealthBoard,
  mapPokerRoom,
  mapRetroBoard,
  mapShowcaseSession,
  matchesQuery,
  pickBannerAnnouncement,
  pickSquadsToQuery,
  ritualFacts,
  sprintLabel,
  sprintProgress,
  squadRefsFromSession,
  statusLabel,
  toHomeAnnouncement,
  unreadByTab,
  upcomingCeremonies,
} from '../derive';
import type { HomeAnnouncement, ToolSession } from '../types';

const NOW = new Date('2026-10-14T15:00:00');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const squad = { id: 'phoenix', name: 'Phoenix' };

describe('texto e datas', () => {
  it('primeiro nome e saudação', () => {
    expect(firstName('  Wanderson Alves  ')).toBe('Wanderson');
    expect(firstName(undefined)).toBe('');
    expect(greetingFor(5)).toBe('Bom dia');
    expect(greetingFor(12)).toBe('Boa tarde');
    expect(greetingFor(18)).toBe('Boa noite');
  });

  it('formatShortDate diferencia hoje, ontem e datas antigas', () => {
    expect(formatShortDate(hoursAgo(1), NOW)).toBe('hoje');
    expect(formatShortDate('2026-10-13T10:00:00', NOW)).toBe('ontem');
    expect(formatShortDate('2026-09-30T10:00:00', NOW)).toBe('30/09');
    expect(formatShortDate('2025-09-30T10:00:00', NOW)).toBe('30/09/2025');
    expect(formatShortDate('lixo', NOW)).toBe('');
    expect(formatShortDate(undefined, NOW)).toBe('');
  });

  it('formatRelative', () => {
    expect(formatRelative(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe('há 5 min');
    expect(formatRelative('2026-10-14T13:00:00', NOW)).toBe('há 2 h');
    expect(formatRelative('2026-10-13T10:00:00', NOW)).toBe('ontem');
    expect(formatRelative(undefined, NOW)).toBe('');
  });

  it('iniciais', () => {
    expect(initialsOf('Gabriela Nunes')).toBe('GN');
    expect(initialsOf('Diego')).toBe('D');
    expect(initialsOf('')).toBe('');
  });
});

describe('avisos', () => {
  it('traduz o tipo e cai em informativo', () => {
    expect(announcementKind('IMPORTANTE')).toBe('important');
    expect(announcementKind('maintenance')).toBe('maintenance');
    expect(announcementKind('manutenção')).toBe('maintenance');
    expect(announcementKind(undefined)).toBe('info');
    expect(announcementKind('qualquer coisa')).toBe('info');
  });

  it('normaliza o formato antigo (title/content/createdBy/createdAt)', () => {
    const a = toHomeAnnouncement({ id: '1', title: 'Novo poker', content: 'Texto', createdBy: 'Admin', createdAt: hoursAgo(1) });
    expect(a).toMatchObject({ id: '1', kind: 'info', title: 'Novo poker', text: 'Texto', publishedBy: 'Admin' });
  });

  it('aceita os campos novos e descarta link inseguro', () => {
    const a = toHomeAnnouncement({
      id: '2',
      title: 'Janela',
      content: 'Sábado',
      type: 'MAINTENANCE',
      validUntil: '2026-10-17T23:00:00',
      audience: 'ALL',
      learnMoreUrl: 'javascript:alert(1)',
    });
    expect(a?.kind).toBe('maintenance');
    expect(a?.validUntil).toBe('2026-10-17T23:00:00');
    expect(a?.audienceLabel).toBe('para todas as squads');
    expect(a?.learnMoreUrl).toBeUndefined();
    expect(toHomeAnnouncement({ id: '3', title: 'x', content: 'y', learnMoreUrl: '/manual' })?.learnMoreUrl).toBe('/manual');
  });

  it('ignora registros vazios', () => {
    expect(toHomeAnnouncement(null)).toBeNull();
    expect(toHomeAnnouncement({ id: 'x' })).toBeNull();
  });

  const mk = (over: Partial<HomeAnnouncement>): HomeAnnouncement => ({
    id: over.id ?? 'a',
    kind: 'info',
    title: 't',
    text: '',
    publishedAt: hoursAgo(1),
    ...over,
  });

  it('banner: pula dispensados, vencidos e muito antigos', () => {
    const list = [
      mk({ id: 'dispensado' }),
      mk({ id: 'vencido', validUntil: '2026-10-14T10:00:00' }),
      mk({ id: 'antigo', publishedAt: '2026-09-01T10:00:00' }),
      mk({ id: 'bom', publishedAt: hoursAgo(5) }),
    ];
    expect(pickBannerAnnouncement(list, new Set(['dispensado']), NOW)?.id).toBe('bom');
    expect(pickBannerAnnouncement([], new Set(), NOW)).toBeNull();
  });

  it('banner: importante vence informativo mesmo mais antigo; validade explícita prevalece sobre a janela', () => {
    const list = [
      mk({ id: 'info-novo', kind: 'info', publishedAt: hoursAgo(1) }),
      mk({ id: 'importante', kind: 'important', publishedAt: hoursAgo(48) }),
    ];
    expect(pickBannerAnnouncement(list, new Set(), NOW)?.id).toBe('importante');
    const longo = mk({ id: 'longo', publishedAt: '2026-09-01T10:00:00', validUntil: '2026-10-30T00:00:00' });
    expect(pickBannerAnnouncement([longo], new Set(), NOW)?.id).toBe('longo');
  });

  it('meta do aviso', () => {
    const meta = announcementMeta(mk({ publishedBy: 'Admin', audienceLabel: 'para todas as squads', publishedAt: '2026-10-13T09:00:00' }), NOW);
    expect(meta).toBe('Publicado por Admin · ontem · para todas as squads');
  });

  it('sino: avisos viram itens da aba Avisos, com lido/não lido', () => {
    const list = [mk({ id: '1', kind: 'maintenance', title: 'Manutenção' }), mk({ id: '2', publishedAt: hoursAgo(30 * 24 + 5) })];
    const items = announcementsToNotifications(list, new Set(['announcement:1']), NOW);
    expect(items).toHaveLength(1); // o de 30 dias+ fica fora
    expect(items[0]).toMatchObject({ tab: 'announcements', icon: 'wrench', unread: false });
    const unread = announcementsToNotifications(list, new Set(), NOW);
    expect(unreadByTab(unread)).toEqual({ foryou: 0, messages: 0, announcements: 1 });
  });
});

describe('sessões dos rituais', () => {
  const room = (over: Partial<Room>): Room => ({ id: 'r1', createdAt: hoursAgo(30), title: 'Refinamento', issuesQueue: [], ...over }) as Room;

  it('poker: iniciada e não encerrada é ao vivo', () => {
    const s = mapPokerRoom(room({ sessionStartedAt: hoursAgo(1), participantsCount: 7, issuesQueue: [{}, {}] as never }), squad, NOW);
    expect(s).toMatchObject({ status: 'live', participants: 7, result: '2 tarefas', href: '/room/r1' });
    expect(isLive(s)).toBe(true);
  });

  it('poker: encerrada, não iniciada, assíncrona e esquecida aberta', () => {
    expect(mapPokerRoom(room({ sessionStartedAt: hoursAgo(3), sessionEndedAt: hoursAgo(2) }), squad, NOW).status).toBe('done');
    expect(mapPokerRoom(room({}), squad, NOW).status).toBe('planning');
    expect(mapPokerRoom(room({ sessionStartedAt: hoursAgo(2), mode: 'async' }), squad, NOW).status).toBe('async');
    expect(mapPokerRoom(room({ sessionStartedAt: hoursAgo(40) }), squad, NOW).status).toBe('done'); // sala síncrona esquecida
    expect(mapPokerRoom(room({ sessionStartedAt: hoursAgo(40), mode: 'async' }), squad, NOW).status).toBe('async'); // assíncrona dura dias
    expect(mapPokerRoom(room({ title: '  ' }), squad, NOW).title).toBe('Sessão de poker');
  });

  it('retro: sem resumo e recente está ao vivo', () => {
    const b = (over: Partial<RetroBoard>): RetroBoard => ({ id: 'b1', createdAt: hoursAgo(1), ...over }) as RetroBoard;
    expect(mapRetroBoard(b({}), squad, NOW).status).toBe('live');
    expect(mapRetroBoard(b({ summary: {} }), squad, NOW).status).toBe('done');
    expect(mapRetroBoard(b({ createdAt: hoursAgo(20) }), squad, NOW).status).toBe('done');
    expect(mapRetroBoard(b({}), squad, NOW).href).toBe('/retro/b1');
  });

  it('showcase: apresentando é ao vivo, planejando é planejando', () => {
    const s = (over: Partial<ShowcaseSession>): ShowcaseSession =>
      ({ id: 's1', name: 'Review S42', sprintName: 'S42', tasks: [], createdAt: hoursAgo(1), status: 'presenting', ...over }) as ShowcaseSession;
    expect(mapShowcaseSession(s({}), squad, NOW).status).toBe('live');
    expect(mapShowcaseSession(s({ status: 'planning' }), squad, NOW).status).toBe('planning');
    expect(mapShowcaseSession(s({ status: 'finished' }), squad, NOW).status).toBe('done');
    expect(mapShowcaseSession(s({ createdAt: null }), squad, NOW).status).toBe('done');
  });

  it('radar: coletando recente é ao vivo; título usa a sprint', () => {
    const h = (over: Partial<HealthCheckBoard>): HealthCheckBoard => ({ id: 'h1', status: 'collecting', createdAt: hoursAgo(2), sprintName: 'Sprint 40', ...over }) as HealthCheckBoard;
    const live = mapHealthBoard(h({}), squad, NOW);
    expect(live.status).toBe('live');
    expect(live.title).toBe('Radar Sprint 40');
    expect(mapHealthBoard(h({ status: 'finished' }), squad, NOW).status).toBe('done');
    expect(mapHealthBoard(h({ sprintName: undefined }), squad, NOW).title).toBe('Radar de clima');
  });

  it('brainstorming nunca é ao vivo; mostra a fase', () => {
    const b = { id: 'b', title: 'Ideias', createdAt: hoursAgo(5), phase: 'actions' } as BrainstormingBoard;
    const s = mapBrainstormingBoard(b, squad, NOW);
    expect(s.status).toBe('in_progress');
    expect(s.result).toBe('fase: plano de ação');
    expect(isLive(s)).toBe(false);
    expect(mapBrainstormingBoard({ ...b, createdAt: '2026-09-01T00:00:00' }, squad, NOW).status).toBe('done');
  });

  const sessions: ToolSession[] = [
    { id: '1', tool: 'poker', squadId: 'a', squadName: 'A', title: 'p1', createdAt: hoursAgo(5), status: 'live', href: '/room/1', participants: 7 },
    { id: '2', tool: 'retro', squadId: 'b', squadName: 'B', title: 'r1', createdAt: hoursAgo(1), status: 'live', href: '/retro/2' },
    { id: '3', tool: 'poker', squadId: 'a', squadName: 'A', title: 'p0', createdAt: hoursAgo(70), status: 'done', href: '/room/3', result: '9 tarefas' },
    { id: '4', tool: 'poker', squadId: 'a', squadName: 'A', title: 'p2', createdAt: hoursAgo(10), status: 'async', href: '/room/4' },
  ];

  it('ao vivo: filtra, ordena do mais recente e conta por squad', () => {
    expect(liveSessionsOf(sessions).map((s) => s.id)).toEqual(['2', '1', '4']);
    expect(liveCountBySquad(sessions)).toEqual({ a: 2, b: 1 });
  });

  it('textos de apoio e chips', () => {
    expect(liveMeta(sessions[0])).toBe('Planning Poker · 7 pessoas');
    expect(liveMeta(sessions[3])).toBe('Planning Poker · assíncrona');
    expect(historyMeta(sessions[2], NOW)).toBe('11/10 · 9 tarefas');
    expect(statusLabel('done', 'health')).toBe('Concluído');
    expect(statusLabel('done', 'poker')).toBe('Concluída');
    expect(ritualFacts([], NOW)).toEqual(['Nenhuma sessão']);
    expect(ritualFacts(sessions.filter((s) => s.tool === 'poker'), NOW)).toEqual(['2 ao vivo', 'Última: 11/10 · 9 tarefas']);
  });
});

describe('squads, sprint e cerimônias', () => {
  const rollup = (extra: Partial<SquadMetricsRollup>): SquadMetricsRollup =>
    ({ squadId: 's', totalIssues: 0, doneIssues: 0, ...extra }) as SquadMetricsRollup;

  it('progresso da sprint por datas', () => {
    const p = sprintProgress(
      rollup({ extraMetrics: { activeSprintStart: '2026-10-05T00:00:00', activeSprintEnd: '2026-10-19T00:00:00' } }),
      NOW,
    );
    expect(p.percent).toBe(69);
    expect(p.daysLeft).toBe(5);
  });

  it('progresso por dias úteis quando faltam as datas, e vazio sem dado', () => {
    expect(sprintProgress(rollup({ workdaysTotal: 10, workdaysRemaining: 4 }), NOW)).toEqual({ percent: 60, daysLeft: 4 });
    expect(sprintProgress(rollup({}), NOW)).toEqual({ percent: null, daysLeft: null });
    expect(sprintProgress(null, NOW)).toEqual({ percent: null, daysLeft: null });
  });

  it('rótulo da sprint', () => {
    expect(sprintLabel('Sprint 42', 6)).toBe('Sprint 42 · faltam 6 dias');
    expect(sprintLabel('Sprint 42', 1)).toBe('Sprint 42 · falta 1 dia');
    expect(sprintLabel('Sprint 42', 0)).toBe('Sprint 42 · termina hoje');
    expect(sprintLabel('Sprint 42', null)).toBe('Sprint 42');
    expect(sprintLabel(undefined, 3)).toBe('');
  });

  it('próximas cerimônias manuais, em ordem', () => {
    // 14/10/2026 é quarta-feira.
    const list = upcomingCeremonies(
      [
        { id: '1', title: 'Review', daysOfWeek: ['FRI'], startTime: '14:00', durationMinutes: 60 },
        { id: '2', title: 'Refinamento', daysOfWeek: ['THU'], startTime: '10:00', durationMinutes: 60 },
        { id: '3', title: 'Daily', daysOfWeek: ['WED'], startTime: '09:00', durationMinutes: 15 }, // já passou hoje
      ],
      NOW,
      2,
    );
    expect(list.map((c) => c.title)).toEqual(['Refinamento', 'Review']);
    expect(upcomingCeremonies(undefined, NOW)).toEqual([]);
  });

  it('squads da sessão: lista acessível, ou a ativa, ou nada', () => {
    expect(
      squadRefsFromSession({ accessibleProjects: [{ projectId: 'a', projectName: 'Alfa', roleName: 'Dev' }, { projectId: 'b', projectName: '' }] }),
    ).toEqual([
      { id: 'a', name: 'Alfa', roleName: 'Dev' },
      { id: 'b', name: 'b', roleName: undefined },
    ]);
    expect(squadRefsFromSession({ accessibleProjects: [], activeProjectId: 'x', activeProjectName: 'X' })).toEqual([{ id: 'x', name: 'X' }]);
    expect(squadRefsFromSession({ activeProjectId: 'Sem Time' })).toEqual([]);
    expect(squadRefsFromSession(null)).toEqual([]);
  });

  it('escolhe quais squads consultar: escopo, ativa primeiro e teto', () => {
    const refs = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `S${i}` }));
    expect(pickSquadsToQuery(refs, 's5', 's9').map((r) => r.id)).toEqual(['s9']);
    expect(pickSquadsToQuery(refs, 's5', 'inexistente')).toEqual([]);
    const all = pickSquadsToQuery(refs, 's5', null);
    expect(all).toHaveLength(8);
    expect(all[0].id).toBe('s5');
  });
});

describe('busca de módulos', () => {
  it('ignora acento, caixa e aceita consulta vazia', () => {
    expect(matchesQuery('', 'Jolt')).toBe(true);
    expect(matchesQuery('conhecimento', 'Conhecimento', 'Wiki')).toBe(true);
    expect(matchesQuery('qualidade', 'Central de Qualidade')).toBe(true);
    expect(matchesQuery('POLITICAS', 'Políticas e ajuda')).toBe(true);
    expect(matchesQuery('xyz', 'Jolt', 'Layouts')).toBe(false);
  });
});
