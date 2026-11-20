import {
  DEVTOOLS,
  DEVTOOL_GROUPS,
  HUB_FILTER_FAVORITES,
  HUB_FILTER_QUALITY,
  HUB_FILTER_RECENTS,
  HUB_TABS,
  getDevTool,
  getGroup,
  type DevToolHubTab,
  type DevToolMeta,
} from './registry';
import { RECENTS_ON_TOP, relativeWhen, type RecentEntry } from './preferences';

/** Lógica do hub do DevTools (busca, filtros e seções), separada da tela para ser testada. */

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Valor de `?grupo=` -> aba do hub (valor desconhecido cai em "todas"). */
export function parseHubTab(value: string | null | undefined): DevToolHubTab {
  return (HUB_TABS as readonly string[]).includes(value ?? '') ? (value as DevToolHubTab) : 'todas';
}

/** Todas as palavras da busca precisam aparecer no nome, na descrição, nas palavras-chave ou no grupo. */
export function searchTools(query: string): DevToolMeta[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return DEVTOOLS.filter((t) => {
    const hay = norm([t.title, t.description, t.keywords.join(' '), getGroup(t.group).label].join(' '));
    return terms.every((w) => hay.includes(w));
  });
}

export interface HubCard {
  tool: DevToolMeta;
  /** Linha de rodapé do cartão: o grupo, ou quando foi aberta. */
  foot: string;
}

export interface HubSection {
  id: string;
  title: string;
  sub: string;
  cards: HubCard[];
}

export type HubEmpty = 'busca' | 'favoritas' | 'recentes';

export interface HubView {
  sections: HubSection[];
  /** Estado vazio, quando há. */
  empty: HubEmpty | null;
  /** Mostra a dica de como favoritar (aba Todas, sem favoritas). */
  hintFavorite: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildHubView(opts: {
  tab: DevToolHubTab;
  query: string;
  favorites: string[];
  recents: RecentEntry[];
  now: number;
}): HubView {
  const { tab, query, now } = opts;
  const favList = opts.favorites.map((id) => getDevTool(id)).filter((t): t is DevToolMeta => !!t);
  const recList = opts.recents.map((r) => ({ tool: getDevTool(r.id), at: r.at })).filter((r): r is { tool: DevToolMeta; at: number } => !!r.tool);
  const withGroup = (list: DevToolMeta[]): HubCard[] => list.map((tool) => ({ tool, foot: getGroup(tool.group).label }));
  const plain = (list: DevToolMeta[]): HubCard[] => list.map((tool) => ({ tool, foot: '' }));

  if (norm(query).trim()) {
    const found = searchTools(query);
    if (!found.length) return { sections: [], empty: 'busca', hintFavorite: false };
    return {
      sections: [{ id: 'busca', title: `Resultados para "${query.trim()}"`, sub: plural(found.length, 'ferramenta', 'ferramentas'), cards: withGroup(found) }],
      empty: null,
      hintFavorite: false,
    };
  }

  const recSection = (limit?: number): HubSection => ({
    id: 'recentes',
    title: 'Recentes',
    sub: 'abertas por último',
    cards: (limit ? recList.slice(0, limit) : recList).map((r) => ({ tool: r.tool, foot: relativeWhen(r.at, now) })),
  });
  const favSection = (): HubSection => ({ id: 'favoritas', title: 'Favoritas', sub: `${favList.length} ${favList.length === 1 ? 'fixada' : 'fixadas'}`, cards: withGroup(favList) });

  if (tab === 'todas') {
    const sections: HubSection[] = [];
    if (favList.length) sections.push(favSection());
    if (recList.length) sections.push(recSection(RECENTS_ON_TOP));
    for (const g of DEVTOOL_GROUPS) {
      sections.push({ id: g.id, title: g.label, sub: g.description, cards: plain(DEVTOOLS.filter((t) => t.group === g.id)) });
    }
    return { sections, empty: null, hintFavorite: favList.length === 0 };
  }
  if (tab === HUB_FILTER_QUALITY) {
    return {
      sections: [{ id: 'qualidade', title: 'Qualidade', sub: 'Ferramentas de teste e apoio à qualidade, de todos os grupos', cards: withGroup(DEVTOOLS.filter((t) => t.qa)) }],
      empty: null,
      hintFavorite: false,
    };
  }
  if (tab === HUB_FILTER_FAVORITES) {
    return favList.length ? { sections: [favSection()], empty: null, hintFavorite: false } : { sections: [], empty: 'favoritas', hintFavorite: false };
  }
  if (tab === HUB_FILTER_RECENTS) {
    return recList.length ? { sections: [recSection()], empty: null, hintFavorite: false } : { sections: [], empty: 'recentes', hintFavorite: false };
  }
  const g = getGroup(tab);
  return { sections: [{ id: g.id, title: g.label, sub: g.description, cards: plain(DEVTOOLS.filter((t) => t.group === g.id)) }], empty: null, hintFavorite: false };
}

/** Contagem de cada pílula do hub. */
export function tabCounts(favorites: string[], recents: RecentEntry[]): Record<DevToolHubTab, number> {
  const counts: Record<string, number> = { todas: DEVTOOLS.length, [HUB_FILTER_QUALITY]: DEVTOOLS.filter((t) => t.qa).length };
  for (const g of DEVTOOL_GROUPS) counts[g.id] = DEVTOOLS.filter((t) => t.group === g.id).length;
  counts[HUB_FILTER_FAVORITES] = favorites.filter((id) => getDevTool(id)).length;
  counts[HUB_FILTER_RECENTS] = recents.filter((r) => getDevTool(r.id)).length;
  return counts as Record<DevToolHubTab, number>;
}

/** Ferramentas que usam rede, para o selo e o Guia. */
export function networkTools(): DevToolMeta[] {
  return DEVTOOLS.filter((t) => t.network);
}
