'use client';

import { GraduationCap, Loader2, Save } from 'lucide-react';
import { ModalButton, SelectField, StatusChip, BRAND_TEXT } from '@/components/room-kit';
import type { ResolvedPersonConfig } from '@/app/squad/api';
import { formatHours } from '@/lib/roster/numbers';
import { cn } from '@/lib/utils';
import { DecimalInput } from './DecimalInput';
import { PERSON_LIMITS, personConfigNumbers, personConfigTotal, type PersonConfigDraft } from './hooks/usePersonConfig';
import { FIELD_40, ICON_STROKE } from './styles';

const PAPEL_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: 'DEV', label: 'DEV' },
  { value: 'QA', label: 'QA' },
];

interface PersonConfigPanelProps {
  loading: boolean;
  saving: boolean;
  resolved?: ResolvedPersonConfig;
  draft?: PersonConfigDraft;
  sprintId?: string;
  onChange: (patch: Partial<PersonConfigDraft>) => void;
  onSave: () => void;
}

function Field({ label, inherited, inheritedLabel, range, children }: { label: string; inherited?: boolean; inheritedLabel?: string; range: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground">
        {label}
        {inherited && <StatusChip tone="neutral" className="h-5 px-2 text-xs font-semibold">{inheritedLabel ?? 'Herdado'}</StatusChip>}
      </span>
      {children}
      <span className="text-xs text-muted-foreground">{range}</span>
    </div>
  );
}

/**
 * Papel & Capacidade da pessoa na sprint: papel DEV/QA, dias de codificação/teste e de regressivo, horas
 * produtivas por dia. Campo não definido herda da sprint anterior e depois do padrão da squad ("Herdado").
 * Fica logo abaixo da linha da pessoa.
 */
export function PersonConfigPanel({ loading, saving, resolved, draft, sprintId, onChange, onSave }: PersonConfigPanelProps) {
  const title = `Papel & Capacidade — ${sprintId ? `Sprint ${sprintId}` : 'Sem sprint ativa (padrão da squad)'}`;
  const numbers = draft ? personConfigNumbers(draft) : null;
  return (
    <div className="mx-4 mb-3.5 flex flex-col gap-3.5 rounded-[14px] border border-border bg-muted/40 px-[18px] py-4 xl:mx-5">
      <span className="flex items-center gap-2 text-sm font-bold text-foreground">
        <GraduationCap className={cn('h-4 w-4', BRAND_TEXT)} strokeWidth={ICON_STROKE} aria-hidden="true" />
        {title}
      </span>
      {loading || !draft || !resolved || !numbers ? (
        <span role="status" className="flex items-center gap-2.5 text-[13px] text-muted-foreground motion-safe:animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={ICON_STROKE} aria-hidden="true" />
          Carregando papel &amp; capacidade
        </span>
      ) : (
        <>
          <p className="max-w-3xl text-[13px] text-muted-foreground">
            Modelo separado das horas reais da tabela: a capacidade sai dos dias de cada fase da sprint (codificação/teste e regressivo) vezes as horas produtivas por dia, com papel DEV ou QA.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Papel" inherited={resolved.papelInherited} inheritedLabel={resolved.papelSource ? `Herdado: ${resolved.papelSource}` : 'Herdado'} range="Não definido · DEV · QA">
              <SelectField aria-label="Papel DEV ou QA" value={draft.papel} onChange={(papel) => onChange({ papel })} options={PAPEL_OPTIONS} className="h-10 text-sm" />
            </Field>
            <Field label="Dias codificação/teste" inherited={resolved.diasCodificacaoTesteInherited} range={`${PERSON_LIMITS.dias.min}–${PERSON_LIMITS.dias.max}`}>
              <DecimalInput
                integer
                aria-label="Dias de codificação e teste"
                value={draft.diasCodificacaoTeste}
                onValueChange={(v) => onChange({ diasCodificacaoTeste: v })}
                invalid={!(numbers.dias1 >= 0 && numbers.dias1 <= PERSON_LIMITS.dias.max)}
                className={cn(FIELD_40, 'tabular-nums')}
              />
            </Field>
            <Field label="Dias regressivo" inherited={resolved.diasRegressivoInherited} range={`${PERSON_LIMITS.dias.min}–${PERSON_LIMITS.dias.max}`}>
              <DecimalInput
                integer
                aria-label="Dias de regressivo"
                value={draft.diasRegressivo}
                onValueChange={(v) => onChange({ diasRegressivo: v })}
                invalid={!(numbers.dias2 >= 0 && numbers.dias2 <= PERSON_LIMITS.dias.max)}
                className={cn(FIELD_40, 'tabular-nums')}
              />
            </Field>
            <Field label="Horas produtivas/dia" inherited={resolved.horasProdutivasInherited} range={`${PERSON_LIMITS.horas.min}–${PERSON_LIMITS.horas.max} · passo 0,25`}>
              <DecimalInput
                aria-label="Horas produtivas por dia"
                value={draft.horasProdutivas}
                onValueChange={(v) => onChange({ horasProdutivas: v })}
                invalid={!(numbers.horas >= 0 && numbers.horas <= PERSON_LIMITS.horas.max)}
                className={cn(FIELD_40, 'tabular-nums')}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={cn('text-sm font-bold', BRAND_TEXT)}>Capacidade total no período: {formatHours(personConfigTotal(numbers))} h</span>
            <ModalButton variant="primary" className="h-9 text-[13px]" disabled={saving || !numbers.valid} onClick={onSave}>
              <Save className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
              {saving ? 'Salvando…' : 'Salvar papel & capacidade'}
            </ModalButton>
          </div>
        </>
      )}
    </div>
  );
}
