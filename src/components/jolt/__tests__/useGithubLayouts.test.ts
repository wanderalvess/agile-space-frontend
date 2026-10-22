import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareVersionsDesc, integrationsFromTree, isValidRepoName, routesFromTree, useGithubLayouts } from '../useGithubLayouts';

describe('isValidRepoName', () => {
  it('aceita usuário/repositório do GitHub', () => {
    expect(isValidRepoName('totvs/winthor-smart-hub-layouts')).toBe(true);
    expect(isValidRepoName('a.b_c/d-e.f')).toBe(true);
  });

  it('recusa caminhos, parâmetros e travessia que mudariam a URL consultada', () => {
    expect(isValidRepoName('totvs')).toBe(false);
    expect(isValidRepoName('totvs/repo/extra')).toBe(false);
    expect(isValidRepoName('../users/octocat')).toBe(false);
    expect(isValidRepoName('totvs/repo?per_page=1')).toBe(false);
    expect(isValidRepoName('totvs/repo#x')).toBe(false);
    expect(isValidRepoName('')).toBe(false);
  });
});

describe('árvore do repositório', () => {
  const tree = [
    { path: 'protheus/rotas/pedido.json', type: 'blob' },
    { path: 'protheus/rotas/cliente.json', type: 'blob' },
    { path: 'winthor/rotas/nota.json', type: 'blob' },
    { path: 'scripts/rodar.json', type: 'blob' },
    { path: '.github/rotas/x.json', type: 'blob' },
    { path: 'protheus/rotas', type: 'tree' },
  ];

  it('integração é a pasta com rotas; scripts e pastas ocultas ficam de fora', () => {
    expect(integrationsFromTree(tree)).toEqual(['protheus', 'winthor']);
  });

  it('rotas da integração em ordem alfabética, sem a extensão', () => {
    expect(routesFromTree(tree, 'protheus').map((r) => r.name)).toEqual(['cliente', 'pedido']);
    expect(routesFromTree(tree, '')).toEqual([]);
  });

  it('versões se comparam número a número', () => {
    expect(['1.9', '1.40.0.0', '1.39.48'].sort(compareVersionsDesc)).toEqual(['1.40.0.0', '1.39.48', '1.9']);
  });
});

const TREE = [
  { path: 'protheus/rotas/pedido.json', type: 'blob' },
  { path: 'protheus/rotas/cliente.json', type: 'blob' },
];

function response(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers });
}

describe('useGithubLayouts: o GitHub só é consultado quando a pessoa pede', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const onNotify = vi.fn();
  const onLayoutLoaded = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    onNotify.mockClear();
    onLayoutLoaded.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  const mount = () => renderHook(() => useGithubLayouts({ onNotify, onLayoutLoaded }));

  it('montar a tela não faz nenhuma chamada e começa em "ainda não consultado"', async () => {
    const { result } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('nao-consultado');
    expect(result.current.tags).toEqual([]);
    expect(result.current.integrations).toEqual([]);
  });

  it('"Buscar layouts do GitHub" consulta as versões e a árvore da mais recente', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.includes('/tags') ? response([{ name: '1.9' }, { name: '1.10' }]) : response({ tree: TREE, truncated: false })));
    const { result } = mount();

    await act(async () => {
      await result.current.search();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/repos/totvs/winthor-smart-hub-layouts/tags');
    expect(fetchMock.mock.calls[1][0]).toContain('/git/trees/1.10');
    expect(result.current.status).toBe('pronto');
    expect(result.current.version).toBe('1.10');
    expect(result.current.integrations).toEqual(['protheus']);
    expect(result.current.truncated).toBe(false);
  });

  it('árvore cortada pelo GitHub fica sinalizada', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.includes('/tags') ? response([{ name: '1.0' }]) : response({ tree: TREE, truncated: true })));
    const { result } = mount();
    await act(async () => {
      await result.current.search();
    });
    expect(result.current.truncated).toBe(true);
  });

  it('limite de consultas vira estado próprio, com o horário de liberação', async () => {
    const reset = Math.floor(new Date(2026, 9, 20, 15, 40).getTime() / 1000);
    fetchMock.mockResolvedValue(response({ message: 'rate limit' }, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } }));
    const { result } = mount();
    await act(async () => {
      await result.current.search();
    });
    expect(result.current.status).toBe('limite');
    expect(result.current.resetAt?.getTime()).toBe(reset * 1000);
  });

  it('repositório inexistente vira erro (não "limite")', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Not Found' }, { status: 404 }));
    const { result } = mount();
    await act(async () => {
      await result.current.search();
    });
    expect(result.current.status).toBe('erro');
    expect(result.current.errorMessage).toMatch(/não encontrado/);
  });

  async function ready() {
    fetchMock.mockImplementation(async (url: string) => (url.includes('/tags') ? response([{ name: '2.0' }, { name: '1.0' }]) : response({ tree: TREE, truncated: false })));
    const hook = mount();
    await act(async () => {
      await hook.result.current.search();
    });
    act(() => hook.result.current.selectIntegration('protheus'));
    return hook;
  }

  it('escolher a rota NÃO a marca como carregada: só o arquivo que chegou marca', async () => {
    const { result } = await ready();
    fetchMock.mockClear();
    act(() => result.current.selectRoute('protheus/rotas/pedido.json'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loaded).toBeNull();
    expect(onLayoutLoaded).not.toHaveBeenCalled();
  });

  it('se baixar a rota falha, nada fica marcado como carregado e a pessoa é avisada', async () => {
    const { result } = await ready();
    act(() => result.current.selectRoute('protheus/rotas/pedido.json'));
    fetchMock.mockResolvedValueOnce(response({}, { status: 500 }));
    await act(async () => {
      await result.current.loadSelected();
    });
    expect(result.current.loaded).toBeNull();
    expect(onLayoutLoaded).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao buscar o layout', variant: 'destructive' }));
  });

  it('"Carregar layout" baixa a rota na versão escolhida e entrega o arquivo', async () => {
    const { result } = await ready();
    act(() => result.current.selectRoute('protheus/rotas/pedido.json'));
    fetchMock.mockResolvedValueOnce(response({ tabela: { campos: [] } }));
    await act(async () => {
      await result.current.loadSelected();
    });
    const url = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(url).toBe('https://raw.githubusercontent.com/totvs/winthor-smart-hub-layouts/2.0/protheus/rotas/pedido.json');
    expect(onLayoutLoaded).toHaveBeenCalledWith({ title: 'pedido', path: 'protheus/rotas/pedido.json', tag: '2.0', document: { tabela: { campos: [] } } });
    expect(result.current.loaded).toEqual({ path: 'protheus/rotas/pedido.json', tag: '2.0' });
  });

  it('trocar para uma versão sem a rota avisa e não deixa carregar', async () => {
    const { result } = await ready();
    act(() => result.current.selectRoute('protheus/rotas/pedido.json'));
    fetchMock.mockImplementation(async () => response({ tree: [{ path: 'protheus/rotas/cliente.json', type: 'blob' }], truncated: false }));
    await act(async () => {
      await result.current.selectVersion('1.0');
    });
    await waitFor(() => expect(result.current.loadingTree).toBe(false));
    expect(result.current.missingRoute).toBe('pedido');
    fetchMock.mockClear();
    await act(async () => {
      await result.current.loadSelected();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"Validar e usar" com nome inválido não chama o GitHub', async () => {
    const { result } = mount();
    act(() => result.current.setRepoInput('../users/x'));
    let ok = true;
    await act(async () => {
      ok = await result.current.submitRepo();
    });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.repoError).toMatch(/usuário\/repositório/);
  });
});
