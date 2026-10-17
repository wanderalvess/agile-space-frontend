'use client';

import { useState } from 'react';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { FIELD, Modal } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { DEFAULT_HEALTH_CHECK_QUESTION } from '@/lib/retro-formats';
import type { HealthCheckAnswer } from '@/lib/types';

/** Limite do servidor para a nota livre do check-in. */
export const CHECKIN_NOTE_MAX = 500;

export const SCALE: { key: HealthCheckAnswer; label: string; icon: typeof Frown }[] = [
  { key: 'exhausted', label: 'Exausto', icon: Frown },
  { key: 'tired', label: 'Cansado', icon: Annoyed },
  { key: 'neutral', label: 'Neutro', icon: Meh },
  { key: 'good', label: 'Bem', icon: Smile },
  { key: 'great', label: 'Ótimo', icon: Laugh },
];

/** Nome do humor do check-in ("Cansado"), para mostrar a resposta de alguém. */
export function checkinAnswerLabel(answer: HealthCheckAnswer | undefined): string | null {
  return SCALE.find((s) => s.key === answer)?.label ?? null;
}

interface RetroHealthCheckGateProps {
  question?: string;
  /** A nota só vai junto com a resposta, e só se for preenchida. */
  onAnswer: (answer: HealthCheckAnswer, note?: string) => void | Promise<void>;
  /** Mostra o campo de nota livre (backend novo). Sem ele a janela é a de sempre. */
  allowNote?: boolean;
}

/**
 * Check-in mostrado uma vez, antes do quadro, quando o facilitador liga o check-in inicial. Não dá para
 * fechar sem responder. A resposta some assim que enviada: `currentUser.healthCheckAnswer` passa a existir e
 * a página para de renderizar isto. O histórico da retro mostra só a média do time.
 */
export function RetroHealthCheckGate({ question, onAnswer, allowNote = false }: RetroHealthCheckGateProps) {
  // Um clique só: sem isso, cliques repetidos enviavam várias respostas e a tela não dava retorno nenhum.
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const answer = async (key: HealthCheckAnswer) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const text = allowNote ? note.trim() : '';
      await (text ? onAnswer(key, text) : onAnswer(key));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={() => undefined}
      dismissible={false}
      preventClose
      size="md"
      title={question?.trim() || DEFAULT_HEALTH_CHECK_QUESTION}
      description="Sua resposta aparece só para o facilitador, resumida na média do time."
      className="text-center sm:max-w-[520px]"
    >
      {allowNote && (
        <div className="flex flex-col gap-1.5 pt-1 text-left">
          <label htmlFor="retro-checkin-note" className="text-[13px] font-semibold text-foreground">
            Quer contar mais? <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            id="retro-checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, CHECKIN_NOTE_MAX))}
            maxLength={CHECKIN_NOTE_MAX}
            rows={2}
            placeholder="Uma frase sobre como você chega na retro…"
            className={`${FIELD} min-h-[64px] resize-none py-2 text-[13px] leading-relaxed`}
          />
          <p className="m-0 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>Aparece com o seu nome, só para o facilitador.</span>
            <span className="tabular-nums" aria-live="polite">{note.length}/{CHECKIN_NOTE_MAX}</span>
          </p>
        </div>
      )}
      <div role="group" aria-label="Como você está" className="flex flex-wrap justify-center gap-2.5 pt-2">
        {SCALE.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => answer(key)}
            disabled={submitting}
            aria-label={label}
            className={cn(
              'group flex h-[76px] w-[68px] flex-col items-center justify-center gap-1.5 rounded-[14px] border border-border bg-muted/40 text-foreground transition-[transform,background-color,border-color] duration-fast',
              'hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/10 disabled:opacity-60 motion-reduce:hover:translate-y-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
          >
            <Icon className="h-[26px] w-[26px]" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
