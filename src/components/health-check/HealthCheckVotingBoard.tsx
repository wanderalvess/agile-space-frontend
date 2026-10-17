'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, EyeOff, Loader2, MessageSquare, Timer } from 'lucide-react';
import { ConfirmDialog, FIELD, FOCUS_RING, ModalButton, StatusChip } from '@/components/room-kit';
import { scaleOptions, type ScaleOption } from '@/lib/health-check-rules';
import type { HealthCheckBoard, HealthCheckDimension, HealthCheckParticipant, HealthCheckVote, HealthCheckVoteValue } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HealthRoomShell } from './HealthRoomShell';
import { ConnectionChip, TONE_SELECTED, ValueGlyph, type HealthConnection, type SaveState } from './health-ui';

export interface FinishResult {
  ok: boolean;
  /** Mensagem do servidor ou da regra ("É necessário pelo menos um voto para encerrar."). */
  message?: string;
}

interface HealthCheckVotingBoardProps {
  board: HealthCheckBoard;
  squadLabel: string;
  participants: HealthCheckParticipant[];
  /** Contas com a sala aberta agora; `null`/ausente = o servidor não informa (sem ponto de online). */
  onlineIds?: ReadonlySet<string> | null;
  currentUserId?: string;
  userVotes: HealthCheckVote[];
  /** Devolve true quando o servidor gravou; o comentário digitado fica na tela de qualquer forma. */
  onVote: (dimension: string, value: HealthCheckVoteValue, comment?: string) => Promise<boolean> | boolean | void;
  isCreator: boolean;
  onFinish: () => Promise<FinishResult>;
  isFinishing: boolean;
  dimensions: HealthCheckDimension[];
  connection: HealthConnection;
  onDeleteBoard: () => Promise<void>;
  onOpenFeedback: () => void;
}

/** Quanto tempo depois da última tecla o comentário é enviado. */
const COMMENT_DELAY_MS = 700;

function SaveBadge({ state }: { state: SaveState | undefined }) {
  if (!state) return null;
  if (state === 'saving') {
    return <span role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Salvando…</span>;
  }
  if (state === 'saved') {
    return <span role="status" className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> Salvo</span>;
  }
  return <span role="alert" className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300"><AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Não salvou · o texto continua aqui</span>;
}

