'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, Check, Flag, Hourglass, Save, Send, Settings, SkipForward } from 'lucide-react';
import type { Issue, VotingRound } from '@/lib/types';
import { computeSessionBreakdown } from '@/lib/poker-utils';
import { cn } from '@/lib/utils';
import { ConfirmDialog, FIELD, Modal, ModalButton } from '@/components/room-kit';

/** Campo "por quê?" dos modais de tirar da mesa e cancelar. */
function ReasonField({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground">{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(FIELD, 'min-h-[88px] resize-none py-2.5')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trocar a tarefa da mesa com votos em andamento
// ---------------------------------------------------------------------------

export function SwitchIssueDialog({ open, onOpenChange, votesCount, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  votesCount: number;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="warn"
      icon={AlertTriangle}
      title="Votos em andamento"
      description={
        <>
          Trocar a tarefa da mesa agora descarta {votesCount === 1 ? 'o voto já dado' : <>os <strong className="text-foreground">{votesCount} votos</strong> já dados</>} nesta tarefa.
        </>
      }
      cancelLabel="Continuar votando"
      confirmLabel="Trocar mesmo assim"
      onConfirm={onConfirm}
    />
  );
}

// ---------------------------------------------------------------------------
// Tirar da mesa: pular de vez ou adiar
// ---------------------------------------------------------------------------

export type OffTableMode = 'skip' | 'park';

export function OffTableDialog({ open, onOpenChange, initialMode, canPark, issueLabel, onSkip, onPark }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: OffTableMode;
  /** Adiar só existe se a configuração "Adiar tarefa" está ligada e o handler existe. */
  canPark: boolean;
  issueLabel?: string;
  onSkip: (note: string) => void;
  onPark?: (note: string) => void;
}) {
  const [mode, setMode] = useState<OffTableMode>(initialMode);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setMode(canPark ? initialMode : 'skip');
      setNote('');
    }
  }, [open, initialMode, canPark]);

  const isPark = mode === 'park';
  const modes: { id: OffTableMode; title: string; desc: string }[] = [
    { id: 'skip', title: 'Pular de vez', desc: 'Não será estimada nesta sessão. Entra no relatório como pulada.' },
    { id: 'park', title: 'Adiar', desc: 'Volta para o fim da fila. Dá para estimar mais tarde.' },
  ];

  const confirm = () => {
    if (isPark && onPark) onPark(note);
    else onSkip(note);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      tone="warn"
      icon={SkipForward}
      title={canPark ? 'Tirar da mesa' : 'Pular tarefa'}
      description={issueLabel ? `${issueLabel} · os votos desta rodada são descartados.` : 'Os votos desta rodada são descartados.'}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)}>Voltar</ModalButton>
          <ModalButton variant="primary" onClick={confirm}>
            {isPark ? 'Adiar e avançar' : 'Pular e avançar'}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {canPark && (
          <div role="radiogroup" aria-label="O que fazer com a tarefa" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {modes.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border p-3 text-left transition-[background-color,border-color] duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/50'
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <span aria-hidden="true" className={cn('box-border h-4 w-4 rounded-full', on ? 'border-[5px] border-primary' : 'border-[1.5px] border-border')} />
                    {m.id === 'park' ? <Hourglass className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <SkipForward className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                    {m.title}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">{m.desc}</span>
                </button>
              );
            })}
          </div>
        )}
        <ReasonField
          id="off-table-why"
          label={isPark ? 'Por que está adiando?' : 'Por que esta tarefa não será estimada agora?'}
          placeholder={isPark ? 'Ex.: aguardando alinhamento, quebrar antes' : 'Ex.: bloqueada, falta informação, fora do escopo'}
          value={note}
          onChange={setNote}
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cancelar a tarefa no refinamento
// ---------------------------------------------------------------------------

export function CancelIssueDialog({ open, onOpenChange, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(''); }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      tone="warn"
      iconTone="neutral"
      icon={Ban}
      title="Cancelar no refinamento?"
      description="A tarefa sai da estimativa desta sessão e vai para as descartadas. Dá para reativar pela fila."
      dismissible={false}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)}>Voltar</ModalButton>
          <ModalButton variant="danger" onClick={() => { onConfirm(note); onOpenChange(false); }}>Cancelar tarefa</ModalButton>
        </>
      }
    >
      <ReasonField
        id="cancel-why"
        label="Por que esta tarefa foi cancelada?"
        placeholder="Ex.: descartada pelo PO, escopo duplicado, descontinuada"
        value={note}
        onChange={setNote}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Encerrar a sessão
// ---------------------------------------------------------------------------

