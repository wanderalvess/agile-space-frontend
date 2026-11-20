export const MAX_CHAT_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_CONTEXT_CHARS = 120_000;
export const MAX_DOC_CHARS = 12_000;

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface ContextDoc { title?: string; name?: string; fullPath?: string; category?: string; content?: string }

/** Mantém só role/content (texto), as últimas N mensagens e corta mensagens gigantes. */
export function sanitizeMessages(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const content = (m as { content?: unknown }).content;
    if (typeof content !== 'string' || !content.trim()) continue;
    const role = (m as { role?: unknown }).role === 'user' ? 'user' : 'assistant';
    turns.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return turns.slice(-MAX_CHAT_MESSAGES);
}

/** Monta o bloco de contexto com teto por documento e total, para o custo da chamada não depender do tamanho da base. */
export function buildContext(docs: ContextDoc[], maxTotal = MAX_CONTEXT_CHARS, maxDoc = MAX_DOC_CHARS): string {
  let total = 0;
  const parts: string[] = [];
  for (const doc of docs) {
    const header = `--- DOCUMENTO: ${doc.title || doc.name || 'Sem título'} (${doc.fullPath || doc.category || ''}) ---\n`;
    const body = (doc.content || '').slice(0, maxDoc);
    const block = `${header}${body}\n`;
    if (total + block.length > maxTotal) {
      const room = maxTotal - total;
      if (room > header.length + 200) parts.push(block.slice(0, room));
      break;
    }
    parts.push(block);
    total += block.length + 1;
  }
  return parts.join('\n');
}

/** Chaves OpenAI/Anthropic enviadas ao Gemini só geram erro confuso; detectamos antes de gastar a chamada. */
export function foreignKeyProvider(key: string | undefined): 'anthropic' | 'openai' | null {
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}
