'use client';

import { useMemo } from 'react';
import type { Vote, Participant, DeckType, TshirtEquivalent } from '@/lib/types';
import { getParticipantCategory, TECHNICAL_CATEGORIES, resolveTshirtHours } from '@/lib/poker-utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, MessageSquareQuote } from 'lucide-react';

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
    <Card className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="h-4 w-4 text-amber-600" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Explique os extremos
          </h3>
          <span className="text-[9px] font-bold text-amber-600/60 uppercase tracking-widest">quem votou mais alto e mais baixo, em 1 frase</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outliers.map(o => (
            <div key={o.category} className="p-3 rounded-xl bg-white/70 dark:bg-card/60 border border-amber-100/60 dark:border-amber-900/30">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{o.category}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TrendingDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{o.min.name}</span>
                  <span className="text-[10px] font-black text-blue-600">{o.min.value}{suffix}</span>
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1.5 min-w-0 justify-end">
                  <span className="text-[10px] font-black text-rose-600">{o.max.value}{suffix}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{o.max.name}</span>
                  <TrendingUp className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
