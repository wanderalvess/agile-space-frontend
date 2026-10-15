import { beforeEach, describe, expect, it, vi } from 'vitest';

const apis = vi.hoisted(() => ({
  getAnnouncements: vi.fn(),
  listRooms: vi.fn(),
  listBoards: vi.fn(),
  getSessions: vi.fn(),
  healthList: vi.fn(),
  brainList: vi.fn(),
  getRollup: vi.fn(),
  getSquad: vi.fn(),
}));

vi.mock('../../../app/admin/api', () => ({ publicApi: { getAnnouncements: apis.getAnnouncements } }));
vi.mock('../../../app/room/api', () => ({ pokerApi: { listRooms: apis.listRooms } }));
vi.mock('../../../app/retro/api', () => ({ retroApi: { listBoards: apis.listBoards } }));
vi.mock('../../../app/showcase/api', () => ({ showcaseApi: { getSessions: apis.getSessions } }));
vi.mock('../../../app/health-check/api', () => ({ healthCheckApi: { listBoards: apis.healthList } }));
vi.mock('../../../app/brainstorming/api', () => ({ brainstormingApi: { listBoards: apis.brainList } }));
vi.mock('../../../app/squad/api', () => ({ squadApi: { getRollup: apis.getRollup, getSquad: apis.getSquad } }));

import {
  clearAnnouncementsCache,
  clearSquadSnapshotCache,
  clearToolSessionCache,
  dismissAnnouncement,
  fetchAnnouncements,
  fetchLiveSessions,
  fetchNotifications,
  fetchRitualHistory,
  fetchSquadSnapshot,
  loadDismissedAnnouncements,
  loadReadNotifications,
  markNotificationsRead,
} from '../sources';

const NOW = new Date('2026-10-14T15:00:00');
const iso = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
const squad = { id: 'phoenix', name: 'Phoenix' };

beforeEach(() => {
  Object.values(apis).forEach((m) => m.mockReset());
  clearAnnouncementsCache();
  clearToolSessionCache();
  clearSquadSnapshotCache();
  localStorage.clear();
  apis.listRooms.mockResolvedValue([]);
  apis.listBoards.mockResolvedValue([]);
  apis.getSessions.mockResolvedValue([]);
  apis.healthList.mockResolvedValue([]);
  apis.brainList.mockResolvedValue([]);
});

