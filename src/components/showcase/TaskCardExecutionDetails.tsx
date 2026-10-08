'use client';

import React from 'react';
import { BookOpen, Camera, ExternalLink, FileText, GitBranch, User, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShowcaseTask } from './types';
import { FieldLabel } from './TaskCardFields';
import { ControlledInput } from './ControlledFields';

interface TaskCardExecutionDetailsProps {
  task: ShowcaseTask;
  onUpdate: (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void;
}

export function TaskCardExecutionDetails({ task, onUpdate }: TaskCardExecutionDetailsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
      {/* Responsáveis */}
      <div className="space-y-3">
        <FieldLabel icon={User} label="Time Executor" color="text-slate-500 dark:text-slate-400" />
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase text-blue-400 dark:text-blue-400">Dev</label>
              {task.evidence.planned?.dev && (
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase italic">Plano: {task.evidence.planned.dev}</span>
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
              <label className="text-[11px] font-bold uppercase text-amber-500 dark:text-amber-500">QA / Validação</label>
              {task.evidence.planned?.qa && (
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase italic">Plano: {task.evidence.planned.qa}</span>
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
            <label className="text-[11px] font-bold uppercase text-cyan-500 dark:text-cyan-400">Projeto / Repositório</label>
            <ControlledInput
              value={task.project}
              onChange={(v: string) => onUpdate({ project: v })}
              placeholder="Ex: Integracao_Matcon"
              className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-400">Versões (S / M / R / D)</label>
            <div className="grid grid-cols-4 gap-1">
              <ControlledInput
                value={task.versionSuporte}
                onChange={(v: string) => onUpdate({ versionSuporte: v })}
                placeholder="Suporte"
                title="Versão Suporte"
                className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
              />
              <ControlledInput
                value={task.versionMaster}
                onChange={(v: string) => onUpdate({ versionMaster: v })}
                placeholder="Master"
                title="Versão Master"
                className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
              />
              <ControlledInput
                value={task.versionRelease}
                onChange={(v: string) => onUpdate({ versionRelease: v })}
                placeholder="Release"
                title="Versão Release"
                className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
              />
              <ControlledInput
                value={task.versionDevelop}
                onChange={(v: string) => onUpdate({ versionDevelop: v })}
                placeholder="Develop"
                title="Versão Develop"
                className="h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 px-1.5 text-center"
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
              className="h-8 flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 px-2"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(task.evidence.screenshot, '_blank')}
              disabled={!task.evidence.screenshot}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-1.5">
            <ControlledInput
              value={task.evidence.video}
              onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, video: v } }))}
              placeholder="Vídeo / Loom / Demo"
              className="h-8 flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 px-2"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(task.evidence.video, '_blank')}
              disabled={!task.evidence.video}
              className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Video className="h-3 w-3" />
            </Button>
          </div>
          {([
            { field: 'techDocUrl' as const, placeholder: 'Link do documento técnico', icon: FileText },
            { field: 'tdnUrl' as const, placeholder: 'Link do TDN', icon: BookOpen },
          ]).map(({ field, placeholder, icon: Icon }) => (
            <div key={field} className="flex gap-1.5">
              <ControlledInput
                value={task.evidence[field] || ''}
                onChange={(v: string) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, [field]: v } }))}
                placeholder={placeholder}
                className="h-8 flex-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 px-2"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(task.evidence[field], '_blank')}
                disabled={!task.evidence[field]}
                title={`Abrir ${placeholder.toLowerCase().replace('link do ', '')}`}
                className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {/* Alternador de evidência principal quando ambas existem */}
          {task.evidence.screenshot && task.evidence.video && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Abre primeiro:</span>
              <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit">
                {([
                  { value: 'video' as const, label: 'Vídeo', icon: Video },
                  { value: 'screenshot' as const, label: 'Print', icon: Camera },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, evidencePreference: opt.value } }))}
                    className={cn(
                      'h-6 px-2 rounded-md flex items-center gap-1 text-[8px] font-black uppercase tracking-wider transition-all',
                      (task.evidence.evidencePreference || 'video') === opt.value
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20'
                    )}
                  >
                    <opt.icon className="h-3 w-3" /> {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
