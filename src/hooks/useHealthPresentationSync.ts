'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { followState, knownStage, SYNC_STAGE_IDS, type SyncStageId } from '@/lib/health-check-progress';

export type PublishResult = 'ok' | 'unavailable' | 'forbidden';

export interface UseHealthPresentationSyncOptions {
  /** Criador ou ADMIN: publica a etapa. Os demais seguem. */
  isFacilitator: boolean;
  /** Etapa publicada (`null` = sem apresentação; `undefined` = o servidor não conhece o recurso). */
  published: string | null | undefined;
  /** Publica a etapa (ou limpa, com `null`). Falhas de rede podem lançar: são ignoradas. */
  publish?: (stage: string | null) => Promise<PublishResult>;
  initialStage?: SyncStageId;
}

/**
 * Modo apresentação do resultado do Radar, com a etapa sincronizada.
 * - Facilitador: ao abrir e a cada troca de etapa publica `PUT /presentation`; ao sair (ou fechar a tela) limpa.
 *   Se o servidor responder 404/405 (backend antigo) ou 403, para de publicar e a tela volta a "cada pessoa navega na sua".
 * - Participante: "Acompanhar o facilitador" ligado por padrão. Enquanto há etapa publicada ele vê a mesma etapa e a
 *   navegação fica travada; "Soltar" devolve a navegação livre, "Acompanhar" volta. Tudo derivado: nada de efeito
 *   que copia estado.
 */
export function useHealthPresentationSync({ isFacilitator, published, publish, initialStage = 'score' }: UseHealthPresentationSyncOptions) {
  const [localPresenting, setLocalPresenting] = useState(false);
  const [localStage, setLocalStage] = useState<SyncStageId>(initialStage);
  const [follow, setFollow] = useState(true);
  const [broadcasting, setBroadcasting] = useState(true);

  const publishRef = useRef(publish);
  useEffect(() => { publishRef.current = publish; }, [publish]);
  const enabledRef = useRef(true);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const send = useCallback((stage: string | null) => {
    chain.current = chain.current.then(async () => {
      const fn = publishRef.current;
      if (!fn || !enabledRef.current) return;
      try {
        const result = await fn(stage);
        if (result === 'unavailable' || result === 'forbidden') {
          enabledRef.current = false;
          setBroadcasting(false);
        }
      } catch (error) {
        console.warn('Não foi possível sincronizar a apresentação do radar', error);
      }
    });
  }, []);

  const followed = followState({ follow, published, isFacilitator });
  const presenting = localPresenting || followed.following;
  const stage: SyncStageId = followed.stage ?? localStage;
  const canBroadcast = isFacilitator && !!publish && broadcasting;

  // Facilitador: publica a etapa enquanto apresenta; ao sair (ou desmontar) limpa para quem acompanha.
  useEffect(() => {
    if (!canBroadcast || !localPresenting) return;
    send(localStage);
  }, [canBroadcast, localPresenting, localStage, send]);
  useEffect(() => {
    if (!canBroadcast || !localPresenting) return;
    return () => send(null);
  }, [canBroadcast, localPresenting, send]);

  const start = useCallback(() => {
    setLocalStage('score');
    setLocalPresenting(true);
  }, []);

  const exit = useCallback(() => {
    setLocalPresenting(false);
    // Sair da apresentação do facilitador é soltar: sem isto o efeito derivado traria a pessoa de volta na hora.
    if (followed.following) setFollow(false);
  }, [followed.following]);

  const goTo = useCallback((next: SyncStageId) => {
    if (followed.following) return;
    setLocalStage(next);
  }, [followed.following]);

  /** Soltar: continua na apresentação, agora navegando sozinha na etapa em que estava. */
  const release = useCallback(() => {
    setLocalStage(followed.stage ?? localStage);
    setLocalPresenting(true);
    setFollow(false);
  }, [followed.stage, localStage]);

  const rejoin = useCallback(() => setFollow(true), []);

  const step = useCallback((direction: 1 | -1) => {
    if (followed.following) return;
    const i = SYNC_STAGE_IDS.indexOf(localStage);
    const next = SYNC_STAGE_IDS[i + direction];
    if (next) setLocalStage(next);
  }, [followed.following, localStage]);

  return {
    presenting,
    stage,
    following: followed.following,
    /** O facilitador está com uma etapa publicada que esta pessoa pode seguir (ligada ou solta). */
    facilitatorPresenting: !isFacilitator && knownStage(published) !== null,
    /** Este facilitador está publicando a etapa (e o servidor aceita). */
    broadcasting: canBroadcast && localPresenting,
    start,
    exit,
    goTo,
    step,
    release,
    rejoin,
  };
}
