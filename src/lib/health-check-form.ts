/**
 * Regras do formulário "Nova pesquisa" do Radar de clima, sem React: limites do servidor, importação em massa
 * e validação. Os limites espelham `HealthCheckService` (30 dimensões, título e pergunta com 255 e 2000
 * caracteres); a tela mostra os contadores antes de o servidor responder 400.
 */
import type { HealthCheckDimension } from './types';

export const MAX_DIMENSIONS = 30;
export const MAX_TITLE = 255;
export const MAX_DESCRIPTION = 2000;

let sequence = 0;

/** Chave nova e única para uma dimensão (o servidor recusa chaves repetidas). */
export function newDimensionKey(prefix = 'q'): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const SEPARATORS = [' - ', ': ', ' – ', ' — '];

/** Uma linha "Título - pergunta" -> dimensão. Separa no primeiro separador que aparece (o resto fica na pergunta). */
export function parseDimensionLine(line: string): Omit<HealthCheckDimension, 'key'> | null {
  const text = line.trim();
  if (!text) return null;
  let at = -1;
  let width = 0;
  for (const sep of SEPARATORS) {
    const i = text.indexOf(sep);
    if (i >= 0 && (at < 0 || i < at)) {
      at = i;
      width = sep.length;
    }
  }
  if (at < 0) return { title: text.slice(0, MAX_TITLE), description: '' };
  return { title: text.slice(0, at).trim().slice(0, MAX_TITLE), description: text.slice(at + width).trim().slice(0, MAX_DESCRIPTION) };
}

/** Linhas válidas do texto colado (vazias ficam de fora). */
export function parseBulkDimensions(text: string): Omit<HealthCheckDimension, 'key'>[] {
  return text
    .split('\n')
    .map(parseDimensionLine)
    .filter((d): d is Omit<HealthCheckDimension, 'key'> => !!d && d.title !== '');
}

export interface FormErrors {
  title?: string;
  dimensions?: string;
}

/** Erros do formulário (vazio quando pode criar). */
export function validateForm(title: string, dimensions: readonly HealthCheckDimension[]): FormErrors {
  const errors: FormErrors = {};
  if (!title.trim()) errors.title = 'Dê um título para a pesquisa.';
  else if (title.trim().length > MAX_TITLE) errors.title = `O título passa de ${MAX_TITLE} caracteres.`;
  const valid = dimensions.filter((d) => d.title.trim() !== '');
  if (valid.length === 0) errors.dimensions = 'Adicione pelo menos uma pergunta.';
  else if (valid.length > MAX_DIMENSIONS) errors.dimensions = `No máximo ${MAX_DIMENSIONS} perguntas.`;
  return errors;
}

/** Só as dimensões com título (o resto é linha em branco), com texto aparado. */
export function cleanDimensions(dimensions: readonly HealthCheckDimension[]): HealthCheckDimension[] {
  return dimensions
    .filter((d) => d.title.trim() !== '')
    .map((d) => ({ key: d.key, title: d.title.trim(), description: d.description.trim() }));
}

/** Quantas perguntas ainda cabem. */
export function remainingSlots(count: number): number {
  return Math.max(0, MAX_DIMENSIONS - count);
}
