"use client";

import { ModuleIcon } from '@/components/brand/ModuleIcon';
import React, { useEffect, useRef } from 'react';
import { Check, CloudDownload, Copy, ListPlus, Lock, Share2 } from 'lucide-react';
import type { DeckType, Participant } from '@/lib/types';
import { getDeckCards } from '@/lib/poker-deck';
import { canParticipantVote, getParticipantCategory } from '@/lib/poker-utils';
import { canonicalCargo } from '@/lib/cargo';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FOCUS_RING, PersonAvatar, StatusChip } from '@/components/room-kit';

// Cartas exibidas no leque de boas-vindas, por baralho (a do meio é a destacada).
const FAN_FACES: Record<DeckType, readonly string[]> = {
  fibonacci: ['3', '5', '8', '13', '☕'],
  hours: ['2', '4', '8', '16', '☕'],
  tshirt: ['PP', 'P', 'M', 'G', 'GG'],
};

// Rotação (graus), deslocamento X e Y (px) de cada carta no leque.
const FAN_ROTATE = [-16, -8, 0, 8, 16];
const FAN_X = [-168, -84, 0, 84, 168];
const FAN_Y = [30, 10, 0, 10, 30];

// Avisa quando alguém entra depois da montagem (a lista inicial não gera toast).
function useJoinToasts(participants: Participant[]) {
  const { toast } = useToast();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(participants.map((p) => p.id));
      return;
    }
    for (const p of participants) {
      if (!seen.current.has(p.id)) {
        seen.current.add(p.id);
        toast({ title: `${p.nickname} entrou na sala` });
      }
    }
  }, [participants, toast]);
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('[role="dialog"]');
}

/** Escolhe até `n` itens espalhados ao longo da lista, do menor ao maior. */
function pickEvenly(list: readonly string[], n: number): string[] {
  if (list.length <= n) return [...list];
  return Array.from({ length: n }, (_, i) => list[Math.round(((i + 1) * (list.length - 1)) / n)]);
}

