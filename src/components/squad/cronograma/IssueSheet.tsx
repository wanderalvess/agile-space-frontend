'use client';

import { Minus, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { formatHours, formatPt, formatStamp, ptNum } from '@/lib/cronograma/dates';
import { slipReasonText } from '@/lib/cronograma/slip';
import type { PlannedTask, StoryModel } from '@/lib/cronograma/schedule';
import { statusLabel, statusTone } from '@/lib/cronograma/status';
import { isDone } from '@/lib/cronograma/task';
import { ORIGIN_NOTE } from './GanttBar';
import { FOCUS, OK_TEXT, STATUS_CHIP, WARN_BOX, WARN_TEXT, phaseStyle } from './styles';

const CAPACITY_SOURCE = { pessoa: 'cadastro do time', squad: 'padrão da squad', padrao: 'padrão do portal' } as const;
export const SIM_MAX_DAYS = 10;

interface Props {
  task: PlannedTask | null;
  story: StoryModel | null;
  jiraBaseUrl?: string;
  simDays: number;
  onSimDays: (days: number) => void;
  onClose: () => void;
}

function jiraUrl(domain: string | undefined, key: string): string | null {
  if (!domain) return null;
  const base = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return `${base.replace(/\/+$/, '')}/browse/${encodeURIComponent(key)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-foreground">{children}</dd>
    </>
  );
}

function TaskDetail({ p, jiraBaseUrl, simDays, onSimDays, onClose }: { p: PlannedTask; jiraBaseUrl?: string; simDays: number; onSimDays: (d: number) => void; onClose: () => void }) {
  const t = p.task;
  const ps = phaseStyle(p.phase);
  const late = p.effective && p.planned && ptNum(p.effective.end) > ptNum(p.planned.end);
  const slipTitle = p.slip.manual
    ? 'Simulação'
    : p.slip.own > 0
      ? `Atraso de ${p.slip.own} dia(s) útil(eis)`
      : p.slip.pushed > 0 ? 'Empurrada por fase anterior' : '';
  const slipMsg = p.slip.manual
    ? `As fases seguintes desta história foram empurradas ${p.slip.own} dia(s) útil(eis). Nada é gravado no Jira.`
    : p.slip.own > 0
      ? slipReasonText(p.slip.reason, p.task.end ? formatStamp(p.task.end) : '')
      : p.slip.pushed > 0 ? `Uma fase anterior desta história atrasou ${p.slip.pushed} dia(s) útil(eis) e empurrou esta.` : '';
  const url = jiraUrl(jiraBaseUrl, t.key);
  const hasJiraDates = !t.datesAreInferred && t.start !== null;

  return (
    <>
      <SheetHeader className="space-y-1.5 pr-8 text-left">
        <span className="font-code text-sm font-semibold tabular-nums text-foreground">{t.key}</span>
        <SheetTitle className="text-xl leading-snug">{t.title || 'Título ainda não sincronizado'}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes da fase, datas, horas e simulação de atraso.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${ps.solid}`}>{p.phase.label}</span>
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${STATUS_CHIP[statusTone(t.status, t.statusCategory)]}`}>{statusLabel(t.status)}</span>
      </div>

      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
        <Row label="Responsável">{t.assigneeName || 'Sem responsável'}</Row>
        <Row label="Data e hora de início">{hasJiraDates ? formatStamp(t.start) : 'Sem data no Jira'}</Row>
        <Row label="Data e hora de fim">{hasJiraDates ? formatStamp(t.end) : 'Sem data no Jira'}</Row>
        <Row label="Capacidade">{formatHours(p.capacity.hours)} por dia ({CAPACITY_SOURCE[p.capacity.source]})</Row>
        <Row label="Sugestão do portal">
          {p.suggestion ? (
            <span className="font-semibold">
              começa {formatPt(p.suggestion.start)} e termina {formatPt(p.suggestion.end)} ({formatHours(p.suggestion.hours)} em fila)
            </span>
          ) : isDone(t) ? 'Fase concluída' : 'Sem estimativa de horas para calcular'}
        </Row>
        <Row label="Fim previsto">
          {p.effective ? <span className={late ? `font-bold ${WARN_TEXT}` : 'font-semibold'}>{formatPt(p.effective.end)}</span> : '—'}
        </Row>
        <Row label="Estimativa">{formatHours(t.estimateSec / 3600)}</Row>
        <Row label="Restante">{formatHours(t.remainingSec / 3600)}</Row>
        <Row label="Origem das datas">{p.origin === 'aproximada' ? 'Aproximada (criação e última edição)' : p.origin === 'jira' ? 'Campos de data do Jira' : p.origin === 'sugestao' ? 'Sugestão pelas horas' : ORIGIN_NOTE[p.origin]}</Row>
      </dl>

      {slipTitle && (
        <div className={`rounded-xl p-3.5 text-sm leading-relaxed ${WARN_BOX}`}>
          <strong>{slipTitle}</strong>
          {slipMsg && <p className="m-0 text-muted-foreground">{slipMsg}</p>}
        </div>
      )}

      {p.planned && !isDone(t) && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-muted/50 p-3.5">
          <span className="text-sm font-bold text-foreground">E se esta fase atrasar?</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Menos um dia"
              disabled={simDays <= 0}
              onClick={() => onSimDays(Math.max(0, simDays - 1))}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 ${FOCUS}`}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[88px] text-center text-xl font-bold tabular-nums text-foreground" aria-live="polite">{simDays} dia(s)</span>
            <button
              type="button"
              aria-label="Mais um dia"
              disabled={simDays >= SIM_MAX_DAYS}
              onClick={() => onSimDays(Math.min(SIM_MAX_DAYS, simDays + 1))}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 ${FOCUS}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            {simDays > 0
              ? `O fim previsto das fases seguintes desta história muda em ${simDays} dia(s) útil(eis). Nada é gravado no Jira.`
              : 'Mexa nos dias para ver quanto as fases seguintes desta história se deslocam. Nada é gravado no Jira.'}
          </p>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-2">
        {url && (
          <Button asChild className="h-10 flex-1 rounded-xl font-semibold">
            <a href={url} target="_blank" rel="noopener noreferrer">Abrir no Jira</a>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-xl px-4 font-semibold">Fechar</Button>
      </div>
    </>
  );
}

