import { describe, expect, it } from 'vitest';
import {
  buildNotificationFeed,
  mapConversationDto,
  mapLiveSessionDto,
  mapNotificationDto,
  mapRitualSessionDto,
  mapSquadSummaryDto,
  normalizeOutgoingMessage,
  serverNotificationId,
  statusFromServer,
  toolFromServer,
  MESSAGE_MAX_LENGTH,
  type LiveSessionDto,
  type NotificationDto,
} from '../contract';
import { toHomeAnnouncement, isAnnouncementActive, pickBannerAnnouncement } from '../derive';

const NOW = new Date('2026-10-14T15:00:00Z');

describe('ferramentas e status do servidor', () => {
  it('traduz as 5 ferramentas e ignora desconhecidas', () => {
    expect(['POKER', 'RETRO', 'SHOWCASE', 'HEALTH_CHECK', 'BRAINSTORMING'].map(toolFromServer)).toEqual(['poker', 'retro', 'showcase', 'health', 'brainstorming']);
    expect(toolFromServer('OUTRA')).toBeNull();
    expect(toolFromServer(undefined)).toBeNull();
  });

  it('traduz os 4 status; desconhecido é concluído (lado conservador)', () => {
    expect(['LIVE', 'ASYNC_OPEN', 'PLANNING', 'FINISHED'].map(statusFromServer)).toEqual(['live', 'async', 'planning', 'done']);
    expect(statusFromServer('???')).toBe('done');
  });
});

describe('sessões do servidor', () => {
  const live: LiveSessionDto = {
    tool: 'RETRO', id: 'r1', title: ' Retro Sprint 17 ', squadId: 'atlas', squadName: null, participantsCount: 0, status: 'LIVE',
    link: '/retro/r1', startedAt: null, updatedAt: '2026-10-14T14:00:00Z',
  };

  it('usa o nome da squad conhecida, data de atualização e esconde participantes zerados', () => {
    const s = mapLiveSessionDto(live, new Map([['atlas', 'Atlas']]));
    expect(s).toMatchObject({ tool: 'retro', title: 'Retro Sprint 17', squadName: 'Atlas', status: 'live', href: '/retro/r1', createdAt: '2026-10-14T14:00:00Z' });
    expect(s?.participants).toBeUndefined();
  });

  it('descarta ferramenta desconhecida', () => {
    expect(mapLiveSessionDto({ ...live, tool: 'X' as never }, new Map())).toBeNull();
  });

  it('histórico: resumo vira resultado', () => {
    const s = mapRitualSessionDto(
      { tool: 'POKER', id: 'p', title: 'Refinamento', squadId: 'phoenix', date: '2026-10-01T10:00:00Z', participantsCount: 7, status: 'FINISHED', summary: '60h em 6 tarefas', durationMinutes: 72, link: '/room/p' },
      { id: 'phoenix', name: 'Phoenix' },
    );
    expect(s).toMatchObject({ result: '60h em 6 tarefas', status: 'done', participants: 7, squadName: 'Phoenix' });
  });
});

describe('squads do agregado', () => {
  it('arredonda e limita o progresso, converte a cerimônia em data', () => {
    const info = mapSquadSummaryDto({
      squadId: 'p', name: 'P', sprintName: 'Sprint 42', sprintDaysLeft: -1, sprintProgressPct: 140, liveCount: 0,
      nextCeremony: { name: 'Review', startsAt: '2026-10-16T17:00:00Z' },
    });
    expect(info).toMatchObject({ sprintName: 'Sprint 42', sprintPercent: 100, daysLeft: 0 });
    expect(info.nextCeremony?.start.toISOString()).toBe('2026-10-16T17:00:00.000Z');
  });

  it('nulos viram ausência', () => {
    expect(mapSquadSummaryDto({ squadId: 'p', name: 'P', sprintName: null, sprintDaysLeft: null, sprintProgressPct: null, liveCount: 0, nextCeremony: null })).toEqual({
      sprintName: undefined, sprintPercent: null, daysLeft: null, nextCeremony: undefined,
    });
  });
});

