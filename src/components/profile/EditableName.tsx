'use client';

import * as React from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Atributo que o modal consulta para deixar o Esc só cancelar a edição (sem fechar a janela). */
export const NAME_EDITOR_ATTR = 'data-identity-name-editor';

export interface EditableNameProps {
  value: string;
  /** Grava o nome (já aparado). Rejeitar mantém a edição aberta com a mensagem. */
  onSave: (name: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  className?: string;
}

/**
 * Nome editável no lugar. O lápis abre o campo; Enter e sair do campo salvam, Esc cancela.
 * Salva na hora (sem botão) e confirma com "Nome salvo", discreto.
 */
export function EditableName({ value, onSave, onBusyChange, className }: EditableNameProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const penRef = React.useRef<HTMLButtonElement>(null);
  /** Evita salvar duas vezes (Enter seguido do blur) e salvar depois de cancelar. */
  const settled = React.useRef(false);
  const wasEditing = React.useRef(false);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) {
      penRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  React.useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [saved]);

  const start = () => {
    settled.current = false;
    setDraft(value);
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancel = () => {
    settled.current = true;
    setError(null);
    setEditing(false);
  };

  const commit = async () => {
    if (settled.current || saving) return;
    const next = draft.trim();
    if (!next) {
      setError('Informe seu nome.');
      inputRef.current?.focus();
      return;
    }
    if (next === value) {
      cancel();
      return;
    }
    settled.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      await onSave(next);
      setError(null);
      setEditing(false);
      setSaved(true);
    } catch {
      settled.current = false;
      setError('Não foi possível salvar o nome. Tente de novo.');
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            {...{ [NAME_EDITOR_ATTR]: '' }}
            aria-label="Nome"
            value={draft}
            disabled={saving}
            maxLength={120}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? 'identity-name-error' : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            onBlur={() => void commit()}
            className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-muted/40 px-3 text-xl font-bold tracking-tight text-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-2xl"
          />
          {saving && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" strokeWidth={1.5} />}
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-1 max-sm:justify-center">
          <span className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight text-foreground" title={value || undefined}>
            {value || 'Seu nome'}
          </span>
          <button
            ref={penRef}
            type="button"
            aria-label="Editar nome"
            onClick={start}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
              FOCUS_RING,
            )}
          >
            <Pencil aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      )}
      {error && (
        <p id="identity-name-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className={cn('flex items-center gap-1 text-xs text-muted-foreground', !saved && 'sr-only')}>
        {saved && (
          <>
            <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" strokeWidth={1.5} />
            Nome salvo
          </>
        )}
      </p>
    </div>
  );
}
