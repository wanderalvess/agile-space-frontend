'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_LAYOUTS_REPO = 'totvs/winthor-smart-hub-layouts';

export interface GithubRoute {
  name: string;
  path: string;
}

export interface LoadedGithubLayout {
  title: string;
  path: string;
  tag: string;
  /** O documento inteiro do arquivo (layout completo `tabela.campos`, ou só as operações). */
  document: unknown;
}

interface TreeNode {
  path: string;
  type: string;
}

/**
 * Estados da consulta ao GitHub. A página NUNCA consulta sozinha: tudo começa em `nao-consultado` e só muda
 * quando a pessoa aperta "Buscar layouts do GitHub" (ou troca de repositório/versão, que também são ações dela).
 */
export type GithubStatus = 'nao-consultado' | 'buscando' | 'limite' | 'erro' | 'pronto';

interface Options {
  onLayoutLoaded: (layout: LoadedGithubLayout) => void;
  onNotify: (n: { title: string; description?: string; variant?: 'destructive' }) => void;
}

/** Repositório no formato usuário/repositório (só caracteres que o GitHub aceita). */
export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(name) && !name.includes('..');
}

/** 1.40.0.0 > 1.39.48 > 1.9: compara número a número, não texto. */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.\-]/);
  const pb = b.replace(/^v/i, '').split(/[.\-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = parseInt(pa[i] ?? '0', 10);
    const nb = parseInt(pb[i] ?? '0', 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return nb - na;
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const c = (pb[i] ?? '').localeCompare(pa[i] ?? '');
      if (c !== 0) return c;
    }
  }
  return 0;
}

