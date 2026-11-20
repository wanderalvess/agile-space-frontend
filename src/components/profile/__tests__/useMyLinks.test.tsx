import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  userProfile: null as Record<string, unknown> | null,
  userSquads: [] as unknown[],
  memberships: null as unknown,
  switchProject: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, switchProject: mocks.switchProject }),
}));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({ userProfile: mocks.userProfile, userSquads: mocks.userSquads }),
}));
vi.mock('../../../hooks/useMyMemberships', () => ({
  useMyMemberships: () => ({ memberships: mocks.memberships, settled: true, stale: mocks.memberships, refresh: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { useMyLinks } from '../useMyLinks';

const session = {
  activeProjectId: 'DDWMISSI',
  accessibleProjects: [
    { projectId: 'DDWMISSI', projectName: 'Missão Crítica', roleName: 'Developer', leadership: false, directAssignment: true },
    { projectId: 'DDWPRIME', projectName: 'Prime', roleName: 'Agile Master', leadership: true, directAssignment: true },
  ],
};

beforeEach(() => {
  mocks.session = session;
  mocks.userProfile = { id: 'u1', squadId: 'DDWMISSI' };
  mocks.userSquads = [];
  mocks.memberships = null;
  mocks.switchProject.mockReset().mockResolvedValue(undefined);
  mocks.toast.mockReset();
});

describe('useMyLinks', () => {
  it('lista os vínculos da sessão com a squad ativa marcada', () => {
    const { result } = renderHook(() => useMyLinks());
    expect(result.current.links.map((l) => l.id)).toEqual(['DDWMISSI', 'DDWPRIME']);
    expect(result.current.active?.id).toBe('DDWMISSI');
    expect(result.current.canSwitch).toBe(true);
  });

  it('com um vínculo só, não há troca de squad', () => {
    mocks.session = { activeProjectId: 'ABC', activeProjectName: 'Alfa', accessibleProjects: [] };
    mocks.userProfile = { id: 'u1', squadId: 'ABC' };
    const { result } = renderHook(() => useMyLinks());
    expect(result.current.links).toHaveLength(1);
    expect(result.current.canSwitch).toBe(false);
  });

  it('sem sessão, não há vínculos', () => {
    mocks.session = null;
    mocks.userProfile = null;
    const { result } = renderHook(() => useMyLinks());
    expect(result.current.links).toEqual([]);
    expect(result.current.active).toBeUndefined();
  });

  it('"Tornar ativa" usa o switchProject da sessão e avisa', async () => {
    const { result } = renderHook(() => useMyLinks());
    const prime = result.current.links.find((l) => l.id === 'DDWPRIME')!;
    let ok = false;
    await act(async () => {
      ok = await result.current.activate(prime);
    });
    expect(ok).toBe(true);
    expect(mocks.switchProject).toHaveBeenCalledWith('DDWPRIME');
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Squad ativa: Prime' });
    await waitFor(() => expect(result.current.switchingTo).toBeNull());
  });

  it('não troca para a squad que já está ativa', async () => {
    const { result } = renderHook(() => useMyLinks());
    let ok = true;
    await act(async () => {
      ok = await result.current.activate(result.current.links[0]);
    });
    expect(ok).toBe(false);
    expect(mocks.switchProject).not.toHaveBeenCalled();
  });

  it('com /me/memberships, mostra TODOS os papéis por squad e a origem; ele manda mesmo se a sessão diz outra coisa', () => {
    mocks.memberships = {
      contractVersion: '1',
      activeProjectId: 'DDWPRIME',
      legacyOnly: false,
      transversalLeader: false,
      memberships: [
        {
          projectId: 'DDWPRIME',
          projectName: 'Prime',
          roleName: 'Product Owner',
          roleKey: 'PRODUCT_OWNER',
          leadership: true,
          direct: true,
          scope: 'SQUAD',
          source: 'MANUAL',
          roles: [
            { roleName: 'Product Owner', roleKey: 'PRODUCT_OWNER', leadership: true, source: 'MANUAL', primary: true },
            { roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: false },
          ],
        },
      ],
    };
    const { result } = renderHook(() => useMyLinks());
    expect(result.current.links.map((l) => l.id)).toEqual(['DDWPRIME']);
    expect(result.current.links[0].roles.map((r) => r.name)).toEqual(['Product Owner', 'Developer']);
    expect(result.current.links[0].roles.map((r) => r.origin)).toEqual(['Manual', 'Importado do Jira']);
    // a sessão aponta DDWMISSI, mas ela está fora dos vínculos: a ativa passa a ser a validada
    expect(result.current.active?.id).toBe('DDWPRIME');
    expect(result.current.canSwitch).toBe(false);
  });

  it('sem vínculo nenhum no endpoint, a lista fica vazia (a conta só tem rastro legado)', () => {
    mocks.memberships = { contractVersion: '1', activeProjectId: null, legacyOnly: true, transversalLeader: false, memberships: [] };
    const { result } = renderHook(() => useMyLinks());
    expect(result.current.links).toEqual([]);
  });

  it('falha na troca mostra o erro e devolve false', async () => {
    mocks.switchProject.mockRejectedValue(new Error('Sem acesso'));
    const { result } = renderHook(() => useMyLinks());
    const prime = result.current.links.find((l) => l.id === 'DDWPRIME')!;
    let ok = true;
    await act(async () => {
      ok = await result.current.activate(prime);
    });
    expect(ok).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Sem acesso' }));
  });
});
