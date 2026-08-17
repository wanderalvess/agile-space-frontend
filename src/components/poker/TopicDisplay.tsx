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
  FileText
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
  onShowDetail
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
            className="pl-12 h-14 text-lg font-black border-none bg-slate-50 focus-visible:ring-blue-500/10 rounded-2xl shadow-inner placeholder:text-slate-300"
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

  return (
    <div className="flex items-center justify-between gap-6 w-full animate-in fade-in duration-700">
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        <div className="overflow-hidden flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <p className={cn(
              "text-[10px] text-blue-600 font-black uppercase tracking-[0.4em] opacity-80 transition-all",
              isTheaterMode && "text-xs"
            )}>
              {showFinishedUI ? "Sessão Concluída" : "Votando Agora"}
            </p>
            {jiraLink && (
              <a
                href={formatExternalUrl(jiraLink)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                No Jira
              </a>
            )}
          </div>
          {topic ? (
            <h2
              title={topic}
              className={cn(
                "text-base sm:text-lg md:text-xl font-black line-clamp-2 overflow-hidden text-ellipsis tracking-tight uppercase leading-tight text-slate-900 dark:text-white transition-all duration-500",
                isTheaterMode && "text-lg sm:text-2xl lg:text-3xl py-1",
                showFinishedUI && "text-emerald-600 italic"
              )}>
              {topic}
            </h2>
          ) : (
            <h2 className={cn(
              "text-sm font-black uppercase tracking-[0.2em]",
              showFinishedUI ? (untouchedCount > 0 ? "text-amber-600" : "text-emerald-600") : "text-slate-300 animate-pulse"
            )}>
              {showFinishedUI
                ? (untouchedCount > 0
                    ? `Encerrado com ${untouchedCount} tarefa${untouchedCount !== 1 ? 's' : ''} não abordada${untouchedCount !== 1 ? 's' : ''}`
                    : 'Todas as tarefas concluídas! 🎉')
                : 'Aguardando definição...'}
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