export function FinishSessionDialog({ open, onOpenChange, issues, rounds, onConfirm, jira }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: Issue[];
  rounds: VotingRound[];
  onConfirm: () => void;
  /**
   * Estimadas com chave do Jira: quantas já foram enviadas e quantas faltam. Com pendentes, o encerrar vira
   * uma escolha explícita — "sem enviar" ou "e enviar N ao Jira" —, sem caixa marcada escondendo o envio.
   */
  jira?: { sent: number; pending: number; onConfirmAndSend: () => void } | null;
}) {
  const b = useMemo(() => computeSessionBreakdown(issues, rounds), [issues, rounds]);
  const untouched = useMemo(() => issues.filter(i => !i.skipped && !i.cancelled && i.status !== 'completed'), [issues]);
  const offTable = b.skipped + b.parked;
  const pending = jira?.pending ?? 0;
  const withKey = (jira?.sent ?? 0) + pending;
  const close = () => onOpenChange(false);

  const tile = 'flex flex-col gap-1 rounded-xl border px-3.5 py-3';
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      tone="danger"
      icon={Flag}
      title="Encerrar a sessão?"
      description="O time para de votar e o relatório é gerado. O tempo contabilizado é só o das tarefas votadas."
      footerStart={<ModalButton variant="ghost" onClick={close}>Continuar votando</ModalButton>}
      footer={
        pending > 0 && jira ? (
          <>
            <ModalButton onClick={() => { onConfirm(); close(); }} className="border-red-600/50 text-red-700 hover:bg-red-500/10 dark:text-red-300">
              Encerrar sem enviar
            </ModalButton>
            <ModalButton variant="danger" onClick={() => { jira.onConfirmAndSend(); close(); }}>
              Encerrar e enviar {pending} ao Jira
            </ModalButton>
          </>
        ) : (
          <ModalButton variant="danger" onClick={() => { onConfirm(); close(); }}>Encerrar e gerar relatório</ModalButton>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2.5">
          <div className={cn(tile, 'border-border bg-muted/40')}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" strokeWidth={2} aria-hidden="true" />{b.estimated === 1 ? 'Estimada' : 'Estimadas'}</span>
            <span className="text-2xl font-bold tabular-nums">{b.estimated}</span>
          </div>
          <div className={cn(tile, 'border-border bg-muted/40')}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><SkipForward className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Puladas ou adiadas</span>
            <span className="text-2xl font-bold tabular-nums">{offTable}</span>
          </div>
          <div className={cn(tile, b.untouched > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-border bg-muted/40')}>
            <span className={cn('flex items-center gap-1.5 text-xs', b.untouched > 0 ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground')}>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />{b.untouched === 1 ? 'Não abordada' : 'Não abordadas'}
            </span>
            <span className={cn('text-2xl font-bold tabular-nums', b.untouched > 0 && 'text-amber-700 dark:text-amber-300')}>{b.untouched}</span>
          </div>
        </div>

        {untouched.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Tarefas não abordadas">
            {untouched.slice(0, 3).map(i => (
              <li key={i.id} className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-amber-500/50 px-3 py-2">
                {i.key && <span className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-300">{i.key}</span>}
                <span className="min-w-0 flex-1 truncate text-[13px]">{i.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">fica como não abordada</span>
              </li>
            ))}
            {untouched.length > 3 && <li className="px-1 text-xs text-muted-foreground">+ {untouched.length - 3} na fila</li>}
          </ul>
        )}

        {jira && withKey > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
            <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{jira.sent} de {withKey} {withKey === 1 ? 'estimada já está' : 'estimadas já estão'} no Jira</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {pending > 0
                  ? `${pending === 1 ? 'A outra fica salva' : `As outras ${pending} ficam salvas`} no portal se você encerrar sem enviar. Dá para enviar depois pelo relatório.`
                  : 'Nada pendente de envio.'}
              </span>
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Configurações da cerimônia (as 22 opções, em abas, no FacilitatorPanel)
// ---------------------------------------------------------------------------

export function CeremonySettingsDialog({ open, onOpenChange, onRestoreDefaults, onSaveTemplate, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreDefaults: () => void;
  onSaveTemplate?: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={Settings}
      title="Configurações da cerimônia"
      footerStart={
        <>
          <ModalButton variant="ghost" onClick={onRestoreDefaults}>Restaurar padrão</ModalButton>
          {onSaveTemplate && (
            <ModalButton variant="ghost" className="gap-2" onClick={onSaveTemplate}>
              <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Salvar como template
            </ModalButton>
          )}
        </>
      }
      footer={<ModalButton variant="primary" onClick={() => onOpenChange(false)}>Concluir</ModalButton>}
    >
      {children}
    </Modal>
  );
}
