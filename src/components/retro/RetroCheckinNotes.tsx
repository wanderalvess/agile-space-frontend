'use client';

import { MessageSquareQuote } from 'lucide-react';
import type { RetroParticipant } from '@/lib/types';
import { checkinAnswerLabel } from './RetroHealthCheckGate';

/** Quem escreveu uma nota no check-in e o que escreveu (nome, humor e texto). `[]` quando ninguém escreveu. */
export function checkinNotesOf(participants: readonly RetroParticipant[]): { id: string; name: string; mood: string | null; note: string }[] {
  return participants
    .map((p) => ({ id: p.id, name: p.nickname, mood: checkinAnswerLabel(p.healthCheckAnswer), note: (p.checkinNote ?? '').trim() }))
    .filter((p) => p.note !== '')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Notas livres do check-in, só para o facilitador (a tela dos demais nunca as mostra). Fica no painel de participantes.
 * Sem nenhuma nota (ou backend antigo, que não envia o campo), o bloco não aparece.
 */
export function RetroCheckinNotes({ participants }: { participants: readonly RetroParticipant[] }) {
  const notes = checkinNotesOf(participants);
  if (notes.length === 0) return null;
  return (
    <section aria-label="Notas do check-in" className="mx-3 mb-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
      <h3 className="m-0 flex items-center gap-2 text-[13px] font-bold">
        <MessageSquareQuote className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        Notas do check-in <span className="font-normal tabular-nums text-muted-foreground">({notes.length})</span>
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {notes.map((n) => (
          <li key={n.id} className="flex flex-col gap-0.5 text-[13px]">
            <span className="font-semibold">
              {n.name}
              {n.mood && <span className="font-normal text-muted-foreground"> · {n.mood}</span>}
            </span>
            <span className="whitespace-pre-wrap break-words leading-snug text-muted-foreground">{n.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
