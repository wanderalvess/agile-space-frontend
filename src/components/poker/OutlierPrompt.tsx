'use client';

import { useMemo } from 'react';
import type { Vote, Participant, DeckType, TshirtEquivalent } from '@/lib/types';
import { getParticipantCategory, TECHNICAL_CATEGORIES, resolveTshirtHours, formatRoleForCopy } from '@/lib/poker-utils';
import { MessageSquareQuote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_STYLES, roleToneOf } from '@/components/room-kit';

interface OutlierPromptProps {
  votes: Vote[];
  participants: Participant[];
  deck: DeckType;
  // Presente = t-shirt calcula de verdade (horas), então outlier também
  // passa a fazer sentido nesse deck. Ausente = comportamento histórico
  // (outlier desligado pra t-shirt, só moda categórica).
  tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>;
}

/**
 * Ritual de refinamento: ao revelar, destaca o MAIOR e o MENOR votante de cada
 * categoria técnica (quando há divergência real de valores) pedindo uma
 * justificativa em uma frase. Faz sentido em decks numéricos (horas /
 * fibonacci) e em t-shirt quando o facilitador configurou equivalência.
 * Puramente visual — não persiste nada.
 */
export function OutlierPrompt({ votes, participants, deck, tshirtEquivalents }: OutlierPromptProps) {
  const tshirtCalculating = deck === 'tshirt' && !!tshirtEquivalents && Object.keys(tshirtEquivalents).length > 0;

  const outliers = useMemo(() => {
    if (deck === 'tshirt' && !tshirtCalculating) return [];
    const pMap = new Map(participants.map(p => [p.id, p]));

    return TECHNICAL_CATEGORIES.map(category => {
      // Votos numéricos da categoria (identidade viva ou congelada no voto).
      const entries = votes
        .map(v => {
          const p = pMap.get(v.participantId);
          const cat = p
            ? getParticipantCategory(p)
            : (v.participantRole ? getParticipantCategory({ role: v.participantRole, globalRole: v.participantGlobalRole }) : null);
          const num = deck === 'tshirt' ? resolveTshirtHours(v.value, tshirtEquivalents) : Number(v.value);
          const name = p?.nickname || v.participantNickname || 'Participante';
          return cat === category && !isNaN(num) ? { name, value: num } : null;
        })
        .filter((e): e is { name: string; value: number } => e !== null);

      if (entries.length < 2) return null;
      const max = entries.reduce((a, b) => (b.value > a.value ? b : a));
      const min = entries.reduce((a, b) => (b.value < a.value ? b : a));
      // Sem divergência (todos iguais) => nada a explicar.
      if (max.value === min.value) return null;
      return { category, max, min };
    }).filter(Boolean) as { category: string; max: { name: string; value: number }; min: { name: string; value: number } }[];
  }, [votes, participants, deck, tshirtCalculating, tshirtEquivalents]);

  if (outliers.length === 0) return null;

  const suffix = deck === 'hours' || tshirtCalculating ? 'h' : '';

  return (
    <section aria-label="Ouça os extremos" className="room-rise flex flex-col gap-3 rounded-[14px] border border-border bg-card p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <MessageSquareQuote className="h-4 w-4 text-amber-600 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
          Ouça os extremos
        </h2>
        <p className="m-0 text-[13px] text-muted-foreground">Quem votou mais alto e mais baixo explica em uma frase.</p>
      </div>
      <div className="flex flex-col gap-3">
        {outliers.map(o => (
          <div key={o.category} className="flex flex-col gap-2">
            <span className={cn('text-[11px] font-bold', ROLE_STYLES[roleToneOf(o.category)].text)}>{formatRoleForCopy(o.category)}</span>
            {[o.min, o.max].map((x, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
                <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-amber-500/60 bg-amber-500/10 text-[15px] font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {x.value}{suffix}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-semibold">{x.name}</span>
                  <span className="text-xs text-muted-foreground">{i === 0 ? 'Votou mais baixo' : 'Votou mais alto'}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
