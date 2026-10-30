'use client';

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Lock } from 'lucide-react';
import type { DeckType, Participant, Vote } from '@/lib/types';
import { canParticipantVote, getEligibleStatsVotes, getParticipantCategory, observerHintOf } from '@/lib/poker-utils';
import { SEM_CARGO, canonicalCargo } from '@/lib/cargo';
import { LATE_SEAT_MS, introOffset, introTiming, modeOf, newcomersOf, ringFits, seatToneOf, stageMinHeight, tableGeometry, waitingLabel } from '@/lib/poker-table';
import { cn } from '@/lib/utils';
import { ProgressRing, VoteCard, VoteSeat, useElementSize } from '@/components/room-kit';

const CATEGORY_ORDER = ['Developer', 'QA', 'UX', 'Designer', 'Management'] as const;

interface PokerTableProps {
  participants: Participant[];
  votes: Vote[];
  votesRevealed: boolean;
  deck: DeckType;
  currentUserId: string;
  /** Cargos que votam na sala (votingCargosOf). Os demais ficam à mesa como observadores. */
  votingCargos?: readonly string[];
  divergences?: Map<string, 'warning' | 'destructive' | 'none'>;
  /** Mantém quem tem o mesmo papel lado a lado (configuração "agrupar votos por papel"). */
  groupByRole?: boolean;
  /** Revelação anônima: só a distribuição aparece, as cartas ficam viradas. */
  anonymousReveal?: boolean;
  onlineIds?: Set<string>;
  /** Modo apresentação: cartas maiores. */
  large?: boolean;
  /** Tela que rola de qualquer jeito (resultado da rodada): a oval ganha mais altura. */
  roomy?: boolean;
  /** Refinamento ainda não iniciado: a votação não abriu, então o centro não conta votos. */
  locked?: boolean;
  /** Conteúdo do centro da mesa quando revelado (estimativa total, chips por papel). */
  revealedCenter?: React.ReactNode;
  /** Barra de baixo da mesa (régua de referência, reações). */
  footer?: React.ReactNode;
  /** Camada de bolhas de reação sobre a mesa. */
  overlay?: React.ReactNode;
}

const FELT_SHADOW =
  'shadow-[inset_0_2px_14px_rgba(0,0,0,0.06),0_0_0_6px_hsl(var(--muted)/0.5)] dark:shadow-[inset_0_2px_14px_rgba(0,0,0,0.55),0_0_0_6px_hsl(var(--muted)/0.5),0_0_40px_hsl(var(--primary)/0.15)] [.theme-leitura_&]:shadow-[0_0_0_6px_hsl(var(--muted)/0.5)]';

const ENTER_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Assento surgindo a partir do centro da mesa (só opacidade e transform: não pesa na GPU). */
function enterSeat(el: HTMLElement, from: { dx: number; dy: number }, delay: number, duration: number, scale: number) {
  el.animate(
    [
      { opacity: 0, translate: `${from.dx}px ${from.dy}px`, scale },
      { opacity: 1, translate: '0px 0px', scale: 1 },
    ],
    { duration, delay, easing: ENTER_EASE, fill: 'backwards' }
  );
}

