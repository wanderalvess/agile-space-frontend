import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import {
  adminAnnouncementsApi,
  announcementsApi,
  buildUserChannelUrl,
  conversationsApi,
  EMPTY_HOME,
  homeApi,
  liveSessionsApi,
  loadHomeSafe,
  notificationsApi,
  ritualsApi,
  API_BASE_URL,
} from '../home-api';
import { CeremonyApiError } from '../ceremony-api';

function response(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => (text ? JSON.parse(text) : undefined),
  } as Response;
}

const url = (i = 0) => authFetch.mock.calls[i][0] as string;
const init = (i = 0) => (authFetch.mock.calls[i][1] || {}) as RequestInit;
const path = (i = 0) => url(i).replace(API_BASE_URL, '');

beforeEach(() => authFetch.mockReset());

describe('announcementsApi', () => {
  it('active, history (limit) e dismiss', async () => {
    authFetch.mockResolvedValue(response(200, []));
    await announcementsApi.active();
    await announcementsApi.history(5);
    authFetch.mockResolvedValue(response(204));
    await announcementsApi.dismiss('a 1');
    expect(path(0)).toBe('/announcements/active');
    expect(path(1)).toBe('/announcements/history?limit=5');
    expect(path(2)).toBe('/announcements/a%201/dismiss');
    expect(init(2).method).toBe('POST');
  });
});

describe('adminAnnouncementsApi', () => {
  const input = {
    title: 'Manutenção', content: 'Sábado 22h', type: 'MAINTENANCE' as const,
    audienceType: 'ROLES' as const, audienceSquadIds: [], audienceRoles: ['AGILE_MASTER'],
    validFrom: '2026-10-15T00:00:00Z', validUntil: null, link: '/changelog',
  };

  it('create manda o corpo inteiro do contrato', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'x', ...input }));
    const created = await adminAnnouncementsApi.create(input);
    expect(path()).toBe('/admin/announcements');
    expect(init().method).toBe('POST');
    expect(JSON.parse(init().body as string)).toEqual(input);
    expect(created.id).toBe('x');
  });

  it('update usa PUT e delete usa DELETE no id', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'x' }));
    await adminAnnouncementsApi.update('x', input);
    authFetch.mockResolvedValue(response(204));
    await adminAnnouncementsApi.remove('x');
    expect(path(0)).toBe('/admin/announcements/x');
    expect(init(0).method).toBe('PUT');
    expect(path(1)).toBe('/admin/announcements/x');
    expect(init(1).method).toBe('DELETE');
  });

  it('erro 4xx traz a mensagem do servidor', async () => {
    authFetch.mockResolvedValue(response(400, { message: 'validUntil deve ser depois de validFrom' }));
    const error = await adminAnnouncementsApi.create(input).catch((e) => e);
    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.message).toBe('validUntil deve ser depois de validFrom');
  });
});

describe('notificationsApi', () => {
  it('lista por categoria, conta não lidas e marca como lidas', async () => {
    authFetch.mockResolvedValue(response(200, []));
    await notificationsApi.list('FOR_YOU');
    authFetch.mockResolvedValue(response(200, { forYou: 1, messages: 2, announcements: 0, total: 3 }));
    const count = await notificationsApi.unreadCount();
    authFetch.mockResolvedValue(response(204));
    await notificationsApi.markRead('n1');
    await notificationsApi.markAllRead('ANNOUNCEMENTS');
    await notificationsApi.markAllRead();

    expect(path(0)).toBe('/notifications?category=FOR_YOU&limit=30');
    expect(path(1)).toBe('/notifications/unread-count');
    expect(count.total).toBe(3);
    expect(path(2)).toBe('/notifications/n1/read');
    expect(init(2).method).toBe('POST');
    expect(path(3)).toBe('/notifications/read-all?category=ANNOUNCEMENTS');
    expect(path(4)).toBe('/notifications/read-all');
  });
});

describe('conversationsApi', () => {
  it('cobre lista, contatos, abrir, mensagens, enviar e ler', async () => {
    authFetch.mockResolvedValue(response(200, []));
    await conversationsApi.list();
    await conversationsApi.contacts();
    authFetch.mockResolvedValue(response(200, { id: 'c1' }));
    await conversationsApi.open('u2');
    authFetch.mockResolvedValue(response(200, []));
    await conversationsApi.messages('c1', { before: '2026-10-15T10:00:00Z' });
    authFetch.mockResolvedValue(response(200, { id: 'm1' }));
    await conversationsApi.sendMessage('c1', 'oi');
    authFetch.mockResolvedValue(response(204));
    await conversationsApi.markRead('c1');

    expect(path(0)).toBe('/conversations');
    expect(path(1)).toBe('/conversations/contacts');
    expect(path(2)).toBe('/conversations');
    expect(init(2).method).toBe('POST');
    expect(JSON.parse(init(2).body as string)).toEqual({ userId: 'u2' });
    expect(path(3)).toBe('/conversations/c1/messages?limit=50&before=2026-10-15T10%3A00%3A00Z');
    expect(path(4)).toBe('/conversations/c1/messages');
    expect(JSON.parse(init(4).body as string)).toEqual({ body: 'oi' });
    expect(path(5)).toBe('/conversations/c1/read');
  });
});

describe('sessões, rituais e home', () => {
  it('monta as rotas com squadId opcional e o segmento do ritual em minúsculas', async () => {
    authFetch.mockResolvedValue(response(200, []));
    await liveSessionsApi.list();
    await liveSessionsApi.list('sq1');
    await ritualsApi.history('HEALTH_CHECK', { squadId: 'sq1' });
    await ritualsApi.history('POKER');
    authFetch.mockResolvedValue(response(200, EMPTY_HOME));
    await homeApi.get('sq1');

    expect(path(0)).toBe('/live-sessions');
    expect(path(1)).toBe('/live-sessions?squadId=sq1');
    expect(path(2)).toBe('/rituals/health-check/history?squadId=sq1&limit=10');
    expect(path(3)).toBe('/rituals/poker/history?limit=10');
    expect(path(4)).toBe('/home?squadId=sq1');
  });

  it('loadHomeSafe cai para seções vazias quando a home falha', async () => {
    authFetch.mockResolvedValue(response(500));
    const result = await loadHomeSafe();
    expect(result.failed).toBe(true);
    expect(result.data).toEqual(EMPTY_HOME);
  });

  it('loadHomeSafe completa campos ausentes', async () => {
    authFetch.mockResolvedValue(response(200, { multiSquad: true, squads: [{ squadId: 's', name: 'Phoenix' }] }));
    const result = await loadHomeSafe();
    expect(result.failed).toBe(false);
    expect(result.data.multiSquad).toBe(true);
    expect(result.data.liveSessions).toEqual([]);
    expect(result.data.unread.total).toBe(0);
  });
});

describe('buildUserChannelUrl', () => {
  it('troca http→ws, /api→/ws/user e codifica o token', () => {
    expect(buildUserChannelUrl('a.b+c', 'https://app.exemplo.com/api')).toBe('wss://app.exemplo.com/ws/user?token=a.b%2Bc');
    expect(buildUserChannelUrl(null, 'http://localhost:8002/api')).toBe('ws://localhost:8002/ws/user?token=');
  });
});
