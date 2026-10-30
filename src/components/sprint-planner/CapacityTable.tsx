'use client';

import { FIELD, RoleChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { CapacityRow, CapacityUpdateRequest, ReserveMode } from '@/lib/sprint-planner/api';
import { formatHours, formatPct } from '@/lib/sprint-planner/format';

type Field = 'diasCod' | 'diasReg' | 'horasProdutivas' | 'focusPct';

const NUM = cn(FIELD, 'h-9 w-[76px] px-2 text-right tabular-nums');

/** Campo numérico que grava ao sair (ou Enter) só quando o valor mudou. */
function NumberCell({
  value,
  label,
  min,
  max,
  step,
  onCommit,
}: {
  value: number | null;
  label: string;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  return (
    <input
      key={String(value)}
      type="number"
      inputMode="decimal"
      aria-label={label}
      className={NUM}
      defaultValue={value ?? ''}
      min={min}
      max={max}
      step={step}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onBlur={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (raw === '') { e.target.value = value == null ? '' : String(value); return; }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < min || n > max) { e.target.value = value == null ? '' : String(value); return; }
        if (n !== value) onCommit(n);
      }}
    />
  );
}

function Inherited({ on, source }: { on: boolean; source: string | null }) {
  if (!on) return null;
  return <span className="block text-xs text-muted-foreground" title={source ?? undefined}>herdado</span>;
}

interface RowProps {
  row: CapacityRow;
  mode: ReserveMode;
  canEdit: boolean;
  onUpdate: (accountId: string, body: CapacityUpdateRequest) => void;
}

function useCells({ row, mode, canEdit, onUpdate }: RowProps) {
  const commit = (field: Field) => (v: number) => {
    if (field === 'focusPct') onUpdate(row.accountId, { focusPct: v });
    else onUpdate(row.accountId, { [field]: v } as CapacityUpdateRequest);
  };
  const papel = canEdit ? (
    <select
      aria-label={`Papel de ${row.name}`}
      className={cn(FIELD, 'h-9 w-[84px] px-2')}
      // Sem papel definido, o seletor não pode mostrar "DEV": a pessoa ficaria fora da capacidade de DEV e de QA
      // enquanto a tela diz o contrário. Mostra "Definir" até a liderança escolher.
      value={row.papel === 'QA' || row.papel === 'DEV' ? row.papel : ''}
      onChange={(e) => onUpdate(row.accountId, { papel: e.target.value as 'DEV' | 'QA' })}
    >
      {row.papel !== 'QA' && row.papel !== 'DEV' && (
        <option value="" disabled>
          Definir
        </option>
      )}
      <option value="DEV">DEV</option>
      <option value="QA">QA</option>
    </select>
  ) : (
    <RoleChip category={row.papel} label={row.papel || '–'} />
  );
  const num = (field: Field, value: number | null, label: string, min: number, max: number, step: number) =>
    canEdit ? (
      <NumberCell value={value} label={`${label} de ${row.name}`} min={min} max={max} step={step} onCommit={commit(field)} />
    ) : (
      <span className="tabular-nums text-foreground">{value ?? '–'}</span>
    );
  const foco =
    mode !== 'FOCO' ? (
      <span className="text-muted-foreground" title="Fator de foco só vale no modo fator de foco">–</span>
    ) : canEdit ? (
      <div className="flex items-center gap-1">
        <NumberCell value={row.personFocusPct ?? row.focusPct} label={`Fator de foco de ${row.name}`} min={1} max={100} step={1} onCommit={commit('focusPct')} />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    ) : (
      <span className="tabular-nums">{formatPct(row.focusPct)}</span>
    );
  const descontos = row.absencesHours + row.holidaysHours;
  const ausencias = (
    <span className={cn('tabular-nums', descontos > 0 ? 'text-foreground' : 'text-muted-foreground')}>
      {descontos > 0 ? `−${formatHours(descontos)}` : '–'}
      {row.holidaysHours > 0 && <span className="block text-xs text-muted-foreground">feriados {formatHours(row.holidaysHours)}</span>}
    </span>
  );
  const capacidade = (
    <span className="flex flex-col items-end">
      <strong className="tabular-nums text-foreground" data-testid={`cap-${row.accountId}`}>{formatHours(row.capacityHours)}</strong>
      <span className="text-xs tabular-nums text-muted-foreground">base {formatHours(row.baseHours)}</span>
    </span>
  );
  const incluida = canEdit ? (
    <label className="inline-flex min-h-6 items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[hsl(var(--primary))]"
        checked={row.included}
        onChange={(e) => onUpdate(row.accountId, { included: e.target.checked })}
      />
      Nesta sprint
    </label>
  ) : !row.included ? (
    <span className="text-xs text-muted-foreground">fora desta sprint</span>
  ) : null;
  return { papel, num, foco, ausencias, capacidade, incluida };
}