/** Leque de cartas do baralho da sala; abre em 320 ms e afasta no hover. */
function CardFan({ deck, maxHours }: { deck: DeckType; maxHours?: number | null }) {
  const cards = getDeckCards(deck, maxHours);
  const preset = FAN_FACES[deck] ?? cards.slice(0, 5);
  // Com limite baixo no baralho de horas, o leque usa cartas que existem de fato.
  const faces = preset.every((f) => cards.includes(f)) ? preset : [...pickEvenly(cards.filter((c) => Number(c) > 0), 4), '☕'];
  return (
    <div className="group/fan relative mx-auto h-[190px] w-full max-w-[470px] select-none [@media(max-height:820px)]:-mb-10 [@media(max-height:820px)]:origin-top [@media(max-height:820px)]:scale-[0.8]" aria-hidden="true">
      {faces.map((face, i) => {
        const hero = i === 2;
        return (
          <div
            key={`${face}-${i}`}
            className="absolute left-1/2 top-3 -ml-[47px] h-[132px] w-[94px] transition-transform duration-slow ease-room motion-reduce:transition-none"
            style={{
              transform: `translate(${FAN_X[i]}px, ${FAN_Y[i]}px) rotate(${FAN_ROTATE[i]}deg)`,
              transformOrigin: '50% 140%',
              zIndex: hero ? 10 : 5 - Math.abs(i - 2),
            }}
          >
            <div
              className={cn(
                'room-rise relative flex h-full w-full items-center justify-center rounded-xl border text-4xl font-bold tabular-nums',
                hero
                  ? 'border-primary bg-primary text-primary-foreground shadow-[0_16px_36px_hsl(var(--primary)/0.45)] [.theme-leitura_&]:shadow-none'
                  : 'border-border bg-card text-card-foreground shadow-[0_8px_20px_rgba(15,23,42,0.1)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="absolute left-2 top-1.5 text-xs font-semibold leading-none opacity-70">{face === '☕' ? '' : face}</span>
              <span className="absolute bottom-1.5 right-2 rotate-180 text-xs font-semibold leading-none opacity-70">{face === '☕' ? '' : face}</span>
              {face === '☕' ? <span className="text-base font-semibold">pausa</span> : <span className={face.length > 2 ? 'text-2xl' : undefined}>{face}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BTN = 'inline-flex h-[42px] w-full items-center justify-center gap-2.5 rounded-[10px] text-sm transition-[transform,background-color] duration-fast hover:-translate-y-px motion-reduce:transform-none';
const KEY = 'rounded border border-current/40 px-1.5 py-px text-xs tabular-nums';

interface RoomWelcomeProps {
  deck: DeckType;
  maxHours?: number | null;
  deckLabel: string;
  roomTeam?: string | null;
  participants: Participant[];
  onlineIds: Set<string>;
  roomUrl: string;
  /** Código curto da sala (o mesmo do "Entrar com o ID" do lobby). */
  roomCode: string;
  currentUserId: string;
  /** Cargos que votam nesta sala (rótulo "vota" ao lado de cada pessoa e o resumo da sessão). */
  votingCargos: readonly string[];
  onShare: () => void;
  onImportJira: () => void;
  onAddManual: () => void;
  onOpenSettings?: () => void;
}

/** Lugares da mesa em miniatura: quem já chegou senta em volta; sobram cadeiras tracejadas até 4. */
function MiniTable({ participants, onlineIds, currentUserId }: { participants: Participant[]; onlineIds: Set<string>; currentUserId: string }) {
  const shown = participants.slice(0, 8);
  const seats = Math.max(4, shown.length);
  const placed = Array.from({ length: seats }, (_, i) => {
    // Começa à esquerda e gira no sentido horário, como na mesa da votação.
    const angle = Math.PI + (i * 2 * Math.PI) / seats;
    return { x: 50 + 42 * Math.cos(angle), y: 50 + 38 * Math.sin(angle), p: shown[i] ?? null };
  });
  return (
    <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-[18px] border border-border bg-card">
      <div aria-hidden="true" className="room-dots-bg pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="absolute h-[44%] w-[62%] max-w-[460px] rounded-[50%] border border-border bg-background shadow-[0_0_0_8px_hsl(var(--border)/0.35),0_0_60px_hsl(var(--primary)/0.10)]" />
      <div className="relative flex flex-col items-center gap-1 text-center">
        <span className="text-[15px] font-semibold">{participants.length} {participants.length === 1 ? 'lugar ocupado' : 'lugares ocupados'}</span>
        <span className="text-[13px] text-muted-foreground">Quem entrar pelo link senta aqui</span>
      </div>
      {placed.map(({ x, y, p }, i) =>
        p ? (
          <span key={p.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={cn('relative rounded-full', p.id === currentUserId && 'ring-2 ring-primary ring-offset-2 ring-offset-card', !onlineIds.has(p.id) && 'opacity-50')}>
              <PersonAvatar name={p.nickname} userId={p.id} size="lg" />
            </span>
            <span className="max-w-[7rem] truncate text-xs font-semibold">{p.nickname.split(' ')[0]}</span>
          </span>
        ) : (
          <span key={`empty-${i}`} aria-hidden="true" className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-border" style={{ left: `${x}%`, top: `${y}%` }} />
        )
      )}
    </div>
  );
}

/** Facilitador, fila vazia: passos em trilha, a mesa com quem já chegou, o convite e, ao lado, quem está e como a sessão está. */
export function RoomWelcome({ deck, maxHours, deckLabel, roomTeam, participants, onlineIds, roomUrl, roomCode, currentUserId, votingCargos, onShare, onImportJira, onAddManual, onOpenSettings }: RoomWelcomeProps) {
  const { toast } = useToast();
  useJoinToasts(participants);

  const copyInline = async () => {
    if (await copyToClipboard(roomUrl)) toast({ title: 'Link copiado' });
    else onShare();
  };
  const votingLabels = votingCargos.map((c) => canonicalCargo(c) || c);
  const hasQaOnline = participants.some((p) => onlineIds.has(p.id) && getParticipantCategory(p) === 'QA');
  const hasDevOnline = participants.some((p) => onlineIds.has(p.id) && getParticipantCategory(p) === 'Developer');
  const missing = !hasDevOnline ? 'um DEV' : !hasQaOnline ? 'um QA' : null;

  // Atalhos do facilitador: I importar, N nova tarefa, S compartilhar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'i') { e.preventDefault(); onImportJira(); }
      else if (k === 'n') { e.preventDefault(); onAddManual(); }
      else if (k === 's') { e.preventDefault(); onShare(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onImportJira, onAddManual, onShare]);

  const STEP = 'flex items-center gap-2.5 rounded-xl px-3.5 py-3';
  return (
    <div className="grid h-full w-full gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Primeiros passos" className="flex min-w-0 flex-col gap-[18px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] font-extrabold leading-tight tracking-[-0.02em]">Sua sala está pronta</h1>
          <p className="m-0 text-[15px] text-muted-foreground">Chame o time e monte a fila. A votação começa quando a primeira tarefa entrar.</p>
        </div>

        <ol aria-label="Passos" className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 md:grid-cols-3">
          <li className={cn(STEP, 'border border-emerald-500/40 bg-emerald-500/5')}>
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white dark:text-emerald-950"><Check className="h-4 w-4" strokeWidth={2.25} /></span>
            <span className="flex min-w-0 flex-col"><span className="text-sm font-semibold">Sala criada</span><span className="truncate text-xs text-muted-foreground">{deckLabel}{roomTeam ? ` · ${roomTeam}` : ''}</span></span>
          </li>
          <li aria-current="step" className={cn(STEP, 'border-[1.5px] border-primary bg-primary/5')}>
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">2</span>
            <span className="flex min-w-0 flex-col"><span className="text-sm font-semibold">Chame o time e monte a fila</span><span className="text-xs text-muted-foreground">{participants.length} na sala · 0 tarefas</span></span>
          </li>
          <li className={cn(STEP, 'border border-dashed border-border')}>
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border text-sm font-extrabold text-muted-foreground"><Lock className="h-3.5 w-3.5" strokeWidth={1.5} /></span>
            <span className="flex min-w-0 flex-col"><span className="text-sm font-semibold text-muted-foreground">Comece a votar</span><span className="text-xs text-muted-foreground">Libera com a primeira tarefa</span></span>
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onImportJira} className={cn(BTN, 'w-auto bg-primary px-4 font-semibold text-primary-foreground room-glow hover:bg-primary/90', FOCUS_RING)}>
            <CloudDownload className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Importar do Jira <kbd className={KEY}>I</kbd>
          </button>
          <button type="button" onClick={onAddManual} className={cn(BTN, 'w-auto border border-border px-4 font-medium hover:bg-accent', FOCUS_RING)}>
            <ListPlus className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Adicionar manualmente <kbd className={KEY}>N</kbd>
          </button>
        </div>

        <MiniTable participants={participants} onlineIds={onlineIds} currentUserId={currentUserId} />

        <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-card px-[18px] py-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Chame o time</span>
            <span className="text-xs text-muted-foreground">Mande no chat da reunião</span>
          </span>
          <div className="flex h-[42px] min-w-[16rem] flex-1 items-center overflow-hidden rounded-[11px] border border-border bg-background">
            <label htmlFor="room-welcome-link" className="sr-only">Link da sala</label>
            <input id="room-welcome-link" readOnly value={roomUrl.replace(/^https?:\/\//, '')} onFocus={(e) => e.currentTarget.select()} className="h-[42px] min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-muted-foreground outline-none" />
            <button type="button" onClick={copyInline} className={cn('inline-flex h-[42px] items-center gap-2 border-l border-border bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90', FOCUS_RING)}>
              <Copy className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Copiar link
            </button>
          </div>
          {/* Código curto (salas antigas): dá para ditar. Os identificadores longos ficam só no link. */}
          {roomCode.length <= 12 && (
            <span className="flex flex-col items-center gap-0.5 rounded-[11px] border border-border px-3 py-1">
              <span className="text-xs text-muted-foreground">Código</span>
              <span className="font-mono text-[15px] font-medium tracking-[0.08em]">{roomCode}</span>
            </span>
          )}
          <button type="button" onClick={onShare} className={cn('inline-flex h-[42px] items-center gap-2 rounded-[11px] border border-border px-3.5 text-sm font-semibold hover:bg-accent', FOCUS_RING)}>
            <Share2 className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Convite e QR <kbd className={KEY}>S</kbd>
          </button>
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-3.5">
        <section aria-labelledby="room-welcome-people" className="flex flex-col gap-2">
          <h2 id="room-welcome-people" className="m-0 text-[15px] font-semibold">Na sala · {participants.length}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {participants.slice(0, 8).map((p) => {
              const votes = canParticipantVote(p, votingCargos);
              const role = canonicalCargo(p.globalRole) || 'Sem cargo';
              return (
                <li key={p.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
                  <span className="relative">
                    <PersonAvatar name={p.nickname} userId={p.id} size="md" />
                    {onlineIds.has(p.id) && <span aria-label="online" className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold">{p.nickname}{p.id === currentUserId ? ' (você)' : ''}</span>
                    <span className={cn('truncate text-xs', votes ? 'text-foreground/80' : 'text-muted-foreground')}>
                      {role} · {p.isFacilitator ? 'facilitador' : votes ? 'vota' : 'observa'}
                    </span>
                  </span>
                </li>
              );
            })}
            {participants.length > 8 && <li className="px-1 text-xs text-muted-foreground">+ {participants.length - 8} na sala</li>}
          </ul>
          {missing && <span className="text-xs leading-relaxed text-muted-foreground">Ainda falta {missing} online para votar.</span>}
        </section>

        <section aria-labelledby="room-welcome-config" className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card p-3.5">
          <div className="flex items-center">
            <h2 id="room-welcome-config" className="m-0 flex-1 text-sm font-semibold">Como a sessão está</h2>
            {onOpenSettings && (
              <button type="button" onClick={onOpenSettings} className={cn('rounded text-[13px] font-medium text-primary underline-offset-2 hover:underline [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}>
                Ajustar
              </button>
            )}
          </div>
          <dl className="m-0 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Baralho</dt>
            <dd className="m-0">{deckLabel}{deck === 'hours' && maxHours ? `, até ${maxHours}h` : ''}</dd>
            <dt className="text-muted-foreground">Quem vota</dt>
            <dd className="m-0">{votingLabels.length ? votingLabels.join(', ') : 'Desenvolvedor(a) e QA'}</dd>
            {roomTeam && (<><dt className="text-muted-foreground">Squad</dt><dd className="m-0 truncate">{roomTeam}</dd></>)}
          </dl>
        </section>
      </aside>
    </div>
  );
}

interface RoomWaitingProps {
  deck: DeckType;
  maxHours?: number | null;
  deckLabel: string;
  roomTeam?: string | null;
  participants: Participant[];
  onlineIds: Set<string>;
}

/** Participante: aguardando o facilitador montar a fila. */
export function RoomWaiting({ deck, maxHours, deckLabel, roomTeam, participants, onlineIds }: RoomWaitingProps) {
  const facilitator = participants.find((p) => p.isFacilitator);
  return (
    <div className="relative w-full max-w-xl text-center">
      <div aria-hidden="true" className="room-halo room-breathe pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2" />

      <CardFan deck={deck} maxHours={maxHours} />

      <div className="mt-2 flex flex-col items-center gap-3.5">
        <h2 className={cn('px-1 pb-1 text-4xl font-bold leading-[1.1] tracking-[-0.035em] sm:text-5xl')}>Boas-vindas à sala</h2>
        <div className="flex items-center gap-2">
          <StatusChip className="h-[26px] gap-1.5 px-2.5 text-xs"><ModuleIcon module="poker" className="h-3 w-3" /> {deckLabel}</StatusChip>
          {roomTeam && <span className="inline-flex h-[26px] items-center rounded-full border border-border px-2.5 text-xs font-semibold text-muted-foreground">{roomTeam}</span>}
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-border bg-card p-4">
        {participants.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {participants.slice(0, 6).map((p, i) => (
                <span key={p.id} className={cn('relative rounded-full border-2 border-card', i > 0 && '-ml-2', !onlineIds.has(p.id) && 'opacity-50')}>
                  <PersonAvatar name={p.nickname} userId={p.id} size="lg" />
                </span>
              ))}
              {participants.length > 6 && <span className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-bold text-muted-foreground">+{participants.length - 6}</span>}
            </div>
            <span className="text-[13px] text-muted-foreground">{participants.length} {participants.length === 1 ? 'pessoa na sala' : 'pessoas na sala'}</span>
          </div>
        )}
        {facilitator && (
          <span className="text-[13px] text-muted-foreground">
            Facilitador: <span className="font-semibold text-foreground">{facilitator.nickname}</span>
            {onlineIds.has(facilitator.id) ? ' · online' : ' · ausente'}
          </span>
        )}
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="Cartas do baralho">
          {getDeckCards(deck, maxHours).map((face) => (
            <span key={face} className="flex h-8 min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted/40 px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {face === '☕' ? 'café' : face}
            </span>
          ))}
        </div>
        <StatusChip dot className="h-8 px-4 text-xs">Aguardando início</StatusChip>
      </div>
    </div>
  );
}
