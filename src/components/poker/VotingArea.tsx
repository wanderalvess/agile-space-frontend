
'use client';

import type { Participant, Vote } from '@/lib/types';
import { ParticipantCard } from './ParticipantCard';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getParticipantCategory } from '@/lib/poker-utils';

interface VotingAreaProps {
  participants: Participant[];
  votes: Vote[];
  votesRevealed: boolean;
  divergences?: Map<string, 'warning' | 'destructive' | 'none'>;
  // Opt-in (facilitador): quebra as cartas em blocos por papel, com cabeçalho
  // por cargo. Default false = grade única.
  groupByRole?: boolean;
}

// Ordem canônica dos blocos e o acento de cor (alinhado ao Relatório por papel).
const CATEGORY_ORDER = ['Developer', 'QA', 'UX', 'Designer', 'Management', 'Outros'] as const;
const CATEGORY_ACCENT: Record<string, string> = {
  Developer: 'bg-indigo-500', QA: 'bg-pink-500', UX: 'bg-violet-500', Designer: 'bg-emerald-500', Management: 'bg-slate-400', Outros: 'bg-slate-400',
};
const CATEGORY_LABEL: Record<string, string> = { Management: 'Gestão', Outros: 'Outros' };

const GRID_CLS = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(95px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(115px,1fr))]';

export function VotingArea({ participants, votes, votesRevealed, divergences = new Map(), groupByRole = false }: VotingAreaProps) {
  const votesByParticipant = useMemo(() => {
    return new Map(votes.map(v => [v.participantId, v]));
  }, [votes]);

  const votingParticipants = useMemo(() => participants.filter(p => p.role !== 'spectator'), [participants]);

  // Blocos por cargo, na ordem canônica; papéis sem categoria caem em "Outros".
  const groups = useMemo(() => {
    if (!groupByRole) return null;
    const byCat = new Map<string, Participant[]>();
    votingParticipants.forEach(p => {
      const cat = getParticipantCategory(p) || 'Outros';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(p);
    });
    const ordered: [string, Participant[]][] = [];
    CATEGORY_ORDER.forEach(c => { if (byCat.has(c)) { ordered.push([c, byCat.get(c)!]); byCat.delete(c); } });
    byCat.forEach((ps, c) => ordered.push([c, ps])); // categorias inesperadas ao final
    return ordered;
  }, [groupByRole, votingParticipants]);

  const renderCard = (participant: Participant) => (
    <ParticipantCard
      key={participant.id}
      participant={participant}
      vote={votesByParticipant.get(participant.id)}
      isRevealed={votesRevealed}
      divergenceLevel={divergences.get(participant.id) || 'none'}
    />
  );

  if (!groups) {
    return <div className={GRID_CLS}>{votingParticipants.map(renderCard)}</div>;
  }

  return (
    <div className="space-y-5">
      {groups.map(([cat, ps]) => (
        <div key={cat} className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className={cn('w-1.5 h-4 rounded-full shrink-0', CATEGORY_ACCENT[cat] || 'bg-slate-400')} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {CATEGORY_LABEL[cat] || cat}
            </span>
            <span className="text-[9px] font-black text-slate-400 shrink-0">· {ps.length}</span>
            <span className="flex-1 h-px bg-slate-100 dark:bg-border/40" />
          </div>
          <div className={GRID_CLS}>{ps.map(renderCard)}</div>
        </div>
      ))}
    </div>
  );
}
