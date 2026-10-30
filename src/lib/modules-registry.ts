import {
  BookOpen,
  Braces,
  CalendarDays,
  HeartPulse,
  House,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Library,
  Lightbulb,
  ListChecks,
  MonitorPlay,
  Network,
  PanelsTopLeft,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
  ListTree,
} from 'lucide-react';

/**
 * Registro único dos módulos do Portal Tech V&D: nome, rota, ícone e grupo de cada um.
 * É a fonte de verdade de Home, menus, cabeçalho, rodapé, busca de módulo e paleta de comandos.
 * Módulo novo entra aqui e aparece nos lugares certos; nenhuma tela mantém lista própria.
 *
 * Ícones: linha de 1,5, um por módulo, sem repetir entre módulos (o teste do registro garante).
 * Sem foguete, sem logo de produto TOTVS.
 */

export type ModuleKey =
  | 'home'
  | 'painel'
  | 'squad'
  | 'roster'
  | 'subtarefas'
  | 'workspace'
  | 'poker'
  | 'retro'
  | 'showcase'
  | 'health'
  | 'brainstorming'
  | 'action-plan'
  | 'jolt'
  | 'devtools'
  | 'sprint-planner'
  | 'knowledge'
  | 'prompt-hub'
  | 'manual'
  | 'support'
  | 'changelog'
  | 'governance'
  | 'admin'
  | 'settings';

export type ModuleGroupKey = 'inicio' | 'squad' | 'rituais' | 'ferramentas' | 'conhecimento' | 'ajuda' | 'conta';

export const MODULE_GROUP_LABELS: Record<ModuleGroupKey, string> = {
  inicio: 'Início',
  squad: 'Squad',
  rituais: 'Rituais',
  ferramentas: 'Ferramentas',
  conhecimento: 'Conhecimento',
  ajuda: 'Ajuda e políticas',
  conta: 'Conta',
};

/** Grupos do cartão "Todos os módulos" da Home. */
export type HomeGroupKey = 'quality' | 'flow' | 'collab' | 'support';

export const HOME_GROUP_LABELS: Record<HomeGroupKey, string> = {
  quality: 'Qualidade e ferramentas',
  flow: 'Fluxo e entregas',
  collab: 'Colaboração e clima',
  support: 'Utilidades e suporte',
};

export const HOME_GROUP_ORDER: HomeGroupKey[] = ['quality', 'flow', 'collab', 'support'];

export interface PortalModule {
  key: ModuleKey;
  /** Nome único do módulo, o mesmo em toda tela. */
  label: string;
  href: string;
  icon: LucideIcon;
  group: ModuleGroupKey;
  /** Uma linha sobre o que o módulo faz (Home, busca, dicas). */
  description: string;
  /** Outros nomes que a pessoa pode digitar na busca (nome antigo, sigla, termo em inglês). */
  aliases?: string[];
  /** Prefixos de rota que também pertencem ao módulo (além do `href`), para marcar o item ativo. */
  paths?: string[];
  /** Módulo ainda não liberado: o link leva à página "Em breve". */
  soon?: boolean;
  /** Só aparece para administradores. */
  adminOnly?: boolean;
  /** Presente quando o módulo é um cartão da Home. */
  home?: {
    group: HomeGroupKey;
    order: number;
    /** Título do cartão, quando difere do nome do módulo. */
    title?: string;
    /** Atalhos extras do cartão. */
    links?: ModuleKey[];
  };
}

