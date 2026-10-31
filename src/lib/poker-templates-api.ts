import { authFetch } from '@/lib/auth-client';
import { deleteTemplate, listTemplates, type PokerTemplate } from './poker-templates';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type NewPokerTemplate = Pick<PokerTemplate, 'name' | 'deckType' | 'settings' | 'backlog'>;

export class PokerTemplatesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'PokerTemplatesError';
  }
}

async function readError(res: Response, fallback: string): Promise<PokerTemplatesError> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text) {
      try {
        const body = JSON.parse(text);
        detail = body.error || body.message || body.reason || '';
      } catch {
        detail = text;
      }
    }
  } catch {
    // corpo ilegível
  }
  return new PokerTemplatesError(res.status, detail ? detail.slice(0, 400) : `${fallback} (HTTP ${res.status})`);
}

/** Servidor devolve settings/backlog nulos em linhas antigas? Normaliza para o formato da tela. */
function normalize(t: PokerTemplate): PokerTemplate {
  return { ...t, settings: t.settings ?? {}, backlog: Array.isArray(t.backlog) ? t.backlog : [] };
}

const base = (squadId: string) => `${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/poker-templates`;

/** Templates de sessão do Scrum Poker guardados no servidor, compartilhados pela squad. */
export const pokerTemplatesApi = {
  async list(squadId: string): Promise<PokerTemplate[]> {
    const res = await authFetch(base(squadId));
    if (!res.ok) throw await readError(res, 'Falha ao carregar os templates da squad');
    return ((await res.json()) as PokerTemplate[]).map(normalize);
  },

  async create(squadId: string, t: NewPokerTemplate): Promise<PokerTemplate> {
    const res = await authFetch(base(squadId), {
      method: 'POST',
      body: JSON.stringify({ name: t.name, deckType: t.deckType, settings: t.settings, backlog: t.backlog }),
    });
    if (!res.ok) throw await readError(res, 'Falha ao salvar o template');
    return normalize(await res.json());
  },

  async rename(squadId: string, id: string, name: string): Promise<PokerTemplate> {
    const res = await authFetch(`${base(squadId)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    if (!res.ok) throw await readError(res, 'Falha ao renomear o template');
    return normalize(await res.json());
  },

  async remove(squadId: string, id: string): Promise<void> {
    const res = await authFetch(`${base(squadId)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await readError(res, 'Falha ao excluir o template');
  },
};

/**
 * Leva para a squad os templates que ficaram no localStorage (versões antigas guardavam só no navegador).
 * Cada um que o servidor aceita sai do navegador; os que falham ficam para tentar de novo.
 */
export async function importLocalTemplates(squadId: string): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;
  // Do mais antigo para o mais novo: a lista da squad (mais novo primeiro) mantém a ordem que a pessoa via.
  for (const t of [...listTemplates()].reverse()) {
    try {
      await pokerTemplatesApi.create(squadId, { name: t.name, deckType: t.deckType, settings: t.settings ?? {}, backlog: t.backlog ?? [] });
      deleteTemplate(t.id);
      imported++;
    } catch {
      failed++;
    }
  }
  return { imported, failed };
}
