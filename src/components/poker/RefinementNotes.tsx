'use client';

import { useState, useEffect, useRef } from 'react';
import { Bug, Code, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD, FOCUS_RING, RoleChip } from '@/components/room-kit';

interface RefinementNotesProps {
  devNotes?: string;
  qaNotes?: string;
  // Recebe só o campo que mudou: o backend mescla por campo, então quem edita DEV
  // não apaga o que outra pessoa escreveu em QA ao mesmo tempo.
  onUpdateNotes?: (notes: { devNotes?: string; qaNotes?: string }) => void;
  isTheaterMode?: boolean;
  activeIssueId?: string | null;
  // Somente leitura (sem como salvar). Na sala, todos os presentes podem escrever.
  readOnly?: boolean;
}

const SAVE_DELAY_MS = 800;
const same = (a: string, b?: string | null) => a.trim() === (b ?? '').trim();

/** Um campo de notas com salvamento automático (debounce) que não pisa em quem está digitando. */
function NotesField({
  id,
  title,
  roleCategory,
  roleLabel,
  placeholder,
  icon: Icon,
  remote,
  onSave,
  readOnly,
  issueKey,
  large,
  compact,
  hidden,
}: {
  id: string;
  title: string;
  roleCategory: string;
  roleLabel: string;
  placeholder: string;
  icon: typeof Code;
  remote: string;
  onSave?: (value: string) => void;
  readOnly: boolean;
  issueKey?: string | null;
  large?: boolean;
  /** Painel lateral: só o campo, sem o cartão com cabeçalho (a aba já diz o papel). */
  compact?: boolean;
  /** Aba fechada no painel: continua montado para o salvamento pendente não se perder. */
  hidden?: boolean;
}) {
  const [local, setLocal] = useState(remote);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Referência estável: trocar a função a cada render não pode reiniciar o debounce.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const canSave = !!onSave;

  // Atualizações de outras pessoas entram no campo — menos o que está sendo digitado agora
  // (foco): sobrescrever no meio da frase faria o texto de quem digita pular.
  useEffect(() => {
    if (document.activeElement !== ref.current) setLocal(remote);
  }, [remote, issueKey]);

  // Salva com debounce, só quando difere do que o servidor já tem.
  useEffect(() => {
    if (!canSave || readOnly || !issueKey || same(local, remote)) return;
    const timer = setTimeout(() => saveRef.current?.(local), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [local, remote, canSave, readOnly, issueKey]);

  if (compact) {
    return (
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab`} hidden={hidden} className={cn('min-h-0 flex-1 flex-col gap-1.5', hidden ? 'hidden' : 'flex')}>
        <label htmlFor={id} className="text-xs text-muted-foreground">{title} · {roleLabel}</label>
        <textarea
          id={id}
          ref={ref}
          value={local}
          readOnly={readOnly}
          onChange={(e) => { if (!readOnly) setLocal(e.target.value); }}
          placeholder={readOnly ? 'Ainda não há notas.' : placeholder}
          className={cn(FIELD, 'min-h-[160px] flex-1 resize-none py-3 text-[13px] leading-[1.6]')}
        />
      </div>
    );
  }

  return (
    <section aria-label={title} className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card">
      <header className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <RoleChip category={roleCategory} label={roleLabel} />
        <h3 className="m-0 flex-1 text-[15px] font-bold">{title}</h3>
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </header>
      <label htmlFor={id} className="sr-only">{title}</label>
      <textarea
        id={id}
        ref={ref}
        value={local}
        readOnly={readOnly}
        onChange={(e) => { if (!readOnly) setLocal(e.target.value); }}
        placeholder={readOnly ? 'Ainda não há notas.' : placeholder}
        className={cn(FIELD, 'm-3.5 min-h-[180px] flex-1 resize-none py-3 leading-[1.7]', large ? 'text-base' : 'text-[13px]')}
      />
    </section>
  );
}

const NOTE_TABS = [
  { id: 'dev', role: 'Developer', label: 'DEV', title: 'Notas técnicas' },
  { id: 'qa', role: 'QA', label: 'QA', title: 'Cenários' },
] as const;

/**
 * Notas de refinamento no painel ao lado da mesa: uma aba por papel (DEV e QA), o campo ocupa a altura toda.
 * As duas abas ficam montadas: trocar de aba antes do salvamento automático não perde o que foi digitado.
 */
export function RefinementNotesPanel({ devNotes = '', qaNotes = '', onUpdateNotes, activeIssueId, readOnly = false }: RefinementNotesProps) {
  const [tab, setTab] = useState<'dev' | 'qa'>('dev');
  if (!activeIssueId) {
    return <p className="m-0 text-sm text-muted-foreground">As notas abrem quando houver uma tarefa na mesa.</p>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="tablist" aria-label="Notas por papel" className="grid grid-cols-2 gap-0.5 rounded-[10px] border border-border bg-background p-[3px]">
        {NOTE_TABS.map(t => {
          const selected = tab === t.id;
          const filled = !!(t.id === 'dev' ? devNotes : qaNotes).trim();
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`notes-panel-${t.id}-tab`}
              aria-selected={selected}
              aria-controls={`notes-panel-${t.id}-panel`}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative flex h-8 items-center justify-center gap-1.5 rounded-[7px] text-[13px] transition-colors duration-fast',
                selected ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                FOCUS_RING
              )}
            >
              <RoleChip category={t.role} label={t.label} className="h-[18px] px-1.5" />
              {t.title}
              {filled && <span aria-label="com notas" className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <NotesField
        compact
        hidden={tab !== 'dev'}
        id="notes-panel-dev"
        title="Notas técnicas"
        roleCategory="Developer"
        roleLabel="DEV"
        placeholder="Solução, riscos e pontos de atenção"
        icon={Code}
        remote={devNotes}
        onSave={onUpdateNotes ? (v) => onUpdateNotes({ devNotes: v }) : undefined}
        readOnly={readOnly}
        issueKey={activeIssueId}
      />
      <NotesField
        compact
        hidden={tab !== 'qa'}
        id="notes-panel-qa"
        title="Cenários de teste"
        roleCategory="QA"
        roleLabel="QA"
        placeholder="Cenários de teste e riscos"
        icon={Bug}
        remote={qaNotes}
        onSave={onUpdateNotes ? (v) => onUpdateNotes({ qaNotes: v }) : undefined}
        readOnly={readOnly}
        issueKey={activeIssueId}
      />
      <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
        {readOnly ? 'Somente leitura.' : 'Todo o time edita. Salva sozinho.'}
      </p>
    </div>
  );
}

/**
 * Notas de refinamento: solução técnica (DEV) e cenários de teste (QA) em campos
 * SEPARADOS. Todo o time pode escrever; cada campo salva sozinho, sem sobrescrever o outro.
 */
export function RefinementNotes({ devNotes = '', qaNotes = '', onUpdateNotes, isTheaterMode, activeIssueId, readOnly = false }: RefinementNotesProps) {
  if (!activeIssueId) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2">
        <NotesField
          id="notes-dev"
          title="Notas técnicas"
          roleCategory="Developer"
          roleLabel="DEV"
          placeholder="Solução, riscos e pontos de atenção"
          icon={Code}
          remote={devNotes}
          onSave={onUpdateNotes ? (v) => onUpdateNotes({ devNotes: v }) : undefined}
          readOnly={readOnly}
          issueKey={activeIssueId}
          large={isTheaterMode}
        />
        <NotesField
          id="notes-qa"
          title="Cenários de teste"
          roleCategory="QA"
          roleLabel="QA"
          placeholder="Cenários de teste e riscos"
          icon={Bug}
          remote={qaNotes}
          onSave={onUpdateNotes ? (v) => onUpdateNotes({ qaNotes: v }) : undefined}
          readOnly={readOnly}
          issueKey={activeIssueId}
          large={isTheaterMode}
        />
      </div>
      <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
        {readOnly ? 'Somente leitura.' : 'Todo o time pode editar. Salva sozinho.'}
      </p>
    </div>
  );
}
