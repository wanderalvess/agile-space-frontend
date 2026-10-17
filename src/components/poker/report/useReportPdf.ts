'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { SessionReportData } from '@/lib/poker-report';
import { downloadReportPdf, type ReportPdfOptions } from '@/lib/poker-report-pdf';

/**
 * Baixa o relatório em PDF A4 gerado no próprio navegador (sem diálogo de
 * impressão). O jsPDF só é carregado no primeiro clique.
 */
export function useReportPdf(report: SessionReportData) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = useCallback(
    async (options: ReportPdfOptions = {}) => {
      setBusy(true);
      try {
        const name = await downloadReportPdf(report, options);
        toast({ title: options.resultsOnly ? 'Página de resultados baixada' : 'PDF baixado', description: `${name} · A4 paisagem.` });
      } catch {
        toast({ title: 'Não foi possível gerar o PDF', description: 'Tente de novo ou use Imprimir / Salvar PDF.', variant: 'destructive' });
      } finally {
        setBusy(false);
      }
    },
    [report, toast]
  );

  return { download, busy };
}
