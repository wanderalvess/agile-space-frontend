"use client";

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, CloudDownload, Copy, ListPlus, Lock, Play, WalletCards, Zap } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DECKS, type DeckType, type Participant } from '@/lib/types';
import { cn } from '@/lib/utils';

// Cartas exibidas no leque de boas-vindas, por baralho (a do meio é a destacada).
const FAN_FACES: Record<DeckType, readonly string[]> = {
  fibonacci: ['3', '5', '8', '13', '☕'],
  hours: ['2', '4', '8', '16', '☕'],
  tshirt: ['PP', 'P', 'M', 'G', 'GG'],
};

// Rotação (graus) e deslocamento X (px) de cada carta no leque.
const FAN_ROTATE = [-18, -9, 0, 9, 18];
const FAN_X = [-132, -66, 0, 66, 132];
const FAN_Y = [26, 8, 0, 8, 26];

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

interface RoomWelcomeProps {
  deck: DeckType;
  deckLabel: string;
  roomTeam?: string | null;
  participants: Participant[];
  onlineIds: Set<string>;
  onShare: () => void;
  onImportJira: () => void;
  onAddManual: () => void;
}

function CardFan({ deck }: { deck: DeckType }) {
  const reduce = useReducedMotion();
  const faces = FAN_FACES[deck] ?? DECKS[deck].slice(0, 5);

  return (
    <motion.div
      className="relative mx-auto h-44 w-full max-w-md select-none"
      initial="rest"
      animate="fan"
      whileHover="spread"
      aria-hidden
    >
      {/* halo atrás do leque */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/25 blur-3xl dark:bg-indigo-500/30" />
      {faces.map((face, i) => {
        const isHero = i === 2;
        return (
          <motion.div
            key={`${face}-${i}`}
            className="absolute left-1/2 top-4 h-32 w-[5.25rem] -ml-[2.625rem]"
            style={{ zIndex: isHero ? 10 : 5 - Math.abs(i - 2), transformOrigin: '50% 140%' }}
            variants={{
              rest: { opacity: 0, x: 0, y: 40, rotate: 0, scale: 0.8 },
              fan: {
                opacity: 1,
                x: FAN_X[i],
                y: FAN_Y[i],
                rotate: FAN_ROTATE[i],
                scale: 1,
                transition: { type: 'spring', stiffness: 120, damping: 14, delay: 0.1 + i * 0.07 },
              },
              spread: {
                x: FAN_X[i] * 1.28,
                y: FAN_Y[i] - (isHero ? 14 : 0),
                rotate: FAN_ROTATE[i] * 1.2,
                transition: { type: 'spring', stiffness: 220, damping: 16 },
              },
            }}
          >
            <motion.div
              className={cn(
                'relative flex h-full w-full items-center justify-center rounded-xl border shadow-xl',
                isHero
                  ? 'border-white/30 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-indigo-600/40'
                  : 'border-slate-200 bg-gradient-to-br from-white to-slate-100 text-slate-700 shadow-slate-900/10 dark:border-white/10 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200 dark:shadow-black/40',
              )}
              animate={reduce || !isHero ? undefined : { y: [0, -7, 0] }}
              transition={reduce ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="absolute left-2 top-1.5 text-[11px] font-black leading-none opacity-70">{face}</span>
              <span className="absolute bottom-1.5 right-2 rotate-180 text-[11px] font-black leading-none opacity-70">{face}</span>
              <span className={cn('font-black italic tracking-tighter', face.length > 2 ? 'text-2xl' : 'text-4xl')}>{face}</span>
              {isHero && (
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0 opacity-60" />
              )}
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function StepBadge({ n, state }: { n: number; state: 'done' | 'active' | 'locked' }) {
  return (
    <span
      className={cn(
        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
        state === 'done' && 'bg-emerald-500 text-white',
        state === 'active' && 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40',
        state === 'locked' && 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
      )}
    >
      {state === 'active' && <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/40" />}
      <span className="relative">{state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'locked' ? <Lock className="h-3 w-3" /> : n}</span>
    </span>
  );
}

const stepCard =
  'relative flex h-full flex-col gap-3 rounded-2xl border p-4 text-left backdrop-blur transition-all duration-300';

export function RoomWelcome({
  deck,
  deckLabel,
  roomTeam,
  participants,
  onlineIds,
  onShare,
  onImportJira,
  onAddManual,
}: RoomWelcomeProps) {
  const others = participants.length > 1;
  const stepItem = (i: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.45 + i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  });

  return (
    <div className="relative w-full max-w-4xl">
      {/* aurora ambiente */}
      <div className="pointer-events-none absolute -inset-x-20 -top-10 bottom-0 -z-10 overflow-hidden" aria-hidden>
        <div className="animate-aurora-drift absolute left-[8%] top-0 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="animate-aurora-drift absolute right-[8%] top-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <CardFan deck={deck} />

      {/* HERO */}
      <motion.div
        className="mt-3 space-y-3 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h2 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text inline-block px-2 pb-1.5 pt-1 text-3xl font-black uppercase italic leading-tight tracking-tighter text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300 sm:text-5xl">
          Sua sala está pronta
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400">
            <WalletCards className="h-3 w-3" /> {deckLabel}
          </span>
          {roomTeam && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              {roomTeam}
            </span>
          )}
          <span className="text-[11px] font-medium text-slate-500 dark:text-muted-foreground/80">
            Dois passos e a primeira rodada começa.
          </span>
        </div>
      </motion.div>

      {/* PASSOS */}
      <div className="relative mt-7">
        {/* trilho que conecta os passos (desktop) */}
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-[2.1rem] hidden h-px md:block" aria-hidden>
          <div className="h-full w-full bg-gradient-to-r from-indigo-500/60 via-indigo-400/30 to-slate-300/30 dark:to-slate-700/40" />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
          <motion.div {...stepItem(0)}>
            <div className={cn(stepCard, 'border-slate-100 bg-white/90 shadow-[0_20px_50px_-24px_rgba(79,70,229,0.35)] hover:-translate-y-0.5 hover:border-indigo-300/60 dark:border-border/60 dark:bg-card/80')}>
              <div className="flex items-center gap-2.5">
                <StepBadge n={1} state={others ? 'done' : 'active'} />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-foreground">Convide o time</h3>
              </div>
              {participants.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 -space-x-3">
                    {participants.slice(0, 5).map(p => {
                      const online = onlineIds.has(p.id);
                      return (
                        <span key={p.id} className="relative">
                          <Avatar className={cn('h-8 w-8 border-2 border-white dark:border-card', !online && 'opacity-50')}>
                            <AvatarFallback className="bg-indigo-100 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {getInitials(p.nickname)}
                            </AvatarFallback>
                          </Avatar>
                          {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-card" />}
                        </span>
                      );
                    })}
                    {participants.length > 5 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-black text-slate-500 dark:border-card dark:bg-slate-800 dark:text-slate-400">
                        +{participants.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground">
                    {participants.length} já {participants.length === 1 ? 'entrou' : 'entraram'}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-medium italic text-slate-400 dark:text-muted-foreground/70">Ninguém entrou ainda</span>
              )}
              <Button
                size="sm"
                onClick={onShare}
                className="mt-auto h-9 w-full rounded-xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700"
              >
                <Copy className="mr-2 h-3.5 w-3.5" /> Compartilhar Sala
              </Button>
            </div>
          </motion.div>

          <motion.div {...stepItem(1)}>
            <div className={cn(stepCard, 'border-indigo-300/70 bg-white/95 shadow-[0_24px_60px_-22px_rgba(79,70,229,0.55)] ring-1 ring-indigo-500/20 hover:-translate-y-0.5 dark:border-indigo-500/40 dark:bg-card/90')}>
              <div className="flex items-center gap-2.5">
                <StepBadge n={2} state="active" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-foreground">Monte a fila</h3>
              </div>
              <p className="-mt-1 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-muted-foreground">
                Importe direto do Jira ou adicione tarefas manualmente.
              </p>
              <div className="mt-auto flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={onImportJira}
                  className="h-auto min-h-9 w-full whitespace-normal rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2 text-[10px] font-black uppercase leading-tight tracking-widest text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-700 hover:to-violet-700"
                >
                  <CloudDownload className="mr-2 h-3.5 w-3.5" /> Importar do Jira
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddManual}
                  className="h-auto min-h-8 w-full whitespace-normal rounded-xl border-indigo-200 py-2 text-[10px] font-black uppercase leading-tight tracking-widest text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                >
                  <ListPlus className="mr-2 h-3.5 w-3.5" /> Adicionar Manualmente
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div {...stepItem(2)}>
            <div className={cn(stepCard, 'border-dashed border-slate-200 bg-slate-50/60 dark:border-border/60 dark:bg-slate-900/30')}>
              <div className="flex items-center gap-2.5">
                <StepBadge n={3} state="locked" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-muted-foreground">Comece a votar</h3>
              </div>
              <p className="text-[11px] font-medium leading-relaxed text-slate-400 dark:text-muted-foreground/70">
                A primeira tarefa adicionada já cai na mesa — a votação começa automaticamente, sem passo extra.
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Play className="h-3 w-3" /> Libera sozinho
              </span>
            </div>
          </motion.div>
        </div>
      </div>
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

// Visão do participante enquanto o facilitador ainda não montou a fila.
export function RoomWaiting({ deck, deckLabel, roomTeam, participants, onlineIds }: RoomWaitingProps) {
  return (
    <div className="relative w-full max-w-xl">
      <div className="pointer-events-none absolute -inset-x-16 -top-10 bottom-0 -z-10 overflow-hidden" aria-hidden>
        <div className="animate-aurora-drift absolute left-[10%] top-0 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="animate-aurora-drift absolute right-[10%] top-20 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <CardFan deck={deck} />

      <motion.div
        className="mt-3 space-y-4 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h2 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text inline-block px-2 pb-1.5 pt-1 text-3xl font-black uppercase italic leading-tight tracking-tighter text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300 sm:text-5xl">
          Boas-vindas à sala
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400">
            <WalletCards className="h-3 w-3" /> {deckLabel}
          </span>
          {roomTeam && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              {roomTeam}
            </span>
          )}
        </div>
        <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-slate-500 dark:text-muted-foreground">
          O facilitador está montando a fila. Assim que a primeira tarefa entrar na mesa, suas cartas aparecem aqui para votar.
        </p>
      </motion.div>

      <motion.div
        className="mx-auto mt-6 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-[0_20px_50px_-24px_rgba(79,70,229,0.35)] backdrop-blur dark:border-border/60 dark:bg-card/80"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {participants.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 -space-x-3">
              {participants.slice(0, 6).map(p => {
                const online = onlineIds.has(p.id);
                return (
                  <span key={p.id} className="relative">
                    <Avatar className={cn('h-9 w-9 border-2 border-white dark:border-card', !online && 'opacity-50')}>
                      <AvatarFallback className="bg-indigo-100 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        {getInitials(p.nickname)}
                      </AvatarFallback>
                    </Avatar>
                    {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-card" />}
                  </span>
                );
              })}
              {participants.length > 6 && (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-black text-slate-500 dark:border-card dark:bg-slate-800 dark:text-slate-400">
                  +{participants.length - 6}
                </div>
              )}
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground">
              {participants.length} {participants.length === 1 ? 'pessoa na sala' : 'pessoas na sala'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 dark:bg-indigo-950/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Aguardando início</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-muted-foreground/70">
          <Zap className="h-3 w-3" /> A tela atualiza sozinha, não precisa recarregar.
        </span>
      </motion.div>
    </div>
  );
}
