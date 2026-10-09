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
  document: any;
}

interface TreeNode {
  path: string;
  type: string;
}

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

function githubErrorMessage(status: number, fallback: string): string {
  if (status === 403 || status === 429) return 'O limite de consultas do GitHub foi atingido. Tente de novo em alguns minutos.';
  if (status === 404) return 'Repositório, versão ou arquivo não encontrado. Confira o nome (usuário/repositório) e se ele é público.';
  return fallback;
}

/**
 * Seletor de layouts do GitHub na ordem em que a pessoa pensa: INTEGRAÇÃO → ROTA → VERSÃO.
 * Trocar a versão recarrega a mesma rota naquela versão (se ela existir lá) em vez de zerar tudo.
 */
export function useGithubLayouts({ onLayoutLoaded, onNotify }: Options) {
  const [repo, setRepo] = useState(DEFAULT_LAYOUTS_REPO);
  const [repoInput, setRepoInput] = useState(DEFAULT_LAYOUTS_REPO);
  const [tags, setTags] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [integration, setIntegrationState] = useState('');
  const [routes, setRoutes] = useState<GithubRoute[]>([]);
  const [routePath, setRoutePath] = useState('');
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingLayout, setLoadingLayout] = useState(false);

  const treeCache = useRef<Record<string, TreeNode[]>>({});
  const currentTree = useRef<TreeNode[]>([]);
  // Respostas que chegam depois de a pessoa já ter escolhido outra coisa são descartadas.
  const treeReq = useRef(0);
  const layoutReq = useRef(0);
  const notify = useRef(onNotify);
  notify.current = onNotify;
  const onLoaded = useRef(onLayoutLoaded);
  onLoaded.current = onLayoutLoaded;
  // Estado "atual" para os handlers assíncronos, sem recriar callbacks a cada render.
  const state = useRef({ repo, version, integration, routePath });
  state.current = { repo, version, integration, routePath };

  const loadTags = useCallback(async (repoName: string) => {
    setLoadingTags(true);
    try {
      const cacheKey = `github_layouts_tags_${repoName}`;
      let list: string[] | null = null;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) list = JSON.parse(cached);
      } catch {
        /* sem cache */
      }
      if (!list) {
        const res = await fetch(`https://api.github.com/repos/${repoName}/tags?per_page=100`);
        if (!res.ok) throw new Error(githubErrorMessage(res.status, 'Não foi possível listar as versões do repositório.'));
        list = (await res.json()).map((t: { name: string }) => t.name).sort(compareVersionsDesc);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(list));
        } catch {
          /* cheio: segue sem cache */
        }
      }
      setTags(list!);
      return list!;
    } catch (e: any) {
      setTags([]);
      notify.current({ title: 'Erro ao carregar o repositório', description: e.message, variant: 'destructive' });
      return [];
    } finally {
      setLoadingTags(false);
    }
  }, []);

  const loadTree = useCallback(async (repoName: string, tag: string): Promise<TreeNode[] | null> => {
    const key = `github_tree_${repoName}_${tag}`;
    if (treeCache.current[key]) return treeCache.current[key];
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        treeCache.current[key] = JSON.parse(cached);
        return treeCache.current[key];
      }
    } catch {
      /* sem cache */
    }
    const res = await fetch(`https://api.github.com/repos/${repoName}/git/trees/${encodeURIComponent(tag)}?recursive=1`);
    if (!res.ok) throw new Error(githubErrorMessage(res.status, 'Não foi possível carregar a estrutura desta versão.'));
    const data = await res.json();
    if (data.truncated) {
      notify.current({
        title: 'Lista de rotas incompleta',
        description: 'O GitHub devolveu só parte dos arquivos desta versão. Algumas rotas podem não aparecer.',
        variant: 'destructive',
      });
    }
    const tree: TreeNode[] = data.tree || [];
    treeCache.current[key] = tree;
    try {
      sessionStorage.setItem(key, JSON.stringify(tree));
    } catch {
      /* cheio: segue sem cache */
    }
    return tree;
  }, []);

  const loadLayoutContent = useCallback(async (repoName: string, tag: string, path: string) => {
    const req = ++layoutReq.current;
    setLoadingLayout(true);
    try {
      const url = `https://raw.githubusercontent.com/${repoName}/${encodeURIComponent(tag)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(githubErrorMessage(res.status, 'Não foi possível carregar o conteúdo do layout.'));
      const document = await res.json();
      if (req !== layoutReq.current) return;
      const title = path.split('/').pop()!.replace(/\.json$/, '');
      onLoaded.current({ title, path, tag, document });
    } catch (e: any) {
      if (req === layoutReq.current) notify.current({ title: 'Erro ao buscar o layout', description: e.message, variant: 'destructive' });
    } finally {
      if (req === layoutReq.current) setLoadingLayout(false);
    }
  }, []);

  /** Carrega a árvore de uma versão e reaproveita o que a pessoa já tinha escolhido, se ainda existir. */
  const applyVersion = useCallback(
    async (repoName: string, tag: string, opts: { reloadRoute: boolean }) => {
      const req = ++treeReq.current;
      setLoadingTree(true);
      try {
        const tree = await loadTree(repoName, tag);
        if (req !== treeReq.current || !tree) return;
        currentTree.current = tree;
        const list = integrationsFromTree(tree);
        setIntegrations(list);

        const { integration: keptIntegration, routePath: keptRoute } = state.current;
        const integrationStillThere = !!keptIntegration && list.includes(keptIntegration);
        if (!integrationStillThere) {
          setIntegrationState('');
          setRoutes([]);
          setRoutePath('');
          if (keptIntegration) {
            notify.current({ title: 'Integração não existe nesta versão', description: `"${keptIntegration}" não está na versão ${tag}.`, variant: 'destructive' });
          }
          return;
        }
        const newRoutes = routesFromTree(tree, keptIntegration);
        setRoutes(newRoutes);
        if (keptRoute && newRoutes.some(r => r.path === keptRoute)) {
          if (opts.reloadRoute) await loadLayoutContent(repoName, tag, keptRoute);
        } else if (keptRoute) {
          setRoutePath('');
          notify.current({
            title: 'Rota não existe nesta versão',
            description: `"${keptRoute.split('/').pop()?.replace(/\.json$/, '')}" não está na versão ${tag}. O editor continua com o que estava.`,
            variant: 'destructive',
          });
        }
      } catch (e: any) {
        if (req === treeReq.current) {
          notify.current({ title: 'Erro de conexão', description: e.message, variant: 'destructive' });
        }
      } finally {
        if (req === treeReq.current) setLoadingTree(false);
      }
    },
    [loadTree, loadLayoutContent]
  );

  // Trocar de repositório recomeça do zero: versões, integrações e rotas.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIntegrations([]);
      setIntegrationState('');
      setRoutes([]);
      setRoutePath('');
      setVersion('');
      const list = await loadTags(repo);
      if (cancelled || list.length === 0) return;
      setVersion(list[0]);
      state.current = { ...state.current, version: list[0], integration: '', routePath: '' };
      await applyVersion(repo, list[0], { reloadRoute: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, loadTags, applyVersion]);

  const selectIntegration = useCallback((name: string) => {
    setIntegrationState(name);
    setRoutePath('');
    setRoutes(routesFromTree(currentTree.current, name));
  }, []);

  const selectRoute = useCallback(
    (path: string) => {
      setRoutePath(path);
      if (path) loadLayoutContent(state.current.repo, state.current.version, path);
    },
    [loadLayoutContent]
  );

  const selectVersion = useCallback(
    (tag: string) => {
      setVersion(tag);
      state.current = { ...state.current, version: tag };
      applyVersion(state.current.repo, tag, { reloadRoute: true });
    },
    [applyVersion]
  );

  const submitRepo = useCallback(() => {
    const next = repoInput.trim();
    if (!next) return;
    if (!isValidRepoName(next)) {
      notify.current({ title: 'Repositório inválido', description: 'Use o formato usuário/repositório, por exemplo totvs/winthor-smart-hub-layouts.', variant: 'destructive' });
      return;
    }
    setRepo(next);
  }, [repoInput]);

  return {
    repoInput,
    setRepoInput,
    submitRepo,
    tags,
    version,
    integrations,
    integration,
    routes,
    routePath,
    loadingTags,
    loadingTree,
    loadingLayout,
    selectIntegration,
    selectRoute,
    selectVersion,
  };
}
