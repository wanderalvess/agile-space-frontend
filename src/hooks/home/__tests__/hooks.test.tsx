import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { id: 'u1', activeProjectId: 'phoenix', activeProjectName: 'Phoenix', accessibleProjects: [] as unknown[] } as Record<string, unknown> | null,
  switchProject: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchNotifications: vi.fn(),
  fetchLiveSessions: vi.fn(),
  fetchRitualHistory: vi.fn(),
  fetchSquadInfos: vi.fn(),
  fetchConversations: vi.fn(),
  fetchContacts: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
  markNotificationsRead: vi.fn(),
  onSignal: null as null | ((s: { type: string }) => void),
  stopChannel: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, switchProject: mocks.switchProject }),
}));

vi.mock('../userChannel', () => ({
  buildUserChannelUrl: () => 'ws://teste',
  startUserChannel: (opts: { onSignal: (s: { type: string }) => void }) => {
    mocks.onSignal = opts.onSignal;
    return mocks.stopChannel;
  },
}));

vi.mock('../sources', async () => {
  const actual = await vi.importActual<typeof import('../sources')>('../sources');
  return {
    ...actual,
    fetchAnnouncements: mocks.fetchAnnouncements,
    fetchNotifications: mocks.fetchNotifications,
    fetchLiveSessions: mocks.fetchLiveSessions,
    fetchRitualHistory: mocks.fetchRitualHistory,
    fetchSquadInfos: mocks.fetchSquadInfos,
    fetchConversations: mocks.fetchConversations,
    fetchContacts: mocks.fetchContacts,
    fetchMessages: mocks.fetchMessages,
    sendMessage: mocks.sendMessage,
    markConversationRead: mocks.markConversationRead,
    markNotificationsRead: mocks.markNotificationsRead,
  };
});

import { useHomeAnnouncements } from '../useHomeAnnouncements';
import { useLiveSessions } from '../useLiveSessions';
import { useConversationList, useConversationThread } from '../useMessages';
import { useMySquads } from '../useMySquads';
import { useNotifications } from '../useNotifications';
import { useRitualHistory } from '../useRitualHistory';

const recent = () => new Date(Date.now() - 3_600_000).toISOString();
const ann = (over: Record<string, unknown> = {}) => ({ id: 'a1', kind: 'info', title: 'Novo poker', text: 'x', publishedAt: recent(), ...over });

beforeEach(() => {
  localStorage.clear();
  mocks.session = { id: 'u1', activeProjectId: 'phoenix', activeProjectName: 'Phoenix', accessibleProjects: [] };
  mocks.onSignal = null;
  Object.values(mocks).forEach((m) => typeof m === 'function' && 'mockReset' in m && m.mockReset());
  mocks.fetchAnnouncements.mockResolvedValue([]);
  mocks.fetchNotifications.mockResolvedValue(null);
  mocks.fetchLiveSessions.mockResolvedValue([]);
  mocks.fetchRitualHistory.mockResolvedValue({ poker: [], retro: [], showcase: [], health: [], brainstorming: [] });
  mocks.fetchSquadInfos.mockResolvedValue({});
  mocks.fetchConversations.mockResolvedValue(null);
  mocks.markNotificationsRead.mockResolvedValue(undefined);
  mocks.markConversationRead.mockResolvedValue(undefined);
});

describe('useHomeAnnouncements', () => {
  it('mostra o aviso e para de mostrá-lo depois de dispensado (aviso antigo: guarda no navegador)', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann()]);
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.announcement?.id).toBe('a1'));
    await act(async () => {
      await result.current.dismiss(result.current.announcement!);
    });
    expect(result.current.announcement).toBeNull();
    expect(JSON.parse(localStorage.getItem('agileSpace_home_dismissed_u1') ?? '[]')).toEqual(['a1']);
  });

  it('lembra a dispensa na próxima visita', async () => {
    localStorage.setItem('agileSpace_home_dismissed_u1', JSON.stringify(['a1']));
    mocks.fetchAnnouncements.mockResolvedValue([ann()]);
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.announcement).toBeNull();
  });

  it('aviso do servidor sem data final continua valendo (não expira pela janela dos antigos)', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ serverManaged: true, publishedAt: '2026-01-01T00:00:00Z' })]);
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.announcement?.id).toBe('a1'));
  });

  it('endpoint fora do ar: sem aviso e sem erro', async () => {
    mocks.fetchAnnouncements.mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.announcement).toBeNull();
    expect(result.current.announcements).toEqual([]);
  });

  it('sem sessão não busca nada', async () => {
    mocks.session = null;
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.fetchAnnouncements).not.toHaveBeenCalled();
  });
});

