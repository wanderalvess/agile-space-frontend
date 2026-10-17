import {
  Code,
  History,
  Home,
  KeyRound,
  LayoutGrid,
  Link2,
  Network,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceLocation } from './workspace-nav';

/** O que um item da paleta faz ao ser escolhido. */
export type PaletteRun =
  | { type: 'nav'; loc: WorkspaceLocation }
  | { type: 'action'; action: PaletteAction }
  | { type: 'href'; href: string };

export type PaletteAction = 'new-task' | 'new-note' | 'new-snippet' | 'new-link' | 'search-notes';

export const PALETTE_GROUPS = ['Navegação', 'Ações rápidas', 'Portal Tech V&D'] as const;
export type PaletteGroup = (typeof PALETTE_GROUPS)[number];

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  /** Palavras extras para a busca (sem repetir o rótulo). */
  keywords?: string[];
  icon: LucideIcon;
  run: PaletteRun;
}

/**
 * Itens do Meu espaço. Todos fazem algo de verdade: nenhum aponta para aba que não existe e não há atalhos
 * de teclado desenhados que não funcionam. Os módulos do portal vêm do registro (grupo à parte).
 */
export const PALETTE_ITEMS: readonly PaletteItem[] = [
  { id: 'nav-inicio', group: 'Navegação', label: 'Início', keywords: ['home', 'painel principal'], icon: Home, run: { type: 'nav', loc: { aba: 'inicio' } } },
  { id: 'nav-kanban', group: 'Navegação', label: 'Quadro Kanban', keywords: ['tarefas'], icon: LayoutGrid, run: { type: 'nav', loc: { aba: 'kanban' } } },
  { id: 'nav-notas', group: 'Navegação', label: 'Minhas Notas', keywords: ['mural', 'anotações'], icon: StickyNote, run: { type: 'nav', loc: { aba: 'notas' } } },
  { id: 'nav-atalhos', group: 'Navegação', label: 'Meus Atalhos', keywords: ['links', 'biblioteca'], icon: Link2, run: { type: 'nav', loc: { aba: 'biblioteca', sub: 'atalhos' } } },
  { id: 'nav-snippets', group: 'Navegação', label: 'Biblioteca de Snippets', keywords: ['código'], icon: Code, run: { type: 'nav', loc: { aba: 'biblioteca', sub: 'snippets' } } },
  { id: 'nav-historico', group: 'Navegação', label: 'Histórico de Sessões', keywords: ['cerimônias', 'poker', 'retro'], icon: History, run: { type: 'nav', loc: { aba: 'historico' } } },
  { id: 'nav-conectividade', group: 'Navegação', label: 'Conectividade e chaves de API', keywords: ['jira', 'tdn', 'token', 'agenda', 'google'], icon: KeyRound, run: { type: 'nav', loc: { aba: 'conta', sub: 'conectividade' } } },

  { id: 'act-task', group: 'Ações rápidas', label: 'Nova Tarefa (Kanban)', icon: Plus, run: { type: 'action', action: 'new-task' } },
  { id: 'act-note', group: 'Ações rápidas', label: 'Criar Nova Nota', icon: Plus, run: { type: 'action', action: 'new-note' } },
  { id: 'act-snippet', group: 'Ações rápidas', label: 'Registrar Snippet', icon: Plus, run: { type: 'action', action: 'new-snippet' } },
  { id: 'act-link', group: 'Ações rápidas', label: 'Novo Atalho', icon: Plus, run: { type: 'action', action: 'new-link' } },
  { id: 'act-search', group: 'Ações rápidas', label: 'Buscar tarefas e notas', keywords: ['procurar', 'pesquisar'], icon: Search, run: { type: 'action', action: 'search-notes' } },

  { id: 'portal-prompts', group: 'Portal Tech V&D', label: 'Meus Prompts Hub', keywords: ['prompts', 'ia'], icon: Sparkles, run: { type: 'nav', loc: { aba: 'biblioteca', sub: 'prompts' } } },
  { id: 'portal-perfil', group: 'Portal Tech V&D', label: 'Meu Perfil', keywords: ['conta', 'vínculos'], icon: UserRound, run: { type: 'nav', loc: { aba: 'conta', sub: 'perfil' } } },
  { id: 'portal-squad', group: 'Portal Tech V&D', label: 'Painel da squad', keywords: ['squad', 'time', 'hub'], icon: Network, run: { type: 'href', href: '/squad' } },
];

export function paletteItemsOf(group: PaletteGroup): PaletteItem[] {
  return PALETTE_ITEMS.filter((i) => i.group === group);
}

/** Valor que o cmdk usa para filtrar um item (rótulo + palavras extras). */
export function paletteSearchValue(item: Pick<PaletteItem, 'label' | 'keywords'>): string {
  return [item.label, ...(item.keywords ?? [])].join(' ');
}

export const PALETTE_NOTE_ICON = NotebookPen;
