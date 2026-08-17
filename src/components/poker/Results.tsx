"use client";

import { useMemo } from 'react';
import type { Vote, Participant, DeckType, TshirtEquivalent } from '@/lib/types';
import { TSHIRT_UNIT_LABELS } from '@/lib/types';
import { getParticipantCategory, TECHNICAL_CATEGORIES, calculateRoleEfforts, TechnicalCategory, formatRoleForCopy, getEligibleStatsVotes, resolveTshirtHours } from '@/lib/poker-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Trophy, Copy, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ResultsProps {
  votes: Vote[];
  participants: Participant[];
  deck: DeckType;
  allowManagementToVote?: boolean;
  // Equivalência numérica configurada pelo facilitador (ex: PP=4 horas) — só
  // usada quando deck === 'tshirt'. Presente = resultado calculado de verdade
  // (média em horas). Ausente = comportamento histórico (moda).
  tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>;
}

export function Results({ votes, participants, deck, allowManagementToVote = false, tshirtEquivalents }: ResultsProps) {
  const { toast } = useToast();

  const stats = useMemo(() => {
    // Consenso/média/piso/teto só sobre votos técnicos — gestão e espectador
    // não entram (o detalhamento por papel abaixo já os exclui).
    const eligibleVotes = getEligibleStatsVotes(votes, participants, allowManagementToVote);
    const allVoteValues = eligibleVotes.map(v => v.value);
    const numericVotes = allVoteValues
      .filter((v): v is string => v !== null && !isNaN(Number(v)))
      .map(Number);

    const consensus = allVoteValues.length > 1 && new Set(allVoteValues).size === 1;

    let avg = 'N/A', min = 'N/A', max = 'N/A';
    let tshirtNumeric = false;

    const efforts = calculateRoleEfforts(votes, participants, deck, tshirtEquivalents);
    const totalHours = efforts.totalPoints;

    const T_SHIRT_ORDER = ['PP', 'P', 'M', 'G', 'GG'];

    if (allVoteValues.length > 0) {
      if (deck === 'tshirt') {
        // Equivalência configurada: calcula média/piso/teto de verdade em
        // horas, igual deck numérico. Só entram votos com tamanho mapeado.
        const numericTshirtVotes = allVoteValues
          .map(v => resolveTshirtHours(v, tshirtEquivalents))
          .filter(n => !isNaN(n));

        if (numericTshirtVotes.length > 0) {
          tshirtNumeric = true;
          const sum = numericTshirtVotes.reduce((acc, val) => acc + val, 0);
          avg = String(Math.ceil(sum / numericTshirtVotes.length));
          min = String(Math.min(...numericTshirtVotes));
          max = String(Math.max(...numericTshirtVotes));
        } else {
          // Sem equivalência (ou nenhum voto cobre um tamanho mapeado):
          // comportamento histórico — moda categórica.
          const validTshirtVotes = allVoteValues.filter(v => T_SHIRT_ORDER.includes(v));

          if (validTshirtVotes.length > 0) {
            const voteCounts = validTshirtVotes.reduce((acc, value) => {
              acc[value] = (acc[value] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            avg = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);

            const indexes = validTshirtVotes.map(v => T_SHIRT_ORDER.indexOf(v));
            const minIdx = Math.min(...indexes);
            const maxIdx = Math.max(...indexes);
            min = T_SHIRT_ORDER[minIdx];
            max = T_SHIRT_ORDER[maxIdx];
          }
        }
      } else {
        if (numericVotes.length > 0) {
          const sum = numericVotes.reduce((acc, val) => acc + val, 0);
          avg = String(Math.ceil(sum / numericVotes.length));
          min = String(Math.min(...numericVotes));
          max = String(Math.max(...numericVotes));
        }
      }
    }

    return { consensus, avg, min, max, rolePoints: efforts.rolePoints, totalHours, tshirtNumeric };
  }, [votes, deck, participants, allowManagementToVote, tshirtEquivalents]);

  const votesByCategory = useMemo(() => {
    const participantMap = new Map(participants.map(p => [p.id, p]));
    const result: Record<string, { votes: string[]; resultValue: string; resultLabel: string }> = {};

    votes.forEach(vote => {
      let participant = participantMap.get(vote.participantId);
      
      let category: TechnicalCategory | 'Management' | null = null;
      
      if (participant) {
        category = getParticipantCategory(participant);
      } else if (vote.participantRole) {
        // Fallback para "votos são fatos" - usa identidade congelada no voto
        category = getParticipantCategory({
          role: vote.participantRole,
          globalRole: vote.participantGlobalRole
        });
      }

      if (category && category !== 'Management') {
        if (!result[category]) {
          result[category] = { votes: [], resultValue: 'N/A', resultLabel: 'MÉDIA' };
        }
        result[category].votes.push(vote.value);
      }
    });

    const T_SHIRT_ORDER = ['PP', 'P', 'M', 'G', 'GG'];

    Object.keys(result).forEach(category => {
      const categoryData = result[category];
      if (deck === 'hours' && stats.rolePoints[category]) {
        categoryData.resultValue = stats.rolePoints[category];
        categoryData.resultLabel = 'MÉDIA';
      } else if (deck === 'tshirt' && stats.tshirtNumeric && stats.rolePoints[category]) {
        // Mesma equivalência calculada no card principal — sem isso o
        // detalhamento por papel ficava preso na moda antiga enquanto o
        // resumo geral já mostrava a média real em horas.
        categoryData.resultValue = stats.rolePoints[category];
        categoryData.resultLabel = 'MÉDIA (H)';
      } else if (deck === 'tshirt') {
        const vals = categoryData.votes.filter(v => T_SHIRT_ORDER.includes(v));
        if (vals.length > 0) {
          const voteCounts = vals.reduce((acc, value) => {
            acc[value] = (acc[value] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const predominant = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
          categoryData.resultValue = predominant;
          categoryData.resultLabel = 'MAIS VOTADO';
        }
      } else {
        const vals = categoryData.votes;
        const nums = vals.map(Number).filter(n => !isNaN(n));
        if (nums.length > 0) {
          categoryData.resultValue = String(Math.ceil(nums.reduce((a, b) => a + b, 0) / nums.length));
          categoryData.resultLabel = 'MÉDIA';
        }
      }
    });

    return result;
  }, [votes, participants, deck, stats.rolePoints, stats.tshirtNumeric]);

  const handleCopyResults = () => {
    const parts: string[] = [];
    
    TECHNICAL_CATEGORIES.forEach(category => {
      const categoryData = votesByCategory[category];
      if (categoryData && categoryData.resultValue && categoryData.resultValue !== 'N/A') {
        const suffix = deck === 'hours' || (deck === 'tshirt' && stats.tshirtNumeric) ? 'h' : (deck === 'fibonacci' ? ' SP' : '');
        parts.push(`${formatRoleForCopy(category)} ${categoryData.resultValue}${suffix}`);
      }
    });

    if (parts.length > 0) {
      const copyText = `(${parts.join(' / ')})`;
      navigator.clipboard.writeText(copyText);
      toast({
        title: 'Estimativas copiadas!',
        description: `"${copyText}" copiado para a área de transferência.`,
      });
    } else {
      toast({
        title: 'Nada para copiar',
        description: 'Não há estimativas calculadas para copiar.',
        variant: 'destructive',
      });
    }
  };

  const avgLabel = deck === 'hours' ? 'ESTIMATIVA TOTAL' : (deck === 'tshirt' && !stats.tshirtNumeric ? 'RESULTADO PREDOMINANTE' : 'MÉDIA CALCULADA');
  const mainValue = deck === 'hours' ? stats.totalHours : stats.avg;

  // Acento por papel (barra e número). Reaproveitado nos tiles compactos.
  const roleBar: Record<string, string> = {
    Developer: 'bg-indigo-500', QA: 'bg-pink-500', UX: 'bg-violet-500', Designer: 'bg-emerald-500',
  };
  const roleText: Record<string, string> = {
    Developer: 'text-indigo-600 dark:text-indigo-400', QA: 'text-pink-600 dark:text-pink-400',
    UX: 'text-violet-600 dark:text-violet-400', Designer: 'text-emerald-600 dark:text-emerald-400',
  };
  // Só papéis que votaram, na ordem canônica.
  const activeCategories = TECHNICAL_CATEGORIES.filter(c => votesByCategory[c] && votesByCategory[c].votes.length > 0);
  // Classes literais (JIT-safe) para o grid de tiles conforme a contagem.
  const gridColsCls = ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' } as Record<number, string>)[activeCategories.length] || 'grid-cols-2';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
        {/* HERÓI — métrica principal + piso/teto inline */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border p-5 md:w-[38%] flex flex-col justify-center',
            stats.consensus
              ? 'border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-card/40'
              : 'border-slate-200/70 dark:border-border/50 bg-white/70 dark:bg-card/50 backdrop-blur-xl'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {stats.consensus ? <Trophy className="h-4 w-4 text-amber-500" /> : <Hash className="h-4 w-4 text-indigo-400" />}
            <span className={cn('text-[10px] font-black uppercase tracking-[0.28em]', stats.consensus ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-500')}>
              {stats.consensus ? 'Consenso Pleno' : avgLabel}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-6xl lg:text-7xl font-black tracking-tighter text-slate-900 dark:text-white leading-none italic">{mainValue}</span>
                {(deck === 'hours' || stats.tshirtNumeric) && <span className="text-2xl font-black text-slate-300 dark:text-slate-600 italic">H</span>}
              </div>
              {deck === 'tshirt' && !stats.tshirtNumeric && tshirtEquivalents?.[mainValue] && (
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                  ≈ {tshirtEquivalents[mainValue]!.value} {TSHIRT_UNIT_LABELS[tshirtEquivalents[mainValue]!.unit]}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {[{ l: 'Piso', v: stats.min }, { l: 'Teto', v: stats.max }].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{s.l}</div>
                  <div className="min-w-[2.5rem] px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-border text-sm font-black text-slate-800 dark:text-slate-100 leading-none">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {stats.consensus && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> Sincronia máxima atingida
            </div>
          )}
        </div>

        {/* PAPÉIS — tiles compactos (sem chips por voto: já aparecem no Detalhamento) */}
        <div className="flex-1 rounded-2xl border border-slate-200/70 dark:border-border/50 bg-white/70 dark:bg-card/50 backdrop-blur-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg"><Users className="h-3.5 w-3.5 text-indigo-500" /></div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Estimativa por papel</span>
            </div>
            <Button
              variant="ghost"
              onClick={handleCopyResults}
              className="h-8 px-3 text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg gap-1.5 transition-all active:scale-95 border border-indigo-100/50 dark:border-indigo-900/40"
            >
              <Copy className="h-3 w-3" /> COPIAR P/ JIRA
            </Button>
          </div>

          {activeCategories.length > 0 ? (
            <div className={cn('grid gap-2 flex-1 content-start', gridColsCls)}>
              {activeCategories.map(category => {
                const d = votesByCategory[category];
                const unit = (deck === 'hours' || (deck === 'tshirt' && stats.tshirtNumeric)) && !isNaN(Number(d.resultValue)) ? 'H' : '';
                return (
                  <div key={category} className="relative overflow-hidden rounded-xl border border-slate-100 dark:border-border/40 bg-slate-50/70 dark:bg-slate-900/40 py-2.5 pl-4 pr-3">
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', roleBar[category] || 'bg-slate-400')} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 truncate leading-none">{category}</div>
                        <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mt-1">{d.resultLabel} · {d.votes.length} voto{d.votes.length > 1 ? 's' : ''}</div>
                      </div>
                      <span className={cn('text-2xl font-black italic tracking-tighter leading-none shrink-0', roleText[category] || 'text-slate-700')}>
                        {d.resultValue}{unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-6">
              Sem votos técnicos nesta rodada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
