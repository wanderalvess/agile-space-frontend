'use client';

import React, { useMemo } from 'react';
import type { DeckType, Participant, Vote } from '@/lib/types';
import { canParticipantVote, formatRoleForCopy, getEligibleStatsVotes, getParticipantCategory } from '@/lib/poker-utils';
import { modeOf, seatToneOf, splitSeats, waitingLabel } from '@/lib/poker-table';
import { cn } from '@/lib/utils';
import { ProgressRing, VoteCard, VoteSeat } from '@/components/room-kit';

const CATEGORY_ORDER = ['Developer', 'QA', 'UX', 'Designer', 'Management'] as const;

interface PokerTableProps {
  participants: Participant[];
  votes: Vote[];
  votesRevealed: boolean;
  deck: DeckType;
  currentUserId: string;
  allowManagementToVote?: boolean;
  divergences?: Map<string, 'warning' | 'destructive' | 'none'>;
  /** Mantém quem tem o mesmo papel lado a lado (configuração "agrupar votos por papel"). */
  groupByRole?: boolean;
  /** Revelação anônima: só a distribuição aparece, as cartas ficam viradas. */
  anonymousReveal?: boolean;
  onlineIds?: Set<string>;
  /** Modo apresentação: cartas maiores. */
  large?: boolean;
  /** Conteúdo do centro da mesa quando revelado (estimativa total, chips por papel). */
  revealedCenter?: React.ReactNode;
  /** Barra de baixo da mesa (régua de referência, reações). */
  footer?: React.ReactNode;
  /** Camada de bolhas de reação sobre a mesa. */
  overlay?: React.ReactNode;
}

/** Mesa oval: assentos em cima e embaixo, anel de progresso no centro. */
export function PokerTable({
  participants,
  votes,
  votesRevealed,
  deck,
  currentUserId,
  allowManagementToVote = false,
  divergences,
  groupByRole = false,
  anonymousReveal = false,
  onlineIds,
  large = false,
  revealedCenter,
  footer,
  overlay,
}: PokerTableProps) {
  const voteByPerson = useMemo(() => new Map(votes.map((v) => [v.participantId, v])), [votes]);

  const seats = useMemo(() => {
    const list = participants.filter((p) => p.role !== 'spectator');
    if (!groupByRole) return list;
    const rank = (p: Participant) => {
      const i = CATEGORY_ORDER.indexOf((getParticipantCategory(p) ?? 'Management') as (typeof CATEGORY_ORDER)[number]);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [participants, groupByRole]);

  const voters = useMemo(() => seats.filter((p) => canParticipantVote(p, allowManagementToVote)), [seats, allowManagementToVote]);
  const votedCount = voters.filter((p) => voteByPerson.has(p.id)).length;
  const waiting = voters.filter((p) => !voteByPerson.has(p.id) && (onlineIds ? onlineIds.has(p.id) : true)).map((p) => p.nickname);

  const mode = useMemo(
    () => modeOf(getEligibleStatsVotes(votes, participants, allowManagementToVote).map((v) => v.value)),
    [votes, participants, allowManagementToVote]
  );

  const { top, bottom } = splitSeats(seats);
  const unit = deck === 'hours' ? 'h' : undefined;
  const cardSize = large ? 'lg' : 'md';

  const renderSeat = (p: Participant, flipped: boolean, order: number) => {
    const vote = voteByPerson.get(p.id);
    const category = getParticipantCategory(p);
    const roleLabel = category && category !== 'Management' ? formatRoleForCopy(category) : (p.globalRole || (p.role === 'organizador' ? 'Organizador' : 'Participante'));
    let card: React.ReactNode;
    if (!canParticipantVote(p, allowManagementToVote)) {
      card = <VoteCard state="observer" size={cardSize} />;
    } else if (!vote) {
      card = <VoteCard state="thinking" size={cardSize} label={onlineIds && !onlineIds.has(p.id) ? 'Ausente' : 'Pensando'} />;
    } else if (votesRevealed && !anonymousReveal) {
      card = (
        <VoteCard
          state="revealed"
          size={cardSize}
          value={vote.value}
          unit={unit}
          tone={seatToneOf(vote.value, mode, divergences?.get(p.id))}
          delay={order * 70}
          confidence={vote.confidence ?? null}
          highlight={p.id === currentUserId}
          label={`${p.nickname}: ${vote.value}`}
        />
      );
    } else {
      card = <VoteCard state="hidden" size={cardSize} highlight={p.id === currentUserId} label={`${p.nickname} votou`} />;
    }
    return (
      <VoteSeat key={p.id} name={p.nickname} roleLabel={roleLabel} roleCategory={category} flipped={flipped} isYou={p.id === currentUserId} isHost={!!p.isFacilitator}>
        {card}
      </VoteSeat>
    );
  };

  const rowCls = 'relative m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]';

  return (
    <section aria-label="Mesa" className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card px-4 pb-4 pt-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:px-6">
      <div aria-hidden="true" className="room-halo room-breathe pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[760px] -translate-x-1/2 -translate-y-1/2" />
      <div aria-hidden="true" className="room-dots-bg pointer-events-none absolute inset-0" />

      <ul className={rowCls}>{top.map((p, i) => renderSeat(p, false, i))}</ul>

      <div
        className={cn(
          'relative z-[1] flex min-h-[96px] items-center justify-center gap-5 self-center rounded-[999px] border border-border bg-background px-8 py-4 sm:w-[82%]',
          'shadow-[inset_0_2px_14px_rgba(0,0,0,0.06),0_0_0_6px_hsl(var(--muted)/0.5)] dark:shadow-[inset_0_2px_14px_rgba(0,0,0,0.55),0_0_0_6px_hsl(var(--muted)/0.5),0_0_40px_hsl(var(--primary)/0.15)] [.theme-leitura_&]:shadow-[0_0_0_6px_hsl(var(--muted)/0.5)]',
          large && 'min-h-[128px]'
        )}
      >
        {votesRevealed ? (
          revealedCenter
        ) : (
          <>
            <ProgressRing value={votedCount} total={voters.length} size={large ? 72 : 56} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn('font-semibold', large ? 'text-xl' : 'text-[15px]')} aria-live="polite">
                {voters.length > 0 && votedCount === voters.length ? 'Todos votaram' : `${votedCount} de ${voters.length} votaram`}
              </span>
              <span className={cn('truncate text-muted-foreground', large ? 'text-base' : 'text-[13px]')}>{waitingLabel(waiting)}</span>
            </div>
          </>
        )}
      </div>

      <ul className={rowCls}>{bottom.map((p, i) => renderSeat(p, true, top.length + i))}</ul>

      {overlay}
      {footer && <div className="relative z-[2] flex flex-wrap items-center justify-between gap-3">{footer}</div>}
    </section>
  );
}
