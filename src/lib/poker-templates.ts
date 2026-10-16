import type { DeckType, Room, Issue } from './types';

/**
 * Templates de sala de poker guardados no localStorage (por navegador do
 * usuário, mesmo padrão do histórico de salas). Guardam deck + configurações
 * do facilitador + backlog (títulos/links), para reabrir uma sessão pré-pronta.
 */
export const POKER_TEMPLATES_KEY = 'agileSpace_poker_templates';

export interface PokerTemplate {
  id: string;
  name: string;
  deckType: DeckType;
  settings: NonNullable<Room['settings']>;
  backlog: { title: string; jiraLink?: string; type?: Issue['type'] }[];
  createdAt: string;
}

export function listTemplates(): PokerTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(POKER_TEMPLATES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveTemplate(t: Omit<PokerTemplate, 'id' | 'createdAt'>): PokerTemplate {
  const tpl: PokerTemplate = {
    ...t,
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    createdAt: new Date().toISOString(),
  };
  const all = listTemplates();
  // Limita a 20 templates para não estourar o storage.
  const next = [tpl, ...all].slice(0, 20);
  try { localStorage.setItem(POKER_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* storage cheio */ }
  return tpl;
}

export function deleteTemplate(id: string): void {
  const next = listTemplates().filter(t => t.id !== id);
  try { localStorage.setItem(POKER_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export const TEMPLATE_NAME_MAX = 60;
const TEMPLATE_NAME_FALLBACK = 'Template do Scrum Poker';

/** Nome limpo: sem espaços sobrando, no máximo 60 caracteres; vazio cai no nome padrão. */
export function cleanTemplateName(name: string | null | undefined, fallback = TEMPLATE_NAME_FALLBACK): string {
  const cleaned = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, TEMPLATE_NAME_MAX).trim();
  return cleaned || fallback;
}

/** Template a partir de uma sala em andamento (baralho, configurações e títulos do backlog). */
export function templateFromRoom(input: {
  name: string;
  deckType: DeckType;
  settings?: Room['settings'];
  issues?: readonly Pick<Issue, 'title' | 'jiraLink' | 'type'>[];
}): Omit<PokerTemplate, 'id' | 'createdAt'> {
  return {
    name: cleanTemplateName(input.name),
    deckType: input.deckType,
    settings: { ...(input.settings ?? {}) },
    backlog: (input.issues ?? []).map((i) => ({ title: i.title, jiraLink: i.jiraLink || undefined, type: i.type })),
  };
}

/** Renomeia um template salvo. Devolve false se ele não existe mais. */
export function renameTemplate(id: string, name: string): boolean {
  const all = listTemplates();
  if (!all.some((t) => t.id === id)) return false;
  const next = all.map((t) => (t.id === id ? { ...t, name: cleanTemplateName(name, t.name) } : t));
  try { localStorage.setItem(POKER_TEMPLATES_KEY, JSON.stringify(next)); } catch { return false; }
  return true;
}
