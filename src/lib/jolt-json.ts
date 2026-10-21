/**
 * Leitura de JSON colado pela pessoa: diz onde está o erro (linha e coluna) em português e,
 * quando o erro é uma vírgula esquecida, sabe corrigir.
 */

export interface JsonProblem {
  /** Linha e coluna (a partir de 1) do ponto onde o JSON deixou de fazer sentido; 0 quando o navegador não informa. */
  line: number;
  column: number;
  /** Posição no texto (índice), ou -1 quando o navegador não informa. */
  position: number;
  /** Uma frase em português dizendo o que provavelmente está errado. */
  hint: string;
}

export type JsonCheck = { ok: true; value: unknown } | { ok: false; problem: JsonProblem };

function lineColumnAt(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(position, text.length))).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function hintFor(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("expected ',' or '}'") || m.includes("expected ',' or ']'")) return 'Falta uma vírgula entre dois itens, ou uma chave/colchete não foi fechada.';
  if (m.includes('double-quoted property name') || m.includes('property name')) return 'Todo nome de campo precisa estar entre aspas duplas; uma vírgula a mais no fim da lista também causa este erro.';
  if (m.includes('unexpected end') || m.includes('end of json')) return 'O JSON termina antes da hora: falta fechar uma chave ou um colchete.';
  if (m.includes('unexpected token') || m.includes('unexpected character') || m.includes('unexpected non-whitespace')) return 'Há um caractere fora do lugar: confira vírgulas, aspas e chaves perto daqui.';
  if (m.includes('unterminated string') || m.includes('bad control character')) return 'Um texto entre aspas não foi fechado (ou tem uma quebra de linha dentro).';
  return 'O JSON não está bem formado.';
}

/** Valida o texto. Em caso de erro devolve onde e por quê, sem expor a mensagem em inglês do navegador. */
export function checkJson(text: string): JsonCheck {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const lc = /line (\d+) column (\d+)/i.exec(raw);
    const pos = /position (\d+)/i.exec(raw);
    let line = 0;
    let column = 0;
    let position = -1;
    if (pos) {
      position = Number(pos[1]);
      ({ line, column } = lineColumnAt(text, position));
    } else if (lc) {
      line = Number(lc[1]);
      column = Number(lc[2]);
      const lines = text.split('\n');
      position = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + column - 1;
    }
    return { ok: false, problem: { line, column, position, hint: hintFor(raw) } };
  }
}

/** "Erro de sintaxe na linha 10, coluna 9. Falta uma vírgula..." (sem a posição quando ela é desconhecida). */
export function describeProblem(label: string, p: JsonProblem): string {
  const where = p.line > 0 ? ` na linha ${p.line}, coluna ${p.column}` : '';
  return `${label}${where}. ${p.hint}`;
}

/**
 * Corrige o erro mais comum: vírgula esquecida no fim da linha anterior ao ponto do erro.
 * Devolve o texto corrigido só se ele passar a ser um JSON válido; senão, null (nada é alterado).
 */
export function tryFixJson(text: string): string | null {
  const check = checkJson(text);
  if (check.ok || check.problem.position < 0) return null;
  let i = Math.min(check.problem.position, text.length) - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return null;
  const prev = text[i];
  if (prev === ',' || prev === '{' || prev === '[' || prev === ':') return null;
  const fixed = text.slice(0, i + 1) + ',' + text.slice(i + 1);
  return checkJson(fixed).ok ? fixed : null;
}

/** Indenta com 2 espaços; devolve null se o texto não for JSON válido. */
export function formatJson(text: string): string | null {
  const check = checkJson(text);
  return check.ok ? JSON.stringify(check.value, null, 2) : null;
}
