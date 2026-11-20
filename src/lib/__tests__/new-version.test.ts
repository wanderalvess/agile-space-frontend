import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getLatestRelease = vi.fn();
vi.mock('../../services/changelogApi', () => ({ changelogApi: { getLatestRelease: (...a: unknown[]) => getLatestRelease(...a) } }));

import { setAuthToken, clearAuthToken } from '../auth-client';
import {
  LATEST_CHECK_KEY,
  RUNNING_TAG,
  decideNewVersion,
  dismissVersionNotice,
  markVersionsRead,
  maxTag,
  refreshNewVersion,
  resetNewVersionForTests,
  restoreVersionsSeen,
  seenKey,
  noticeKey,
} from '../new-version';
import * as nv from '../new-version';

function jwtFor(sub: string) {
  const payload = btoa(JSON.stringify({ sub })).replace(/=+$/, '');
  return `h.${payload}.s`;
}

/** Lê o estado atual sem React: o hook usa o mesmo snapshot. */
async function state() {
  await refreshNewVersion();
  // O snapshot é exposto só pelo hook; os efeitos observáveis estão no armazenamento. Para ler a decisão usamos decide.
  return {
    seen: localStorage.getItem(seenKey('u1')),
    noticed: localStorage.getItem(noticeKey('u1')),
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetNewVersionForTests();
  getLatestRelease.mockReset();
  getLatestRelease.mockResolvedValue(null);
  setAuthToken(jwtFor('u1'));
});
afterEach(() => {
  vi.restoreAllMocks();
  clearAuthToken();
});

describe('decideNewVersion', () => {
  it('sem versão conhecida não faz nada', () => {
    expect(decideNewVersion({ latest: null, seen: 'v1.0.0', noticed: null })).toEqual({ unread: false, showNotice: false, firstVisit: false });
  });
  it('primeira visita: registra a atual e não avisa', () => {
    expect(decideNewVersion({ latest: 'v4.24.0', seen: null, noticed: null })).toEqual({ unread: false, showNotice: false, firstVisit: true });
  });
  it('mesma versão: em dia', () => {
    expect(decideNewVersion({ latest: 'v4.24.0', seen: 'v4.24.0', noticed: null })).toEqual({ unread: false, showNotice: false, firstVisit: false });
  });
  it('versão nova: ponto e aviso, uma vez por versão', () => {
    expect(decideNewVersion({ latest: 'v4.25.0', seen: 'v4.24.0', noticed: null })).toEqual({ unread: true, showNotice: true, firstVisit: false });
    expect(decideNewVersion({ latest: 'v4.25.0', seen: 'v4.24.0', noticed: 'v4.25.0' })).toEqual({ unread: true, showNotice: false, firstVisit: false });
    // Saiu outra depois da dispensada: avisa de novo.
    expect(decideNewVersion({ latest: 'v4.26.0', seen: 'v4.24.0', noticed: 'v4.25.0' }).showNotice).toBe(true);
  });
  it('compara numericamente (v4.10.0 é maior que v4.9.0) e a vista maior que a publicada não vira novidade', () => {
    expect(decideNewVersion({ latest: 'v4.10.0', seen: 'v4.9.0', noticed: null }).unread).toBe(true);
    expect(decideNewVersion({ latest: 'v4.9.0', seen: 'v4.10.0', noticed: null }).unread).toBe(false);
    expect(maxTag('v4.9.0', 'v4.10.0')).toBe('v4.10.0');
    expect(maxTag(null, 'v1.0.0')).toBe('v1.0.0');
  });
});

describe('fluxo com o navegador', () => {
  it('primeira visita grava a versão atual e não consulta nada de novo à toa', async () => {
    const s = await state();
    expect(s.seen).toBe(RUNNING_TAG);
    expect(s.noticed).toBeNull();
  });

  it('consulta o servidor no máximo uma vez por sessão do navegador', async () => {
    getLatestRelease.mockResolvedValue({ tag: 'v999.0.0' });
    await refreshNewVersion();
    await refreshNewVersion();
    resetNewVersionForTests();
    await refreshNewVersion();
    expect(getLatestRelease).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(LATEST_CHECK_KEY)).toBe('v999.0.0');
  });

  it('versão nova do servidor: fica não lida; "Agora não" some o aviso; ler marca como vista', async () => {
    localStorage.setItem(seenKey('u1'), RUNNING_TAG);
    getLatestRelease.mockResolvedValue({ tag: 'v999.0.0' });
    await refreshNewVersion();
    const seen: { unread?: boolean; showNotice?: boolean } = {};
    // Lê o snapshot por um hook mínimo.
    const { renderHook, act } = await import('@testing-library/react');
    const { result } = renderHook(() => nv.useNewVersion());
    await act(async () => {
      await Promise.resolve();
    });
    Object.assign(seen, { unread: result.current.unread, showNotice: result.current.showNotice });
    expect(seen).toEqual({ unread: true, showNotice: true });
    act(() => dismissVersionNotice());
    expect(result.current.showNotice).toBe(false);
    expect(result.current.unread).toBe(true);
    expect(localStorage.getItem(noticeKey('u1'))).toBe('v999.0.0');
    act(() => {
      markVersionsRead('v999.0.0');
    });
    expect(result.current.unread).toBe(false);
    expect(localStorage.getItem(seenKey('u1'))).toBe('v999.0.0');
  });

  it('Desfazer volta à versão vista antes', async () => {
    localStorage.setItem(seenKey('u1'), 'v4.0.0');
    await refreshNewVersion();
    const previous = markVersionsRead('v4.24.0');
    expect(localStorage.getItem(seenKey('u1'))).toBe('v4.24.0');
    restoreVersionsSeen(previous!);
    expect(localStorage.getItem(seenKey('u1'))).toBe('v4.0.0');
  });

  it('visitante sem sessão: nada é lido, gravado nem consultado', async () => {
    clearAuthToken();
    await refreshNewVersion();
    expect(getLatestRelease).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(markVersionsRead('v1.0.0')).toBeNull();
  });

  it('localStorage falhando não quebra nada', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    // Sem ler o token não há usuário: sai em silêncio.
    await expect(refreshNewVersion()).resolves.toBeUndefined();
    expect(() => dismissVersionNotice()).not.toThrow();
    expect(() => markVersionsRead('v1.0.0')).not.toThrow();
  });

  it('só o armazenamento de dados falha (token vem de outro lugar): segue sem avisar e sem erro', async () => {
    const realGet = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key.startsWith('changelog_')) throw new Error('bloqueado');
      return realGet.call(this, key);
    });
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('changelog_')) throw new Error('cota');
      return realSet.call(this, key, value);
    });
    getLatestRelease.mockResolvedValue({ tag: 'v999.0.0' });
    await expect(refreshNewVersion()).resolves.toBeUndefined();
    // Sem conseguir ler "visto", conta como primeira visita: não avisa.
    const { renderHook, act } = await import('@testing-library/react');
    const { result } = renderHook(() => nv.useNewVersion());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.showNotice).toBe(false);
  });

  it('o servidor responder com erro mantém só a versão do build', async () => {
    localStorage.setItem(seenKey('u1'), RUNNING_TAG);
    getLatestRelease.mockRejectedValue(new Error('fora do ar'));
    await expect(refreshNewVersion()).resolves.toBeUndefined();
    expect(localStorage.getItem(seenKey('u1'))).toBe(RUNNING_TAG);
  });
});
