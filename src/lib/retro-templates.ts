import type { RetroTemplateKey, RetroColumnTheme } from './types';
import type { SetupSettings } from '@/components/retro/CreateRetroDialog';

/**
 * Templates de retro guardados no localStorage (por navegador do usuário),
 * mesmo padrão dos templates de sala de poker em poker-templates.ts.
 */
export const RETRO_TEMPLATES_KEY = 'agileSpace_retro_templates';

export interface RetroTemplate {
  id: string;
  name: string;
  template: RetroTemplateKey;
  customColumns: { title: string; theme: RetroColumnTheme }[];
  setupSettings: SetupSettings;
  createdAt: string;
}

export function listTemplates(): RetroTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RETRO_TEMPLATES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveTemplate(t: Omit<RetroTemplate, 'id' | 'createdAt'>): RetroTemplate {
  const tpl: RetroTemplate = {
    ...t,
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    createdAt: new Date().toISOString(),
  };
  const all = listTemplates();
  // Limita a 20 templates para não estourar o storage.
  const next = [tpl, ...all].slice(0, 20);
  try { localStorage.setItem(RETRO_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* storage cheio */ }
  return tpl;
}

export function deleteTemplate(id: string): void {
  const next = listTemplates().filter(t => t.id !== id);
  try { localStorage.setItem(RETRO_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}
