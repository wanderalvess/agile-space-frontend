"use client";

import React, { useEffect, useRef } from 'react';
import { Check, CloudDownload, Copy, ListPlus, Lock, Play, Share2, WalletCards } from 'lucide-react';
import { DECKS, type DeckType, type Participant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FOCUS_RING, PersonAvatar, RoomQr, StatusChip, TITLE_GRADIENT } from '@/components/room-kit';

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

/** Leque de cartas do baralho da sala; abre em 320 ms e afasta no hover. */
function CardFan({ deck }: { deck: DeckType }) {
  const faces = FAN_FACES[deck] ?? DECKS[deck].slice(0, 5);
  return (
    <div className="group/fan relative mx-auto h-[190px] w-full max-w-[470px] select-none" aria-hidden="true">
      {faces.map((face, i) => {
        const hero = i === 2;
        return (
          <div
            key={`${face}-${i}`}
            className="absolute left-1/2 top-3 -ml-[47px] h-[132px] w-[94px] transition-transform duration-[320ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none"
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

function StepBadge({ n, state }: { n: number; state: 'done' | 'active' | 'locked' }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-[320ms]',
        state === 'done' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        state === 'active' && 'bg-primary text-primary-foreground room-glow-ring',
        state === 'locked' && 'border border-border bg-muted text-muted-foreground'
      )}
    >
      {state === 'done' ? <Check className="h-4 w-4" strokeWidth={1.75} /> : state === 'locked' ? <Lock className="h-3.5 w-3.5" strokeWidth={1.5} /> : n}
    </span>
  );
}

const STEP_CARD = 'relative flex h-full flex-col gap-4 rounded-[14px] border p-[22px] transition-colors duration-[320ms]';
const BTN = 'inline-flex h-[42px] w-full items-center justify-center gap-2.5 rounded-[10px] text-sm transition-[transform,background-color] duration-[140ms] hover:-translate-y-px motion-reduce:transform-none';
const KEY = 'rounded border border-current/30 px-1.5 py-px text-[11px] tabular-nums opacity-70';

interface RoomWelcomeProps {
  deck: DeckType;
  deckLabel: string;
  roomTeam?: string | null;
  participants: Participant[];
  onlineIds: Set<string>;
  roomUrl: string;
  onShare: () => void;
  onImportJira: () => void;
  onAddManual: () => void;
}

/** Facilitador, fila vazia: três passos para começar (convidar, montar a fila, votar). */
export function RoomWelcome({ deck, deckLabel, roomTeam, participants, onlineIds, roomUrl, onShare, onImportJira, onAddManual }: RoomWelcomeProps) {
  const { toast } = useToast();
  const others = participants.length > 1;
  const onlineCount = participants.filter((p) => onlineIds.has(p.id)).length;
  useJoinToasts(participants);

  const copyInline = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      toast({ title: 'Link copiado' });
    } catch {
      onShare();
    }
  };

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

  return (
    <div className="relative w-full max-w-[1080px] text-left">
      <div aria-hidden="true" className="room-halo room-breathe pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2" />

      <CardFan deck={deck} />

      <div className="mt-2 flex flex-col items-center gap-3.5 text-center">
        <h2 className={cn('px-1 pb-1 text-4xl font-bold leading-[1.1] tracking-[-0.035em] sm:text-5xl', TITLE_GRADIENT)}>Sua sala está pronta</h2>
        <div className="flex items-center gap-2">
          <StatusChip className="h-[26px] gap-1.5 px-2.5 text-xs"><WalletCards className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {deckLabel}</StatusChip>
          {roomTeam && <span className="inline-flex h-[26px] items-center rounded-full border border-border px-2.5 text-xs font-semibold text-muted-foreground">{roomTeam}</span>}
        </div>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-x-[18px] gap-y-1 p-0 text-[13px] text-muted-foreground" aria-label="Progresso da sala">
          <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" /> Sala criada</li>
          <li className="flex items-center gap-1.5">
            {others ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" /> : <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-primary" />}
            {others ? `${onlineCount} online agora` : 'Convide o time'}
          </li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-primary" /> Fila vazia</li>
        </ul>
      </div>

      <ol className="relative m-0 mt-8 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-3">
        <li aria-hidden="true" className="absolute left-[16%] right-[16%] top-[38px] hidden h-px bg-border md:block" />

        <li className="relative">
          <div className={cn(STEP_CARD, 'border-border bg-card')}>
            <div className="flex items-center gap-3">
              <StepBadge n={1} state={others ? 'done' : 'active'} />
              <h3 className="text-[17px] font-semibold">Convide o time</h3>
            </div>
            <div className="flex items-center gap-3.5">
              <RoomQr url={roomUrl} size={104} />
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex items-center">
                  {participants.slice(0, 5).map((p, i) => (
                    <span key={p.id} className={cn('relative rounded-full border-2 border-card', i > 0 && '-ml-2', !onlineIds.has(p.id) && 'opacity-50')}>
                      <PersonAvatar name={p.nickname} size="md" />
                    </span>
                  ))}
                  {participants.length > 5 && <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[11px] font-bold text-muted-foreground">+{participants.length - 5}</span>}
                </div>
                <span className="text-[13px] leading-snug text-muted-foreground">
                  {participants.length > 1 ? `${participants.length} já entraram · ${onlineCount} online` : 'Ninguém entrou ainda.'}
                  <br />Aponte a câmera ou copie o link.
                </span>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <button type="button" onClick={copyInline} className={cn(BTN, 'bg-primary font-semibold text-primary-foreground room-glow hover:bg-primary/90', FOCUS_RING)}>
                <Copy className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Copiar link
              </button>
              <button type="button" onClick={onShare} className={cn(BTN, 'border border-border font-medium hover:bg-accent', FOCUS_RING)}>
                <Share2 className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Mais opções <kbd className={KEY}>S</kbd>
              </button>
            </div>
          </div>
        </li>

        <li className="relative">
          <div className={cn(STEP_CARD, 'border-primary/50 bg-card shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] [.theme-leitura_&]:shadow-none')}>
            <div className="flex items-center gap-3">
              <StepBadge n={2} state="active" />
              <h3 className="text-[17px] font-semibold">Monte a fila</h3>
            </div>
            <p className="m-0 text-[13px] leading-normal text-muted-foreground">Importe do Jira ou adicione tarefas à mão. A primeira já cai na mesa.</p>
            <div className="mt-auto flex flex-col gap-2">
              <button type="button" onClick={onImportJira} className={cn(BTN, 'bg-primary font-semibold text-primary-foreground room-glow hover:bg-primary/90', FOCUS_RING)}>
                <CloudDownload className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Importar do Jira <kbd className={KEY}>I</kbd>
              </button>
              <button type="button" onClick={onAddManual} className={cn(BTN, 'border border-border font-medium hover:bg-accent', FOCUS_RING)}>
                <ListPlus className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Adicionar manualmente <kbd className={KEY}>N</kbd>
              </button>
            </div>
          </div>
        </li>

        <li className="relative">
          <div className={cn(STEP_CARD, 'border-dashed border-border bg-muted/40')}>
            <div className="flex items-center gap-3">
              <StepBadge n={3} state="locked" />
              <h3 className="text-[17px] font-semibold text-muted-foreground">Comece a votar</h3>
            </div>
            <p className="m-0 text-[13px] leading-normal text-muted-foreground">Com o time reunido, inicie. O timer e o tempo de cada tarefa contam a partir daí, e o baralho abre para todos.</p>
            <span className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Play className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Libera quando houver uma tarefa na fila
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}

interface RoomWaitingProps {
  deck: DeckType;
  deckLabel: string;
  roomTeam?: string | null;
  participants: Participant[];
  onlineIds: Set<string>;
}

/** Participante: aguardando o facilitador montar a fila. */
export function RoomWaiting({ deck, deckLabel, roomTeam, participants, onlineIds }: RoomWaitingProps) {
  const facilitator = participants.find((p) => p.isFacilitator);
  return (
    <div className="relative w-full max-w-xl text-center">
      <div aria-hidden="true" className="room-halo room-breathe pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2" />

      <CardFan deck={deck} />

      <div className="mt-2 flex flex-col items-center gap-3.5">
        <h2 className={cn('px-1 pb-1 text-4xl font-bold leading-[1.1] tracking-[-0.035em] sm:text-5xl', TITLE_GRADIENT)}>Boas-vindas à sala</h2>
        <div className="flex items-center gap-2">
          <StatusChip className="h-[26px] gap-1.5 px-2.5 text-xs"><WalletCards className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {deckLabel}</StatusChip>
          {roomTeam && <span className="inline-flex h-[26px] items-center rounded-full border border-border px-2.5 text-xs font-semibold text-muted-foreground">{roomTeam}</span>}
        </div>
        <p className="m-0 max-w-sm text-sm leading-relaxed text-muted-foreground">Aguardando o início. Quando a primeira tarefa entrar na mesa, suas cartas aparecem aqui.</p>
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-border bg-card p-4">
        {participants.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {participants.slice(0, 6).map((p, i) => (
                <span key={p.id} className={cn('relative rounded-full border-2 border-card', i > 0 && '-ml-2', !onlineIds.has(p.id) && 'opacity-50')}>
                  <PersonAvatar name={p.nickname} size="lg" />
                </span>
              ))}
              {participants.length > 6 && <span className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-muted text-[11px] font-bold text-muted-foreground">+{participants.length - 6}</span>}
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
          {(DECKS[deck] ?? []).map((face) => (
            <span key={face} className="flex h-8 min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted/40 px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {face === '☕' ? 'café' : face}
            </span>
          ))}
        </div>
        <StatusChip dot className="h-8 px-4 text-xs">Aguardando início</StatusChip>
      </div>
    </div>
  );
}
