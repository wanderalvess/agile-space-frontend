/**
 * Navegação do Meu espaço por URL: `/workspace?aba=inicio|kanban|notas|biblioteca|historico|conta`.
 * Biblioteca e Conta têm subabas (`&sub=`). Os links das 9 abas antigas (`?tab=atalhos|prompts|snippets|perfil|
 * conectividade|home|notes|history|links...`) continuam levando ao mesmo conteúdo.
 */

export const WORKSPACE_TABS = ['inicio', 'kanban', 'notas', 'biblioteca', 'historico', 'conta'] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const LIBRARY_SUBS = ['atalhos', 'prompts', 'snippets'] as const;
export type LibrarySub = (typeof LIBRARY_SUBS)[number];

export const ACCOUNT_SUBS = ['perfil', 'conectividade'] as const;
export type AccountSub = (typeof ACCOUNT_SUBS)[number];

export type WorkspaceSub = LibrarySub | AccountSub;

export interface WorkspaceLocation {
  aba: WorkspaceTab;
  sub?: WorkspaceSub;
}

export const DEFAULT_LIBRARY_SUB: LibrarySub = 'atalhos';
export const DEFAULT_ACCOUNT_SUB: AccountSub = 'perfil';

export const TAB_LABELS: Record<WorkspaceTab, string> = {
  inicio: 'Início',
  kanban: 'Kanban',
  notas: 'Notas',
  biblioteca: 'Biblioteca',
  historico: 'Histórico',
  conta: 'Conta',
};

export const LIBRARY_LABELS: Record<LibrarySub, string> = {
  atalhos: 'Atalhos',
  prompts: 'Prompts',
  snippets: 'Snippets',
};

export const ACCOUNT_LABELS: Record<AccountSub, string> = {
  perfil: 'Perfil',
  conectividade: 'Conectividade',
};

/**
 * Nomes aceitos em `?tab=` (as 9 abas antigas e os ids internos de antes) e em `?aba=` (por tolerância).
 * Cada um aponta para a aba nova e, quando existe, a subaba.
 */
const LEGACY: Record<string, WorkspaceLocation> = {
  home: { aba: 'inicio' },
  inicio: { aba: 'inicio' },
  kanban: { aba: 'kanban' },
  notes: { aba: 'notas' },
  notas: { aba: 'notas' },
  history: { aba: 'historico' },
  historico: { aba: 'historico' },
  links: { aba: 'biblioteca', sub: 'atalhos' },
  atalhos: { aba: 'biblioteca', sub: 'atalhos' },
  prompts: { aba: 'biblioteca', sub: 'prompts' },
  snippets: { aba: 'biblioteca', sub: 'snippets' },
  biblioteca: { aba: 'biblioteca' },
  profile: { aba: 'conta', sub: 'perfil' },
  perfil: { aba: 'conta', sub: 'perfil' },
  connectivity: { aba: 'conta', sub: 'conectividade' },
  conectividade: { aba: 'conta', sub: 'conectividade' },
  conta: { aba: 'conta' },
};

export function isLibrarySub(v: unknown): v is LibrarySub {
  return typeof v === 'string' && (LIBRARY_SUBS as readonly string[]).includes(v);
}

export function isAccountSub(v: unknown): v is AccountSub {
  return typeof v === 'string' && (ACCOUNT_SUBS as readonly string[]).includes(v);
}

function normalize(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Garante que a subaba pertence à aba (e preenche o padrão de Biblioteca e Conta). */
export function withDefaultSub(loc: WorkspaceLocation): WorkspaceLocation {
  if (loc.aba === 'biblioteca') return { aba: 'biblioteca', sub: isLibrarySub(loc.sub) ? loc.sub : DEFAULT_LIBRARY_SUB };
  if (loc.aba === 'conta') return { aba: 'conta', sub: isAccountSub(loc.sub) ? loc.sub : DEFAULT_ACCOUNT_SUB };
  return { aba: loc.aba };
}

/** Lê `aba`, `sub` e o antigo `tab` da URL. Valor desconhecido cai em Início. */
export function parseWorkspaceLocation(params: { get(name: string): string | null } | null | undefined): WorkspaceLocation {
  const abaRaw = normalize(params?.get('aba'));
  const tabRaw = normalize(params?.get('tab'));
  const subRaw = normalize(params?.get('sub'));

  const base = LEGACY[abaRaw] ?? LEGACY[tabRaw] ?? { aba: 'inicio' as WorkspaceTab };
  // `sub` explícito vence o que o nome antigo sugeria, desde que seja válido para a aba.
  const sub = base.aba === 'biblioteca' ? (isLibrarySub(subRaw) ? subRaw : base.sub) : base.aba === 'conta' ? (isAccountSub(subRaw) ? subRaw : base.sub) : undefined;
  return withDefaultSub({ aba: base.aba, sub });
}

/** Endereço canônico de uma aba. Início fica em `/workspace` puro. */
export function workspaceHref(loc: WorkspaceLocation | WorkspaceTab, sub?: WorkspaceSub): string {
  const raw: WorkspaceLocation = typeof loc === 'string' ? { aba: loc, sub } : loc;
  const { aba, sub: s } = withDefaultSub(raw);
  if (aba === 'inicio') return '/workspace';
  const q = new URLSearchParams({ aba });
  if (s) q.set('sub', s);
  return `/workspace?${q.toString()}`;
}

/** Ids que o palette e os botões internos já usavam (`home`, `notes`, `history`, `links`...) -> localização nova. */
export function locationFromLegacyId(id: string): WorkspaceLocation | null {
  const loc = LEGACY[normalize(id)];
  return loc ? withDefaultSub(loc) : null;
}
