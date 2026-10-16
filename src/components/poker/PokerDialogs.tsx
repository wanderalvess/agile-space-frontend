'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Ban, Flag, Hourglass, Save, Settings, SkipForward } from 'lucide-react';
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

export function FinishSessionDialog({ open, onOpenChange, issues, rounds, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: Issue[];
  rounds: VotingRound[];
  onConfirm: () => void;
}) {
  const b = useMemo(() => computeSessionBreakdown(issues, rounds), [issues, rounds]);
  const stats: { n: number; label: string; cls: string }[] = [
    { n: b.estimated, label: b.estimated === 1 ? 'estimada' : 'estimadas', cls: 'text-emerald-700 dark:text-emerald-300' },
    { n: b.skipped + b.parked, label: 'puladas ou adiadas', cls: 'text-amber-700 dark:text-amber-300' },
    { n: b.untouched, label: b.untouched === 1 ? 'não abordada' : 'não abordadas', cls: 'text-muted-foreground' },
  ];
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={Flag}
      title="Encerrar a sessão?"
      description="O que sobrar na fila entra como não abordado no relatório. O tempo contabilizado é só o das tarefas votadas."
      cancelLabel="Continuar votando"
      confirmLabel="Encerrar e gerar relatório"
      onConfirm={onConfirm}
    >
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-[10px] border border-border bg-muted/40 p-2.5">
            <span className={cn('text-xl font-bold tabular-nums', s.cls)}>{s.n}</span>
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </ConfirmDialog>
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
