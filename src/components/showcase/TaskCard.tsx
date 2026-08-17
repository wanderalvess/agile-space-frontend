'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Trash2, Clock, Check, Bug, Code2, Camera, ExternalLink, Video, CheckCircle2, User, GitBranch, FileText
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ShowcaseTask, DECISION, Decision, ISSUE_TYPES, PREPARATION_STATUS, PreparationStatus, SessionMember } from './types';
import { isPdfUrl } from './utils';

// ── Controlled Inputs ────────────────────────────────────────────────────────
const ControlledInput = React.memo(function ControlledInput({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const [local, setLocal] = React.useState(value || '');
  const [focused, setFocused] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!focused) setLocal(value || '');
  }, [value, focused]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  return (
    <input
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { 
        setFocused(false); 
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); onChange(local); }
        props.onBlur?.(e); 
      }}
      onChange={handleChange}
    />
  );
});

const ControlledTextarea = React.memo(function ControlledTextarea({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const [local, setLocal] = React.useState(value || '');
  const [focused, setFocused] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!focused) setLocal(value || '');
  }, [value, focused]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  return (
    <textarea
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { 
        setFocused(false); 
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); onChange(local); }
        props.onBlur?.(e); 
      }}
      onChange={handleChange}
    />
  );
});

interface TaskCardProps {
  task: ShowcaseTask;
  index: number;
  members: SessionMember[];
  // taskId-first (em vez de já vir pré-aplicado) — permite passar a MESMA
  // função pra todos os cards, e junto com React.memo evita re-renderizar
  // todo mundo a cada edição de um único card.
  onUpdateTask: (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void;
  onRemoveTask: (taskId: string) => void;
}

// ── Design Tokens ────────────────────────────────────────────────────────────
function FieldLabel({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em]', color)}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </p>
  );
}