describe('notificações do servidor', () => {
  const base: NotificationDto = {
    id: 'n1', kind: 'ACTION_ASSIGNED', title: 'Retro Sprint 41', text: '2 ações estão sob sua responsabilidade.', link: '/retro/x', actorId: null, actorName: null,
    squadId: 'phoenix', createdAt: '2026-10-14T14:00:00Z', readAt: null,
  };

  it('quem não é pessoa aparece pelo título; o link vira botão por tipo', () => {
    expect(mapNotificationDto(base, 'foryou')).toMatchObject({
      id: 'notification:n1', who: 'Retro Sprint 41', personName: undefined, unread: true, icon: 'list', cta: { label: 'Ver ações', href: '/retro/x' },
    });
  });

  it('com autor vira avatar de pessoa; lida não conta; link inseguro some', () => {
    const n = mapNotificationDto({ ...base, kind: 'INVITE', actorName: 'Gabriela Nunes', readAt: '2026-10-14T14:30:00Z', link: 'javascript:alert(1)' }, 'foryou');
    expect(n).toMatchObject({ who: 'Gabriela Nunes', personName: 'Gabriela Nunes', unread: false, cta: undefined });
  });

  it('LINK_REQUEST: os dois destinos do backend (aba Pedidos da squad e Admin) viram o botão "Ver pedido"', () => {
    const request = { ...base, kind: 'LINK_REQUEST' as const, actorName: 'Ana Paula' };
    expect(mapNotificationDto({ ...request, link: '/squad/roster?tab=pedidos&squadId=DDWMISSI' }, 'foryou').cta).toEqual({
      label: 'Ver pedido',
      href: '/squad/roster?tab=pedidos&squadId=DDWMISSI',
    });
    expect(mapNotificationDto({ ...request, link: '/admin?tab=aprovacoes' }, 'foryou').cta).toEqual({ label: 'Ver pedido', href: '/admin?tab=aprovacoes' });
  });

  it('feed: contadores do servidor valem; sem eles, calcula', () => {
    const forYou = [base, { ...base, id: 'n2', readAt: 'x' }];
    expect(buildNotificationFeed(forYou, [], { forYou: 5, messages: 3, announcements: 1, total: 9 }).unread).toEqual({ foryou: 5, messages: 3, announcements: 1, total: 9 });
    expect(buildNotificationFeed(forYou, [], null).unread).toEqual({ foryou: 1, messages: 0, announcements: 0, total: 1 });
  });

  it('id do servidor sem o prefixo local', () => {
    expect(serverNotificationId('notification:abc')).toBe('abc');
    expect(serverNotificationId('announcement:abc')).toBeNull();
  });
});

describe('mensagens', () => {
  it('conversa traduzida com a última mensagem', () => {
    const c = mapConversationDto({
      id: 'c1', otherUser: { id: 'u2', name: '  Diego Alves ', avatarUrl: null },
      lastMessage: { id: 'm', conversationId: 'c1', senderId: 'u2', body: 'oi', createdAt: 'x' }, unreadCount: 3, updatedAt: 'y',
    });
    expect(c).toMatchObject({ id: 'c1', other: { id: 'u2', name: 'Diego Alves' }, unreadCount: 3 });
    expect(c.lastMessage?.body).toBe('oi');
  });

  it('texto de saída: apara, recusa vazio, limita o tamanho', () => {
    expect(normalizeOutgoingMessage('  oi  ')).toBe('oi');
    expect(normalizeOutgoingMessage('   ')).toBeNull();
    expect(normalizeOutgoingMessage('a'.repeat(MESSAGE_MAX_LENGTH + 50))).toHaveLength(MESSAGE_MAX_LENGTH);
  });
});

describe('avisos v2', () => {
  const dto = {
    id: 'a1', title: 'Atualize o vínculo', content: 'Até sexta.', type: 'IMPORTANT', audienceType: 'ROLES', audienceSquadIds: [], audienceRoles: ['AGILE_MASTER'],
    validFrom: '2026-10-13T10:00:00Z', validUntil: null, link: 'https://exemplo.com/x', createdBy: 'tribe@totvs.com.br', createdByName: 'Tribe Lead', createdAt: '2026-10-13T10:00:00Z', dismissed: false,
  };

  it('tipo, público, link e autor (nunca o e-mail)', () => {
    const a = toHomeAnnouncement(dto)!;
    expect(a).toMatchObject({ kind: 'important', publishedBy: 'Tribe Lead', learnMoreUrl: 'https://exemplo.com/x', audienceLabel: 'para papéis selecionados', serverManaged: true });
    expect(toHomeAnnouncement({ ...dto, createdByName: null })?.publishedBy).toBeUndefined();
  });

  it('sem validade final o aviso do servidor não expira; o antigo expira em 7 dias', () => {
    const v2 = toHomeAnnouncement({ ...dto, validFrom: '2026-08-01T00:00:00Z' })!;
    expect(isAnnouncementActive(v2, NOW, 7 * 86_400_000)).toBe(true);
    const legacy = toHomeAnnouncement({ id: 'o', title: 't', content: 'c', createdAt: '2026-08-01T00:00:00Z' })!;
    expect(isAnnouncementActive(legacy, NOW, 7 * 86_400_000)).toBe(false);
    expect(pickBannerAnnouncement([v2, legacy], new Set(), NOW)?.id).toBe('a1');
  });

  it('data final vencida esconde mesmo do servidor', () => {
    const a = toHomeAnnouncement({ ...dto, validUntil: '2026-10-14T10:00:00Z' })!;
    expect(isAnnouncementActive(a, NOW, 7 * 86_400_000)).toBe(false);
  });
});
