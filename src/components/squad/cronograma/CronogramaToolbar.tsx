'use client';

import type { ReactNode } from 'react';
import { CalendarCog, Minus, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ALL, type Filters, type Grouping, type HierarchyLevel, type PeriodPreset } from '@/lib/cronograma/view';
import type { DateSource } from '@/lib/cronograma/schedule';
import { DAY_W, FIELD, FOCUS } from './styles';

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl border border-border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 min-w-6 rounded-lg px-3 text-sm font-semibold motion-safe:transition-colors ${FOCUS} ${
            value === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} w-full font-medium`}>
      {children}
    </select>
  );
}

export interface ToolbarProps {
  filters: Filters;
  onFilters: (f: Filters) => void;
  statuses: string[];
  types: string[];
  assignees: string[];
  grouping: Grouping;
  onGrouping: (g: Grouping) => void;
  level: HierarchyLevel;
  onLevel: (l: HierarchyLevel) => void;
  source: DateSource;
  onSource: (s: DateSource) => void;
  preset: PeriodPreset;
  onPreset: (p: PeriodPreset) => void;
  sprintLabel: string;
  customStart: string;
  customEnd: string;
  onCustomStart: (v: string) => void;
  onCustomEnd: (v: string) => void;
  dayWidth: number;
  onZoom: (delta: number) => void;
  simulating: boolean;
  onClearSim: () => void;
  canConfigure: boolean;
  onOpenFields: () => void;
}

export function CronogramaToolbar(p: ToolbarProps) {
  const set = (patch: Partial<Filters>) => p.onFilters({ ...p.filters, ...patch });
  return (
    <section aria-label="Controles do cronograma" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Agrupar"
          value={p.grouping}
          options={[{ id: 'story', label: 'Por história' }, { id: 'person', label: 'Por pessoa' }]}
          onChange={p.onGrouping}
        />
        <Segmented
          label="Fonte das datas"
          value={p.source}
          options={[{ id: 'jira', label: 'Datas do Jira' }, { id: 'horas', label: 'Sugestão pelas horas' }]}
          onChange={p.onSource}
        />
        <span className="flex-1" />
        {p.simulating && (
          <Button type="button" variant="outline" onClick={p.onClearSim} className="h-9 rounded-xl px-3 font-semibold">
            Limpar simulação
          </Button>
        )}
        {p.canConfigure && (
          <Button type="button" variant="outline" onClick={p.onOpenFields} className="h-9 gap-2 rounded-xl px-3 font-semibold">
            <CalendarCog className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Campos de data
          </Button>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Largura dos dias">
          <button
            type="button"
            aria-label="Diminuir a largura dos dias"
            disabled={p.dayWidth <= DAY_W.min}
            onClick={() => p.onZoom(-DAY_W.step)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 ${FOCUS}`}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[64px] text-center text-xs tabular-nums text-muted-foreground">{p.dayWidth} px/dia</span>
          <button
            type="button"
            aria-label="Aumentar a largura dos dias"
            disabled={p.dayWidth >= DAY_W.max}
            onClick={() => p.onZoom(DAY_W.step)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 ${FOCUS}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {p.grouping === 'story' && (
          <Field label="Mostrar">
            <Select value={p.level} onChange={(v) => p.onLevel(v as HierarchyLevel)}>
              <option value="story-to-subtask">Histórias e subtarefas</option>
              <option value="subtask-only">Só subtarefas</option>
              <option value="story-only">Só histórias</option>
            </Select>
          </Field>
        )}
        <Field label="Buscar" className="min-w-[200px] flex-[2]">
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={p.filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Chave, título ou pessoa"
              className={`${FIELD} w-full pl-9 font-medium placeholder:text-muted-foreground`}
            />
          </span>
        </Field>
        <Field label="Tipo">
          <Select value={p.filters.type} onChange={(v) => set({ type: v })}>
            <option value={ALL}>Todos os tipos</option>
            {p.types.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={p.filters.status} onChange={(v) => set({ status: v })}>
            <option value={ALL}>Todos os status</option>
            {p.statuses.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select value={p.filters.assignee} onChange={(v) => set({ assignee: v })}>
            <option value={ALL}>Todas as pessoas</option>
            {p.assignees.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Período" className="min-w-[200px]">
          <Select value={p.preset} onChange={(v) => p.onPreset(v as PeriodPreset)}>
            <option value="SPRINT_CURRENT">{p.sprintLabel}</option>
            <option value="NEXT_14_DAYS">Próximos 14 dias</option>
            <option value="CURRENT_MONTH">Este mês</option>
            <option value="CUSTOM">Datas livres</option>
          </Select>
        </Field>
        {p.preset === 'CUSTOM' && (
          <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-2">
            <Field label="De">
              <input type="date" value={p.customStart} max={p.customEnd || undefined} onChange={(e) => p.onCustomStart(e.target.value)} className={`${FIELD} w-full`} />
            </Field>
            <Field label="Até">
              <input type="date" value={p.customEnd} min={p.customStart || undefined} onChange={(e) => p.onCustomEnd(e.target.value)} className={`${FIELD} w-full`} />
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}
