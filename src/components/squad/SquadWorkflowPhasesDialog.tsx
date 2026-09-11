'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Workflow, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SquadWorkflowPhase } from '@/lib/types';

// Paleta fixa de classes Tailwind — só cores literais escritas aqui (dentro de
// src/components, coberto pelo content glob do tailwind.config.ts) geram CSS
// de verdade via JIT. Um admin não pode digitar uma classe livre: a cor
// sempre vem desta lista, nunca de texto arbitrário salvo no JSONB.
const PHASE_COLOR_OPTIONS: { value: string; name: string }[] = [
  { value: 'bg-blue-600 dark:bg-blue-500', name: 'Azul' },
  { value: 'bg-teal-600 dark:bg-teal-500', name: 'Teal' },
  { value: 'bg-purple-600 dark:bg-purple-500', name: 'Roxo' },
  { value: 'bg-amber-600 dark:bg-amber-500', name: 'Âmbar' },
  { value: 'bg-indigo-600 dark:bg-indigo-500', name: 'Índigo' },
  { value: 'bg-rose-600 dark:bg-rose-500', name: 'Rosa' },
  { value: 'bg-emerald-600 dark:bg-emerald-500', name: 'Verde' },
  { value: 'bg-cyan-600 dark:bg-cyan-500', name: 'Ciano' },
  { value: 'bg-orange-600 dark:bg-orange-500', name: 'Laranja' },
  { value: 'bg-fuchsia-600 dark:bg-fuchsia-500', name: 'Fúcsia' },
  { value: 'bg-slate-600 dark:bg-slate-500', name: 'Cinza' },
  { value: 'bg-lime-600 dark:bg-lime-500', name: 'Lima' },
];

function normalizeType(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[áàâã]/g, 'a')
    .replace(/[éê]/g, 'e')
    .replace(/í/g, 'i')
    .replace(/[óôõ]/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ç/g, 'c');
}

function emptyPhase(colorIndex: number): SquadWorkflowPhase {
  return {
    kind: '',
    label: '',
    color: PHASE_COLOR_OPTIONS[colorIndex % PHASE_COLOR_OPTIONS.length].value,
    issueTypes: [],
  };
}

