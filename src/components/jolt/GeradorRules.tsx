'use client';

import React from 'react';
import { ArrowRight, CheckCircle2, Plus, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalButton, SelectField } from '@/components/room-kit';
import { TONES, FIELD, type Tone } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import {
  EDITABLE_KINDS,
  KIND_LABEL,
  fieldName,
  type GeneratorOverride,
  type GeneratorRule,
  type RuleDraft,
  type RuleKind,
} from '@/lib/jolt-generator';
import { FIELD_LABEL } from './LayoutCard';

/** Tom do selo da regra: pendente em âmbar, calculadas na cor da marca, fixas em verde, o resto neutro. */
function kindTone(kind: RuleKind): Tone {
  if (kind === 'UNRESOLVED') return 'warn';
  if (kind === 'CONSTANT' || kind === 'VARIABLE') return 'success';
  if (['AS_TEXT', 'AS_NUMBER', 'DIGITS', 'CONCAT', 'VALUE_MAP'].includes(kind)) return 'brand';
  return 'neutral';
}

export function KindChip({ kind }: { kind: RuleKind }) {
  return (
    <span className={cn('inline-flex h-6 w-fit items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold', TONES[kindTone(kind)].chip)}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Colunas da tabela de regras (as mesmas no cabeçalho e nas linhas). */
export const RULE_GRID = 'md:grid-cols-[minmax(150px,1.1fr)_minmax(180px,1.5fr)_130px_minmax(160px,1.4fr)_96px]';

export function RuleEditorPanel({
  rule,
  draft,
  sources,
  adjusted,
  error,
  onChange,
  onCancel,
  onSave,
  onUndo,
}: {
  rule: GeneratorRule;
  draft: RuleDraft;
  sources: string[];
  /** Já existe um ajuste guardado para este campo (habilita "Desfazer ajuste"). */
  adjusted: boolean;
  error: string | null;
  onChange: (d: RuleDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onUndo: () => void;
}) {
  const id = rule.output.replace(/[^a-zA-Z0-9]/g, '-');
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch });
  const suggested = new Set(rule.alternatives);
  const sourceList = [...rule.alternatives.filter((a) => !sources.includes(a)), ...sources];
  const hint = rule.alternatives.length
    ? 'Os campos sugeridos trazem o mesmo valor no exemplo. Escolha o que vale para o seu cliente.'
    : rule.kind === 'UNRESOLVED'
      ? 'O valor do exemplo não está na entrada. Diga se ele é fixo ou de onde vem.'
      : 'Mude a regra ou a origem deste campo.';

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-end gap-3.5">
        <div className="flex w-[220px] max-w-full flex-col gap-1.5">
          <label htmlFor={`${id}-regra`} className={FIELD_LABEL}>Regra</label>
          <SelectField
            id={`${id}-regra`}
            aria-label="Regra"
            value={draft.kind}
            onChange={(v) => set({ kind: v as GeneratorOverride['kind'] })}
            options={EDITABLE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            className="h-10"
          />
        </div>
        {draft.kind !== 'CONSTANT' ? (
          <div className="flex w-[340px] max-w-full flex-col gap-1.5">
            <label htmlFor={`${id}-origem`} className={FIELD_LABEL}>Vem de</label>
            <SelectField
              id={`${id}-origem`}
              aria-label="Vem de"
              value={draft.source}
              onChange={(v) => set({ source: v })}
              options={sourceList.map((s) => ({ value: s, label: suggested.has(s) ? `${s} (sugerido)` : s }))}
              placeholder="Escolha o campo da entrada"
              className="h-10 font-code text-[13px]"
            />
          </div>
        ) : (
          <div className="flex w-[260px] max-w-full flex-col gap-1.5">
            <label htmlFor={`${id}-valor`} className={FIELD_LABEL}>Valor fixo</label>
            <input id={`${id}-valor`} value={draft.value} onChange={(e) => set({ value: e.target.value })} className={cn(FIELD, 'h-10 font-code text-[13px]')} />
          </div>
        )}
      </div>

      {draft.kind === 'VALUE_MAP' && (
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(FIELD_LABEL, 'mb-1')}>Como cada valor chega</legend>
          {draft.map.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2.5">
              <input
                aria-label={`Valor na entrada ${i + 1}`}
                value={row.from}
                onChange={(e) => set({ map: draft.map.map((r, j) => (j === i ? { ...r, from: e.target.value } : r)) })}
                placeholder="valor na entrada"
                className={cn(FIELD, 'h-9 w-[180px] font-code text-[13px]')}
              />
              <ArrowRight className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" aria-hidden="true" />
              <input
                aria-label={`Valor na saída ${i + 1}`}
                value={row.to}
                onChange={(e) => set({ map: draft.map.map((r, j) => (j === i ? { ...r, to: e.target.value } : r)) })}
                placeholder="valor na saída"
                className={cn(FIELD, 'h-9 w-[220px] font-code text-[13px]')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={`Remover linha ${i + 1}`}
                onClick={() => set({ map: draft.map.length > 1 ? draft.map.filter((_, j) => j !== i) : [{ from: '', to: '' }] })}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3.5">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]" onClick={() => set({ map: [...draft.map, { from: '', to: '' }] })}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Adicionar valor
            </Button>
            <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground" htmlFor={`${id}-outro`}>
              Qualquer outro
              <input
                id={`${id}-outro`}
                value={draft.otherwise}
                onChange={(e) => set({ otherwise: e.target.value })}
                placeholder="sem valor"
                className={cn(FIELD, 'h-9 w-[180px] font-code text-[13px]')}
              />
            </label>
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[13px] text-muted-foreground">{hint}</span>
        <span className="inline-flex gap-2">
          {adjusted && (
            <ModalButton variant="ghost" onClick={onUndo} className="h-9 gap-1.5 text-red-700 dark:text-red-300">
              <Undo2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Desfazer ajuste
            </ModalButton>
          )}
          <ModalButton onClick={onCancel} className="h-9">Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={onSave} className="h-9">Guardar ajuste</ModalButton>
        </span>
      </div>
    </div>
  );
}

export function RuleRow({
  rule,
  adjustedDraft,
  editing,
  onToggle,
  panel,
}: {
  rule: GeneratorRule;
  /** Ajuste já guardado para este campo, se houver. */
  adjustedDraft?: RuleDraft;
  editing: boolean;
  onToggle: () => void;
  panel: React.ReactNode;
}) {
  const adjusted = !!adjustedDraft;
  const pendingOpen = rule.pending && !adjusted;
  const kind: RuleKind = adjustedDraft ? adjustedDraft.kind : rule.kind;
  const source = adjustedDraft
    ? adjustedDraft.kind === 'CONSTANT'
      ? '— (valor fixo)'
      : adjustedDraft.source || '—'
    : pendingOpen
      ? rule.alternatives.length
        ? rule.alternatives.join(' ou ')
        : 'Não achei na entrada'
      : rule.kind === 'CONSTANT'
        ? '— (valor fixo)'
        : rule.source ?? '—';
  return (
    <li className={cn('flex flex-col gap-3 border-b border-border px-5 py-3 last:border-b-0', editing && 'bg-primary/5', pendingOpen && !editing && 'bg-amber-500/[0.05]')}>
      <div className={cn('grid grid-cols-1 items-center gap-x-4 gap-y-1', RULE_GRID)}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate font-code text-sm font-semibold text-foreground" title={rule.output}>{fieldName(rule)}</strong>
          <span className="truncate text-xs text-muted-foreground">{rule.scope ? `Cada item de ${rule.scope}` : 'Raiz do resultado'}</span>
        </span>
        <span className={cn('font-code text-[13px] leading-snug', pendingOpen ? 'text-amber-800 dark:text-amber-300' : 'text-foreground')}>{source}</span>
        <span className="flex flex-col items-start gap-1">
          <KindChip kind={kind} />
          {adjusted && <span className="text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">ajustado</span>}
        </span>
        <span className="truncate font-code text-[13px] text-muted-foreground" title={rule.example ?? ''}>{rule.example ?? ''}</span>
        <span className="flex items-center justify-end gap-2">
          {!rule.pending && !adjusted && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Confere com a saída" />}
          <Button
            type="button"
            variant={pendingOpen && !editing ? 'default' : 'outline'}
            size="xs"
            className="h-8 rounded-lg px-3 text-[13px] font-semibold"
            onClick={onToggle}
            aria-expanded={editing}
            aria-label={`${editing ? 'Fechar ajuste de' : pendingOpen ? 'Confirmar' : 'Ajustar'} ${fieldName(rule)}`}
          >
            {editing ? 'Fechar' : pendingOpen ? 'Confirmar' : 'Ajustar'}
          </Button>
        </span>
      </div>
      {pendingOpen && !editing && rule.reason && (
        <p className="text-xs text-amber-800 dark:text-amber-300">{rule.reason}</p>
      )}
      {editing && panel}
    </li>
  );
}
