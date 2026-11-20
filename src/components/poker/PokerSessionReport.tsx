'use client';

import React, { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Download, FileDown, Plus, Printer, RefreshCcw, Send } from 'lucide-react';
import type { DeckType, Issue, Participant, VotingRound, Room } from '@/lib/types';
import type { SessionBreakdown } from '@/lib/poker-utils';
import { buildSessionReport } from '@/lib/poker-report';
import { buildSummaryText } from '@/lib/poker-report-export';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { ModalButton, TabBar } from '@/components/room-kit';
import { ExportDialog } from './ExportDialog';
import { TopicTiming } from './TopicTiming';
import { SessionVelocity } from './SessionVelocity';
import { ReportDocumentHeader, ReportKpis } from './report/ReportOverview';
import { ReportTaskTable, type JiraTaskStatus } from './report/ReportTaskTable';
import { ReportHighlights } from './report/ReportHighlights';
import { ReportResults } from './report/ReportResults';
import { useReportPrint } from './report/useReportPrint';
import { useReportPdf } from './report/useReportPdf';

export interface ReportStats {
  totalTopics: number;
  totalPoints: number;
  durationStr: string;
  avgTimePerTopic: string;
  idleMins: number;
  estimatedIssues: Issue[];
  skippedIssues: Issue[];
  cancelledIssues: Issue[];
  parkedIssues: Issue[];
  untouchedIssues: Issue[];
  breakdown: SessionBreakdown;
}

interface Props {
  roomId: string;
  roomTitle?: string;
  roomTeam?: string;
  deck: DeckType;
  stats: ReportStats;
  issues: Issue[];
  participants: Participant[];
  rounds: VotingRound[];
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  settings?: Room['settings'];
  onRefreshHistory: () => void;
  onNewSession: () => void;
  /** Estimadas com chave do Jira: enviadas e prontas para enviar (abre a prévia de todas). */
  jira?: { sent: number; pending: number; onSend: () => void; statusByIssueId?: Record<string, JiraTaskStatus> } | null;
}

/**
 * Fim da sessão: o documento que o facilitador mostra, imprime e leva para a
 * gestão. Identificação, resumo em números, tabela de tarefas, destaques e notas;
 * o tempo por tópico e o histórico do time ficam ao final. Os números vêm de
 * `buildSessionReport` e são os mesmos do PDF, do Markdown, do CSV e do texto copiado.
 * A aba "Resultados" traz a folha-resumo de 1 página que também abre o PDF A4.
 */