/** Mesa oval: assentos em volta do feltro, estado da votação no centro. Em tela estreita (ou mesa muito cheia) vira grade. */
export function PokerTable({
  participants,
  votes,
  votesRevealed,
  deck,
  currentUserId,
  votingCargos,
  divergences,
  groupByRole = false,
  anonymousReveal = false,
  onlineIds,
  large = false,
  locked = false,
  roomy = false,
  revealedCenter,
  footer,
  overlay,
}: PokerTableProps) {
  const voteByPerson = useMemo(() => new Map(votes.map((v) => [v.participantId, v])), [votes]);

  // Quem vota fica primeiro; quem só observa (cargo que não vota na sala, sem cargo) vai junto, no fim: o grupo de observadores não toma o lugar de ninguém.
  const seats = useMemo(() => {
    const list = participants.filter((p) => p.role !== 'spectator');
    const rank = (p: Participant) => {
      const i = CATEGORY_ORDER.indexOf((getParticipantCategory(p) ?? 'Management') as (typeof CATEGORY_ORDER)[number]);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    const ordered = groupByRole ? [...list].sort((a, b) => rank(a) - rank(b)) : list;
    return [
      ...ordered.filter((p) => canParticipantVote(p, votingCargos)),
      ...ordered.filter((p) => !canParticipantVote(p, votingCargos)),
    ];
  }, [participants, groupByRole, votingCargos]);

  const voters = useMemo(() => seats.filter((p) => canParticipantVote(p, votingCargos)), [seats, votingCargos]);
  const votedCount = voters.filter((p) => voteByPerson.has(p.id)).length;
  const waiting = voters.filter((p) => !voteByPerson.has(p.id) && (onlineIds ? onlineIds.has(p.id) : true)).map((p) => p.nickname);

  const mode = useMemo(
    () => modeOf(getEligibleStatsVotes(votes, participants, votingCargos).map((v) => v.value)),
    [votes, participants, votingCargos]
  );

  // Entrada do time: ao sair de "refinamento não iniciado" os assentos entram em sequência a partir
  // do centro (uma vez, só nesse momento); quem chega depois entra sozinho, mais curto. Sem
  // animação com "reduzir movimento". As cartas e a mesa em si não animam por rodada.
  const sectionRef = useRef<HTMLElement>(null);
  const wasLocked = useRef(locked);
  const seenSeats = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    const root = sectionRef.current;
    const starting = wasLocked.current && !locked;
    wasLocked.current = locked;
    const ids = seats.map((p) => p.id);
    if (!root || ids.length === 0) return;
    const seen = seenSeats.current;
    seenSeats.current = new Set(ids);
    if (!seen) return;
    const fresh = starting ? ids : newcomersOf(seen, ids);
    if (fresh.length === 0) return;
    if (typeof root.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const felt = root.querySelector<HTMLElement>('[data-table-felt]');
    const fr = felt?.getBoundingClientRect();
    const center = fr ? { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 } : null;
    const timing = introTiming(fresh.length);
    fresh.forEach((id, i) => {
      const el = root.querySelector<HTMLElement>(`[data-seat="${CSS.escape(id)}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const from = center ? introOffset({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, center, starting ? 0.5 : 0.3) : { dx: 0, dy: 14 };
      enterSeat(el, from, starting ? i * timing.step : 0, starting ? timing.duration : LATE_SEAT_MS, starting ? 0.82 : 0.9);
    });
    if (starting) {
      felt?.animate([{ opacity: 0.4, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: ENTER_EASE, fill: 'backwards' });
      root.querySelector<HTMLElement>('[data-table-center]')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 180, easing: 'ease-out', fill: 'backwards' });
    }
  }, [locked, seats]);

  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  // O modo (oval ou grade) só depende da largura e da quantidade de assentos; a altura entra só no desenho da oval.
  const minH = stageMinHeight(seats.length, roomy);
  const ring = stage.width > 0 && ringFits(seats.length, stage.width, large, minH);
  const geo = useMemo(
    () => (ring ? tableGeometry(seats.length, stage.width, stage.height, large, minH) : null),
    [ring, seats.length, stage.width, stage.height, large, minH]
  );
  const unit = deck === 'hours' ? 'h' : undefined;
  const cardSize = geo?.tier.size ?? (large ? 'lg' : 'mid');

  const renderSeat = (p: Participant, index: number, place?: { x: number; y: number; width: number; flipped: boolean }) => {
    const vote = voteByPerson.get(p.id);
    const category = getParticipantCategory(p);
    // O cargo por extenso (o da administração), nunca um rótulo inventado pela categoria.
    const roleLabel = canonicalCargo(p.globalRole) || SEM_CARGO;
    const absent = !!onlineIds && !onlineIds.has(p.id);
    const seatProps = {
      seatId: p.id,
      userId: p.id,
      name: p.nickname,
      roleLabel,
      roleCategory: category,
      isYou: p.id === currentUserId,
      isHost: !!p.isFacilitator,
      absent,
      className: place ? 'absolute transition-[left,top] duration-slow ease-room motion-reduce:transition-none' : undefined,
      style: place ? { left: place.x, top: place.y, width: place.width, transform: 'translate(-50%, -50%)' } : undefined,
    };

    if (!canParticipantVote(p, votingCargos)) {
      return <VoteSeat key={p.id} {...seatProps} observer observerHint={observerHintOf(p)} compact={cardSize === 'xs' || cardSize === 'sm'} />;
    }
    let card: React.ReactNode;
    if (!vote) {
      card = <VoteCard state="thinking" size={cardSize} label={absent ? 'Ausente' : 'Pensando'} />;
    } else if (votesRevealed && !anonymousReveal) {
      card = (
        <VoteCard
          state="revealed"
          size={cardSize}
          value={vote.value}
          unit={unit}
          tone={seatToneOf(vote.value, mode, divergences?.get(p.id))}
          delay={index * 70}
          confidence={vote.confidence ?? null}
          highlight={p.id === currentUserId}
          label={`${p.nickname}: ${vote.value}`}
        />
      );
    } else {
      card = <VoteCard state="hidden" size={cardSize} highlight={p.id === currentUserId} label={`${p.nickname} votou`} />;
    }
    return <VoteSeat key={p.id} {...seatProps} flipped={place?.flipped ?? false}>{card}</VoteSeat>;
  };

  const centerContent = votesRevealed ? (
    revealedCenter
  ) : locked ? (
    <>
      <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', large ? 'h-[72px] w-[72px]' : 'h-14 w-14')}>
        <Lock className={large ? 'h-7 w-7' : 'h-6 w-6'} strokeWidth={1.5} />
      </span>
      <span className={cn('font-semibold', large ? 'text-xl' : 'text-base')}>Votação ainda fechada</span>
    </>
  ) : (
    <>
      <ProgressRing value={votedCount} total={voters.length} size={large ? 72 : 56} />
      <div className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className={cn('font-semibold', large ? 'text-xl' : 'text-base')} aria-live="polite">
          {voters.length === 0 ? 'Sem votantes na mesa' : votedCount === voters.length ? 'Todos votaram' : `${votedCount} de ${voters.length} votaram`}
        </span>
        {voters.length > 0 && <span className={cn('truncate text-muted-foreground', large ? 'text-base' : 'text-[13px]')}>{waitingLabel(waiting)}</span>}
      </div>
    </>
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Mesa"
      className="relative flex shrink-0 grow basis-auto flex-col overflow-hidden rounded-2xl border border-border bg-card px-3 pb-2 pt-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:px-5"
    >
      <div aria-hidden="true" className="room-halo room-breathe pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[760px] max-w-full -translate-x-1/2 -translate-y-1/2" />
      <div aria-hidden="true" className="room-dots-bg pointer-events-none absolute inset-0" />

      <div
        ref={stageRef}
        style={ring ? { minHeight: `clamp(${minH}px, 38dvh, ${Math.max(minH, 460)}px)` } : undefined}
        className={cn('relative mx-auto w-full max-w-[1500px]', ring ? 'max-h-[760px] flex-1' : 'flex flex-col gap-4')}
      >
        {ring && geo ? (
          <>
            <div
              aria-hidden="true"
              data-table-felt=""
              className={cn('absolute rounded-[50%] border border-border bg-background', FELT_SHADOW)}
              style={{ left: geo.felt.x, top: geo.felt.y, width: geo.felt.w, height: geo.felt.h }}
            />
            <div
              data-table-center=""
              className="absolute z-[1] flex items-center justify-center gap-4"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxWidth: Math.max(240, geo.felt.w - geo.tier.seatW * 2) }}
            >
              {centerContent}
            </div>
            <ul className="absolute inset-0 z-[2] m-0 list-none p-0">
              {seats.map((p, i) => renderSeat(p, i, { x: geo.seats[i].x, y: geo.seats[i].y, width: geo.tier.seatW, flipped: geo.seats[i].y < geo.felt.y + geo.felt.h / 2 - 2 }))}
            </ul>
          </>
        ) : (
          <>
            <div data-table-felt="" data-table-center="" className={cn('relative z-[1] mx-auto flex min-h-[80px] w-full max-w-[560px] items-center justify-center gap-4 rounded-3xl border border-border bg-background px-4 py-3', FELT_SHADOW)}>
              {centerContent}
            </div>
            <ul className="relative m-0 grid list-none gap-x-3 gap-y-4 p-0 pt-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(152px,1fr))]">
              {seats.map((p, i) => renderSeat(p, i))}
            </ul>
          </>
        )}
      </div>

      {overlay}
      {footer && <div className="relative z-[3] mt-2 flex flex-wrap items-center justify-between gap-3">{footer}</div>}
    </section>
  );
}
