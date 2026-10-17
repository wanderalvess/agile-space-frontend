import type { RetroBoard } from './types';

/**
 * Ciclo de vida da sessão inteira da Retro (`lifecycleStatus`), separado de `votingStatus` (a votação dentro dela).
 * Todos os campos novos são opcionais: o backend antigo não os envia e a retro se comporta como sempre (aberta, sem
 * botões de encerrar). Contrato: docs/redesign/ceremony-radar-retro.md.
 */

/** O backend conhece o encerramento? Sem o campo, os botões "Encerrar retro"/"Reabrir" e o "Escrevendo…" ficam escondidos. */
export function supportsRetroLifecycle(board: Pick<RetroBoard, 'lifecycleStatus'> | null | undefined): boolean {
  return board?.lifecycleStatus === 'OPEN' || board?.lifecycleStatus === 'FINISHED';
}

/** Retro encerrada pelo facilitador. Sem o campo (backend antigo), nunca. */
export function isRetroFinished(board: Pick<RetroBoard, 'lifecycleStatus'> | null | undefined): boolean {
  return board?.lifecycleStatus === 'FINISHED';
}

/**
 * Quem pode escrever numa retro encerrada: só o facilitador (criador) e o ADMIN, que também a reabrem. Os demais
 * a veem somente leitura; o servidor responde 409 a qualquer escrita deles.
 */
export function isRetroReadOnly(board: Pick<RetroBoard, 'lifecycleStatus'> | null | undefined, canManage: boolean): boolean {
  return isRetroFinished(board) && !canManage;
}

/** Data do encerramento (a Retro grava LocalDateTime ISO, sem fuso); `null` quando desconhecida. */
export function retroFinishedAt(board: Pick<RetroBoard, 'finishedAt'> | null | undefined): Date | null {
  if (!board?.finishedAt) return null;
  const date = new Date(board.finishedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Aviso fixo para quem vê a retro encerrada sem poder alterá-la. */
export const RETRO_READ_ONLY_NOTICE = 'O facilitador encerrou esta retro. Você pode ler tudo, mas não escrever, votar nem mover cartões.';

/** Mensagem do servidor para o 409 de retro encerrada (mostrada quando a resposta não trouxer texto). */
export const RETRO_CLOSED_FALLBACK = 'Esta retrospectiva foi encerrada. Só o facilitador pode alterá-la.';

/** Aviso curto quando a tela barra a escrita antes de chamar o servidor. */
export function readOnlyToast(): { title: string; description: string; variant: 'destructive' } {
  return { title: 'Retro encerrada', description: RETRO_CLOSED_FALLBACK, variant: 'destructive' };
}
