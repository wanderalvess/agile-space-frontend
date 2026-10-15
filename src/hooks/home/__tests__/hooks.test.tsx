import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { id: 'u1', activeProjectId: 'phoenix', activeProjectName: 'Phoenix', accessibleProjects: [] as unknown[] } as Record<string, unknown> | null,
  switchProject: vi.fn(),
  fetchAnnouncements: vi.fn(),
  fetchNotifications: vi.fn(),
  fetchLiveSessions: vi.fn(),
  fetchRitualHistory: vi.fn(),
  fetchSquadSnapshot: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, switchProject: mocks.switchProject }),
}));

vi.mock('../sources', async () => {
  const actual = await vi.importActual<typeof import('../sources')>('../sources');
  return {
    ...actual,
    fetchAnnouncements: mocks.fetchAnnouncements,
    fetchNotifications: mocks.fetchNotifications,
    fetchLiveSessions: mocks.fetchLiveSessions,
    fetchRitualHistory: mocks.fetchRitualHistory,
    fetchSquadSnapshot: mocks.fetchSquadSnapshot,
  };
});

import { useHomeAnnouncements } from '../useHomeAnnouncements';
import { useLiveSessions } from '../useLiveSessions';
import { useMySquads } from '../useMySquads';
import { useNotifications } from '../useNotifications';
import { useRitualHistory } from '../useRitualHistory';

const recent = () => new Date(Date.now() - 3_600_000).toISOString();
const ann = (over: Record<string, unknown> = {}) => ({ id: 'a1', kind: 'info', title: 'Novo poker', text: 'x', publishedAt: recent(), ...over });

beforeEach(() => {
  localStorage.clear();
  mocks.session = { id: 'u1', activeProjectId: 'phoenix', activeProjectName: 'Phoenix', accessibleProjects: [] };
  mocks.switchProject.mockReset();
  mocks.fetchAnnouncements.mockReset().mockResolvedValue([]);
  mocks.fetchNotifications.mockReset().mockResolvedValue(null);
  mocks.fetchLiveSessions.mockReset().mockResolvedValue([]);
  mocks.fetchRitualHistory.mockReset().mockResolvedValue({ poker: [], retro: [], showcase: [], health: [], brainstorming: [] });
  mocks.fetchSquadSnapshot.mockReset().mockResolvedValue({ rollup: null, config: null });
});

describe('useHomeAnnouncements', () => {
  it('mostra o aviso e para de mostrá-lo depois de dispensado', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann()]);
    const { result } = renderHook(() => useHomeAnnouncements());
    await waitFor(() => expect(result.current.announcement?.id).toBe('a1'));
    await act(async () => {
      await result.current.dismiss('a1');
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
  it('só avisos enquanto o backend não entrega notificações', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ id: 'a1' }), ann({ id: 'a2', kind: 'maintenance' })]);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.byTab.announcements).toHaveLength(2));
    expect(result.current.hasBackendFeed).toBe(false);
    expect(result.current.byTab.foryou).toEqual([]);
    expect(result.current.byTab.messages).toEqual([]);
    expect(result.current.unread).toEqual({ foryou: 0, messages: 0, announcements: 2 });
    expect(result.current.unreadTotal).toBe(2);
  });

  it('marcar como lidas zera o contador e persiste', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ id: 'a1' })]);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadTotal).toBe(1));
    await act(async () => {
      await result.current.markAllRead();
    });
    expect(result.current.unreadTotal).toBe(0);
    expect(JSON.parse(localStorage.getItem('agileSpace_home_read_u1') ?? '[]')).toEqual(['announcement:a1']);
  });

  it('usa notificações do backend quando existirem, junto com os avisos', async () => {
    mocks.fetchAnnouncements.mockResolvedValue([ann({ id: 'a1' })]);
    mocks.fetchNotifications.mockResolvedValue([
      { id: 'n1', tab: 'foryou', who: 'Gabriela Nunes', text: 'convidou você', unread: true },
      { id: 'n2', tab: 'messages', who: 'Diego Alves', text: 'oi', unread: false },
    ]);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.hasBackendFeed).toBe(true));
    expect(result.current.unread).toEqual({ foryou: 1, messages: 0, announcements: 1 });
    expect(result.current.byTab.messages).toHaveLength(1);
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
    mocks.fetchSquadSnapshot.mockImplementation(async (id: string) => ({
      rollup: id === 'atlas' ? { squadId: id, sprintName: 'Sprint 18', workdaysTotal: 10, workdaysRemaining: 2 } : null,
      config: null,
    }));
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
    mocks.fetchSquadSnapshot.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useMySquads());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squads.map((s) => s.name)).toEqual(['A', 'B']);
  });
});
