import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveUser: vi.fn(),
  sync: vi.fn(),
  getSquad: vi.fn(),
  getRollup: vi.fn(),
  getMemberMetrics: vi.fn(),
}));

vi.mock('../../app/users/api', () => ({ userApi: { saveUser: (...args: unknown[]) => mocks.saveUser(...args) } }));
vi.mock('../../app/squad/api', () => ({
  squadApi: {
    sync: (...args: unknown[]) => mocks.sync(...args),
    getSquad: (...args: unknown[]) => mocks.getSquad(...args),
    getRollup: (...args: unknown[]) => mocks.getRollup(...args),
    getMemberMetrics: (...args: unknown[]) => mocks.getMemberMetrics(...args),
  },
}));

import { useSquadStore } from '../useSquadStore';

beforeEach(() => {
  mocks.saveUser.mockReset();
  mocks.sync.mockReset().mockResolvedValue(undefined);
  mocks.getSquad.mockReset().mockResolvedValue({ squadId: 'DDWMISSI', rankingEnabled: false });
  mocks.getRollup.mockReset().mockResolvedValue(null);
  mocks.getMemberMetrics.mockReset().mockResolvedValue([]);
});

describe('useSquadStore.syncSquad', () => {
  it('sincroniza a squad sem gravar squadId no usuário', async () => {
    useSquadStore.setState({ activeSquadId: 'DDWMISSI' } as never);
    await useSquadStore.getState().syncSquad('u1', 'DDWMISSI', true);
    expect(mocks.sync).toHaveBeenCalledWith('DDWMISSI', true);
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });
});

describe('useSquadStore: vínculo', () => {
  it('não grava mais o claim da pessoa no roster (o vínculo nasce no onboarding, no convite e na aprovação)', () => {
    expect('claimMember' in useSquadStore.getState()).toBe(false);
  });
});
