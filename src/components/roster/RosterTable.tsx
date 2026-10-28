'use client';

import * as React from 'react';
import { Calculator, ChevronDown, FileSpreadsheet, GraduationCap, RotateCcw, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { IconButton, ModalButton, StatusChip, BRAND_TEXT, type Tone } from '@/components/room-kit';
import type { SquadMember } from '@/lib/types';
import {
  isMemberOverridden,
  memberSource,
  sprintHours,
  systemHoursOf,
  variationPercent,
  weeklyHours,
  type CapacityRule,
  type MemberSource,
} from '@/lib/roster/calc';
import { formatHours } from '@/lib/roster/numbers';
import { cn } from '@/lib/utils';
import { DecimalInput } from './DecimalInput';
import type { useMemberEdits } from './hooks/useMemberEdits';
import type { usePersonConfig } from './hooks/usePersonConfig';
import { PersonConfigPanel } from './PersonConfigPanel';
import { RoleSelect } from './RoleSelect';
import { FIELD_32, ICON_STROKE, ROSTER_CARD, ROSTER_GRID_COLS } from './styles';

const SOURCE_VIEW: Record<MemberSource, { label: string; tone: Tone; icon: typeof Calculator }> = {
  IMPORTED: { label: 'Planilha Excel', tone: 'brand', icon: FileSpreadsheet },
  MANAGER: { label: 'Gestor', tone: 'success', icon: SlidersHorizontal },
  SYSTEM: { label: 'Sugestão sistema', tone: 'neutral', icon: Calculator },
};

const COLUMNS = ['Pessoa', 'Cargo / função', 'Sugeridas (sistema)', 'Reais (gestor)', 'Semanal (h)', 'Sprint (10 dias)', 'Variação', 'Fonte da carga'];

/** Rótulo que só aparece quando a linha vira cartão (abaixo de 1280 px); no desktop a coluna tem cabeçalho. */
function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground xl:hidden">{children}</span>;
}

interface RosterTableProps {
  members: SquadMember[];
  rule: CapacityRule;
  isAdmin: boolean;
  canManageTeam: boolean;
  edits: ReturnType<typeof useMemberEdits>;
  person: ReturnType<typeof usePersonConfig>;
  sprintId?: string;
  onRemove: (m: SquadMember) => void;
  /** Estados vazios (time vazio, filtro sem resultado) entram no rodapé do cartão. */
  footer?: React.ReactNode;
}

export function RosterTable({ members, rule, isAdmin, canManageTeam, edits, person, sprintId, onRemove, footer }: RosterTableProps) {
  return (
    <section aria-label="Integrantes da squad" className={cn(ROSTER_CARD, 'overflow-hidden')}>
      <div role="table" aria-label="Time da squad" aria-rowcount={members.length + 1}>
        <div role="row" className={cn('hidden items-center gap-3 bg-muted/60 px-5 py-3 text-xs font-bold leading-tight text-muted-foreground xl:grid', ROSTER_GRID_COLS)}>
          {COLUMNS.map((c) => (
            <span key={c} role="columnheader">{c}</span>
          ))}
          <span role="columnheader" className="text-right">Ações</span>
        </div>
        {members.map((m) => (
          <div key={m.jiraAccountId} role="rowgroup" className="border-t border-border first:border-t-0 xl:first:border-t">
            <RosterRow m={m} rule={rule} isAdmin={isAdmin} canManageTeam={canManageTeam} edits={edits} person={person} onRemove={onRemove} />
            {person.openId === m.jiraAccountId && (
              <PersonConfigPanel
                loading={person.loadingId === m.jiraAccountId}
                saving={person.savingId === m.jiraAccountId}
                resolved={person.resolved[m.jiraAccountId]}
                draft={person.drafts[m.jiraAccountId]}
                sprintId={sprintId}
                onChange={(patch) => person.patch(m.jiraAccountId, patch)}
                onSave={() => person.save(m.jiraAccountId)}
              />
            )}
          </div>
        ))}
      </div>
      {footer}
    </section>
  );
}

