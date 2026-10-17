'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { canEditIdeaText, canVoteOn, voteQuota, type VoteQuota } from './brainstorm-ceremony';
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
  /** Mural encerrado: tudo é leitura (sem lançar, editar, votar, fundir, mover, agrupar nem apagar). */
  readOnly?: boolean;
  /** `settings.restrictEdits`: só autor, facilitação e ADMIN editam o texto. */
  restrictEdits?: boolean;
  isAdmin?: boolean;
  /** Cota de votos de quem está logado (sem limite = `reached: false`). */
  quota?: VoteQuota;
}

const NO_QUOTA: VoteQuota = voteQuota(null, [], undefined);

const DEFAULT_VIEW: IdeaViewValue = { isFacilitator: false, anonymous: false, names: new Map() };

const IdeaViewContext = createContext<IdeaViewValue>(DEFAULT_VIEW);

export function IdeaViewProvider({ value, children }: { value: IdeaViewValue; children: React.ReactNode }) {
  return <IdeaViewContext.Provider value={value}>{children}</IdeaViewContext.Provider>;
}

export function useIdeaView(): IdeaViewValue {
  return useContext(IdeaViewContext);
}

/** Autor, cobertura e permissões de uma ideia vistos por quem está na sala. */
export function useIdeaPresentation(idea: BrainstormingIdea): {
  author: AuthorInfo;
  masked: boolean;
  isMine: boolean;
  /** Pode mudar o texto (o lápis aparece). */
  canEditText: boolean;
  /** Pode votar agora (ou tirar o voto que já deu). */
  canVote: boolean;
  quota: VoteQuota;
  readOnly: boolean;
} {
  const view = useIdeaView();
  return useMemo(() => {
    const quota = view.quota ?? NO_QUOTA;
    const hasVoted = !!view.currentUserId && Array.isArray(idea.votes) && idea.votes.includes(view.currentUserId);
    return {
      author: authorInfo(idea, { currentUserId: view.currentUserId, anonymous: view.anonymous, names: view.names }),
      masked: isIdeaMasked(idea, { revealed: view.revealed, currentUserId: view.currentUserId, isFacilitator: view.isFacilitator }),
      isMine: !!view.currentUserId && idea.authorId === view.currentUserId,
      canEditText: canEditIdeaText({ idea, userId: view.currentUserId, isFacilitator: view.isFacilitator, isAdmin: view.isAdmin, restrictEdits: view.restrictEdits, readOnly: view.readOnly }),
      canVote: canVoteOn({ quota, hasVoted, readOnly: view.readOnly }),
      quota,
      readOnly: !!view.readOnly,
    };
  }, [idea, view]);
}