interface PhaseRowProps {
  row: SquadWorkflowPhase;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  suggestions: string[];
  onChange: (patch: Partial<SquadWorkflowPhase>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAddIssueType: (type: string) => void;
  onRemoveIssueType: (type: string) => void;
}

function PhaseRow({
  row, index, isFirst, isLast, suggestions,
  onChange, onMoveUp, onMoveDown, onRemove, onAddIssueType, onRemoveIssueType,
}: PhaseRowProps) {
  const [draftType, setDraftType] = useState('');

  const commitDraft = () => {
    if (draftType.trim()) onAddIssueType(draftType);
    setDraftType('');
  };

  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/40 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            type="button" onClick={onMoveUp} disabled={isFirst}
            title="Mover fase pra cima (mais cedo no fluxo)"
            className="h-4 w-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-25 disabled:hover:text-slate-400"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button" onClick={onMoveDown} disabled={isLast}
            title="Mover fase pra baixo (mais tarde no fluxo)"
            className="h-4 w-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-25 disabled:hover:text-slate-400"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-[9px] font-black text-slate-400 w-4 text-center shrink-0" title="Ordem no fluxo">
          {index + 1}
        </span>

        <Input
          value={row.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Nome da fase (ex: Code Review)"
          className="h-8 text-xs rounded-lg flex-1 min-w-0"
        />
        <Input
          value={row.kind}
          onChange={e => onChange({ kind: e.target.value })}
          placeholder="Rótulo curto (ex: Review)"
          maxLength={12}
          title="Texto compacto mostrado dentro da fita do cronograma"
          className="h-8 text-xs rounded-lg w-32 shrink-0 font-mono"
        />

        <Select value={row.color} onValueChange={v => onChange({ color: v })}>
          <SelectTrigger className="h-8 w-[104px] text-[10px] rounded-lg shrink-0 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-[11px]">
            {PHASE_COLOR_OPTIONS.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.value}`} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button" size="icon" variant="ghost" onClick={onRemove}
          title="Remover fase"
          className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        {row.issueTypes.map(t => (
          <Badge key={t} variant="outline" className="text-[9px] font-bold gap-1 pr-1 rounded-md">
            {t}
            <button type="button" onClick={() => onRemoveIssueType(t)} title="Remover tipo" className="hover:text-rose-500">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={draftType}
            onChange={e => setDraftType(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } }}
            placeholder="Digitar tipo de issue..."
            className="h-6 w-40 text-[10px] rounded-md"
          />
          <button
            type="button" onClick={commitDraft} title="Adicionar tipo"
            className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {suggestions.map(s => (
            <button
              key={s} type="button" onClick={() => onAddIssueType(s)}
              title="Adicionar tipo sincronizado do Jira"
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SquadWorkflowPhasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  phases: SquadWorkflowPhase[];
  availableIssueTypes: string[];
  onSave: (phases: SquadWorkflowPhase[]) => Promise<void>;
}

export function SquadWorkflowPhasesDialog({
  open, onOpenChange, squadId, phases, availableIssueTypes, onSave,
}: SquadWorkflowPhasesDialogProps) {
  const [rows, setRows] = useState<SquadWorkflowPhase[]>(phases);
  const [isSaving, setIsSaving] = useState(false);
  // Só resemeia `rows` na TRANSIÇÃO fechado->aberto, não em todo re-render
  // com o dialog já aberto — `phases` normalmente chega como `config?.phases
  // || []`, um array NOVO a cada render do pai; sincronizar em toda mudança
  // de referência apagava silenciosamente o que o admin tava digitando.
  const wasOpenRef = React.useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) setRows(phases);
    wasOpenRef.current = open;
  }, [open, phases]);

  const unassignedTypes = useMemo(() => {
    const used = new Set<string>();
    rows.forEach(r => r.issueTypes.forEach(t => used.add(normalizeType(t))));
    return availableIssueTypes.filter(t => !used.has(normalizeType(t)));
  }, [rows, availableIssueTypes]);

  const updateRow = (index: number, patch: Partial<SquadWorkflowPhase>) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyPhase(prev.length)]);
  };

  // Cada issuetype só pode pertencer a UMA fase — adicionar num remove
  // silenciosamente de qualquer outra fase que já o tivesse.
  const addIssueType = (index: number, raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const norm = normalizeType(value);
    setRows(prev => prev.map((r, i) => {
      if (i === index) {
        if (r.issueTypes.some(t => normalizeType(t) === norm)) return r;
        return { ...r, issueTypes: [...r.issueTypes, value] };
      }
      return { ...r, issueTypes: r.issueTypes.filter(t => normalizeType(t) !== norm) };
    }));
  };

  const removeIssueType = (index: number, type: string) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, issueTypes: r.issueTypes.filter(t => t !== type) } : r)));
  };

  const handleSave = async () => {
    const cleaned: SquadWorkflowPhase[] = rows
      .map(r => ({
        label: r.label.trim(),
        kind: (r.kind.trim() || r.label.trim().slice(0, 4)).toUpperCase(),
        color: r.color,
        issueTypes: r.issueTypes.map(t => t.trim()).filter(Boolean),
      }))
      .filter(r => r.label.length > 0);

    setIsSaving(true);
    try {
      await onSave(cleaned);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Workflow className="h-5 w-5 text-indigo-500" /> Fases do Workflow ({squadId})
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mapeie os tipos de issue do Jira pra fases do fluxo (Codificação, Code Review, Teste QA...). A ordem abaixo é a ordem usada na fita do cronograma do Jira Plans. Sem fases configuradas, o sistema usa uma heurística padrão pelo nome do tipo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {availableIssueTypes.length === 0 && (
            <p className="text-[10px] text-slate-400">
              Nenhum tipo de issue sincronizado ainda — sincronize o squad ou digite o nome manualmente em cada fase.
            </p>
          )}

          {rows.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              Nenhuma fase configurada — o cronograma usa o fallback padrão por tipo de issue.
            </p>
          )}

          {rows.map((row, index) => (
            <PhaseRow
              key={index}
              row={row}
              index={index}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              suggestions={unassignedTypes}
              onChange={patch => updateRow(index, patch)}
              onMoveUp={() => moveRow(index, -1)}
              onMoveDown={() => moveRow(index, 1)}
              onRemove={() => removeRow(index)}
              onAddIssueType={type => addIssueType(index, type)}
              onRemoveIssueType={type => removeIssueType(index, type)}
            />
          ))}

          <Button
            type="button" variant="outline" onClick={addRow}
            className="w-full h-9 rounded-xl text-xs font-bold border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Fase
          </Button>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving} className="bg-primary text-white rounded-xl text-xs font-bold">
              {isSaving ? 'Salvando...' : 'Salvar Fases'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
