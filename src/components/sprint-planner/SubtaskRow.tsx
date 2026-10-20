'use client';

import { useState } from 'react';
import { Link2, Lock } from 'lucide-react';
import { FIELD, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { DistributionPerson, DistributionSubtask, DistributionView } from '@/lib/sprint-planner/api';
import {
  assignablePeople, chainNote, ownershipOf, phaseLabelOf, startIsLocked, validateDates, type Distributable,
} from '@/lib/sprint-planner/distribution';
import { formatDay, formatHours } from '@/lib/sprint-planner/format';

export interface DateDraft { start: string; end: string }
export interface RowError { message: string; minStartDate: string | null }

const CLASS_TONE: Record<'DEV' | 'QA', Tone> = { DEV: 'brand', QA: 'warn' };

export interface SubtaskRowProps {
  sub: Distributable;
  view: DistributionView;
  byKey: Map<string, DistributionSubtask>;
  /** false = plano fora da etapa Distribuição: tudo somente leitura. */
  editable: boolean;
  busy: boolean;
  draft: DateDraft | undefined;
  error: RowError | undefined;
  onDraft: (key: string, d: DateDraft | null) => void;
  onClaim: (key: string, accountId?: string) => void;
  onRelease: (key: string) => void;
  onSave: (key: string, d: DateDraft) => void;
}

function Hours({ sub }: { sub: DistributionSubtask }) {
  return (
    <span className="tabular-nums text-xs text-muted-foreground" title="Horas que contam na conta">
      {formatHours(sub.countedH)}
      {sub.remainingH !== sub.estimateH && <> · estimado {formatHours(sub.estimateH)}</>}
    </span>
  );
}

/** Uma subtarefa na lista: livre (Pegar), minha (datas editáveis, Soltar) ou de colega (somente leitura, cadeado). */
export function SubtaskRow({ sub, view, byKey, editable, busy, draft, error, onDraft, onClaim, onRelease, onSave }: SubtaskRowProps) {
  const own = ownershipOf(sub, view.myAccountId);
  const leader = view.canEditPlan && editable;
  const [assignTo, setAssignTo] = useState('');
  const locked = startIsLocked(sub);
  const note = chainNote(sub, byKey);
  const canEditDates = editable && sub.canEditDates && own !== 'free';
  // Liderança: o servidor recusa (422) papel diferente do da subtarefa, então só entram pessoas do mesmo papel.
  const people: DistributionPerson[] = leader ? assignablePeople(view.people, sub.cls) : [];
  const pickedPerson = assignTo || (people.some((p) => p.accountId === view.myAccountId) ? view.myAccountId ?? '' : '');

  const start = draft?.start ?? sub.startDate ?? '';
  const end = draft?.end ?? sub.endDate ?? '';
  const dirty = !!draft && (draft.start !== (sub.startDate ?? '') || draft.end !== (sub.endDate ?? ''));
  const invalid = dirty && start && end ? validateDates(sub, view, start, end) : null;
  const min = sub.minStartDate ?? view.sprint.startDate;
  const idBase = `dist-${sub.key}`;

  const change = (patch: Partial<DateDraft>) => onDraft(sub.key, { start, end, ...patch });
  // Início travado (QA depois do Code Review): enviamos o início que o servidor já deu ou o primeiro possível.
  const effectiveStart = locked ? sub.startDate ?? sub.minStartDate ?? start : start;

  return (
    <li
      data-testid={`sub-${sub.key}`}
      data-owner={own}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3 sm:p-4',
        own === 'mine' ? 'border-primary/50 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-foreground">{sub.key}</span>
        <StatusChip tone={CLASS_TONE[sub.cls]}>{sub.cls}</StatusChip>
        <StatusChip tone="neutral">{sub.typeName ?? phaseLabelOf(sub)}</StatusChip>
        {sub.codeReview && <StatusChip tone="neutral">Code Review</StatusChip>}
        <Hours sub={sub} />
        {own === 'other' && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            {sub.assigneeName} · somente leitura
          </span>
        )}
        {own === 'mine' && <StatusChip tone="success" className="ml-auto">Sua</StatusChip>}
      </div>
      {sub.title && <p className="text-sm text-foreground">{sub.title}</p>}

      {note && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`cadeia-nota-${sub.key}`}>
          <Link2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          {note}
          {sub.minStartDate && <> ({formatDay(sub.minStartDate)})</>}
        </p>
      )}

      {own === 'free' && (
        <div className="flex flex-wrap items-center gap-2">
          {leader && (
            <>
              <label htmlFor={`${idBase}-quem`} className="sr-only">Quem fica com {sub.key}</label>
              <select
                id={`${idBase}-quem`}
                value={pickedPerson}
                onChange={(e) => setAssignTo(e.target.value)}
                className={cn(FIELD, 'h-10 min-w-[10rem] max-w-full')}
              >
                <option value="">Escolha a pessoa</option>
                {people.map((p) => (
                  <option key={p.accountId} value={p.accountId}>{p.name} ({p.role}){p.accountId === view.myAccountId ? ' · você' : ''}</option>
                ))}
              </select>
            </>
          )}
          {editable && leader ? (
            <ModalButton variant="primary" disabled={busy || !pickedPerson} onClick={() => onClaim(sub.key, pickedPerson)}>
              Atribuir<span className="sr-only"> {sub.key}</span>
            </ModalButton>
          ) : editable && sub.canClaim ? (
            <ModalButton variant="primary" disabled={busy} onClick={() => onClaim(sub.key)}>
              Pegar<span className="sr-only"> {sub.key}</span>
            </ModalButton>
          ) : (
            <span className="text-xs text-muted-foreground">{editable ? 'Sem responsável. Você não pode pegar esta subtarefa.' : 'Sem responsável.'}</span>
          )}
        </div>
      )}

      {own !== 'free' && (
        <div className="flex flex-col gap-2">
          {own === 'other' && !canEditDates && (
            <p className="text-sm tabular-nums text-foreground" data-testid={`datas-leitura-${sub.key}`}>
              {sub.startDate && sub.endDate ? `${formatDay(sub.startDate)} a ${formatDay(sub.endDate)}` : 'Ainda sem datas'}
            </p>
          )}
          {own === 'mine' && !canEditDates && (
            <p className="text-sm tabular-nums text-foreground">
              {sub.startDate && sub.endDate ? `${formatDay(sub.startDate)} a ${formatDay(sub.endDate)}` : 'Ainda sem datas'}
            </p>
          )}
          {canEditDates && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${idBase}-ini`} className="text-xs font-medium text-muted-foreground">Início</label>
                <input
                  id={`${idBase}-ini`}
                  type="date"
                  value={locked ? effectiveStart : start}
                  min={min}
                  max={view.sprint.endDate}
                  disabled={locked || busy}
                  onChange={(e) => change({ start: e.target.value })}
                  className={cn(FIELD, 'h-10 w-40 disabled:cursor-not-allowed disabled:opacity-70')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${idBase}-fim`} className="text-xs font-medium text-muted-foreground">Fim</label>
                <input
                  id={`${idBase}-fim`}
                  type="date"
                  value={end}
                  min={locked ? effectiveStart || min : start || min}
                  max={view.sprint.endDate}
                  disabled={busy}
                  onChange={(e) => change({ end: e.target.value })}
                  className={cn(FIELD, 'h-10 w-40')}
                />
              </div>
              {dirty && (
                <>
                  <ModalButton variant="primary" disabled={busy || !!invalid || !end || !effectiveStart} onClick={() => onSave(sub.key, { start: effectiveStart, end })}>
                    Salvar datas<span className="sr-only"> de {sub.key}</span>
                  </ModalButton>
                  <ModalButton variant="ghost" disabled={busy} onClick={() => onDraft(sub.key, null)}>Descartar</ModalButton>
                </>
              )}
            </div>
          )}
          {canEditDates && locked && (
            <p className="text-xs text-muted-foreground">O início acompanha a etapa anterior: se ela mudar, este teste muda junto.</p>
          )}
          {invalid && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{invalid}</p>}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400" data-testid={`erro-${sub.key}`}>
              {error.message}
              {error.minStartDate && !locked && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="min-h-6 rounded-md px-1 font-semibold underline underline-offset-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => change({ start: error.minStartDate as string })}
                  >
                    Usar {formatDay(error.minStartDate)} como início
                  </button>
                </>
              )}
            </p>
          )}
          {editable && (own === 'mine' || leader) && (
            <div>
              <ModalButton variant="ghost" disabled={busy} onClick={() => onRelease(sub.key)}>
                Soltar<span className="sr-only"> {sub.key}</span>
              </ModalButton>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
