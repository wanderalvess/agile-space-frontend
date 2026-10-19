'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Layers, ArrowRight, TrendingUp } from 'lucide-react';
import { ShowcaseSession } from './types';
import { getDirectImageUrl, imageBackgroundCss, isImageBackground } from './utils';
import { cn } from '@/lib/utils';
import { DANGER_HOVER } from '@/components/room-kit/tokens';

interface ShowcaseCoverProps {
  session: ShowcaseSession;
  onStart: () => void;
  onClose: () => void;
  isLight?: boolean;
}

/** Capa do Modo Teatro: squad, nome, período, nº de cards, "Iniciar apresentação", objetivo da sprint e pauta. */
export function ShowcaseCover({ session, onStart, onClose, isLight }: ShowcaseCoverProps) {
  const [bgLoaded, setBgLoaded] = useState(true);

  const totalTasks = session.tasks?.length || 0;
  const metricsCards = session.tasks?.filter(t => t.cardKind === 'metrics').length || 0;
  const storiesCount = session.tasks?.filter(t => {
    const tp = (t.type || '').toLowerCase();
    return tp.includes('história') || tp.includes('historia') || tp.includes('story') || tp.includes('recurso');
  }).length || 0;

  const mute = 'text-muted-foreground';
  // O fundo escolhido em Configurações > Apresentação manda na capa; a foto só aparece enquanto nenhum fundo foi escolhido.
  const coverPhoto = session.coverImage;
  const showPhoto = Boolean(coverPhoto) && bgLoaded && !session.presentationBackground;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('relative flex h-full w-full flex-col overflow-hidden', isLight ? 'bg-card' : 'bg-[#001824]')}
    >
      {/* Fundo */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {showPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDirectImageUrl(coverPhoto ?? '')}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              alt=""
              onError={() => setBgLoaded(false)}
            />
            {/* Véu (cores do palco claro/escuro) para garantir contraste e leitura */}
            <div className={cn('absolute inset-0 bg-gradient-to-r to-transparent', 'from-background/95 via-background/80')} />
            <div className={cn('absolute inset-0 bg-gradient-to-t via-transparent to-transparent', 'from-background/90')} />
          </>
        ) : (
          <div
            className={cn('relative h-full w-full overflow-hidden', isLight ? 'bg-muted' : 'bg-[#001824]')}
            style={session.presentationBackground ? {
              background: isImageBackground(session.presentationBackground)
                ? imageBackgroundCss(session.presentationBackground)
                : session.presentationBackground,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
          >
            <div className={cn('absolute inset-0', isLight ? 'bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.03),transparent_60%)]' : 'bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.08),transparent_60%)]')} />
            <div className="absolute bottom-0 right-0 h-[800px] w-[800px] translate-x-1/2 translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
          </div>
        )}
      </div>

      {/* Sair do Modo Teatro */}
      <div className="absolute right-4 top-4 z-50 sm:right-8 sm:top-8">
        <button
          type="button"
          onClick={onClose}
          title="Sair do Modo Teatro"
          aria-label="Sair do Modo Teatro"
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isLight
              ? `border-border bg-card/80 text-foreground shadow-sm ${DANGER_HOVER}`
              : `border-border bg-foreground/5 text-muted-foreground ${DANGER_HOVER}`
          )}
        >
          <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 flex w-full flex-1 flex-col justify-center overflow-y-auto py-16">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-10 px-6 sm:px-10 md:px-20 lg:grid-cols-12 lg:gap-16">
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col gap-8 lg:col-span-7"
          >
            <div className="flex flex-col gap-3">
              {session.squadName && (
                <div className={cn(
                  'inline-flex w-fit items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold backdrop-blur-md',
                  isLight ? 'border-border bg-muted text-foreground' : 'border-border bg-foreground/10 text-foreground'
                )}>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
                  {session.squadName}
                </div>
              )}
              <h1
                className={cn('m-0 break-words font-bold leading-[0.95] tracking-tight drop-shadow-xl', 'text-foreground')}
                style={{ fontSize: 'clamp(2.25rem, 5.5vw, 5.5rem)' }}
              >
                {session.name || 'Review'}
              </h1>
              <div aria-hidden="true" className="mt-4 h-1.5 w-20 rounded-full bg-primary" />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className={cn('text-xs font-semibold', mute)}>Ciclo / período</span>
                <span className={cn('mt-0.5 text-xl font-bold tracking-tight', 'text-foreground')}>
                  {session.period || session.sprintName || 'Sprint atual'}
                </span>
              </div>
              {totalTasks > 0 && (
                <>
                  <div className={cn('h-8 w-px', isLight ? 'bg-muted' : 'bg-foreground/15')} aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className={cn('text-xs font-semibold', mute)}>Entregas prontas</span>
                    <span className={cn('mt-0.5 text-xl font-bold tabular-nums', isLight ? 'text-foreground' : 'text-cyan-300')}>
                      {totalTasks} {totalTasks === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="pt-2">
              <button
                type="button"
                onClick={onStart}
                className="group inline-flex h-16 items-center gap-3 rounded-2xl bg-primary px-10 text-base font-semibold text-primary-foreground shadow-2xl transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <span>Iniciar apresentação</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </motion.div>
          </motion.div>

          {/* Briefing da sessão */}
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              'flex flex-col gap-6 rounded-[2rem] border p-6 shadow-2xl backdrop-blur-3xl md:p-10 lg:col-span-5',
              isLight ? 'border-border bg-card/95 shadow-black/10' : 'border-border bg-background/90 shadow-black/60'
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <Target className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
                <span className={cn('text-xs font-semibold', mute)}>Objetivo da sprint</span>
              </div>
              <p className={cn('m-0 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-primary/60 py-1 pl-4 text-base font-medium leading-relaxed md:text-lg', 'text-foreground')}>
                {session.description || 'Demonstração técnica dos incrementos e entregas realizados durante o ciclo para validação dos stakeholders.'}
              </p>
            </div>

            {totalTasks > 0 && (
              <div className={cn('grid grid-cols-2 gap-3 border-t pt-4', 'border-border')}>
                <div className={cn('rounded-2xl border p-3.5', isLight ? 'border-border bg-muted/80' : 'border-border bg-foreground/[0.03]')}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                    <span className={cn('text-xs font-semibold', mute)}>Pauta da cerimônia</span>
                  </div>
                  <p className={cn('m-0 text-xl font-bold tabular-nums', 'text-foreground')}>
                    {totalTasks} <span className="text-xs font-normal text-muted-foreground">cards</span>
                  </p>
                </div>
                <div className={cn('rounded-2xl border p-3.5', isLight ? 'border-border bg-muted/80' : 'border-border bg-foreground/[0.03]')}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <TrendingUp className={cn('h-3.5 w-3.5', isLight ? 'text-emerald-700' : 'text-emerald-400')} strokeWidth={1.5} aria-hidden="true" />
                    <span className={cn('text-xs font-semibold', mute)}>Tipo dominante</span>
                  </div>
                  <p className="m-0 mt-1 truncate text-sm font-bold text-foreground">
                    {storiesCount > 0 ? `${storiesCount} histórias` : metricsCards > 0 ? `${metricsCards} métricas` : 'Funcionalidades'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
