/** Atalhos reais da Sandbox: Ctrl+Enter executa e Ctrl+S salva o layout (Cmd no Mac). */

export type JoltShortcut = 'executar' | 'salvar';

export const SHORTCUT_LABEL: Record<JoltShortcut, string> = {
  executar: 'Ctrl+Enter',
  salvar: 'Ctrl+S',
};

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/** Qual atalho a tecla pressionada aciona (ou null). Com Alt ou Shift junto, não é o atalho. */
export function matchShortcut(e: KeyLike): JoltShortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return null;
  if (e.key === 'Enter') return 'executar';
  if (e.key.toLowerCase() === 's') return 'salvar';
  return null;
}
