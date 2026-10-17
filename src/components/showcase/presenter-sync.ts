/**
 * Seguir o apresentador (backend com a V81, docs/ceremony-review-api.md): regras puras, sem rede nem React.
 * O estado do apresentador é efêmero e fica no servidor; aqui só o que decide quem publica, o limite de envios e
 * para qual card o Teatro de quem acompanha deve ir.
 */
import type { ShowcasePresenter, ShowcaseTask } from './types';

/** Intervalo mínimo entre duas publicações do card atual. */
export const PRESENTER_THROTTLE_MS = 500;

/** Etapas que o cliente publica no campo livre `step` do servidor. */
export type PresenterStep = 'cover' | 'card';

/**
 * Quem pode publicar: não há apresentador ou o apresentador sou eu. Outra pessoa apresentando não é tomada de quem
 * só está navegando (o servidor também deixaria o último a publicar vencer, e a sala viraria uma disputa).
 */
export function canPublishAsPresenter(presenter: ShowcasePresenter | null | undefined, meId: string | null | undefined): boolean {
  if (!meId) return false;
  return !presenter || presenter.userId === meId;
}

/** Há outra pessoa apresentando (para o chip "Apresentando: nome" e o botão Acompanhar). */
export function isOtherPresenter(presenter: ShowcasePresenter | null | undefined, meId: string | null | undefined): presenter is ShowcasePresenter {
  return !!presenter && (!meId || presenter.userId !== meId);
}

/**
 * Posição do card no Teatro de quem acompanha: -1 é a capa; `null` quando o card publicado não existe aqui
 * (removido por alguém): fica onde está, em vez de pular para um card qualquer.
 */
export function followTarget(tasks: readonly Pick<ShowcaseTask, 'id'>[], presenter: Pick<ShowcasePresenter, 'cardId'> | null | undefined): number | null {
  if (!presenter) return null;
  if (presenter.cardId == null || presenter.cardId === '') return -1;
  const at = tasks.findIndex((t) => t.id === presenter.cardId);
  return at >= 0 ? at : null;
}

export interface Throttled<A extends unknown[]> {
  /** Chama já se passou o intervalo; senão guarda a chamada mais recente e a executa quando o intervalo fechar. */
  call: (...args: A) => void;
  /** Descarta a chamada guardada. */
  cancel: () => void;
}

/** Limita as chamadas a uma por `intervalMs`: a primeira sai na hora e, no meio do intervalo, só a última sai no fim dele. */
export function createThrottle<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number = PRESENTER_THROTTLE_MS): Throttled<A> {
  let lastRun = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const run = (args: A) => {
    lastRun = Date.now();
    fn(...args);
  };

  return {
    call(...args: A) {
      const wait = lastRun + intervalMs - Date.now();
      if (wait <= 0 && timer === null) {
        run(args);
        return;
      }
      pending = args;
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          const next = pending;
          pending = null;
          if (next) run(next);
        }, Math.max(wait, 0));
      }
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
