'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ExportDialogShell, type ExportFormatOption } from '@/components/room-kit';
import type { Issue, Participant, DeckType, VotingRound } from '@/lib/types';
import { buildSessionReport, type SessionReportData } from '@/lib/poker-report';
import { buildCsv, buildMarkdown, buildTdnText } from '@/lib/poker-report-export';
import { useReportPrint } from './report/useReportPrint';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ExportDialogProps {
  roomTitle: string;
  roomTeam?: string;
  issues: Issue[];
  participants: Participant[];
  deck: DeckType;
  triggerNode?: React.ReactNode;
  // Tempo por tópico no relatório — só inclui a seção quando o facilitador
  // ligou "Tempo por tópico" nas configs (mesma flag da visão ao vivo).
  rounds?: VotingRound[];
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  perTopicTime?: boolean;
  divergenceThresholds?: { warn: number; high: number };
  /** Relatório já montado pela tela (evita calcular duas vezes). */
  report?: SessionReportData;
  /** Faz o Ctrl+P do navegador imprimir o relatório em vez da página da sala. */
  interceptBrowserPrint?: boolean;
}

type ExportFormatId = 'markdown' | 'csv' | 'pdf' | 'tdn';

const EXPORT_FORMATS: ExportFormatOption[] = [
  { id: 'markdown', name: 'Markdown para o Jira', desc: 'Tabela formatada pronta para colar', short: 'MD' },
  { id: 'csv', name: 'Planilha (CSV)', desc: 'Uma linha por tarefa, com a situação', short: 'CSV' },
  { id: 'pdf', name: 'Documento executivo (PDF)', desc: 'A4 paisagem, com totais e destaques para a gestão', short: 'PDF' },
  { id: 'tdn', name: 'Texto para o TDN', desc: 'Texto simples para colar na página do TDN', short: 'TDN' },
];

export function ExportDialog({
  roomTitle, roomTeam, issues, participants, deck, triggerNode, rounds, sessionStartedAt, sessionEndedAt,
  perTopicTime, divergenceThresholds, report: reportProp, interceptBrowserPrint,
}: ExportDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormatId>('markdown');

  const report = useMemo(
    () =>
      reportProp ??
      buildSessionReport({ roomTitle, roomTeam, deck, issues, participants, rounds, sessionStartedAt, sessionEndedAt, divergenceThresholds, perTopicTime }),
    [reportProp, roomTitle, roomTeam, deck, issues, participants, rounds, sessionStartedAt, sessionEndedAt, divergenceThresholds, perTopicTime]
  );
  const { print, portal } = useReportPrint(report, { interceptBrowserPrint });

  const copyText = async (text: string, title: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description });
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const handleCSV = () => {
    const blob = new Blob(['﻿' + buildCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${roomTitle || 'poker'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Baixado!', description: 'Arquivo CSV gerado com sucesso.' });
  };

  // Antes só aparecia com itens concluídos; uma sessão em que tudo foi pulado
  // também merece relatório (justamente para registrar o que não foi debatido).
  if (issues.length === 0) return <>{portal}</>;

  const runExport = () => {
    if (exportFormat === 'markdown') {
      void copyText(buildMarkdown(report), 'Markdown Copiado!', 'Pronto para colar no Jira, Confluence ou Notion.');
      setIsOpen(false);
    } else if (exportFormat === 'csv') {
      handleCSV();
      setIsOpen(false);
    } else if (exportFormat === 'tdn') {
      void copyText(buildTdnText(report), 'Texto TDN Copiado!', 'Cole na página do TDN e ajuste a formatação.');
      setIsOpen(false);
    } else {
      // O diálogo precisa sair da tela antes da impressão; o CSS de impressão o esconde de qualquer forma.
      setIsOpen(false);
      window.setTimeout(print, 150);
    }
  };

  const b = report.breakdown;
  const summary = [
    `${b.discussed} ${b.discussed === 1 ? 'debatida' : 'debatidas'}`,
    b.skipped > 0 && `${b.skipped} ${b.skipped === 1 ? 'pulada' : 'puladas'}`,
    b.cancelled > 0 && `${b.cancelled} ${b.cancelled === 1 ? 'cancelada' : 'canceladas'}`,
    b.parked > 0 && `${b.parked} ${b.parked === 1 ? 'adiada' : 'adiadas'}`,
    b.untouched > 0 && `${b.untouched} não ${b.untouched === 1 ? 'abordada' : 'abordadas'}`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <span className="contents" onClick={() => setIsOpen(true)}>
        {triggerNode || (
          <Button variant="outline" size="sm" className="hidden h-9 gap-2 sm:flex">
            <Download className="h-4 w-4" strokeWidth={1.5} />
            Exportar resumo
          </Button>
        )}
      </span>
      <ExportDialogShell
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Exportar resultados"
        summary={summary}
        formats={EXPORT_FORMATS}
        selected={exportFormat}
        onSelect={(id) => setExportFormat(id as ExportFormatId)}
        onExport={runExport}
        ctaLabel={exportFormat === 'pdf' ? 'Imprimir / Salvar PDF' : `Exportar ${EXPORT_FORMATS.find((f) => f.id === exportFormat)?.short ?? ''}`}
      />
      {portal}
    </>
  );
}
