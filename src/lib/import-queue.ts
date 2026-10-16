/**
 * Fila da importação do Jira. Quem cuida de várias squads cola várias chaves; cada uma tem prévia e
 * confirmação próprias. O estado da fila é um valor imutável, e estas funções puras o fazem andar,
 * para a tela ficar só com o que é visual (e a regra poder ser testada sem React).
 */

import type { ProjectDetail } from '@/services/projectService';

export interface ImportQueue {
  /** Chaves na ordem em que a pessoa as colou, sem repetidas. */
  keys: string[];
  /** Posição da chave que está na prévia. */
  index: number;
  /** Squads já gravadas nesta rodada. */
  imported: ProjectDetail[];
  /** Chaves que falharam na prévia ou foram puladas. */
  skipped: string[];
}

export function createQueue(keys: string[]): ImportQueue {
  return { keys, index: 0, imported: [], skipped: [] };
}

/** Mais de uma chave: a tela mostra "Squad 2 de 5" e o botão de pular. */
export const isBatch = (q: ImportQueue): boolean => q.keys.length > 1;

export function queueLabel(q: ImportQueue): string | undefined {
  return isBatch(q) ? `Squad ${q.index + 1} de ${q.keys.length}` : undefined;
}

/** Existe outra chave depois da que está na prévia. */
export const hasNext = (q: ImportQueue): boolean => q.index + 1 < q.keys.length;

/** A primeira squad gravada vira a ativa; as demais só entram na lista da pessoa. */
export const isFirstImport = (q: ImportQueue): boolean => q.imported.length === 0;

export const pointAt = (q: ImportQueue, index: number): ImportQueue => ({ ...q, index });

export const addImported = (q: ImportQueue, project: ProjectDetail): ImportQueue => ({ ...q, imported: [...q.imported, project] });

export const addSkipped = (q: ImportQueue, key: string): ImportQueue => ({ ...q, skipped: [...q.skipped, key] });

/**
 * "Voltar à lista" no meio da fila: o que já foi gravado fica, e as chaves que ainda não tiveram vez
 * (a da prévia aberta e as seguintes) contam como não importadas.
 */
export function abandonRemaining(q: ImportQueue): { done: ProjectDetail[]; skipped: string[] } {
  return { done: q.imported, skipped: [...q.skipped, ...q.keys.slice(q.index)] };
}

/** Texto do aviso ao fim da fila quando nada, ou só parte, foi importado. */
export function queueEndNotice(done: number, skipped: string[]): { title: string; description?: string } | null {
  const left = skipped.length ? `Sem importar: ${skipped.join(', ')}.` : undefined;
  if (done === 0) return { title: 'Nenhuma squad foi importada', description: left };
  if (skipped.length) return { title: `${done} importada${done === 1 ? '' : 's'}`, description: left };
  return null;
}
