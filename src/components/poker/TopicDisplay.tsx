'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Pencil, 
  Check, 
  X, 
  Target, 
  ExternalLink,
  FileText,
  Eye,
  Layers,
  PartyPopper,
  Crosshair
} from 'lucide-react';
import { cn, formatExternalUrl } from '@/lib/utils';

interface TopicDisplayProps {
  topic?: string;
  jiraLink?: string;
  // Há contexto pra abrir o painel de detalhes (Jira OU descrição/critérios
  // preenchidos manualmente). Sem isso o botão só aparecia com link do Jira.
  hasDetail?: boolean;
  isFacilitator: boolean;
  onSetTopic: (topic: string) => void;
  isSessionFinished?: boolean;
  // Sessão encerrada com itens que nunca chegaram à mesa (estourou o tempo).
  // Sem isso o cabeçalho comemorava "todas as tarefas concluídas" mesmo tendo
  // ficado fila para trás.
  untouchedCount?: number;
  isTheaterMode?: boolean;
  onShowDetail?: () => void;
  // Palco da rodada (opcionais — sem eles o cabeçalho cai no visual simples).
  votedCount?: number;
  totalVoters?: number;
  round?: number;
  revealed?: boolean;
}

// Anel de progresso dos votos: quem já votou / quem falta.
function VoteRing({ voted, total, revealed }: { voted: number; total: number; revealed: boolean }) {
  const size = 52;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, voted / total) : 0;
  const complete = revealed || (total > 0 && voted >= total);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={revealed ? 'Votos revelados' : `${voted} de ${total} já votaram`}
      role="img"
      aria-label={revealed ? 'Votos revelados' : `${voted} de ${total} já votaram`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (revealed ? 1 : pct))}
          className={cn('transition-all duration-700 ease-out', complete ? 'stroke-emerald-500' : 'stroke-indigo-500')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {revealed ? (
          <Eye className="h-4 w-4 text-emerald-500" />
        ) : (
          <>
            <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{voted}</span>
            <span className="text-[8px] font-black tabular-nums text-slate-400">/{total}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function TopicDisplay({
  topic,
  jiraLink,
  hasDetail,
  isFacilitator,
  onSetTopic,
  isSessionFinished,
  untouchedCount = 0,
  isTheaterMode,
  onShowDetail,
  votedCount = 0,
  totalVoters = 0,
  round,
  revealed = false
}: TopicDisplayProps) {
  const [editingTopic, setEditingTopic] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSetTopic = () => {
    if (editingTopic.trim()) {
      onSetTopic(editingTopic.trim());
      setIsEditing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSetTopic();
    }
    if (event.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isFacilitator && isEditing) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="relative flex-1">
          <Target className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-blue-400" />
          <Input
            autoFocus
            placeholder="Qual User Story vamos estimar?"
            value={editingTopic}
            onChange={(e) => setEditingTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-12 h-14 text-lg font-black border-none bg-slate-50 dark:bg-slate-800 focus-visible:ring-blue-500/10 rounded-2xl shadow-inner placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={handleSetTopic} size="lg" className="h-14 px-8 font-black rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest text-[10px]">
            <Check className="mr-2 h-4 w-4" />
            DEFINIR TAREFA
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setIsEditing(false)} className="h-14 px-4 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  const showFinishedUI = isSessionFinished && !isEditing;
  const showStage = !showFinishedUI && !!topic;
  const showRing = showStage && totalVoters > 0;

  return (
    <div className="flex items-center justify-between gap-4 sm:gap-6 w-full animate-in fade-in duration-700">
      <div className="flex items-center gap-4 overflow-hidden flex-1 min-w-0">
        {showRing && <VoteRing voted={votedCount} total={totalVoters} revealed={revealed} />}
        <div className="overflow-hidden flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {showFinishedUI ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-[0.25em]">
                <PartyPopper className="h-3 w-3" /> Sessão concluída
              </span>
            ) : topic ? (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-[0.25em]',
                revealed
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                isTheaterMode && 'text-xs'
              )}>
                <span className="relative flex h-1.5 w-1.5">
                  {!revealed && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />}
                  <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', revealed ? 'bg-emerald-500' : 'bg-indigo-500')} />
                </span>
                {revealed ? 'Votos revelados' : 'Votando agora'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-[9px] font-black uppercase tracking-[0.25em]">
                <Crosshair className="h-3 w-3" /> Mesa livre
              </span>
            )}
            {showStage && !!round && round > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest">
                <Layers className="h-3 w-3" /> Rodada {round}
              </span>
            )}
            {jiraLink && (
              <a
                href={formatExternalUrl(jiraLink)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <ExternalLink className="h-3 w-3" />
                No Jira
              </a>
            )}
          </div>
          {topic ? (
            <h2
              title={topic}
              className={cn(
                "text-base sm:text-lg md:text-2xl font-black line-clamp-2 overflow-hidden text-ellipsis tracking-tight uppercase leading-tight text-slate-900 dark:text-white transition-all duration-500",
                isTheaterMode && "text-lg sm:text-2xl lg:text-4xl py-1",
                showFinishedUI && "text-emerald-600 italic"
              )}>
              {topic}
            </h2>
          ) : (
            <h2 className={cn(
              "text-sm font-black uppercase tracking-[0.2em]",
              showFinishedUI ? (untouchedCount > 0 ? "text-amber-600" : "text-emerald-600") : "text-slate-400 dark:text-slate-500"
            )}>
              {showFinishedUI
                ? (untouchedCount > 0
                    ? `Encerrado com ${untouchedCount} tarefa${untouchedCount !== 1 ? 's' : ''} não abordada${untouchedCount !== 1 ? 's' : ''}`
                    : 'Todas as tarefas concluídas! 🎉')
                : (
                  <>
                    Aguardando a primeira tarefa
                    <span className="block mt-1 text-[10px] font-bold normal-case tracking-normal text-slate-400/80 dark:text-slate-500">
                      {isFacilitator ? 'Importe do Jira, adicione na fila ou defina uma pelo lápis.' : 'O facilitador vai colocar a tarefa na mesa.'}
                    </span>
                  </>
                )}
            </h2>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isFacilitator && !showFinishedUI && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 lg:h-11 lg:w-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm active:scale-90"
            onClick={() => {
              setEditingTopic(topic || '');
              setIsEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {(jiraLink || hasDetail) && onShowDetail && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 lg:h-11 lg:w-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm active:scale-90"
            onClick={onShowDetail}
            title="Ver Detalhes da Issue"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

