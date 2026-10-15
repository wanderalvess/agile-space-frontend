'use client';

import React, { useMemo } from 'react';
import { Check, ClipboardCopy, Download, MessageSquareText, Plus, Printer, RefreshCcw } from 'lucide-react';
import type { DeckType, Issue, Participant, VotingRound, Room } from '@/lib/types';
import type { SessionBreakdown } from '@/lib/poker-utils';
import { buildSessionReport } from '@/lib/poker-report';
import { buildSummaryText } from '@/lib/poker-report-export';
import { useToast } from '@/hooks/use-toast';
import { ModalButton } from '@/components/room-kit';
import { ExportDialog } from './ExportDialog';
import { TopicTiming } from './TopicTiming';
import { SessionVelocity } from './SessionVelocity';
import { ReportDocumentHeader, ReportKpis } from './report/ReportOverview';
import { ReportTaskTable } from './report/ReportTaskTable';
import { ReportHighlights } from './report/ReportHighlights';

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
  onOpenRetro?: () => void;
  onNewSession: () => void;
}

/**
 * Fim da sessão: o documento que o facilitador mostra, imprime e leva para a
 * gestão. Identificação, resumo em números, tabela de tarefas, destaques e notas;
 * o tempo por tópico e o histórico do time ficam ao final. Os números vêm de
 * `buildSessionReport` e são os mesmos do PDF, do Markdown, do CSV e do texto copiado.
 */
export function PokerSessionReport({ roomId, roomTitle, roomTeam, deck, issues, participants, rounds, sessionStartedAt, sessionEndedAt, settings, onRefreshHistory, onOpenRetro, onNewSession }: Props) {
  const { toast } = useToast();
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

  const k = report.kpis;
  const subtitle = [
    `${k.estimated} de ${k.agenda} ${k.agenda === 1 ? 'tarefa estimada' : 'tarefas estimadas'}`,
    k.total !== null ? k.totalLabel : null,
    report.header.durationMins !== null ? report.header.durationLabel : null,
    `${report.header.participantsCount} ${report.header.participantsCount === 1 ? 'participante' : 'participantes'}`,
  ].filter(Boolean).join(' · ');

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(report));
      toast({ title: 'Resumo copiado', description: 'Pronto para colar em e-mail ou chat.' });
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
      <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="m-0 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Cerimônia concluída</h1>
          <p className="m-0 text-[15px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModalButton onClick={copySummary} className="gap-2">
            <ClipboardCopy className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Copiar resumo
          </ModalButton>
          <ModalButton onClick={() => window.print()} className="gap-2">
            <Printer className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Imprimir / Salvar PDF
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
            triggerNode={<ModalButton variant="primary" className="gap-2"><Download className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Exportar resultados</ModalButton>}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" /> Resultados salvos no workspace
        </p>
        <div className="flex flex-wrap gap-2">
          {onOpenRetro && <ModalButton onClick={onOpenRetro} className="h-9 gap-2 text-[13px]"><MessageSquareText className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Abrir retro da sprint</ModalButton>}
          <ModalButton onClick={onRefreshHistory} className="h-9 gap-2 text-[13px]"><RefreshCcw className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Atualizar histórico</ModalButton>
          <ModalButton onClick={onNewSession} className="h-9 gap-2 text-[13px]"><Plus className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Nova sessão</ModalButton>
        </div>
      </div>

      <ReportDocumentHeader report={report} />
      <ReportKpis report={report} />
      <ReportTaskTable report={report} />
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
  );
}
