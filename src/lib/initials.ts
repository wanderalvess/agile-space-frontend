/** Ligações que não contam como "nome" nas iniciais: "Maria da Silva" -> "MS". */
const CONNECTORS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/** Quantidade de tons do avatar (classes `.avatar-tone-0` a `.avatar-tone-7` em globals.css). */
export const AVATAR_TONE_COUNT = 8;

/** Primeira letra ou número da palavra (preserva acento), em maiúscula. Palavra sem nenhum -> ''. */
function firstGlyph(word: string): string {
  const match = word.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase('pt-BR') : '';
}

function wordsOf(text: string, separators: RegExp): string[] {
  return text.split(separators).filter((w) => firstGlyph(w) !== '');
}

/**
 * Iniciais para o avatar: primeira letra do primeiro e do último nome, em maiúsculas e com acento
 * ("Ana Paula de Souza" -> "AS", "Álvaro" -> "Á"). Ignora "de/da/do/dos/das/e" e espaços extras.
 * Sem nome, ou com um e-mail no lugar dele, usa o e-mail ("ana.silva@x.com" -> "AS"). Sem nada, "?".
 */
export function initialsOf(name?: string | null, email?: string | null): string {
  const raw = (name ?? '').trim();
  const source = raw && !raw.includes('@') ? raw : raw || (email ?? '').trim();
  const isEmail = source.includes('@');
  // Em e-mail, "ana.silva" vira duas palavras; em nome, só o espaço separa.
  const words = isEmail ? wordsOf(source.slice(0, source.indexOf('@')), /[\s._+-]+/) : wordsOf(source, /\s+/);
  const meaningful = words.filter((w) => !CONNECTORS.has(w.toLocaleLowerCase('pt-BR')));
  const list = meaningful.length > 0 ? meaningful : words;
  if (list.length === 0) return '?';

  const first = firstGlyph(list[0]);
  if (list.length === 1) return first;
  return first + firstGlyph(list[list.length - 1]);
}

/** Índice (0 a 7) do tom do avatar: o mesmo nome sempre cai no mesmo tom, sem diferenciar acento nem caixa. */
export function avatarToneIndex(name?: string | null, email?: string | null): number {
  const key = ((name ?? '').trim() || (email ?? '').trim())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  return h % AVATAR_TONE_COUNT;
}