describe('useNotifications', () => {
  it('servidor antigo: só avisos, e as abas Para você e Mensagens ficam vazias', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ id: 'a1' }), ann({ id: 'a2', kind: 'maintenance' })]);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.byTab.announcements).toHaveLength(2));
    expect(result.current.hasBackendFeed).toBe(false);
    expect(result.current.byTab.foryou).toEqual([]);
    expect(result.current.byTab.messages).toEqual([]);
    expect(result.current.unread).toEqual({ foryou: 0, messages: 0, announcements: 2, total: 2 });
    expect(result.current.unreadTotal).toBe(2);
  });

  it('servidor antigo: marcar como lidas zera o contador e persiste no navegador', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ id: 'a1' })]);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadTotal).toBe(1));
    await act(async () => {
      await result.current.markAllRead();
    });
    expect(result.current.unreadTotal).toBe(0);
    expect(mocks.markNotificationsRead).toHaveBeenCalledWith('u1', ['announcement:a1']);
  });

  const feed = () => ({
    items: [
      { id: 'notification:n1', tab: 'foryou', who: 'Gabriela Nunes', text: 'convidou você', unread: true },
      { id: 'notification:n3', tab: 'announcements', who: 'Nova versão', text: '', unread: true },
    ],
    unread: { foryou: 1, messages: 2, announcements: 1, total: 4 },
  });

  it('servidor novo: usa as notificações e os contadores do servidor (inclui mensagens)', async () => {
    mocks.fetchNotifications.mockResolvedValue(feed());
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.hasBackendFeed).toBe(true));
    expect(result.current.unread).toEqual({ foryou: 1, messages: 2, announcements: 1, total: 4 });
    expect(result.current.byTab.foryou).toHaveLength(1);
    expect(result.current.byTab.announcements).toHaveLength(1);
    expect(mocks.fetchAnnouncements).not.toHaveBeenCalled();
  });

  it('servidor novo: marcar como lidas zera o contador na hora e pede nova leitura', async () => {
    mocks.fetchNotifications.mockResolvedValue(feed());
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadTotal).toBe(4));
    const callsBefore = mocks.fetchNotifications.mock.calls.length;
    mocks.fetchNotifications.mockResolvedValue({ ...feed(), unread: { foryou: 0, messages: 0, announcements: 0, total: 0 } });
    await act(async () => {
      await result.current.markAllRead();
    });
    expect(mocks.markNotificationsRead).toHaveBeenCalledWith('u1', ['notification:n1', 'notification:n3']);
    await waitFor(() => expect(mocks.fetchNotifications.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(result.current.unreadTotal).toBe(0);
  });

  it('sinal do canal do usuário refaz a leitura e encerra ao desmontar', async () => {
    mocks.fetchNotifications.mockResolvedValue(feed());
    const { result, unmount } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.hasBackendFeed).toBe(true));
    const before = mocks.fetchNotifications.mock.calls.length;
    expect(mocks.onSignal).toBeTruthy();
    await act(async () => {
      mocks.onSignal?.({ type: 'NOTIFICATION' });
    });
    await waitFor(() => expect(mocks.fetchNotifications.mock.calls.length).toBeGreaterThan(before));
    expect(result.current.tick).toBeGreaterThan(0);
    unmount();
    expect(mocks.stopChannel).toHaveBeenCalled();
  });

  it('sem sessão não abre canal nem busca', async () => {
    mocks.session = null;
    renderHook(() => useNotifications());
    expect(mocks.onSignal).toBeNull();
    expect(mocks.fetchNotifications).not.toHaveBeenCalled();
  });
});