function RosterRow({
  m, rule, isAdmin, canManageTeam, edits, person, onRemove,
}: Pick<RosterTableProps, 'rule' | 'isAdmin' | 'canManageTeam' | 'edits' | 'person' | 'onRemove'> & { m: SquadMember }) {
  const id = m.jiraAccountId;
  const draft = edits.draftOf(m);
  const suggested = systemHoursOf(m, rule);
  // Linha com horas inválidas não entra nas contas: mostra o que está gravado até a pessoa corrigir.
  const real = draft.valid ? draft.capacity : (m.capacityHoursPerDay ?? rule.baseHours);
  const overridden = isMemberOverridden(m, real, suggested);
  const source = SOURCE_VIEW[memberSource(m, real, suggested)];
  const diff = variationPercent(real, suggested);
  const saving = edits.savingId === id;
  const open = person.openId === id;
  const SourceIcon = source.icon;

  return (
    <div
      role="row"
      className={cn(
        'grid grid-cols-2 items-start gap-x-4 gap-y-3 px-4 py-3.5 transition-colors duration-fast hover:bg-muted/40 sm:grid-cols-3',
        'xl:items-center xl:gap-3 xl:px-5 xl:py-2.5',
        ROSTER_GRID_COLS
      )}
    >
      <div role="cell" className="col-span-full flex min-w-0 items-center gap-2.5 xl:col-span-1">
        <InitialsAvatar name={m.displayName || id} email={m.email} userId={m.claimedByUid} className="h-8 w-8 text-xs" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground" title={m.displayName}>{m.displayName}</span>
          <span className="truncate text-xs text-muted-foreground" title={m.email || id}>{m.email || id}</span>
        </div>
      </div>

      <div role="cell" className="flex min-w-0 flex-col gap-1">
        <CellLabel>Cargo / função</CellLabel>
        <RoleSelect
          aria-label={`Cargo de ${m.displayName}`}
          value={draft.role}
          onChange={(r) => edits.setRole(id, r)}
          isAdmin={isAdmin}
          editable={canManageTeam}
          className="w-full xl:w-[140px]"
        />
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Sugeridas (sistema)</CellLabel>
        <StatusChip tone="neutral" className="h-6 w-fit border border-border bg-transparent text-[13px] font-bold tabular-nums">
          {formatHours(suggested)} h / dia
        </StatusChip>
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Reais (gestor)</CellLabel>
        <span className="flex items-center gap-1.5">
          <DecimalInput
            aria-label={`Horas reais por dia de ${m.displayName}`}
            value={draft.capacityText}
            onValueChange={(t) => edits.setCapacityText(id, t)}
            invalid={!draft.valid}
            className={cn(FIELD_32, 'w-16 border-primary/40 text-center text-sm font-bold tabular-nums')}
          />
          <span className="text-xs text-muted-foreground">h/dia</span>
        </span>
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Semanal (h)</CellLabel>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatHours(weeklyHours(real), 1)} h</span>
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Sprint (10 dias)</CellLabel>
        <span className={cn('text-sm font-semibold tabular-nums', BRAND_TEXT)}>{formatHours(sprintHours(real), 1)} h</span>
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Variação</CellLabel>
        {diff === 0 ? (
          <span className="text-xs font-semibold text-muted-foreground">0%</span>
        ) : (
          <StatusChip tone={diff > 0 ? 'success' : 'warn'} className="w-fit tabular-nums font-bold">
            {diff > 0 ? `+${diff}%` : `${diff}%`}
          </StatusChip>
        )}
      </div>

      <div role="cell" className="flex flex-col gap-1">
        <CellLabel>Fonte da carga</CellLabel>
        <StatusChip tone={source.tone} className="h-6 w-fit font-bold">
          <SourceIcon className="h-[13px] w-[13px]" strokeWidth={ICON_STROKE} aria-hidden="true" />
          {source.label}
        </StatusChip>
      </div>

      <div role="cell" className="col-span-full flex flex-wrap items-center justify-end gap-1 xl:col-span-1 xl:flex-nowrap">
        <IconButton
          size="sm"
          label="Papel e capacidade"
          icon={open ? ChevronDown : GraduationCap}
          pressed={open}
          aria-expanded={open}
          className="border-transparent xl:border-border"
          onClick={() => person.toggle(id)}
        />
        {overridden && (
          <IconButton
            size="sm"
            label="Restaurar sugestão do sistema"
            icon={RotateCcw}
            disabled={saving}
            className="border-transparent text-muted-foreground xl:border-border"
            onClick={() => edits.restoreRow(m)}
          />
        )}
        <ModalButton variant="primary" className="h-8 rounded-lg px-2.5 text-xs" disabled={saving || !draft.valid} onClick={() => edits.saveRow(m)}>
          <Save className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
          {saving ? 'Salvando…' : 'Salvar'}
        </ModalButton>
        {canManageTeam && (
          <IconButton
            size="sm"
            label={`Remover ${m.displayName} da squad`}
            icon={Trash2}
            className="border-transparent text-red-700 hover:bg-red-500/10 dark:text-red-300 xl:border-border"
            onClick={() => onRemove(m)}
          />
        )}
      </div>
    </div>
  );
}