export const MODULES: readonly PortalModule[] = [
  // Início
  { key: 'home', label: 'Home', href: '/', icon: House, group: 'inicio', description: 'Suas squads, o que está ao vivo e todos os módulos', aliases: ['início', 'hub'] },

  // Squad
  { key: 'painel', label: 'Painel do time', href: '/squad?tab=resumo', icon: LayoutDashboard, group: 'squad', description: 'Sprint, board e movimentos da squad', aliases: ['resumo', 'painel'], paths: ['/painel'], home: { group: 'flow', order: 1 } },
  { key: 'squad', label: 'Squad', href: '/squad', icon: Network, group: 'squad', description: 'Quadro, cronograma e métricas da squad', aliases: ['hub da squad'], paths: ['/squad/dashboards', '/squad/panels'] },
  { key: 'roster', label: 'Time da squad', href: '/squad/roster', icon: Users, group: 'squad', description: 'Quem está no time, cargos e capacidade', aliases: ['roster', 'integrantes', 'equipe'] },
  { key: 'subtarefas', label: 'Sub-tarefas do time', href: '/subtarefas', icon: ListTree, group: 'squad', description: 'Quais sub-tarefas o time cria no Jira por tipo de issue', aliases: ['subtasks', 'sub-tarefas', 'jira', 'codificação', 'code review'] },
  { key: 'workspace', label: 'Meu espaço', href: '/workspace', icon: PanelsTopLeft, group: 'squad', description: 'Kanban pessoal, tarefas e agendas', aliases: ['meu quadro', 'workspace'], home: { group: 'flow', order: 2 } },

  // Rituais (os cinco módulos de sessão)
  { key: 'poker', label: 'Scrum Poker', href: '/room', icon: Layers, group: 'rituais', description: 'Estimativa em horas por papel, com a squad na mesma sala', aliases: ['poker', 'estimativa', 'planning poker'] },
  { key: 'retro', label: 'Retrospectiva', href: '/retro', icon: RefreshCw, group: 'rituais', description: 'O que foi bem, o que melhorar e as ações', aliases: ['retro'] },
  { key: 'showcase', label: 'Review', href: '/showcase', icon: MonitorPlay, group: 'rituais', description: 'Apresentação das entregas da sprint', aliases: ['showcase', 'sprint review'] },
  { key: 'health', label: 'Radar de clima', href: '/health-check', icon: HeartPulse, group: 'rituais', description: 'Pesquisas rápidas e anônimas do time', aliases: ['health check', 'clima'], home: { group: 'collab', order: 1 } },
  { key: 'brainstorming', label: 'Brainstorming', href: '/brainstorming', icon: Lightbulb, group: 'rituais', description: 'Quadros de ideias com a squad', aliases: ['ideias', 'painel de ideias'], home: { group: 'collab', order: 2 } },
  { key: 'action-plan', label: 'Plano de ação', href: '/action-plan', icon: ListChecks, group: 'rituais', description: 'Matrizes 5W2H com responsáveis e prazos', aliases: ['5w2h'], home: { group: 'collab', order: 3 } },

  // Ferramentas
  { key: 'jolt', label: 'Jolt', href: '/jolt', icon: Braces, group: 'ferramentas', description: 'Layouts e especificações', aliases: ['layouts', 'spec'], home: { group: 'quality', order: 1 } },
  { key: 'devtools', label: 'DevTools', href: '/devtools', icon: Wrench, group: 'ferramentas', description: 'JSON, Base64, JWT, Regex, Diff, Zephyr, massa de dados e mais', aliases: ['ferramentas', 'json', 'regex', 'base64', 'qa', 'qualidade', 'central de qualidade', 'zephyr'], paths: ['/qa'], home: { group: 'quality', order: 2 } },
  { key: 'sprint-planner', label: 'Planejamento', href: '/sprint-planner', icon: CalendarDays, group: 'ferramentas', description: 'Capacidade e planejamento da sprint', aliases: ['planejamento', 'sprint planner', 'capacidade'], home: { group: 'flow', order: 3 } },

  // Conhecimento
  { key: 'knowledge', label: 'Base de conhecimento', href: '/knowledge/kb', icon: Library, group: 'conhecimento', description: 'Wiki e base técnica', aliases: ['conhecimento', 'wiki', 'kb'], paths: ['/knowledge'], home: { group: 'support', order: 1 } },
  { key: 'prompt-hub', label: 'Prompt Hub', href: '/prompt-hub', icon: Sparkles, group: 'conhecimento', description: 'Prompts, skills, agentes e Gems', aliases: ['biblioteca de ia', 'prompts', 'ia'], home: { group: 'support', order: 2 } },

  // Ajuda e políticas
  { key: 'manual', label: 'Manual', href: '/manual', icon: BookOpen, group: 'ajuda', description: 'Como usar cada módulo' },
  { key: 'support', label: 'Suporte', href: '/support', icon: LifeBuoy, group: 'ajuda', description: 'Chamados e ajuda da equipe do portal', aliases: ['chamados', 'ajuda'], home: { group: 'support', order: 3, title: 'Políticas e ajuda', links: ['governance', 'changelog', 'manual', 'support'] } },
  { key: 'changelog', label: 'Versões', href: '/changelog', icon: ScrollText, group: 'ajuda', description: 'O que mudou em cada versão', aliases: ['changelog', 'novidades'] },
  { key: 'governance', label: 'Segurança e dados', href: '/governance', icon: ShieldCheck, group: 'ajuda', description: 'Como o portal protege os dados', aliases: ['governança', 'segurança', 'lgpd'] },

  // Conta
  { key: 'admin', label: 'Administração', href: '/admin', icon: UserCog, group: 'conta', description: 'Usuários, vínculos, aprovações e configurações do portal', aliases: ['admin'], adminOnly: true },
  { key: 'settings', label: 'Configurações', href: '/configuracoes', icon: Settings, group: 'conta', description: 'Preferências da sua conta', aliases: ['preferências'] },
];

