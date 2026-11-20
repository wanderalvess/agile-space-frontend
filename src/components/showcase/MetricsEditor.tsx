'use client';

import React from 'react';
import { Trash2, Plus, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { FOCUS_RING, IconButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ImpactMetric, ChartType } from './types';
import { ChartRenderer } from './ChartRenderer';
import { CHART_PRESETS, REVIEW_CHART_COLOR, getCategoryColor } from './chartPresets';
import { ControlledInput } from './ControlledFields';
import { CARD_INPUT } from './TaskCardFields';

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ElementType }[] = [
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'pie', label: 'Pizza', icon: PieChartIcon },
  { value: 'line', label: 'Linha', icon: LineChartIcon },
];

const SEGMENT_ON = 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground';
const SEGMENT_OFF = 'text-muted-foreground hover:bg-accent hover:text-foreground';

export function ChartTypePicker({ value, onChange }: { value: ChartType | undefined; onChange: (type: ChartType) => void }) {
  const current = value || 'bar';
  return (
    <div role="group" aria-label="Tipo de gráfico" className="flex w-fit items-center gap-1 rounded-lg border border-border bg-background p-0.5">
      {CHART_TYPE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={current === opt.value}
          className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors max-sm:h-11 max-sm:w-11', current === opt.value ? SEGMENT_ON : SEGMENT_OFF, FOCUS_RING)}
        >
          <opt.icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

const CHART_DISPLAY_OPTIONS: { value: 'compact' | 'featured'; label: string; title: string; icon: React.ElementType }[] = [
  { value: 'compact', label: 'Compacto', title: 'Aparece pequeno junto com os detalhes', icon: Minimize2 },
  { value: 'featured', label: 'Destaque', title: 'Vira o destaque grande da apresentação (substitui a evidência na tela principal)', icon: Maximize2 },
];

export function ChartDisplayPicker({ value, onChange }: { value: 'compact' | 'featured' | undefined; onChange: (v: 'compact' | 'featured') => void }) {
  const current = value || 'compact';
  return (
    <div role="group" aria-label="Tamanho do gráfico na apresentação" className="flex w-fit shrink-0 items-center gap-1 rounded-lg border border-border bg-background p-0.5">
      {CHART_DISPLAY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.title}
          aria-pressed={current === opt.value}
          className={cn('flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors max-sm:h-11', current === opt.value ? SEGMENT_ON : SEGMENT_OFF, FOCUS_RING)}
        >
          <opt.icon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {opt.label}
        </button>
      ))}
    </div>
  );
}

const GHOST_ACTION = 'inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 max-sm:h-11 [.theme-totvs:not(.dark)_&]:text-foreground';

function PresetPicker({ onApply }: { onApply: (preset: typeof CHART_PRESETS[number]) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className={cn(GHOST_ACTION, FOCUS_RING)}>
        <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Gráfico pronto
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {CHART_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => { onApply(preset); setOpen(false); }}
              className={cn('w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent', FOCUS_RING)}
            >
              <p className="m-0 text-[13px] font-semibold">{preset.label}</p>
              <p className="m-0 text-xs text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Lista de campo+valor livre (ex.: "Economia (R$)": 5000) para entregas que valem um número para mostrar na
// apresentação, mesmo sem ser ticket do Jira. Sem id por item: a lista inteira é sempre substituída de uma vez
// (mesmo padrão que evidence.* já usa), edição/remoção por índice já é suficiente.
export function MetricsEditor({
  metrics, onChange, chartType, onChartTypeChange, chartTitle, onChartTitleChange, onApplyPreset,
}: {
  metrics: ImpactMetric[]; onChange: (metrics: ImpactMetric[]) => void;
  chartType?: ChartType; onChartTypeChange: (type: ChartType) => void;
  chartTitle?: string; onChartTitleChange: (title: string) => void;
  onApplyPreset: (preset: typeof CHART_PRESETS[number]) => void;
}) {
  const updateRow = (i: number, patch: Partial<ImpactMetric>) => {
    onChange(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };
  const removeRow = (i: number) => onChange(metrics.filter((_, idx) => idx !== i));
  const chartData = metrics.filter(m => (m.field || '').trim()).map(m => ({ name: m.field, value: m.value, color: getCategoryColor(m.field) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <ChartTypePicker value={chartType} onChange={onChartTypeChange} />
        <PresetPicker onApply={onApplyPreset} />
      </div>
      <ControlledInput
        value={chartTitle || ''}
        onChange={onChartTitleChange}
        placeholder="Título do gráfico, ex.: Bugs por severidade"
        aria-label="Título do gráfico"
        className={cn(CARD_INPUT, 'font-medium')}
      />
      <div className="flex flex-col gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <ControlledInput
              value={m.field}
              onChange={(v: string) => updateRow(i, { field: v })}
              placeholder="Campo, ex.: Economia (R$)"
              aria-label={`Campo da métrica ${i + 1}`}
              className={cn(CARD_INPUT, 'flex-1 font-medium')}
            />
            <ControlledInput
              type="number"
              value={m.value ? String(m.value) : ''}
              onChange={(v: string) => updateRow(i, { value: Number(v) || 0 })}
              placeholder="Valor"
              aria-label={`Valor da métrica ${i + 1}`}
              className={cn(CARD_INPUT, 'w-24 font-medium tabular-nums')}
            />
            <IconButton size="sm" label="Remover métrica" icon={Trash2} onClick={() => removeRow(i)} className="h-9 w-9 shrink-0 border-transparent hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11" />
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onChange([...metrics, { field: '', value: 0 }])} className={cn(GHOST_ACTION, 'w-fit', FOCUS_RING)}>
        <Plus className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Adicionar métrica
      </button>

      {chartData.length > 0 && (
        <ChartRenderer type={chartType} title={chartTitle || 'Impacto'} data={chartData} height={160} defaultColor={REVIEW_CHART_COLOR} />
      )}
    </div>
  );
}