export function PokerSessionReport({ roomId, roomTitle, roomTeam, deck, issues, participants, rounds, sessionStartedAt, sessionEndedAt, settings, onRefreshHistory, onNewSession, jira }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'relatorio' | 'resultados'>('relatorio');
  const perTopicTime = settings?.perTopicTime !== false;

  const report = useMemo(
    () =>
      buildSessionReport({
        roomTitle: roomTitle || 'Scrum Poker',
        roomTeam,
        deck,
        issues,
        participants,
        rounds,
        sessionStartedAt,
        sessionEndedAt,
        divergenceThresholds: settings?.divergenceThresholds,
        perTopicTime,
      }),
    [roomTitle, roomTeam, deck, issues, participants, rounds, sessionStartedAt, sessionEndedAt, settings?.divergenceThresholds, perTopicTime]
  );

  // A impressão do navegador (botão e Ctrl+P) usa o documento A4 montado aqui.
  const { print, portal } = useReportPrint(report, { interceptBrowserPrint: true });
  const { download, busy } = useReportPdf(report);

  const k = report.kpis;
  const subtitle = [
    `${k.estimated} de ${k.agenda} ${k.agenda === 1 ? 'tarefa estimada' : 'tarefas estimadas'}`,
    k.total !== null ? k.totalLabel : null,
    report.header.durationMins !== null ? report.header.durationLabel : null,
    `${report.header.participantsCount} ${report.header.participantsCount === 1 ? 'participante' : 'participantes'}`,
  ].filter(Boolean).join(' · ');

  const copySummary = async () => {
    if (await copyToClipboard(buildSummaryText(report))) {
      toast({ title: 'Resumo copiado', description: 'Pronto para colar em e-mail ou chat.' });
    } else {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const b = report.breakdown;
  const offTable = b.skipped + b.parked;
  const agenda = Math.max(1, b.estimated + offTable + b.untouched);
  const deg = (n: number) => Math.round((n / agenda) * 360);
  const donut = `conic-gradient(rgb(16 185 129) 0 ${deg(b.estimated)}deg, rgb(245 158 11) ${deg(b.estimated)}deg ${deg(b.estimated + offTable)}deg, hsl(var(--border)) ${deg(b.estimated + offTable)}deg 360deg)`;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
      <section
        aria-label="Resumo da cerimônia"
        className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[22px] border border-border bg-card px-6 py-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:px-8"
        style={{ backgroundImage: 'radial-gradient(ellipse 50% 140% at 90% 50%, rgb(16 185 129 / 0.12), transparent 70%)' }}
      >
        <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-2.5">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Resultados salvos no workspace
          </span>
          <h1 className="m-0 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">Cerimônia concluída</h1>
          <p className="m-0 text-[15px] text-muted-foreground">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
          <ModalButton onClick={copySummary} className="gap-2">
            <ClipboardCopy className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Copiar resumo
          </ModalButton>
          <ModalButton onClick={() => print({ includeResults: true, resultsOnly: false })} className="gap-2">
            <Printer className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Imprimir / Salvar PDF
          </ModalButton>
          <ModalButton onClick={() => void download({ includeResults: true })} disabled={busy} className="gap-2">
            <FileDown className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Gerando…' : 'Baixar PDF (A4)'}
          </ModalButton>
          <ExportDialog
            roomTitle={roomTitle || 'Scrum Poker'}
            roomTeam={roomTeam}
            issues={issues}
            participants={participants}
            deck={deck}
            rounds={rounds}
            sessionStartedAt={sessionStartedAt}
            sessionEndedAt={sessionEndedAt}
            perTopicTime={perTopicTime}
            divergenceThresholds={settings?.divergenceThresholds}
            report={report}
            interceptBrowserPrint
            print={print}
            triggerNode={<ModalButton variant="primary" className="gap-2 room-glow"><Download className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Exportar resultados</ModalButton>}
          />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div aria-hidden="true" className="flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-full" style={{ background: donut }}>
            <span className="flex h-[124px] w-[124px] flex-col items-center justify-center gap-0.5 rounded-full bg-card">
              <span className="text-4xl font-extrabold leading-none tabular-nums">{b.estimated}/{agenda}</span>
              <span className="text-xs text-muted-foreground">estimadas</span>
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]" aria-label="Situação das tarefas">
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" />{b.estimated} {b.estimated === 1 ? 'estimada' : 'estimadas'}</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-amber-500" />{offTable} {offTable === 1 ? 'pulada ou adiada' : 'puladas ou adiadas'}</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-border" />{b.untouched} {b.untouched === 1 ? 'não abordada' : 'não abordadas'}</li>
          </ul>
        </div>
      </section>

      {jira && jira.sent + jira.pending > 0 && (
        <section aria-label="Envio ao Jira" className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-primary/45 bg-primary/5 px-4 py-3.5 sm:px-5">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
            <Send className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </span>
          <span className="flex min-w-0 flex-1 basis-[260px] flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {jira.pending > 0
                ? `Jira: ${jira.sent} ${jira.sent === 1 ? 'enviada' : 'enviadas'} · ${jira.pending} ${jira.pending === 1 ? 'pronta' : 'prontas'} para enviar`
                : `Jira: ${jira.sent === 1 ? 'a tarefa estimada foi enviada' : `todas as ${jira.sent} estimadas foram enviadas`}`}
            </span>
            <span className="text-[13px] text-muted-foreground">Renomeia a pai com as horas e cria as sub-tarefas. Você revisa a prévia antes.</span>
          </span>
          {jira.pending > 0 && (
            <ModalButton variant="primary" onClick={jira.onSend} className="gap-2 room-glow">
              Enviar {jira.pending} ao Jira
            </ModalButton>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ModalButton onClick={onRefreshHistory} className="h-9 gap-2 text-[13px]"><RefreshCcw className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Atualizar histórico</ModalButton>
        <ModalButton onClick={onNewSession} className="h-9 gap-2 text-[13px]"><Plus className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Nova sessão</ModalButton>
      </div>

      <TabBar
        tabs={[{ id: 'relatorio', label: 'Relatório completo' }, { id: 'resultados', label: 'Resultados (1 página)' }] as const}
        value={tab}
        onChange={setTab}
        label="Visões do relatório"
        idPrefix="report"
        className="px-0"
      />

      {tab === 'resultados' ? (
        <div role="tabpanel" id="report-panel-resultados" aria-labelledby="report-tab-resultados">
          <ReportResults
            report={report}
            busy={busy}
            onDownload={() => void download({ resultsOnly: true })}
            onPrint={() => print({ includeResults: true, resultsOnly: true })}
          />
        </div>
      ) : (
        <div role="tabpanel" id="report-panel-relatorio" aria-labelledby="report-tab-relatorio" className="flex flex-col gap-5">
          <ReportDocumentHeader report={report} />
          <ReportKpis report={report} />
          <ReportTaskTable report={report} jiraStatus={jira?.statusByIssueId} />
          <ReportHighlights report={report} />

          <div className="grid gap-4 lg:grid-cols-12">
            {perTopicTime && (
              <div className="lg:col-span-7"><TopicTiming rounds={rounds} issues={issues} sessionStartedAt={sessionStartedAt} /></div>
            )}
            {settings?.showVelocity && (
              <div className={perTopicTime ? 'lg:col-span-5' : 'lg:col-span-12'}><SessionVelocity currentRoomId={roomId} /></div>
            )}
          </div>
        </div>
      )}

      {portal}
    </div>
  );
}
