import type { Participant, Vote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getParticipantCategory } from '@/lib/poker-utils';
import { CheckCircle2, Crown, MoreHorizontal, Coffee, Sparkles } from 'lucide-react';

interface ParticipantCardProps {
  participant: Participant;
  vote: Vote | undefined;
  isRevealed: boolean;
  divergenceLevel?: 'warning' | 'destructive' | 'none';
}

export function ParticipantCard({ participant, vote, isRevealed, divergenceLevel = 'none' }: ParticipantCardProps) {
  const hasVoted = !!vote;
  const showVote = isRevealed && hasVoted;
  const voteValue = vote?.value;

  // Cargo/perfil técnico do participante, pra ver as notas separadas por papel
  // no Detalhamento. 'Management' vira "Gestão"; sem categoria não mostra nada.
  const category = getParticipantCategory(participant);
  const categoryLabel = category === 'Management' ? 'Gestão' : category;

  return (
    <div className="perspective-1000 group">
      <div
        className={cn(
          'relative w-full aspect-[3/4.2] transition-all duration-700 preserve-3d cursor-default',
          showVote && 'rotate-y-180'
        )}
      >
        {/* LADO A: VERSO (Aguardando ou Votado/Oculto) */}
        <div className="absolute w-full h-full backface-hidden">
          <div
            className={cn(
              'w-full h-full flex flex-col border rounded-[1.2rem] overflow-hidden transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.2)]',
              hasVoted 
                ? 'bg-gradient-to-br from-primary to-primary/80 border-primary/30' 
                : 'bg-slate-50/90 dark:bg-card/60 backdrop-blur-xl border-slate-200/80 dark:border-border shadow-sm'
            )}
          >
            {/* Crown (Absolute) */}
            {participant.isFacilitator && (
              <div className="absolute top-3 right-3 z-10">
                <Crown className={cn("h-4 w-4 drop-shadow-sm", hasVoted ? "text-white/40 fill-white/10" : "text-amber-500 fill-amber-500/20")} />
              </div>
            )}
            
            <div className="flex-1 flex items-center justify-center w-full px-4 relative overflow-hidden">
              {hasVoted ? (
                /* ESTADO 2: Voto Oculto (Check Branco) */
                <div className="relative animate-in zoom-in-50 duration-500">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-2xl relative z-10">
                      <Sparkles className="text-white w-5 h-5 opacity-80" />
                   </div>
                   <div className="absolute -inset-8 bg-white/10 blur-2xl rounded-full -z-10 animate-pulse" />
                </div>
              ) : (
                /* ESTADO 1: Aguardando (Reticências Pulsantes) */
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-primary/40 dark:bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-primary/40 dark:bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-primary/40 dark:bg-primary/60 rounded-full animate-bounce"></div>
                </div>
              )}
            </div>

            <footer className={cn(
              "py-2 px-1 shrink-0 flex flex-col items-center justify-center gap-0.5 border-t border-white/10",
              hasVoted ? "bg-black/25 backdrop-blur-md" : "bg-slate-100/60 dark:bg-slate-950/45"
            )}>
              <p
                title={participant.nickname}
                className={cn(
                  "w-full text-center text-[10.5px] font-extrabold uppercase tracking-tight truncate italic drop-shadow-sm leading-none",
                  hasVoted ? "text-white" : "text-slate-700 dark:text-slate-300"
                )}
              >
                {participant.nickname}
              </p>
              {categoryLabel && (
                <span className={cn(
                  "text-[7px] font-black uppercase tracking-[0.15em] leading-none truncate max-w-full",
                  hasVoted ? "text-white/60" : "text-slate-400 dark:text-slate-500"
                )}>
                  {categoryLabel}
                </span>
              )}
            </footer>
          </div>
        </div>

        {/* LADO B: FRENTE (Voto Revelado) */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180">
          <div 
            className={cn(
               "w-full h-full flex flex-col border rounded-[1.2rem] transition-all duration-300 group-hover:-translate-y-1 overflow-hidden",
               divergenceLevel === 'destructive' 
                 ? "bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 animate-pulse shadow-[0_20px_40px_-10px_rgba(239,68,68,0.2)]" 
                 : divergenceLevel === 'warning'
                 ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.2)]"
                 : "bg-white dark:bg-card backdrop-blur-2xl border-slate-200 dark:border-border shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)]"
            )}
          >
            {participant.isFacilitator && (
              <div className="absolute top-3 right-3 z-10">
                <Crown className="h-4 w-4 text-amber-500 fill-amber-500/10" />
              </div>
            )}

            {vote?.confidence && (
              <div className="absolute top-2.5 left-2.5 z-10" title={`Confiança ${vote.confidence === 'low' ? 'baixa' : vote.confidence === 'medium' ? 'média' : 'alta'}`}>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest",
                  vote.confidence === 'high' ? "bg-emerald-500/15 text-emerald-600" : vote.confidence === 'medium' ? "bg-amber-500/15 text-amber-600" : "bg-rose-500/15 text-rose-600"
                )}>
                  {vote.confidence === 'high' ? 'Alta' : vote.confidence === 'medium' ? 'Média' : 'Baixa'}
                </span>
              </div>
            )}

            <div className="flex-1 flex items-center justify-center relative">
              {voteValue === '☕' ? (
                <div className="relative">
                   <Coffee className={cn("h-16 w-16 animate-bounce", divergenceLevel === 'destructive' ? "text-red-500" : divergenceLevel === 'warning' ? "text-amber-500" : "text-indigo-600")} />
                   <div className={cn("absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-black/5 rounded-full blur-[2px] scale-x-150")} />
                </div>
              ) : (
                <span className={cn(
                  "text-4xl sm:text-5xl font-black tracking-tighter drop-shadow-sm italic", 
                  divergenceLevel === 'destructive' ? "text-red-600" : divergenceLevel === 'warning' ? "text-amber-600" : "text-slate-900 dark:text-white"
                )}>
                  {voteValue}
                </span>
              )}
            </div>
            
            <footer className={cn(
              "py-2 px-1 w-full shrink-0 flex flex-col items-center justify-center gap-0.5 border-t border-white/10",
              divergenceLevel === 'destructive' ? "bg-red-500/20" : divergenceLevel === 'warning' ? "bg-amber-500/20" : "bg-slate-100/90 dark:bg-slate-950/60"
            )}>
               <p
                 title={participant.nickname}
                 className={cn(
                   "w-full text-center text-[10.5px] font-extrabold uppercase tracking-tight truncate italic drop-shadow-sm leading-none",
                   divergenceLevel === 'destructive' ? "text-red-900 dark:text-red-200" : divergenceLevel === 'warning' ? "text-amber-900 dark:text-amber-200" : "text-slate-800 dark:text-slate-300"
                 )}
               >
                {participant.nickname}
              </p>
              {categoryLabel && (
                <span className={cn(
                  "text-[7px] font-black uppercase tracking-[0.15em] leading-none truncate max-w-full",
                  divergenceLevel === 'destructive' ? "text-red-700/70 dark:text-red-300/70" : divergenceLevel === 'warning' ? "text-amber-700/70 dark:text-amber-300/70" : "text-slate-400 dark:text-slate-500"
                )}>
                  {categoryLabel}
                </span>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