describe('avisos', () => {
  it('mapeia o formato atual e descarta registros inválidos', async () => {
    apis.getAnnouncements.mockResolvedValue([{ id: '1', title: 'A', content: 'x', createdBy: 'Admin', createdAt: iso(1) }, { id: '2' }, null]);
    const list = await fetchAnnouncements(NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: '1', kind: 'info', publishedBy: 'Admin' });
  });

  it('falha ou resposta estranha vira lista vazia', async () => {
    apis.getAnnouncements.mockRejectedValue(new Error('rede'));
    expect(await fetchAnnouncements(NOW)).toEqual([]);
    clearAnnouncementsCache();
    apis.getAnnouncements.mockResolvedValue({ erro: true });
    expect(await fetchAnnouncements(NOW)).toEqual([]);
  });

  it('o banner e o sino compartilham uma só chamada', async () => {
    apis.getAnnouncements.mockResolvedValue([]);
    await Promise.all([fetchAnnouncements(NOW), fetchAnnouncements(NOW)]);
    expect(apis.getAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('dispensa e leitura ficam guardadas por usuário', async () => {
    await dismissAnnouncement('u1', 'a1');
    await markNotificationsRead('u1', ['announcement:a1', 'announcement:a2']);
    expect([...loadDismissedAnnouncements('u1')]).toEqual(['a1']);
    expect(loadDismissedAnnouncements('u2').size).toBe(0);
    expect(loadReadNotifications('u1').has('announcement:a2')).toBe(true);
  });

  it('storage corrompido não quebra', () => {
    localStorage.setItem('agileSpace_home_dismissed_u1', '{lixo');
    expect(loadDismissedAnnouncements('u1').size).toBe(0);
  });

  it('notificações ainda não têm endpoint: devolve null (sem chamada de rede)', async () => {
    expect(await fetchNotifications()).toBeNull();
  });
});

describe('sessões ao vivo', () => {
  it('junta os rituais, filtra só o que está ao vivo e ignora quem falhou', async () => {
    apis.listRooms.mockResolvedValue([
      { id: 'p1', title: 'Refinamento', createdAt: iso(30), sessionStartedAt: iso(1), participantsCount: 5, issuesQueue: [] },
      { id: 'p2', title: 'Velha', createdAt: iso(100), sessionStartedAt: iso(99), sessionEndedAt: iso(98), issuesQueue: [] },
    ]);
    apis.listBoards.mockRejectedValue(new Error('403')); // retro indisponível
    apis.getSessions.mockResolvedValue([{ id: 's1', name: 'Review', tasks: [], createdAt: iso(2), status: 'presenting' }]);
    const live = await fetchLiveSessions([squad], NOW);
    expect(live.map((s) => s.id).sort()).toEqual(['p1', 's1']);
    expect(live.every((s) => s.squadName === 'Phoenix')).toBe(true);
  });

  it('sem squads não chama ninguém', async () => {
    expect(await fetchLiveSessions([], NOW)).toEqual([]);
    expect(apis.listRooms).not.toHaveBeenCalled();
  });

  it('tudo falhando devolve vazio, sem lançar', async () => {
    Object.values(apis).forEach((m) => m.mockRejectedValue(new Error('fora do ar')));
    expect(await fetchLiveSessions([squad], NOW)).toEqual([]);
  });

  it('ao vivo e histórico reaproveitam as mesmas listas (cache curto)', async () => {
    await fetchLiveSessions([squad], NOW);
    await fetchRitualHistory([squad], NOW);
    expect(apis.listRooms).toHaveBeenCalledTimes(1);
    expect(apis.healthList).toHaveBeenCalledTimes(1);
  });

  it('falha não fica no cache: a próxima tentativa refaz', async () => {
    apis.listRooms.mockRejectedValueOnce(new Error('x'));
    await fetchLiveSessions([squad], NOW);
    await fetchLiveSessions([squad], NOW);
    expect(apis.listRooms).toHaveBeenCalledTimes(2);
  });
});

describe('histórico dos rituais', () => {
  it('agrupa por ritual, mais recente primeiro, com squads misturadas', async () => {
    apis.listRooms.mockImplementation(async (id: string) => [
      { id: `${id}-old`, createdAt: iso(100), sessionStartedAt: iso(100), sessionEndedAt: iso(99), issuesQueue: [] },
      { id: `${id}-new`, createdAt: iso(50), sessionStartedAt: iso(50), sessionEndedAt: iso(49), issuesQueue: [] },
    ]);
    const history = await fetchRitualHistory([squad, { id: 'atlas', name: 'Atlas' }], NOW);
    expect(history.poker).toHaveLength(4);
    expect(history.poker[0].createdAt && history.poker[3].createdAt && history.poker[0].createdAt > history.poker[3].createdAt).toBe(true);
    expect(history.retro).toEqual([]);
  });
});

describe('resumo da squad', () => {
  it('rollup 204/ausente e config com erro viram null', async () => {
    apis.getRollup.mockResolvedValue(null);
    apis.getSquad.mockRejectedValue(new Error('403'));
    expect(await fetchSquadSnapshot('phoenix', NOW)).toEqual({ rollup: null, config: null });
  });

  it('devolve o que veio', async () => {
    apis.getRollup.mockResolvedValue({ squadId: 'phoenix', sprintName: 'Sprint 42' });
    apis.getSquad.mockResolvedValue({ id: 'phoenix', ceremonyMode: 'manual' });
    const snap = await fetchSquadSnapshot('phoenix', NOW);
    expect(snap.rollup?.sprintName).toBe('Sprint 42');
    expect(snap.config?.ceremonyMode).toBe('manual');
  });
});
