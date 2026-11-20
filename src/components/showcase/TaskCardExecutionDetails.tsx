'use client';

import React from 'react';
import { BookOpen, Camera, ExternalLink, FileText, GitBranch, User, Video, type LucideIcon } from 'lucide-react';
import { FOCUS_RING, IconButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ShowcaseTask } from './types';
import { openSafeUrl, toSafeUrl } from './utils';
import { CARD_INPUT, CARD_PANEL, FieldLabel } from './TaskCardFields';
import { ControlledInput } from './ControlledFields';
import { TaskCardAttachments } from './TaskCardAttachments';

interface TaskCardExecutionDetailsProps {
  task: ShowcaseTask;
  onUpdate: (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void;
  /** Sem estes três, o campo de arquivos não aparece (ex.: card ainda sem Review salva). */
  sessionId?: string;
  onUploadFile?: (taskId: string, file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
}

const SMALL = 'text-xs font-semibold text-muted-foreground';

/** Linha de um link de evidência com o botão que abre em nova aba (desativado sem link válido). */
function LinkRow({ value, onChange, placeholder, openLabel, icon: Icon }: { value: string; onChange: (v: string) => void; placeholder: string; openLabel: string; icon: LucideIcon }) {
  return (
    <div className="flex gap-1.5">
      <ControlledInput value={value} onChange={onChange} placeholder={placeholder} aria-label={placeholder} className={cn(CARD_INPUT, 'flex-1')} />
      <IconButton
        label={openLabel}
        icon={Icon}
        onClick={() => openSafeUrl(value)}
        disabled={!toSafeUrl(value)}
        className="h-9 w-9 shrink-0 max-sm:h-11 max-sm:w-11"
      />
    </div>
  );
}

export function TaskCardExecutionDetails({ task, onUpdate, sessionId, onUploadFile, onDeleteFile }: TaskCardExecutionDetailsProps) {
  const setEvidence = (patch: Partial<ShowcaseTask['evidence']>) => onUpdate((prev) => ({ ...prev, evidence: { ...prev.evidence, ...patch } }));
  return (
    <div className={cn(CARD_PANEL, 'grid grid-cols-1 gap-4 md:grid-cols-3')}>
      {/* Responsáveis */}
      <div className="flex flex-col gap-3">
        <FieldLabel icon={User} label="Time executor" />
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`dev-${task.id}`} className={SMALL}>Dev</label>
              {task.evidence.planned?.dev && <span className="text-xs text-muted-foreground">Plano: {task.evidence.planned.dev}</span>}
            </div>
            <ControlledInput id={`dev-${task.id}`} value={task.evidence.dev} onChange={(v: string) => setEvidence({ dev: v })} placeholder="Quem desenvolveu?" className={cn(CARD_INPUT, 'font-medium')} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`qa-${task.id}`} className={SMALL}>QA / validação</label>
              {task.evidence.planned?.qa && <span className="text-xs text-muted-foreground">Plano: {task.evidence.planned.qa}</span>}
            </div>
            <ControlledInput id={`qa-${task.id}`} value={task.evidence.qa} onChange={(v: string) => setEvidence({ qa: v })} placeholder="Quem validou?" className={cn(CARD_INPUT, 'font-medium')} />
          </div>
        </div>
      </div>

      {/* Deploy e versões */}
      <div className="flex flex-col gap-3 md:border-x md:border-border md:px-4">
        <FieldLabel icon={GitBranch} label="CI/CD e versões" />
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label htmlFor={`project-${task.id}`} className={SMALL}>Projeto / repositório</label>
            <ControlledInput id={`project-${task.id}`} value={task.project} onChange={(v: string) => onUpdate({ project: v })} placeholder="Ex.: Integracao_Matcon" className={cn(CARD_INPUT, 'font-medium')} />
          </div>
          <div className="flex flex-col gap-1">
            <span className={SMALL}>Versões (suporte, master, release, develop)</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <ControlledInput value={task.versionSuporte} onChange={(v: string) => onUpdate({ versionSuporte: v })} placeholder="Suporte" title="Versão Suporte" aria-label="Versão Suporte" className={cn(CARD_INPUT, 'px-1.5 text-center font-medium')} />
              <ControlledInput value={task.versionMaster} onChange={(v: string) => onUpdate({ versionMaster: v })} placeholder="Master" title="Versão Master" aria-label="Versão Master" className={cn(CARD_INPUT, 'px-1.5 text-center font-medium')} />
              <ControlledInput value={task.versionRelease} onChange={(v: string) => onUpdate({ versionRelease: v })} placeholder="Release" title="Versão Release" aria-label="Versão Release" className={cn(CARD_INPUT, 'px-1.5 text-center font-medium')} />
              <ControlledInput value={task.versionDevelop} onChange={(v: string) => onUpdate({ versionDevelop: v })} placeholder="Develop" title="Versão Develop" aria-label="Versão Develop" className={cn(CARD_INPUT, 'px-1.5 text-center font-medium')} />
            </div>
          </div>
        </div>
      </div>

      {/* Evidências */}
      <div className="flex flex-col gap-3">
        <FieldLabel icon={Camera} label="Links de evidência" />
        <div className="flex flex-col gap-2">
          <LinkRow value={task.evidence.screenshot} onChange={(v) => setEvidence({ screenshot: v })} placeholder="Screenshot / print" openLabel="Abrir print em nova aba" icon={ExternalLink} />
          <LinkRow value={task.evidence.video} onChange={(v) => setEvidence({ video: v })} placeholder="Vídeo / Loom / demo" openLabel="Abrir vídeo em nova aba" icon={Video} />
          <LinkRow value={task.evidence.techDocUrl || ''} onChange={(v) => setEvidence({ techDocUrl: v })} placeholder="Link do documento técnico" openLabel="Abrir documento técnico em nova aba" icon={FileText} />
          <LinkRow value={task.evidence.tdnUrl || ''} onChange={(v) => setEvidence({ tdnUrl: v })} placeholder="Link do TDN" openLabel="Abrir TDN em nova aba" icon={BookOpen} />
          {sessionId && onUploadFile && onDeleteFile && (
            <div className="mt-1 border-t border-border pt-2">
              <TaskCardAttachments task={task} sessionId={sessionId} onUploadFile={onUploadFile} onDeleteFile={onDeleteFile} />
            </div>
          )}
          {/* Alternador de evidência principal quando ambas existem */}
          {task.evidence.screenshot && task.evidence.video && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className={SMALL}>Abre primeiro:</span>
              <div role="group" aria-label="Evidência que abre primeiro" className="flex w-fit items-center gap-1 rounded-lg border border-border bg-background p-0.5">
                {([
                  { value: 'video' as const, label: 'Vídeo', icon: Video },
                  { value: 'screenshot' as const, label: 'Print', icon: Camera },
                ]).map((opt) => {
                  const on = (task.evidence.evidencePreference || 'video') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setEvidence({ evidencePreference: opt.value })}
                      className={cn(
                        'flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors max-sm:h-11',
                        on ? 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        FOCUS_RING
                      )}
                    >
                      <opt.icon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
