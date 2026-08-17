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
