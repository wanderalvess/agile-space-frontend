'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, X } from 'lucide-react';

export interface RoomReaction { id: string; uid: string; emoji: string; ts: string; nickname?: string }

const EMOJIS = ['👍', '🎉', '🤔', '🔥', '❤️', '😮'];
const LIFETIME_MS = 4000;

/**
 * Reações (emoji) durante a votação. Antes era uma barra sempre aberta no canto
 * inferior-esquerdo que ficava POR CIMA do baralho; agora é um gatilho colapsado
 * (smiley) que abre a fileira só quando clicado e fecha ao escolher — footprint
 * mínimo sobre as cartas. Reusa a subcoleção rooms/{id}/reactions; puramente de
 * engajamento, não afeta a votação.
 */
export function ReactionOverlay({ reactions, onReact }: { reactions: RoomReaction[]; onReact: (emoji: string) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const recent = reactions.filter(r => {
    const t = new Date(r.ts).getTime();
    return !isNaN(t) && now - t < LIFETIME_MS;
  });

  return (
    <>
      {/* Camada flutuante — reações recebidas sobem pela borda esquerda e somem. */}
      <div className="fixed bottom-24 left-4 z-[55] pointer-events-none w-12 h-64 overflow-visible">
        <AnimatePresence>
          {recent.map((r, idx) => (
            <motion.div
              key={r.id}
              initial={{ y: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -160, opacity: [0, 1, 1, 0], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: LIFETIME_MS / 1000, ease: 'easeOut' }}
              className="absolute bottom-0 text-3xl drop-shadow"
              style={{ left: `${(idx % 3) * 12}px` }}
              title={r.nickname}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Gatilho colapsado + fileira que abre para a direita ao clicar. */}
      <div className="fixed bottom-6 left-6 z-[56] flex items-center gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Fechar reações' : 'Reagir'}
          aria-expanded={open}
          className="h-11 w-11 shrink-0 rounded-full bg-white/90 dark:bg-card/90 backdrop-blur-md border border-slate-200/70 dark:border-border shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          {open ? <X className="h-4 w-4 text-slate-500" /> : <Smile className="h-5 w-5 text-amber-500" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 bg-white/95 dark:bg-card/95 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-border shadow-lg px-2 py-1.5"
            >
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => { onReact(e); setOpen(false); }}
                  className="h-9 w-9 rounded-xl text-xl hover:bg-slate-100 dark:hover:bg-muted transition-all active:scale-90"
                  aria-label={`Reagir com ${e}`}
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