describe('mensagens', () => {
  it('lista indisponível (servidor antigo): vazia e sem escrita', async () => {
    const { result } = renderHook(() => useConversationList(true, 0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.conversations).toEqual([]);
  });

  it('lista com conversas', async () => {
    mocks.fetchConversations.mockResolvedValue([{ id: 'c1', other: { id: 'u2', name: 'Diego' }, lastMessage: null, unreadCount: 1, updatedAt: recent() }]);
    const { result } = renderHook(() => useConversationList(true, 0));
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.available).toBe(true);
  });

  const msg = (id: string, minutesAgo: number, senderId = 'u2') => ({
    id, conversationId: 'c1', senderId, body: `texto ${id}`, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  });

  it('abrir marca como lida; enviar acrescenta a mensagem em ordem e avisa a tela', async () => {
    mocks.fetchMessages.mockResolvedValue([msg('m1', 10), msg('m2', 5)]);
    mocks.sendMessage.mockResolvedValue(msg('m3', 0, 'u1'));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useConversationThread('c1', 0, onChanged));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(mocks.markConversationRead).toHaveBeenCalledWith('c1');

    let ok = false;
    await act(async () => {
      ok = await result.current.send('Fechado');
    });
    expect(ok).toBe(true);
    expect(mocks.sendMessage).toHaveBeenCalledWith('c1', 'Fechado');
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(onChanged).toHaveBeenCalled();
  });

  it('envio que falha mostra o erro e não acrescenta', async () => {
    mocks.fetchMessages.mockResolvedValue([]);
    mocks.sendMessage.mockRejectedValue(new Error('A mensagem deve ter de 1 a 2000 caracteres.'));
    const { result } = renderHook(() => useConversationThread('c1', 0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = true;
    await act(async () => {
      ok = await result.current.send('x');
    });
    expect(ok).toBe(false);
    expect(result.current.sendError).toContain('2000');
    expect(result.current.messages).toEqual([]);
  });

  it('sem conversa escolhida não busca nem envia', async () => {
    const { result } = renderHook(() => useConversationThread(null, 0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.fetchMessages).not.toHaveBeenCalled();
    expect(await result.current.send('oi')).toBe(false);
  });
});

describe('useLiveSessions / useRitualHistory', () => {
  const squads = [{ id: 'phoenix', name: 'Phoenix' }];

  it('devolve as sessões e falha vira lista vazia', async () => {
    mocks.fetchLiveSessions.mockResolvedValue([{ id: 's1' }]);
    const ok = renderHook(() => useLiveSessions(squads));
    await waitFor(() => expect(ok.result.current.data).toHaveLength(1));

    mocks.fetchLiveSessions.mockRejectedValue(new Error('boom'));
    const bad = renderHook(() => useLiveSessions([{ id: 'atlas', name: 'Atlas' }]));
    await waitFor(() => expect(bad.result.current.failed).toBe(true));
    expect(bad.result.current.data).toEqual([]);
  });

  it('volta a consultar quando a aba volta a ficar visível (sala criada em outra aba aparece sem esperar)', async () => {
    mocks.fetchLiveSessions.mockResolvedValue([]);
    const { result } = renderHook(() => useLiveSessions(squads));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.fetchLiveSessions).toHaveBeenCalledTimes(1);

    mocks.fetchLiveSessions.mockResolvedValue([{ id: 'nova' }]);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(mocks.fetchLiveSessions).toHaveBeenCalledTimes(2);
  });

  it('sem squads não consulta', async () => {
    const { result } = renderHook(() => useLiveSessions([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.fetchLiveSessions).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it('histórico vazio e com falha mantém o formato por ritual', async () => {
    mocks.fetchRitualHistory.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useRitualHistory(squads));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(Object.keys(result.current.data).sort()).toEqual(['brainstorming', 'health', 'poker', 'retro', 'showcase']);
    expect(result.current.data.poker).toEqual([]);
  });
});

describe('useMySquads', () => {
  it('conta de uma squad: não é multi, usa a squad ativa', async () => {
    const { result } = renderHook(() => useMySquads());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isMulti).toBe(false);
    expect(result.current.squads).toHaveLength(1);
    expect(result.current.activeSquad?.name).toBe('Phoenix');
    expect(result.current.squads[0].sprintPercent).toBeNull();
  });

  it('várias squads: resumo de sprint e troca via switchProject', async () => {
    mocks.session = {
      id: 'u1',
      activeProjectId: 'phoenix',
      accessibleProjects: [
        { projectId: 'phoenix', projectName: 'Phoenix', roleName: 'Agile Master' },
        { projectId: 'atlas', projectName: 'Atlas' },
      ],
    };
    mocks.fetchSquadInfos.mockResolvedValue({
      atlas: { sprintName: 'Sprint 18', sprintPercent: 80, daysLeft: 2 },
      phoenix: { sprintPercent: null, daysLeft: null },
    });
    mocks.switchProject.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMySquads());
    await waitFor(() => expect(result.current.squads.find((s) => s.id === 'atlas')?.sprintPercent).toBe(80));
    expect(result.current.isMulti).toBe(true);
    expect(result.current.squads.find((s) => s.id === 'atlas')?.daysLeft).toBe(2);

    await act(async () => {
      await result.current.switchTo('phoenix'); // já é a ativa
      await result.current.switchTo('atlas');
    });
    expect(mocks.switchProject).toHaveBeenCalledTimes(1);
    expect(mocks.switchProject).toHaveBeenCalledWith('atlas');
  });

  it('falha no resumo não derruba a lista de squads', async () => {
    mocks.session = { id: 'u1', activeProjectId: 'a', accessibleProjects: [{ projectId: 'a', projectName: 'A' }, { projectId: 'b', projectName: 'B' }] };
    mocks.fetchSquadInfos.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useMySquads());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squads.map((s) => s.name)).toEqual(['A', 'B']);
  });
});
