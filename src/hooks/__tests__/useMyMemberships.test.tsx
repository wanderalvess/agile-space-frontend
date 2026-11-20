import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership, MyMemberships } from '../../lib/memberships-api';

const mocks = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  getMyMemberships: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('../../lib/memberships-api', () => ({ getMyMemberships: (...args: unknown[]) => mocks.getMyMemberships(...args) }));

import { useMyMemberships } from '../useMyMemberships';
import { invalidateMyMemberships, resetMyMemberships } from '../../lib/memberships-store';

const ms = (projectId: string): Membership => ({
  projectId,
  projectName: projectId,
  roleName: 'Developer',
  roleKey: 'DEVELOPER',
  leadership: false,
  direct: true,
  scope: 'SQUAD',
  source: 'JIRA',
  roles: [{ roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: true }],
});

const payload = (...ids: string[]): MyMemberships => ({
  contractVersion: '1',
  activeProjectId: ids[0] ?? null,
  legacyOnly: false,
  transversalLeader: false,
  memberships: ids.map(ms),
});

const sessionOf = (id: string, active: string) => ({
  id,
  activeProjectId: active,
  accessibleProjects: [{ projectId: 'A1', roleKey: 'DEVELOPER' }, { projectId: 'B2', roleKey: 'DEVELOPER' }],
});

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

beforeEach(() => {
  resetMyMemberships();
  mocks.session = sessionOf('u1', 'A1');
  mocks.getMyMemberships.mockReset();
  mocks.getMyMemberships.mockResolvedValue(null);
});

describe('useMyMemberships', () => {
  it('vários consumidores compartilham UMA consulta', async () => {
    mocks.getMyMemberships.mockResolvedValue(payload('A1', 'B2'));
    const a = renderHook(() => useMyMemberships());
    const b = renderHook(() => useMyMemberships());
    await waitFor(() => expect(a.result.current.settled).toBe(true));
    await waitFor(() => expect(b.result.current.settled).toBe(true));
    expect(mocks.getMyMemberships).toHaveBeenCalledTimes(1);
    expect(a.result.current.memberships?.memberships.map((m) => m.projectId)).toEqual(['A1', 'B2']);
    expect(b.result.current.memberships).toBe(a.result.current.memberships);
  });

  it('endpoint ausente (null): settled, memberships null e nenhuma consulta repetida (sem laço)', async () => {
    mocks.getMyMemberships.mockResolvedValue(null);
    const { result, rerender } = renderHook(() => useMyMemberships());
    expect(result.current.settled).toBe(false);
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.memberships).toBeNull();
    for (let i = 0; i < 5; i += 1) rerender();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(mocks.getMyMemberships).toHaveBeenCalledTimes(1);
  });

  it('trocar de squad (sessão muda) refaz a consulta e, enquanto não volta, não vale como conferido', async () => {
    mocks.getMyMemberships.mockResolvedValueOnce(payload('A1', 'B2'));
    const { result, rerender } = renderHook(() => useMyMemberships());
    await waitFor(() => expect(result.current.settled).toBe(true));

    const pending = deferred<MyMemberships | null>();
    mocks.getMyMemberships.mockReturnValueOnce(pending.promise);
    mocks.session = sessionOf('u1', 'B2');
    rerender();
    await waitFor(() => expect(mocks.getMyMemberships).toHaveBeenCalledTimes(2));
    expect(result.current.settled).toBe(false);
    expect(result.current.memberships).toBeNull();
    // a lista anterior (mesma conta) continua disponível para não piscar a tela
    expect(result.current.stale?.memberships).toHaveLength(2);

    await act(async () => {
      pending.resolve({ ...payload('A1', 'B2'), activeProjectId: 'B2' });
    });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.memberships?.activeProjectId).toBe('B2');
  });

  it('invalidateMyMemberships() força a releitura', async () => {
    mocks.getMyMemberships.mockResolvedValue(payload('A1'));
    const { result } = renderHook(() => useMyMemberships());
    await waitFor(() => expect(result.current.settled).toBe(true));
    act(() => invalidateMyMemberships());
    await waitFor(() => expect(mocks.getMyMemberships).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.settled).toBe(true));
  });

  it('sair da conta zera o cache; outra conta no mesmo navegador nunca vê a lista da anterior', async () => {
    mocks.getMyMemberships.mockResolvedValueOnce(payload('A1', 'B2'));
    const { result, rerender } = renderHook(() => useMyMemberships());
    await waitFor(() => expect(result.current.settled).toBe(true));

    mocks.session = null;
    rerender();
    await waitFor(() => expect(result.current.stale).toBeNull());
    expect(result.current.settled).toBe(false);

    const pending = deferred<MyMemberships | null>();
    mocks.getMyMemberships.mockReturnValueOnce(pending.promise);
    mocks.session = sessionOf('u2', 'A1');
    rerender();
    await waitFor(() => expect(mocks.getMyMemberships).toHaveBeenCalledTimes(2));
    expect(result.current.stale).toBeNull();
    expect(result.current.memberships).toBeNull();
    await act(async () => {
      pending.resolve(payload('A1'));
    });
    await waitFor(() => expect(result.current.memberships?.memberships).toHaveLength(1));
  });

  it('resposta que chega depois de a sessão ter mudado é descartada', async () => {
    const slow = deferred<MyMemberships | null>();
    mocks.getMyMemberships.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(() => useMyMemberships());
    await waitFor(() => expect(mocks.getMyMemberships).toHaveBeenCalledTimes(1));

    mocks.getMyMemberships.mockResolvedValueOnce({ ...payload('B2'), activeProjectId: 'B2' });
    mocks.session = sessionOf('u1', 'B2');
    rerender();
    await waitFor(() => expect(result.current.settled).toBe(true));
    await act(async () => {
      slow.resolve(payload('A1'));
    });
    expect(result.current.memberships?.activeProjectId).toBe('B2');
  });
});
