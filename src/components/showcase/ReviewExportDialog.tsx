'use client';

import React, { useState } from 'react';
import { ExportDialogShell, type ExportFormatOption } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import type { ShowcaseSession, ShowcaseTask } from './types';
import { buildApprovalsTable, buildLogMarkdown, fileSlug, groupByDecision } from './review-export';
import { exportReviewPdf } from './review-pdf';

export type ReviewExportFormat = 'pdf' | 'log' | 'table' | 'print';

export const REVIEW_EXPORT_FORMATS: ExportFormatOption[] = [
  { id: 'pdf', name: 'Slides em PDF', desc: 'Capa, indicadores e uma página por entrega, com o print ou o primeiro anexo de imagem.', short: 'PDF' },
  { id: 'log', name: 'Log em Markdown', desc: 'Relatório com aprovadas, pendências e sem decisão, com autor e hora de cada decisão.', short: 'MD' },
  { id: 'table', name: 'Tabela de aprovações', desc: 'Tabela Markdown com issue, link, dev, QA, projeto e versões; é copiada para a área de transferência.', short: 'MD' },
  { id: 'print', name: 'Imprimir slides', desc: 'Capa e um slide por card em A4 paisagem, pela impressão do navegador.', short: 'A4' },
];

/** Baixa um texto como arquivo. */
function downloadText(text: string, filename: string, type: string) {
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([text], { type }));
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export interface ReviewExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ShowcaseSession | null;
  tasks: ShowcaseTask[];
  sessionName: string;
  /** Imprime os slides (a sala fecha o diálogo e chama a impressão do navegador). */
  onPrint: () => void;
}

/** Exportar a Review: escolha do formato (PDF, log em Markdown, tabela de aprovações ou impressão). */
export function ReviewExportDialog({ open, onOpenChange, session, tasks, sessionName, onPrint }: ReviewExportDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ReviewExportFormat>('pdf');
  const [exporting, setExporting] = useState(false);
  const g = groupByDecision(tasks);

  const summary = `${tasks.length} ${tasks.length === 1 ? 'entrega' : 'entregas'} · ${g.approved.length} ${g.approved.length === 1 ? 'aprovada' : 'aprovadas'} · ${g.adjustments.length} com ajuste · ${g.rejected.length} ${g.rejected.length === 1 ? 'rejeitada' : 'rejeitadas'} · ${g.pending.length} aguardando`;

  const run = async () => {
    if (selected === 'print') {
      onOpenChange(false);
      onPrint();
      return;
    }
    if (selected === 'log') {
      downloadText(buildLogMarkdown(session, sessionName, tasks), `review-log-${fileSlug(sessionName, 'review')}.md`, 'text/markdown');
      return;
    }
    if (selected === 'table') {
      const ok = await copyToClipboard(buildApprovalsTable(sessionName, tasks));
      if (ok) toast({ title: 'Resumo copiado!', description: 'O resumo de aprovações foi copiado para a área de transferência.' });
      else toast({ title: 'Não foi possível copiar', description: 'Permita o acesso à área de transferência e tente de novo.', variant: 'destructive' });
      return;
    }
    if (!session) return;
    setExporting(true);
    try {
      await exportReviewPdf(session, tasks, sessionName);
      toast({ title: 'PDF baixado!', description: 'Slides exportados com sucesso.' });
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const cta: Record<ReviewExportFormat, string> = {
    pdf: 'Exportar PDF',
    log: 'Baixar log (.md)',
    table: 'Copiar tabela',
    print: 'Imprimir slides',
  };

  return (
    <ExportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Exportar a Review"
      summary={summary}
      formats={REVIEW_EXPORT_FORMATS}
      selected={selected}
      onSelect={(id) => setSelected(id as ReviewExportFormat)}
      onExport={run}
      exporting={exporting}
      ctaLabel={cta[selected]}
    />
  );
}