const BY_KEY = new Map<ModuleKey, PortalModule>(MODULES.map((m) => [m.key, m]));

/** O módulo da chave. Chave inexistente é erro de programação (o tipo já impede). */
export function getModule(key: ModuleKey): PortalModule {
  const found = BY_KEY.get(key);
  if (!found) throw new Error(`Módulo desconhecido: ${key}`);
  return found;
}

/** Ícone de cada módulo, indexado pela chave (para componentes que escolhem o ícone sem criar componente em render). */
export const MODULE_ICONS = Object.fromEntries(MODULES.map((m) => [m.key, m.icon])) as Record<ModuleKey, LucideIcon>;

/** Ícone do módulo, o mesmo em toda tela. */
export function moduleIcon(key: ModuleKey): LucideIcon {
  return MODULE_ICONS[key];
}

export function moduleLabel(key: ModuleKey): string {
  return getModule(key).label;
}

export function moduleHref(key: ModuleKey): string {
  return getModule(key).href;
}

/** Os cinco módulos de sessão, na ordem do menu "Rituais". */
export const RITUAL_MODULE_KEYS: readonly ModuleKey[] = ['poker', 'retro', 'showcase', 'health', 'brainstorming'];

export function modulesInGroup(group: ModuleGroupKey): PortalModule[] {
  return MODULES.filter((m) => m.group === group);
}

/** Módulos visíveis para a pessoa (os de administração só para admin). */
export function visibleModules(isAdmin: boolean): PortalModule[] {
  return MODULES.filter((m) => !m.adminOnly || isAdmin);
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca por nome, apelido e descrição, sem acento e sem diferença de caixa. Consulta vazia devolve todos. */
export function searchModules(query: string, isAdmin = true): PortalModule[] {
  const q = normalize(query.trim());
  const pool = visibleModules(isAdmin);
  if (!q) return pool;
  return pool
    .map((m) => {
      const label = normalize(m.label);
      const aliases = (m.aliases ?? []).map(normalize);
      // Nome vale mais que apelido, e apelido mais que descrição: o que a pessoa digitou primeiro aparece primeiro.
      const rank = label.startsWith(q) ? 0 : label.includes(q) ? 1 : aliases.some((a) => a.includes(q)) ? 2 : normalize(m.description).includes(q) ? 3 : -1;
      return { m, rank };
    })
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.m);
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Módulo a que a rota pertence (para marcar o item ativo do menu). Vale o prefixo mais longo:
 * `/squad/roster` é "Time da squad", não "Squad". `/` só casa com a Home exata.
 */
export function moduleForPath(pathname: string): PortalModule | undefined {
  let best: { m: PortalModule; len: number } | undefined;
  for (const m of MODULES) {
    if (m.href === '/') continue;
    // Rota com query (o Resumo é `/squad?tab=resumo`) não é prefixo de caminho: vale só o que está em `paths`.
    const own = m.href.includes('?') ? [] : [m.href];
    for (const prefix of [...own, ...(m.paths ?? [])]) {
      if (underPrefix(pathname, prefix) && (!best || prefix.length > best.len)) best = { m, len: prefix.length };
    }
  }
  if (best) return best.m;
  return pathname === '/' ? getModule('home') : undefined;
}

/** Cartões da Home agrupados na ordem de sempre. */
export function homeModuleGroups(): Array<{ id: HomeGroupKey; label: string; items: PortalModule[] }> {
  return HOME_GROUP_ORDER.map((id) => ({
    id,
    label: HOME_GROUP_LABELS[id],
    items: MODULES.filter((m) => m.home?.group === id).sort((a, b) => (a.home?.order ?? 0) - (b.home?.order ?? 0)),
  }));
}

/** Itens da navegação principal do cabeçalho (curta de propósito: o resto está na busca e na Home). */
export type PrimaryNavKey = 'home' | 'squad' | 'planejamento' | 'workspace' | 'rituais' | 'admin';

/**
 * Qual item da navegação principal está ativo na rota. Painel, Squad e Time da squad contam como "Squad"; o Sprint Planner é "Planejamento";
 * os módulos de sessão (e o Plano de ação) contam como "Rituais".
 */
export function primaryNavFor(pathname: string): PrimaryNavKey | null {
  const m = moduleForPath(pathname);
  if (!m) return null;
  if (m.key === 'home') return 'home';
  if (m.key === 'painel' || m.key === 'squad' || m.key === 'roster') return 'squad';
  if (m.key === 'sprint-planner') return 'planejamento';
  if (m.key === 'workspace') return 'workspace';
  if (m.group === 'rituais') return 'rituais';
  if (m.key === 'admin') return 'admin';
  return null;
}
