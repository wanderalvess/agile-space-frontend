'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isUnavailableError, showcaseApi } from '@/app/showcase/api';
import { canPublishAsPresenter, createThrottle, type PresenterStep } from './presenter-sync';
import type { ShowcasePresenter } from './types';

export interface UseShowcasePresenterOptions {
  sessionId: string;
  /** Login de quem está na sala. */
  meId: string | null | undefined;
  /** Apresentador atual (vem da sala: GET da sessão e PRESENTER_UPDATED). */
  presenter: ShowcasePresenter | null;
  setPresenter: (presenter: ShowcasePresenter | null) => void;
  /** Para teste. */
  throttleMs?: number;
}

export interface ShowcasePresenterControls {
  /** Publica o card que quem apresenta está mostrando (`null` = capa). Limitado a uma por ~500 ms. */
  publish: (cardId: string | null, step: PresenterStep) => void;
  /** Encerra a apresentação (só se fui eu quem publicou). */
  stop: () => void;
  /** Relê o apresentador no servidor (ao começar a acompanhar). */
  refresh: () => Promise<void>;
}

/**
 * Publicar o card atual do Teatro para os outros acompanharem. O recurso é opcional: backend sem a rota (404/405) ou
 * pessoa que não conduz a Review (403) fazem a sala parar de tentar, em silêncio. Só publica quem apresenta ou quando
 * ninguém apresenta, e só depois do último envio terminar de valer (respostas atrasadas são descartadas).
 */
export function useShowcasePresenter({ sessionId, meId, presenter, setPresenter, throttleMs }: UseShowcasePresenterOptions): ShowcasePresenterControls {
  const presenterRef = useRef(presenter);
  presenterRef.current = presenter;
  const meRef = useRef(meId);
  meRef.current = meId;
  const disabledRef = useRef(false);
  const publishedRef = useRef(false);
  const lastSentRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const setPresenterRef = useRef(setPresenter);
  setPresenterRef.current = setPresenter;

  // Trocar de sala recomeça do zero: o que foi aprendido (sem recurso, sem permissão) vale por sala.
  useEffect(() => {
    disabledRef.current = false;
    publishedRef.current = false;
    lastSentRef.current = null;
  }, [sessionId]);

  const send = useCallback(async (cardId: string | null, step: PresenterStep) => {
    if (disabledRef.current || !sessionId) return;
    if (!canPublishAsPresenter(presenterRef.current, meRef.current)) return;
    const key = `${cardId ?? ''}|${step}`;
    if (key === lastSentRef.current && presenterRef.current?.userId === meRef.current) return;
    const seq = ++seqRef.current;
    try {
      const res = await showcaseApi.setPresenter(sessionId, { cardId, step });
      publishedRef.current = true;
      lastSentRef.current = key;
      if (seq === seqRef.current) setPresenterRef.current(res);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      // Sem a rota (backend antigo), sem permissão ou Review já finalizada: não insiste.
      if (isUnavailableError(err) || status === 403 || status === 409 || status === 401) disabledRef.current = true;
    }
  }, [sessionId]);

  const throttle = useMemo(() => createThrottle(send, throttleMs), [send, throttleMs]);

  const publish = useCallback((cardId: string | null, step: PresenterStep) => {
    if (disabledRef.current) return;
    throttle.call(cardId, step);
  }, [throttle]);

  const stop = useCallback(() => {
    throttle.cancel();
    seqRef.current++;
    lastSentRef.current = null;
    // Também vale quando o servidor ainda me tem como apresentador (a página recarregou no meio da apresentação).
    if (!publishedRef.current && !(presenterRef.current && presenterRef.current.userId === meRef.current)) return;
    publishedRef.current = false;
    if (presenterRef.current?.userId === meRef.current) setPresenterRef.current(null);
    // Melhor esforço: se falhar, a validade do servidor limpa o apresentador.
    void Promise.resolve(showcaseApi.clearPresenter(sessionId)).catch(() => {});
  }, [sessionId, throttle]);

  const refresh = useCallback(async () => {
    try {
      setPresenterRef.current(await showcaseApi.getPresenter(sessionId));
    } catch {
      // Backend sem a rota ou falha de rede: fica com o que o tempo real já informou.
    }
  }, [sessionId]);

  // Sair da sala sem encerrar (fechar a aba é tratado pela validade do servidor).
  useEffect(() => stop, [stop]);

  return useMemo(() => ({ publish, stop, refresh }), [publish, stop, refresh]);
}