/** Integração = pasta da raiz que tem rotas (`<integração>/rotas/*.json`). Pastas como `scripts` ficam de fora. */
export function integrationsFromTree(tree: TreeNode[]): string[] {
  const set = new Set<string>();
  for (const node of tree) {
    if (node.type !== 'blob' || !node.path.endsWith('.json')) continue;
    const parts = node.path.split('/');
    if (parts.length >= 3 && parts[1] === 'rotas' && !parts[0].startsWith('.')) set.add(parts[0]);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function routesFromTree(tree: TreeNode[], integration: string): GithubRoute[] {
  if (!integration) return [];
  return tree
    .filter(n => n.type === 'blob' && n.path.startsWith(`${integration}/rotas/`) && n.path.endsWith('.json'))
    .map(n => ({ name: n.path.split('/').pop()!.replace(/\.json$/, ''), path: n.path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Falha de uma resposta do GitHub: o limite de consultas tem estado próprio (e horário de liberação, se vier). */
class GithubFailure extends Error {
  constructor(message: string, readonly kind: 'limite' | 'outro', readonly resetAt: Date | null = null) {
    super(message);
  }
}

function failureFrom(res: Response, fallback: string): GithubFailure {
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (res.status === 429 || (res.status === 403 && remaining === '0')) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    return new GithubFailure('O GitHub atingiu o limite de consultas.', 'limite', Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null);
  }
  if (res.status === 403) return new GithubFailure('O GitHub recusou a consulta. Tente de novo em alguns minutos.', 'outro');
  if (res.status === 404) return new GithubFailure('Repositório, versão ou arquivo não encontrado. Confira o nome (usuário/repositório) e se ele é público.', 'outro');
  return new GithubFailure(fallback, 'outro');
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const cached = sessionStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* cheio ou bloqueado: segue sem cache */
  }
}

async function fetchTags(repoName: string): Promise<string[]> {
  const cacheKey = `github_layouts_tags_${repoName}`;
  const cached = await readCache<string[]>(cacheKey);
  if (cached) return cached;
  const res = await fetch(`https://api.github.com/repos/${repoName}/tags?per_page=100`);
  if (!res.ok) throw failureFrom(res, 'Não foi possível listar as versões do repositório.');
  const list: string[] = (await res.json()).map((t: { name: string }) => t.name).sort(compareVersionsDesc);
  writeCache(cacheKey, list);
  return list;
}

async function fetchTree(repoName: string, tag: string): Promise<{ tree: TreeNode[]; truncated: boolean }> {
  const key = `github_tree_${repoName}_${tag}`;
  const cached = await readCache<{ tree: TreeNode[]; truncated: boolean }>(key);
  if (cached) return cached;
  const res = await fetch(`https://api.github.com/repos/${repoName}/git/trees/${encodeURIComponent(tag)}?recursive=1`);
  if (!res.ok) throw failureFrom(res, 'Não foi possível carregar a estrutura desta versão.');
  const data = await res.json();
  const result = { tree: (data.tree || []) as TreeNode[], truncated: !!data.truncated };
  writeCache(key, result);
  return result;
}

export interface GithubLoadedInfo {
  path: string;
  tag: string;
}

/**
 * Seletor de layouts do GitHub na ordem em que a pessoa pensa: INTEGRAÇÃO → ROTA → VERSÃO, e então "Carregar layout".
 * Escolher rota ou versão não mexe no editor; só "Carregar layout" troca a spec (por isso a rota escolhida não vira
 * "carregada" antes de o arquivo chegar: se a busca falhar, nada fica marcado).
 */
export function useGithubLayouts({ onLayoutLoaded, onNotify }: Options) {
  const [repo, setRepo] = useState(DEFAULT_LAYOUTS_REPO);
  const [repoInput, setRepoInput] = useState(DEFAULT_LAYOUTS_REPO);
  const [status, setStatus] = useState<GithubStatus>('nao-consultado');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [integration, setIntegration] = useState('');
  const [routes, setRoutes] = useState<GithubRoute[]>([]);
  const [routePath, setRoutePath] = useState('');
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [loaded, setLoaded] = useState<GithubLoadedInfo | null>(null);

  const currentTree = useRef<TreeNode[]>([]);
  const queryReq = useRef(0);
  const layoutReq = useRef(0);
  const notify = useRef(onNotify);
  const onLoaded = useRef(onLayoutLoaded);
  // Estado "atual" para os handlers assíncronos, sem recriar callbacks a cada render.
  const state = useRef({ repo, version, integration, routePath });
  useEffect(() => {
    notify.current = onNotify;
    onLoaded.current = onLayoutLoaded;
    state.current = { repo, version, integration, routePath };
  });

  const applyFailure = useCallback((e: unknown) => {
    if (e instanceof GithubFailure && e.kind === 'limite') {
      setStatus('limite');
      setResetAt(e.resetAt);
      setErrorMessage(e.message);
    } else {
      setStatus('erro');
      setResetAt(null);
      setErrorMessage(e instanceof Error ? e.message : 'Não foi possível consultar o GitHub.');
    }
  }, []);

  /** Consulta versões e a árvore da mais recente. Devolve true se deu certo. */
  const consult = useCallback(
    async (repoName: string, opts: { keepSelection: boolean }): Promise<boolean> => {
      const req = ++queryReq.current;
      setStatus('buscando');
      setErrorMessage(null);
      try {
        const list = await fetchTags(repoName);
        if (req !== queryReq.current) return false;
        if (list.length === 0) throw new GithubFailure('O repositório não tem versões publicadas (tags).', 'outro');
        const keptVersion = opts.keepSelection && list.includes(state.current.version) ? state.current.version : list[0];
        const { tree, truncated: cut } = await fetchTree(repoName, keptVersion);
        if (req !== queryReq.current) return false;
        const found = integrationsFromTree(tree);
        if (found.length === 0) throw new GithubFailure('Este repositório não tem a pasta de rotas (<integração>/rotas/*.json).', 'outro');
        currentTree.current = tree;
        const keepIntegration = opts.keepSelection && found.includes(state.current.integration) ? state.current.integration : '';
        setRepo(repoName);
        setTags(list);
        setVersion(keptVersion);
        setTruncated(cut);
        setIntegrations(found);
        setIntegration(keepIntegration);
        setRoutes(routesFromTree(tree, keepIntegration));
        if (!keepIntegration) {
          setRoutePath('');
          setLoaded(null);
        }
        setStatus('pronto');
        return true;
      } catch (e) {
        if (req !== queryReq.current) return false;
        applyFailure(e);
        return false;
      }
    },
    [applyFailure],
  );

  /** "Buscar layouts do GitHub" / "Tentar de novo". */
  const search = useCallback(() => consult(state.current.repo, { keepSelection: true }), [consult]);

  /** Troca de versão: busca a árvore dela e confere se a rota escolhida existe lá (sem mexer no editor). */
  const selectVersion = useCallback(
    async (tag: string) => {
      setVersion(tag);
      state.current = { ...state.current, version: tag };
      const req = ++queryReq.current;
      setLoadingTree(true);
      try {
        const { tree, truncated: cut } = await fetchTree(state.current.repo, tag);
        if (req !== queryReq.current) return;
        currentTree.current = tree;
        setTruncated(cut);
        const found = integrationsFromTree(tree);
        setIntegrations(found);
        const keep = found.includes(state.current.integration) ? state.current.integration : '';
        if (!keep) {
          setIntegration('');
          setRoutes([]);
          setRoutePath('');
          if (state.current.integration) {
            notify.current({ title: 'Integração não existe nesta versão', description: `"${state.current.integration}" não está na versão ${tag}.`, variant: 'destructive' });
          }
        } else {
          setRoutes(routesFromTree(tree, keep));
        }
        setErrorMessage(null);
        setStatus('pronto');
      } catch (e) {
        if (req === queryReq.current) applyFailure(e);
      } finally {
        if (req === queryReq.current) setLoadingTree(false);
      }
    },
    [applyFailure],
  );

  const selectIntegration = useCallback((name: string) => {
    setIntegration(name);
    setRoutePath('');
    setRoutes(routesFromTree(currentTree.current, name));
  }, []);

  /** Só escolhe: o arquivo é baixado em "Carregar layout". */
  const selectRoute = useCallback((path: string) => {
    setRoutePath(path);
  }, []);

  /** A rota escolhida não existe na versão escolhida (aconteceu ao trocar de versão). */
  const missingRoute = routePath && !routes.some(r => r.path === routePath)
    ? routePath.split('/').pop()?.replace(/\.json$/, '') ?? routePath
    : null;
  const routeName = routes.find(r => r.path === routePath)?.name ?? '';

  /** "Carregar layout": baixa a rota escolhida na versão escolhida e entrega ao editor. */
  const loadSelected = useCallback(async () => {
    const { repo: repoName, version: tag, routePath: path } = state.current;
    if (!path || !tag) return;
    // A rota escolhida precisa existir na versão escolhida (ao trocar de versão ela pode ter sumido).
    if (!currentTree.current.some(n => n.type === 'blob' && n.path === path)) return;
    const req = ++layoutReq.current;
    setLoadingLayout(true);
    try {
      const url = `https://raw.githubusercontent.com/${repoName}/${encodeURIComponent(tag)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw failureFrom(res, 'Não foi possível carregar o conteúdo do layout.');
      const document = await res.json();
      if (req !== layoutReq.current) return;
      const title = path.split('/').pop()!.replace(/\.json$/, '');
      setLoaded({ path, tag });
      onLoaded.current({ title, path, tag, document });
    } catch (e) {
      if (req !== layoutReq.current) return;
      if (e instanceof GithubFailure && e.kind === 'limite') applyFailure(e);
      notify.current({ title: 'Erro ao buscar o layout', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      if (req === layoutReq.current) setLoadingLayout(false);
    }
  }, [applyFailure]);

  /** "Validar e usar": confere o nome, consulta o repositório novo e só então troca (o anterior fica se falhar). */
  const submitRepo = useCallback(async () => {
    const next = repoInput.trim();
    setRepoError(null);
    if (!isValidRepoName(next)) {
      setRepoError('Use o formato usuário/repositório, por exemplo totvs/winthor-smart-hub-layouts.');
      return false;
    }
    if (next === state.current.repo && status === 'pronto') return true;
    const previous = { status, tags, version, integrations, integration, routes, routePath };
    const ok = await consult(next, { keepSelection: false });
    if (!ok) {
      setRepoError('Não encontramos esse repositório com a pasta de rotas. Confira o nome e se ele é público.');
      // Mantém o que a pessoa já tinha na tela.
      setStatus(previous.status);
      setTags(previous.tags);
      setVersion(previous.version);
      setIntegrations(previous.integrations);
      setIntegration(previous.integration);
      setRoutes(previous.routes);
      setRoutePath(previous.routePath);
    }
    return ok;
  }, [repoInput, status, tags, version, integrations, integration, routes, routePath, consult]);

  return {
    repo,
    repoInput,
    setRepoInput,
    submitRepo,
    repoError,
    clearRepoError: () => setRepoError(null),
    status,
    errorMessage,
    resetAt,
    truncated,
    search,
    tags,
    version,
    integrations,
    integration,
    routes,
    routePath,
    routeName,
    missingRoute,
    loadingTree,
    loadingLayout,
    loaded,
    selectIntegration,
    selectRoute,
    selectVersion,
    loadSelected,
  };
}
