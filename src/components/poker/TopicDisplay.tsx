'use client';

import { useState, type ReactNode } from 'react';
import { Check, ExternalLink, FileText, Pencil, StickyNote, X } from 'lucide-react';
import { cn, formatExternalUrl } from '@/lib/utils';
import { FIELD, IconButton, ModalButton, StatusChip } from '@/components/room-kit';

interface TopicDisplayProps {
  topic?: string;
  jiraLink?: string;
  /** Chave do Jira (PTV-1284), quando a tarefa tem. */
  issueKey?: string | null;
  /** Tipo no Jira ("História", "Bug") para a etiqueta. */
  issueType?: string | null;
  /** Trecho curto da descrição (texto puro). */
  snippet?: string;
  // Há contexto pra abrir o painel de detalhes (Jira OU descrição/critérios
  // preenchidos manualmente). Sem isso o botão só aparecia com link do Jira.
  hasDetail?: boolean;
  isFacilitator: boolean;
  onSetTopic: (topic: string) => void;
  isSessionFinished?: boolean;
  // Sessão encerrada com itens que nunca chegaram à mesa (estourou o tempo).
  untouchedCount?: number;
  isTheaterMode?: boolean;
  onShowDetail?: () => void;
  /** Abre as notas de refinamento (DEV e QA), quando a sala usa. */
  onShowNotes?: () => void;
  /** Já existe nota de DEV ou de QA nesta tarefa (ponto no botão). */
  hasNotes?: boolean;
  /** Menu "mais ações da tarefa" (tirar da mesa, cancelar, encerrar). */
  menu?: ReactNode;
  // Rodada
  round?: number;
  maxRounds?: number;
  revealed?: boolean;
}

/** Cartão da tarefa na mesa: etiquetas, título, trecho e ações. Também edita o título (facilitador). */
export function TopicDisplay({
  topic,
  jiraLink,
  issueKey,
  issueType,
  snippet,
  hasDetail,
  isFacilitator,
  onSetTopic,
  isSessionFinished,
  untouchedCount = 0,
  isTheaterMode,
  onShowDetail,
  onShowNotes,
  hasNotes = false,
  menu,
  round,
  maxRounds,
  revealed = false,
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
    if (event.key === 'Enter') handleSetTopic();
    if (event.key === 'Escape') setIsEditing(false);
  };

  const card = 'rounded-[14px] border border-border bg-card px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:px-6 sm:py-[18px]';

  if (isFacilitator && isEditing) {
    return (
      <section aria-label="Tarefa em edição" className={cn(card, 'room-rise flex flex-col gap-3 sm:flex-row sm:items-center')}>
        <label htmlFor="topic-edit" className="sr-only">Título da tarefa</label>
        <input
          id="topic-edit"
          autoFocus
          placeholder="Qual tarefa vamos estimar?"
          value={editingTopic}
          onChange={(e) => setEditingTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(FIELD, 'h-11 flex-1 text-base font-semibold')}
        />
        <div className="flex shrink-0 gap-2">
          <ModalButton variant="primary" onClick={handleSetTopic} className="gap-2"><Check className="h-4 w-4" strokeWidth={1.5} /> Definir tarefa</ModalButton>
          <ModalButton onClick={() => setIsEditing(false)} aria-label="Cancelar edição"><X className="h-4 w-4" strokeWidth={1.5} /></ModalButton>
        </div>
      </section>
    );
  }

  const showFinished = isSessionFinished && !isEditing;

  return (
    <section aria-label="Tarefa na mesa" className={cn(card, 'flex flex-wrap items-start justify-between gap-4')}>
      <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {showFinished ? (
            <StatusChip tone="success">Sessão concluída</StatusChip>
          ) : topic ? (
            revealed ? <StatusChip tone="success">Revelado</StatusChip> : <StatusChip dot className="uppercase tracking-wide">Votando agora</StatusChip>
          ) : (
            <span className="inline-flex h-5 items-center rounded-full border border-dashed border-border px-2 text-[11px] font-semibold text-muted-foreground">Mesa livre</span>
          )}
          {!showFinished && topic && issueKey && <span className="text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{issueKey}</span>}
          {!showFinished && topic && issueType && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{issueType}</span>}
          {!showFinished && topic && !!round && round > 0 && (
            <span className="text-xs text-muted-foreground">Rodada {round}{maxRounds ? ` de ${maxRounds}` : ''}</span>
          )}
          {jiraLink && !showFinished && (
            <a
              href={formatExternalUrl(jiraLink)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> No Jira
            </a>
          )}
        </div>

        {topic && !showFinished ? (
          <>
            <h1 title={topic} className={cn('m-0 line-clamp-2 text-xl font-bold leading-tight tracking-tight sm:text-2xl', isTheaterMode && 'text-2xl sm:text-3xl lg:text-4xl')}>{topic}</h1>
            {snippet && <p className={cn('m-0 line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground', isTheaterMode && 'text-base')}>{snippet}</p>}
          </>
        ) : (
          <h1 className={cn('m-0 text-lg font-semibold', showFinished ? (untouchedCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300') : 'text-muted-foreground')}>
            {showFinished
              ? (untouchedCount > 0
                  ? `Encerrado com ${untouchedCount} tarefa${untouchedCount !== 1 ? 's' : ''} não abordada${untouchedCount !== 1 ? 's' : ''}`
                  : 'Todas as tarefas concluídas')
              : 'Aguardando a primeira tarefa'}
          </h1>
        )}
        {!topic && !showFinished && (
          <p className="m-0 text-sm text-muted-foreground">
            {isFacilitator ? 'Importe do Jira, adicione na fila ou defina uma pelo lápis.' : 'O facilitador vai colocar a tarefa na mesa.'}
          </p>
        )}
      </div>

      <div className="relative flex items-center gap-2">
        {isFacilitator && !showFinished && (
          <IconButton
            label="Editar tarefa"
            icon={Pencil}
            onClick={() => { setEditingTopic(topic || ''); setIsEditing(true); }}
            className="h-[38px] w-[38px] rounded-[10px]"
          />
        )}
        {onShowNotes && !showFinished && topic && (
          <span className="relative">
            <IconButton label={hasNotes ? 'Notas de refinamento (com notas)' : 'Notas de refinamento'} icon={StickyNote} onClick={onShowNotes} className="h-[38px] w-[38px] rounded-[10px]" />
            {hasNotes && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
          </span>
        )}
        {(jiraLink || hasDetail) && onShowDetail && !showFinished && (
          <IconButton label="Ver detalhes da tarefa" icon={FileText} onClick={onShowDetail} className="h-[38px] w-[38px] rounded-[10px]" />
        )}
        {menu}
      </div>
    </section>
  );
}
