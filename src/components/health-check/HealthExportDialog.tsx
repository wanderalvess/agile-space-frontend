'use client';

import { useState } from 'react';
import { ExportDialogShell, type ExportFormatOption } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { buildCsv, buildMarkdown, exportFileName, respondentsText, type HealthReport } from '@/lib/health-check-export';
import { formatScore } from '@/lib/health-check-rules';
import { exportHealthPdf } from './health-check-pdf';

export type HealthExportFormat = 'md' | 'csv' | 'pdf';

export const HEALTH_EXPORT_FORMATS: ExportFormatOption[] = [
  { id: 'md', name: 'Markdown', desc: 'Tabela por dimensão, pontos fortes e em atenção e comentários, copiada para colar na ata, no Confluence ou no Jira.', short: 'MD' },
  { id: 'csv', name: 'Planilha (CSV)', desc: 'Uma linha por dimensão, com a contagem de cada resposta, a média e a nota de clima.', short: 'CSV' },
  { id: 'pdf', name: 'PDF do resultado', desc: 'Resumo, barras por dimensão e comentários em páginas A4, pronto para imprimir.', short: 'PDF' },
];

const CTA: Record<HealthExportFormat, string> = { md: 'Copiar Markdown', csv: 'Baixar planilha (.csv)', pdf: 'Baixar PDF' };

/** Baixa um texto como arquivo. */
function downloadText(text: string, filename: string, type: string) {
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([text], { type }));
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export interface HealthExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: HealthReport;
}

/** Exportar o resultado: Markdown (copia), CSV e PDF (baixam), os três nas três escalas e com a mesma regra de atenção. */
export function HealthExportDialog({ open, onOpenChange, report }: HealthExportDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<HealthExportFormat>('md');
  const [exporting, setExporting] = useState(false);

  const summary = `${report.title} · ${respondentsText(report.respondents)} · ${report.dimensions.length} ${report.dimensions.length === 1 ? 'dimensão' : 'dimensões'} · nota de clima ${formatScore(report.climate)}`;

  const run = async () => {
    if (selected === 'md') {
      const ok = await copyToClipboard(buildMarkdown(report));
      if (ok) toast({ title: 'Markdown copiado!', description: 'Pronto para colar no Jira, no Confluence ou no Notion.' });
      else toast({ title: 'Não foi possível copiar', description: 'Permita o acesso à área de transferência e tente de novo.', variant: 'destructive' });
      return;
    }
    if (selected === 'csv') {
      downloadText(buildCsv(report), exportFileName(report.title, 'csv', report.isoDate), 'text/csv;charset=utf-8;');
      toast({ title: 'Planilha baixada!', description: 'O arquivo CSV foi gerado com sucesso.' });
      return;
    }
    setExporting(true);
    try {
      await exportHealthPdf(report, exportFileName(report.title, 'pdf', report.isoDate));
      toast({ title: 'PDF baixado!', description: 'O resultado foi exportado com sucesso.' });
    } catch (e) {
      console.error('Erro ao gerar o PDF do radar', e);
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <ExportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Exportar o resultado"
      summary={summary}
      formats={HEALTH_EXPORT_FORMATS}
      selected={selected}
      onSelect={(id) => setSelected(id as HealthExportFormat)}
      onExport={run}
      exporting={exporting}
      ctaLabel={CTA[selected]}
    />
  );
}
