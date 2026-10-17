'use client';

import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import { Code2 } from 'lucide-react';
import { Modal, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import type { PanelsUnavailable } from '@/store/useSquadPanelsStore';
import {
  CHART_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  STORAGE_LABEL,
  VISIBILITY_OPTIONS,
  emptyForm,
  formFromCard,
  serverUnavailableText,
  type PanelCardModel,
  type PanelForm,
  type PanelStorage,
} from './jql-model';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  /** Painel em edição; null = novo. */
  editing: PanelCardModel | null;
  /** Por que a squad não guarda painéis no servidor (null = disponível). */
  serverUnavailable: PanelsUnavailable | null;
  /** Devolve true quando salvou e o modal pode fechar. */
  onSave: (form: PanelForm, editing: PanelCardModel | null) => Promise<boolean>;
}

const STORAGE_HELP: Record<PanelStorage, string> = {
  local: 'Fica só neste navegador. “Toda a squad” é só um rótulo: ninguém mais vê.',
  squad: 'Quem é da squad vê o painel; só quem criou edita ou exclui. “Só eu” fica visível apenas para você.',
};

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function JqlPanelModal({ open, onOpenChange, squadId, editing, serverUnavailable, onSave }: Props) {
  const uid = useId();
  const [form, setForm] = useState<PanelForm>(() => emptyForm(squadId));
  const [saving, setSaving] = useState(false);

  // Cada abertura começa do zero (novo) ou do painel escolhido (editar).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reabrir recomeça do formulário limpo ou do painel escolhido
    if (open) setForm(editing ? formFromCard(editing) : emptyForm(squadId));
  }, [open, editing, squadId]);

  const set = <K extends keyof PanelForm>(key: K, value: PanelForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const hasGroup = form.chartType === 'bar' || form.chartType === 'pie';
  const serverDisabled = !!serverUnavailable;

  const submit = async () => {
    setSaving(true);
    try {
      // Se o servidor ficou indisponível depois de escolher "na squad", salva no navegador.
      const toSave = serverDisabled && !editing && form.storage === 'squad' ? { ...form, storage: 'local' as const } : form;
      const ok = await onSave(toSave, editing);
      if (ok) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={Code2}
      title={editing ? 'Editar painel JQL' : 'Novo painel personalizado (JQL)'}
      preventClose={saving}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar painel'}
          </ModalButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Título do painel" htmlFor={`${uid}-title`}>
          <input
            id={`${uid}-title`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex.: Bugs críticos em aberto"
            className={cn(FIELD, 'h-10')}
            autoComplete="off"
          />
        </Field>
        <Field label="Consulta JQL do Jira" htmlFor={`${uid}-jql`}>
          <input
            id={`${uid}-jql`}
            value={form.jql}
            onChange={(e) => set('jql', e.target.value)}
            placeholder={`project = ${squadId} AND type = Bug`}
            className={cn(FIELD, 'h-10 font-mono text-[13px]')}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de gráfico" htmlFor={`${uid}-chart`}>
            <SelectField id={`${uid}-chart`} value={form.chartType} onChange={(v) => set('chartType', v as PanelForm['chartType'])} options={CHART_OPTIONS} className="h-10" />
          </Field>
          <Field label="Visibilidade" htmlFor={`${uid}-vis`}>
            <SelectField id={`${uid}-vis`} value={form.visibility} onChange={(v) => set('visibility', v as PanelForm['visibility'])} options={VISIBILITY_OPTIONS} className="h-10" />
          </Field>
          {hasGroup && (
            <>
              <Field label="Agrupar por" htmlFor={`${uid}-group`}>
                <SelectField id={`${uid}-group`} value={form.groupBy} onChange={(v) => set('groupBy', v as PanelForm['groupBy'])} options={GROUP_BY_OPTIONS} className="h-10" />
              </Field>
              <Field label="Métrica" htmlFor={`${uid}-metric`}>
                <SelectField id={`${uid}-metric`} value={form.aggregateMetric} onChange={(v) => set('aggregateMetric', v as PanelForm['aggregateMetric'])} options={METRIC_OPTIONS} className="h-10" />
              </Field>
            </>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-semibold text-foreground">Onde salvar</legend>
          {editing ? (
            <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[13px] text-muted-foreground">
              Salvo <b className="text-foreground">{STORAGE_LABEL[editing.storage].toLowerCase()}</b>. {STORAGE_HELP[editing.storage]}
            </p>
          ) : (
            <div role="radiogroup" aria-label="Onde salvar" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(['local', 'squad'] as PanelStorage[]).map((opt) => {
                const disabled = opt === 'squad' && serverDisabled;
                const selected = form.storage === opt && !disabled;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => set('storage', opt)}
                    className={cn(
                      'flex min-h-11 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent',
                      disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span
                        aria-hidden="true"
                        className={cn('flex h-4 w-4 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-border')}
                      >
                        <span className={cn('h-2 w-2 rounded-full', selected ? 'bg-primary' : 'bg-transparent')} />
                      </span>
                      {opt === 'local' ? 'Neste navegador' : 'No servidor da squad'}
                      {opt === 'squad' && !disabled && <StatusChip tone="brand">Compartilha</StatusChip>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {disabled && serverUnavailable ? serverUnavailableText(serverUnavailable) : STORAGE_HELP[opt]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <p className="text-xs text-muted-foreground">A consulta roda no seu navegador, com o seu token do Jira.</p>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}
