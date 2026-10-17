'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { authorInfo, isIdeaMasked, type AuthorInfo } from './brainstorm-room-logic';
import type { BrainstormingIdea } from '@/lib/types';

/**
 * O que o cartão de ideia precisa saber da sala para decidir quem aparece como autor e se o texto está coberto.
 * Vem por contexto porque a Teia (nós do React Flow), os Grupos e o Mural desenham o mesmo cartão.
 */
export interface IdeaViewValue {
  currentUserId?: string;
  isFacilitator: boolean;
  /** `settings.isAnonymous`. */
  anonymous: boolean;
  /** `settings.isRevealed` (ausente = revelado). */
  revealed?: boolean;
  /** id -> apelido de quem está na sala. */
  names: ReadonlyMap<string, string>;
}

const DEFAULT_VIEW: IdeaViewValue = { isFacilitator: false, anonymous: false, names: new Map() };

const IdeaViewContext = createContext<IdeaViewValue>(DEFAULT_VIEW);

export function IdeaViewProvider({ value, children }: { value: IdeaViewValue; children: React.ReactNode }) {
  return <IdeaViewContext.Provider value={value}>{children}</IdeaViewContext.Provider>;
}

export function useIdeaView(): IdeaViewValue {
  return useContext(IdeaViewContext);
}

/** Autor e cobertura de uma ideia vistos por quem está na sala. */
export function useIdeaPresentation(idea: BrainstormingIdea): { author: AuthorInfo; masked: boolean; isMine: boolean } {
  const view = useIdeaView();
  return useMemo(
    () => ({
      author: authorInfo(idea, { currentUserId: view.currentUserId, anonymous: view.anonymous, names: view.names }),
      masked: isIdeaMasked(idea, { revealed: view.revealed, currentUserId: view.currentUserId, isFacilitator: view.isFacilitator }),
      isMine: !!view.currentUserId && idea.authorId === view.currentUserId,
    }),
    [idea, view]
  );
}