function StoryDetail({ s, jiraBaseUrl, onClose }: { s: StoryModel; jiraBaseUrl?: string; onClose: () => void }) {
  const url = jiraUrl(jiraBaseUrl, s.key);
  const st = s.story;
  return (
    <>
      <SheetHeader className="space-y-1.5 pr-8 text-left">
        <span className="font-code text-sm font-semibold tabular-nums text-foreground">{s.key}</span>
        <SheetTitle className="text-xl leading-snug">{s.title || 'Título ainda não sincronizado'}</SheetTitle>
        <SheetDescription className="sr-only">Resumo da história e das fases.</SheetDescription>
      </SheetHeader>
      {st && (
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${STATUS_CHIP[statusTone(st.status, st.statusCategory)]}`}>{statusLabel(st.status)}</span>
        </div>
      )}
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
        <Row label="Responsável">{st?.assigneeName || 'Sem responsável'}</Row>
        <Row label="Fases">{s.doneCount} de {s.tasks.length} concluídas</Row>
        <Row label="Progresso"><span className={s.progress === 100 ? `font-bold ${OK_TEXT}` : ''}>{s.progress}%</span></Row>
        <Row label="Início previsto">{s.effective ? formatPt(s.effective.start) : '—'}</Row>
        <Row label="Fim previsto">{s.effective ? <span className={s.delayDays > 0 ? `font-bold ${WARN_TEXT}` : 'font-semibold'}>{formatPt(s.effective.end)}</span> : '—'}</Row>
        <Row label="Origem das datas">{ORIGIN_NOTE[s.origin]}</Row>
      </dl>
      {s.delayDays > 0 && (
        <div className={`rounded-xl p-3.5 text-sm leading-relaxed ${WARN_BOX}`}>
          <strong>Prevê {s.delayDays} dia(s) útil(eis) a mais</strong>
          <p className="m-0 text-muted-foreground">Alguma fase atrasou e empurrou as seguintes. Abra uma fase para ver o motivo.</p>
        </div>
      )}
      <div className="mt-auto flex gap-2 pt-2">
        {url && (
          <Button asChild className="h-10 flex-1 rounded-xl font-semibold">
            <a href={url} target="_blank" rel="noopener noreferrer">Abrir no Jira</a>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-xl px-4 font-semibold">Fechar</Button>
      </div>
    </>
  );
}

/** Painel de detalhe de uma fase (ou de uma história) com a simulação "E se esta fase atrasar?". */
export function IssueSheet({ task, story, jiraBaseUrl, simDays, onSimDays, onClose }: Props) {
  const open = !!task || !!story;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" aria-label="Detalhe da issue" className="flex w-full flex-col gap-4 overflow-y-auto bg-card sm:max-w-[420px]">
        {task ? (
          <TaskDetail p={task} jiraBaseUrl={jiraBaseUrl} simDays={simDays} onSimDays={onSimDays} onClose={onClose} />
        ) : story ? (
          <StoryDetail s={story} jiraBaseUrl={jiraBaseUrl} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