function TableRow(props: RowProps) {
  const { row } = props;
  const c = useCells(props);
  return (
    <tr className={cn('border-t border-border', !row.included && 'opacity-60')}>
      <td className="py-2.5 pl-4 pr-3">
        <span className="block font-semibold text-foreground">{row.name || row.accountId}</span>
        {c.incluida}
      </td>
      <td className="px-2 py-2.5">{c.papel}<Inherited on={row.papelInherited} source={row.papelSource} /></td>
      <td className="px-2 py-2.5">{c.num('diasCod', row.diasCod, 'Dias de codificação e teste', 0, 60, 1)}<Inherited on={row.diasCodInherited} source={row.diasCodSource} /></td>
      <td className="px-2 py-2.5">{c.num('diasReg', row.diasReg, 'Dias de regressivo', 0, 60, 1)}<Inherited on={row.diasRegInherited} source={row.diasRegSource} /></td>
      <td className="px-2 py-2.5">{c.num('horasProdutivas', row.horasProdutivas, 'Horas por dia', 0, 24, 0.5)}<Inherited on={row.horasProdutivasInherited} source={row.horasProdutivasSource} /></td>
      <td className="px-2 py-2.5">{c.foco}</td>
      <td className="px-2 py-2.5">{c.ausencias}</td>
      <td className="py-2.5 pl-2 pr-4 text-right">{c.capacidade}</td>
    </tr>
  );
}

function CardRow(props: RowProps) {
  const { row } = props;
  const c = useCells(props);
  const item = (label: string, node: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {node}
    </div>
  );
  return (
    <li className={cn('flex flex-col gap-1 border-t border-border px-4 py-3', !row.included && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{row.name || row.accountId}</span>
          {c.incluida}
        </div>
        {c.capacidade}
      </div>
      {item('Papel', c.papel)}
      {item('Dias cod./teste', c.num('diasCod', row.diasCod, 'Dias de codificação e teste', 0, 60, 1))}
      {item('Dias regressivo', c.num('diasReg', row.diasReg, 'Dias de regressivo', 0, 60, 1))}
      {item('Horas por dia', c.num('horasProdutivas', row.horasProdutivas, 'Horas por dia', 0, 24, 0.5))}
      {props.mode === 'FOCO' && item('Fator de foco', c.foco)}
      {item('Ausências e feriados', c.ausencias)}
    </li>
  );
}

/** Capacidade por pessoa: tabela no desktop, cartões no celular. Edição só com `canEdit`. */
export function CapacityTable({
  people,
  mode,
  canEdit,
  onUpdate,
}: {
  people: CapacityRow[];
  mode: ReserveMode;
  canEdit: boolean;
  onUpdate: (accountId: string, body: CapacityUpdateRequest) => void;
}) {
  if (people.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma pessoa na squad para esta sprint. Confira o time da squad.</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-muted-foreground">
              <th scope="col" className="py-2 pl-4 pr-3">Pessoa</th>
              <th scope="col" className="px-2 py-2">Papel</th>
              <th scope="col" className="px-2 py-2">Dias cod./teste</th>
              <th scope="col" className="px-2 py-2">Dias regressivo</th>
              <th scope="col" className="px-2 py-2">Horas/dia</th>
              <th scope="col" className="px-2 py-2">Fator de foco</th>
              <th scope="col" className="px-2 py-2">Ausências</th>
              <th scope="col" className="py-2 pl-2 pr-4 text-right">Capacidade</th>
            </tr>
          </thead>
          <tbody>
            {people.map((r) => <TableRow key={r.accountId} row={r} mode={mode} canEdit={canEdit} onUpdate={onUpdate} />)}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden" aria-label="Capacidade por pessoa">
        {people.map((r) => <CardRow key={r.accountId} row={r} mode={mode} canEdit={canEdit} onUpdate={onUpdate} />)}
      </ul>
    </>
  );
}