/** Botões da resposta, no formato da escala do radar. `aria-pressed` marca a escolhida. */
function VoteButtons({ dim, scale, current, onPick }: { dim: HealthCheckDimension; scale: HealthCheckBoard['scaleType']; current?: string; onPick: (value: HealthCheckVoteValue) => void }) {
  const options = scaleOptions(scale);

  if (scale === 'numbers_5') {
    const numbers = [...options].reverse();
    return (
      <div className="flex flex-col gap-1.5">
        <div role="group" aria-label={`Nota para ${dim.title}`} className="grid grid-cols-5 gap-1.5">
          {numbers.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              aria-pressed={current === o.value}
              aria-label={`Nota ${o.value} de 5`}
              className={cn(
                'flex h-12 items-center justify-center rounded-[10px] border text-base font-bold tabular-nums transition-colors duration-fast max-sm:h-12',
                current === o.value ? 'border-primary bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border bg-muted/40 text-foreground hover:bg-accent',
                FOCUS_RING
              )}
            >
              {o.value}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
          <span>1 · Crítico</span>
          <span>5 · Muito bom</span>
        </div>
      </div>
    );
  }

  return (
    <div role="group" aria-label={`Resposta para ${dim.title}`} className="grid grid-cols-3 gap-2">
      {options.map((o: ScaleOption) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            'flex min-h-12 items-center justify-center gap-2 rounded-[10px] border px-2 text-sm font-semibold transition-colors duration-fast',
            current === o.value ? TONE_SELECTED[o.tone] : 'border-border bg-muted/40 text-foreground hover:bg-accent',
            FOCUS_RING
          )}
        >
          <ValueGlyph option={o} scale={scale} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Votação do Radar de clima: faixa de anonimato, progresso próprio e um cartão por dimensão. O comentário
 * aparece depois da resposta e é enviado sozinho (700 ms depois da última tecla, ao sair do campo, ao encerrar
 * e ao sair da tela). Só o criador encerra; os demais veem que o resultado depende do facilitador.
 */
export function HealthCheckVotingBoard({
  board,
  squadLabel,
  participants,
  onlineIds,
  currentUserId,
  userVotes,
  onVote,
  isCreator,
  onFinish,
  isFinishing,
  dimensions,
  connection,
  onDeleteBoard,
  onOpenFeedback,
}: HealthCheckVotingBoardProps) {
  const scale = board.scaleType ?? 'traffic_light';
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<Record<string, string>>(() => {
    const comments: Record<string, string> = {};
    userVotes.forEach((v) => { if (v.comment) comments[v.dimensionKey] = v.comment; });
    return comments;
  });
  const [saveStates, setSaveStates] = useState<Record<string, SaveState | undefined>>({});

  const userVotesMap = useMemo(() => new Map(userVotes.map((v) => [v.dimensionKey, v.value])), [userVotes]);

  // Sempre a versão mais recente das props/estado dentro dos timers do comentário (sem closure velha).
  const latest = useRef({ onVote, userVotesMap });
  latest.current = { onVote, userVotesMap };
  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingComments = useRef<Record<string, string>>({});
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mounted = useRef(true);

  /** Envia e mostra Salvando… / Salvo (ou o erro). O texto continua na tela se falhar. */
  const send = useCallback(async (key: string, value: HealthCheckVoteValue, comment?: string): Promise<boolean> => {
    if (mounted.current) setSaveStates((s) => ({ ...s, [key]: 'saving' }));
    let ok = false;
    try {
      const result = await latest.current.onVote(key, value, comment);
      ok = result !== false;
    } catch {
      ok = false;
    }
    if (!mounted.current) return ok;
    setSaveStates((s) => ({ ...s, [key]: ok ? 'saved' : 'error' }));
    if (ok) {
      clearTimeout(savedTimers.current[key]);
      savedTimers.current[key] = setTimeout(() => {
        if (mounted.current) setSaveStates((s) => (s[key] === 'saved' ? { ...s, [key]: undefined } : s));
      }, 4000);
    }
    return ok;
  }, []);

  const handleVoteClick = (dimensionKey: string, value: HealthCheckVoteValue) => {
    // um clique já leva o comentário atual; o rascunho pendente dessa dimensão não precisa mais ser enviado
    clearTimeout(commentTimers.current[dimensionKey]);
    delete pendingComments.current[dimensionKey];
    void send(dimensionKey, value, localComments[dimensionKey]);
  };

  /** Envia o comentário pendente de uma dimensão (ou de todas). Sem voto na dimensão não há onde guardar o comentário. */
  const flushComments = useCallback(async (onlyDimension?: string) => {
    const keys = onlyDimension ? [onlyDimension] : Object.keys(pendingComments.current);
    for (const key of keys) {
      clearTimeout(commentTimers.current[key]);
      const comment = pendingComments.current[key];
      const value = latest.current.userVotesMap.get(key);
      delete pendingComments.current[key];
      if (comment !== undefined && value) await send(key, value, comment);
    }
  }, [send]);

  const handleCommentChange = (dimensionKey: string, comment: string) => {
    setLocalComments((prev) => ({ ...prev, [dimensionKey]: comment }));
    if (!userVotesMap.get(dimensionKey)) return;
    pendingComments.current[dimensionKey] = comment;
    clearTimeout(commentTimers.current[dimensionKey]);
    commentTimers.current[dimensionKey] = setTimeout(() => { void flushComments(dimensionKey); }, COMMENT_DELAY_MS);
  };

  useEffect(() => {
    mounted.current = true;
    const timers = commentTimers.current;
    const saved = savedTimers.current;
    return () => {
      mounted.current = false;
      Object.values(timers).forEach(clearTimeout);
      Object.values(saved).forEach(clearTimeout);
      // sair da tela com comentário pendente não pode perder o texto
      for (const [key, comment] of Object.entries(pendingComments.current)) {
        const value = latest.current.userVotesMap.get(key);
        if (value) void latest.current.onVote(key, value, comment);
      }
    };
  }, []);

  const answered = dimensions.filter((d) => userVotesMap.has(d.key)).length;
  const total = dimensions.length;
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const allDone = total > 0 && answered === total;

  const confirmFinish = async () => {
    setFinishError(null);
    await flushComments();
    const result = await onFinish();
    if (!result.ok) setFinishError(result.message || 'Não foi possível encerrar a votação.');
  };

  return (
    <HealthRoomShell
      title={board.sprintName?.trim() || 'Radar de clima'}
      squadLabel={squadLabel}
      dimensionCount={total}
      phase="vote"
      isCreator={isCreator}
      creatorId={board.creatorId}
      participants={participants}
      onlineIds={onlineIds}
      currentUserId={currentUserId}
      connection={connection}
      onOpenFeedback={onOpenFeedback}
      onDeleteBoard={onDeleteBoard}
      primaryAction={
        isCreator ? (
          <ModalButton variant="primary" className="gap-2" disabled={isFinishing} onClick={() => { setFinishError(null); setFinishOpen(true); }}>
            {isFinishing ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> : <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            {isFinishing ? 'Encerrando…' : 'Encerrar votação'}
          </ModalButton>
        ) : undefined
      }
    >
      <div className="mx-auto flex w-full max-w-[1750px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
        <p className="m-0 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] leading-relaxed dark:bg-primary/15">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
          <span><strong>Respostas anônimas.</strong> Você só vê as suas até o facilitador encerrar; no resultado, votos e comentários aparecem sem nome.</span>
        </p>

        <section aria-label="Seu progresso" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold">{allDone ? 'Você respondeu todas as dimensões' : `Você respondeu ${answered} de ${total}`}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Seu progresso">
              <div className={cn('h-full rounded-full transition-[width] duration-slow motion-reduce:transition-none', allDone ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-primary')} style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionChip connection={connection} />
            {isCreator ? (
              <span className="text-xs text-muted-foreground">{allDone ? 'Encerre quando a squad terminar de responder.' : 'Você encerra a votação quando quiser.'}</span>
            ) : (
              <StatusChip tone="neutral"><Timer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Aguardando o facilitador</StatusChip>
            )}
          </div>
          {!isCreator && <span className="basis-full text-xs text-muted-foreground sm:basis-auto">O resultado é liberado quando o facilitador encerrar.</span>}
        </section>

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4 p-0">
          {dimensions.map((dim) => {
            const current = userVotesMap.get(dim.key);
            return (
              <li key={dim.key}>
                <article aria-label={dim.title} className={cn('flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors duration-base', current ? 'border-primary/40' : 'border-border')}>
                  <header className="flex items-start gap-2">
                    <h3 className="m-0 flex-1 text-[15px] font-bold leading-tight">{dim.title}</h3>
                    {current && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={2} aria-label="Respondida" />}
                  </header>
                  {dim.description && <p className="m-0 text-[13px] leading-snug text-muted-foreground">{dim.description}</p>}
                  <VoteButtons dim={dim} scale={scale} current={current} onPick={(v) => handleVoteClick(dim.key, v)} />
                  {current ? (
                    <div className="flex flex-col gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`health-comment-${dim.key}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <MessageSquare className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Por que essa resposta? <span className="font-normal">(opcional)</span>
                        </label>
                        <SaveBadge state={saveStates[dim.key]} />
                      </div>
                      <textarea
                        id={`health-comment-${dim.key}`}
                        value={localComments[dim.key] || ''}
                        onChange={(e) => handleCommentChange(dim.key, e.target.value)}
                        onBlur={() => { void flushComments(dim.key); }}
                        aria-label={`Comentário sobre ${dim.title}`}
                        placeholder="Escreva o contexto, se quiser…"
                        maxLength={2000}
                        rows={3}
                        className={cn(FIELD, 'min-h-[72px] resize-none py-2 text-[13px] leading-relaxed')}
                      />
                    </div>
                  ) : (
                    <p className="m-0 mt-auto py-1 text-center text-[13px] text-muted-foreground">Aguardando a sua resposta</p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={finishOpen}
        onOpenChange={(o) => { if (!o) setFinishError(null); setFinishOpen(o); }}
        tone="danger"
        icon={Check}
        title="Encerrar o radar?"
        description="Depois de encerrar, ninguém mais responde e o resultado aparece para toda a squad. Quem não respondeu fica de fora. Não dá para desfazer."
        cancelLabel="Continuar votando"
        confirmLabel="Encerrar e ver o resultado"
        loading={isFinishing}
        loadingLabel="Encerrando…"
        keepOpenOnConfirm
        onConfirm={() => void confirmFinish()}
      >
        <dl className="m-0 flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Você respondeu</dt>
            <dd className="m-0 font-semibold tabular-nums">{answered} de {total}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Seus comentários pendentes</dt>
            <dd className="m-0 font-semibold">enviados antes de encerrar</dd>
          </div>
        </dl>
        {finishError && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" /> {finishError}
          </p>
        )}
      </ConfirmDialog>
    </HealthRoomShell>
  );
}