function TextField({
  id, label, icon, value, onChange, placeholder, colorScheme, multiline = false, minRows = 3,
}: {
  id: string; label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; placeholder: string;
  colorScheme: { label: string; focus: string; ring: string };
  multiline?: boolean; minRows?: number;
}) {
  const baseClass = cn(
    'w-full text-[11px] text-slate-700 dark:text-slate-200 font-medium bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3 transition-all',
    'placeholder:text-slate-300 dark:placeholder:text-slate-700',
    'focus:bg-white dark:focus:bg-slate-950 focus:outline-none',
    colorScheme.focus, colorScheme.ring,
  );

  return (
    <div className="space-y-1.5">
      <FieldLabel icon={icon} label={label} color={colorScheme.label} />
      {multiline ? (
        <ControlledTextarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={minRows}
          className={cn(baseClass, 'py-2.5 resize-none leading-relaxed')}
        />
      ) : (
        <ControlledInput
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(baseClass, 'h-9 py-0')}
        />
      )}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
function TaskCardComponent({ task, index, members, onUpdateTask, onRemoveTask }: TaskCardProps) {
  const onUpdate = React.useCallback(
    (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => onUpdateTask(task.id, updates),
    [task.id, onUpdateTask]
  );
  const onRemove = React.useCallback(() => onRemoveTask(task.id), [task.id, onRemoveTask]);
  const hasProblem = !!task.evidence.problem;
  const hasSolution = !!task.evidence.solution;
  const hasEvidence = !!(task.evidence.screenshot || task.evidence.video);
  const isReady = hasProblem && hasSolution && hasEvidence;
  const isManual = task.id.startsWith('manual_') || task.key.startsWith('MANUAL-');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className="group/card"
    >
      <Card className={cn(
        'border rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 transition-all duration-300',
        'hover:shadow-md hover:shadow-slate-200/70 dark:hover:shadow-none',
        isReady ? 'border-emerald-200 dark:border-emerald-950/60' : 'border-slate-200 dark:border-slate-800',
      )}>
        {/* Indicador de status */}
        <div className={cn('h-0.5 w-full transition-all duration-500', isReady ? 'bg-gradient-to-r from-emerald-400 via-emerald-300 to-transparent' : 'bg-transparent')} />

        <div className="p-4 space-y-4">

          {/* ╔══════════════════════════════════╗
              ║  SEÇÃO 1 — Identificação         ║
              ╚══════════════════════════════════╝ */}
          <div className="flex items-center gap-2.5">
            {isManual && (
              <Badge className="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-none font-black text-[8px] uppercase h-7 px-2 rounded-lg shrink-0">
                Manual
              </Badge>
            )}

            {/* KEY */}
            <Badge 
              onClick={() => task.url && window.open(task.url, '_blank')}
              className={cn(
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-none font-black text-[9px] uppercase h-7 px-2.5 rounded-lg shrink-0",
                task.url ? "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all" : ""
              )}
            >
              <ControlledInput
                id={`key-${task.id}`}
                value={task.key}
                onChange={(v: string) => onUpdate({ key: v.toUpperCase() })}
                placeholder="KEY-00"
                className="bg-transparent border-none outline-none w-20 text-center placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </Badge>

            {/* Tipo */}
            <Select value={task.type} onValueChange={(v) => onUpdate({ type: v })}>
              <SelectTrigger className="h-7 w-fit px-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:ring-0 shrink-0">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-850">
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-[11px] font-black uppercase">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Título */}
            <div className="relative flex-1 min-w-0">
              <ControlledInput
                id={`title-${task.id}`}
                value={task.title}
                onChange={(v: string) => onUpdate({ title: v })}
                placeholder="Título da tarefa"
                className="w-full text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:text-violet-700 dark:focus:text-violet-400 transition-colors truncate"
              />
            </div>

            {/* Decisão */}
            <Select 
              value={task.decision} 
              onValueChange={(v) => onUpdate({ decision: v as Decision })}
            >
              <SelectTrigger
                className={cn(
                  "h-7 w-fit px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 border-none",
                  DECISION[task.decision].cls
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-850">
                {(['approved', 'needs_adjustment', 'rejected'] as const).map((d) => (
                  <SelectItem key={d} value={d} className="text-[10px] font-black uppercase">
                    <div className="flex items-center gap-1.5">
                      {DECISION[d].icon}
                      {DECISION[d].label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Preparação */}
            <Select 
              value={task.preparationStatus || 'todo'} 
              onValueChange={(v) => onUpdate({ preparationStatus: v as PreparationStatus })}
            >
              <SelectTrigger
                className={cn(
                  "h-7 w-fit px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 border",
                  PREPARATION_STATUS[task.preparationStatus || 'todo'].cls,
                  PREPARATION_STATUS[task.preparationStatus || 'todo'].border
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-850">
                {Object.entries(PREPARATION_STATUS).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-[10px] font-black uppercase">
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Deletar */}
            <Button
              variant="ghost" size="icon" onClick={onRemove}
              className="h-7 w-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* ╔══════════════════════════════════════╗
              ║  SEÇÃO 2 — Conteúdo da Entrega       ║
              ╚══════════════════════════════════════╝ */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id={`problem-${task.id}`}
              label="O Problema / Motivação"
              icon={Bug}
              value={task.evidence.problem}
              onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, problem: v } }))}
              placeholder="Erro ou necessidade do cliente..."
              multiline minRows={6}
              colorScheme={{ label: 'text-rose-500 dark:text-rose-400', focus: 'focus:border-rose-200 dark:focus:border-rose-900/40', ring: 'focus:ring-1 focus:ring-rose-200/50 dark:focus:ring-rose-900/20' }}
            />
            <TextField
              id={`solution-${task.id}`}
              label="A Solução Implementada"
              icon={Code2}
              value={task.evidence.solution}
              onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, solution: v } }))}
              placeholder="O que foi desenvolvido tecnicamente..."
              multiline minRows={6}
              colorScheme={{ label: 'text-emerald-600 dark:text-emerald-450', focus: 'focus:border-emerald-200 dark:focus:border-emerald-900/40', ring: 'focus:ring-1 focus:ring-emerald-200/50 dark:focus:ring-emerald-900/20' }}
            />
          </div>

          {/* ╔══════════════════════════════════════╗
              ║  SEÇÃO 3 — Responsáveis + Evidências ║
              ╚══════════════════════════════════════╝ */}
          <div className="grid grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
            {/* Responsáveis */}
            <div className="space-y-3">
              <FieldLabel icon={User} label="Time Executor" color="text-slate-500 dark:text-slate-400" />
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black uppercase text-blue-400 dark:text-blue-400">Dev</label>
                    {task.evidence.planned?.dev && (
                      <span className="text-[7px] font-black text-slate-400 dark:text-slate-400 uppercase italic">Plano: {task.evidence.planned.dev}</span>
                    )}
                  </div>
                  <ControlledInput
                    value={task.evidence.dev}
                    onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, dev: v } }))}
                    placeholder="Quem desenvolveu?"
                    className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black uppercase text-amber-500 dark:text-amber-500">QA / Validação</label>
                    {task.evidence.planned?.qa && (
                      <span className="text-[7px] font-black text-slate-400 dark:text-slate-400 uppercase italic">Plano: {task.evidence.planned.qa}</span>
                    )}
                  </div>
                  <ControlledInput
                    value={task.evidence.qa}
                    onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, qa: v } }))}
                    placeholder="Quem validou?"
                    className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
                  />
                </div>
              </div>
            </div>

            {/* Deploy & Versões */}
            <div className="space-y-3 border-x border-slate-200/50 dark:border-slate-800/60 px-4">
              <FieldLabel icon={GitBranch} label="CI/CD & Versões" color="text-slate-500 dark:text-slate-400" />
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-cyan-500 dark:text-cyan-400">Projeto / Repositório</label>
                  <ControlledInput
                    value={task.project}
                    onChange={(v: string) => onUpdate({ project: v })}
                    placeholder="Ex: Integracao_Matcon"
                    className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-400">Versões (M / D / R)</label>
                  <div className="grid grid-cols-3 gap-1">
                    <ControlledInput
                      value={task.versionMaster}
                      onChange={(v: string) => onUpdate({ versionMaster: v })}
                      placeholder="Master"
                      title="Versão Master"
                      className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
                    />
                    <ControlledInput
                      value={task.versionDevelop}
                      onChange={(v: string) => onUpdate({ versionDevelop: v })}
                      placeholder="Develop"
                      title="Versão Develop"
                      className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
                    />
                    <ControlledInput
                      value={task.versionRelease}
                      onChange={(v: string) => onUpdate({ versionRelease: v })}
                      placeholder="Release"
                      title="Versão Release"
                      className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Evidências */}
            <div className="space-y-3">
              <FieldLabel icon={Camera} label="Links de Evidência" color="text-slate-500 dark:text-slate-400" />
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <ControlledInput
                    value={task.evidence.screenshot}
                    onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, screenshot: v } }))}
                    placeholder="Screenshot / Print"
                    className="h-8 flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-200 px-2"
                  />
                  <Button variant="ghost" size="icon" onClick={() => window.open(task.evidence.screenshot, '_blank')} disabled={!task.evidence.screenshot} className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 dark:text-slate-400 dark:hover:bg-slate-800">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <ControlledInput
                    value={task.evidence.video}
                    onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, video: v } }))}
                    placeholder="Vídeo / Loom / Demo"
                    className="h-8 flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-200 px-2"
                  />
                  <Button variant="ghost" size="icon" onClick={() => window.open(task.evidence.video, '_blank')} disabled={!task.evidence.video} className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 dark:text-slate-400 dark:hover:bg-slate-800">
                    <Video className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback do PO */}
          {(task.feedback !== undefined || task.decision === 'needs_adjustment' || task.decision === 'rejected') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl"
            >
              <div className="w-1 rounded-full bg-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 dark:text-amber-400 mb-0.5">Feedback da Review</p>
                <ControlledTextarea
                  value={task.feedback || ''}
                  onChange={(v: string) => onUpdate({ feedback: v })}
                  placeholder="Detalhes do ajuste ou motivo da rejeição..."
                  className="w-full bg-transparent border-none outline-none text-[12px] font-medium text-amber-900 dark:text-amber-300 italic placeholder:text-amber-500/50 resize-none min-h-[40px]"
                />
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export const TaskCard = React.memo(TaskCardComponent);
