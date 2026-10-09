'use client';

import React from 'react';
import { Trash2, Plus, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImpactMetric, ChartType } from './types';
import { ChartRenderer } from './ChartRenderer';
import { CHART_PRESETS, getCategoryColor } from './chartPresets';
import { ControlledInput } from './ControlledFields';

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ElementType }[] = [
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'pie', label: 'Pizza', icon: PieChartIcon },
  { value: 'line', label: 'Linha', icon: LineChartIcon },
];

export function ChartTypePicker({ value, onChange }: { value: ChartType | undefined; onChange: (type: ChartType) => void }) {
  const current = value || 'bar';
  return (
    <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit">
      {CHART_TYPE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.label}
          className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center transition-all',
            current === opt.value
              ? 'bg-violet-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20'
          )}
        >
          <opt.icon className="h-3.5 w-3.5" />
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
    <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit shrink-0">
      {CHART_DISPLAY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.title}
          className={cn(
            'h-7 px-2 rounded-md flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all',
            current === opt.value
              ? 'bg-violet-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20'
          )}
        >
          <opt.icon className="h-3 w-3" /> {opt.label}
        </button>
      ))}
    </div>
  );
}

function PresetPicker({ onApply }: { onApply: (preset: typeof CHART_PRESETS[number]) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button
        variant="ghost" size="sm"
        onClick={() => setOpen(v => !v)}
        className="h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20 gap-1"
      >
        <Sparkles className="h-3 w-3" /> Gráfico Pronto
      </Button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1.5">
          {CHART_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => { onApply(preset); setOpen(false); }}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
            >
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{preset.label}</p>
              <p className="text-[9px] text-slate-400">{preset.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Lista de campo+valor livre (ex: "Economia (R$)": 5000) pra entregas que
// valem um número pra mostrar na apresentação, mesmo sem ser ticket do Jira.
// Sem id por item: a lista inteira é sempre substituída de uma vez (mesmo
// padrão que evidence.* já usa), edição/remoção por índice já é suficiente.
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ChartTypePicker value={chartType} onChange={onChartTypeChange} />
        <PresetPicker onApply={onApplyPreset} />
      </div>
      <ControlledInput
        value={chartTitle || ''}
        onChange={onChartTitleChange}
        placeholder="Título do gráfico — ex: Bugs por Severidade"
        className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
      />
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <ControlledInput
              value={m.field}
              onChange={(v: string) => updateRow(i, { field: v })}
              placeholder="Campo — ex: Economia (R$)"
              className="flex-1 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
            />
            <ControlledInput
              type="number"
              value={m.value ? String(m.value) : ''}
              onChange={(v: string) => updateRow(i, { value: Number(v) || 0 })}
              placeholder="Valor"
              className="w-24 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
            />
            <Button
              variant="ghost" size="icon" onClick={() => removeRow(i)}
              aria-label="Remover métrica"
              title="Remover métrica"
              className="h-8 w-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost" size="sm"
        onClick={() => onChange([...metrics, { field: '', value: 0 }])}
        className="h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20 gap-1"
      >
        <Plus className="h-3 w-3" /> Adicionar Métrica
      </Button>

      {chartData.length > 0 && (
        <ChartRenderer type={chartType} title={chartTitle || 'Impacto'} data={chartData} height={160} defaultColor="hsl(262, 83%, 65%)" />
      )}
    </div>
  );
}
