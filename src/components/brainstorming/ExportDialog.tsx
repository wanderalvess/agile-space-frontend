'use client';

import React, { useMemo, useState } from 'react';
import { ExportDialogShell, type ExportFormatOption } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import type { BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { buildCsv, buildMarkdown, csvFileName } from './brainstorm-export';
import { boardTotals, totalsLine } from './brainstorm-room-logic';

type ExportFormat = 'md' | 'csv' | 'png';

const FORMATS: Record<ExportFormat, ExportFormatOption & { cta: string }> = {
  md: { id: 'md', name: 'Resumo em Markdown', desc: 'Grupos com as ideias ordenadas por votos, com retorno e esforço.', short: 'MD', cta: 'Copiar resumo' },
  csv: { id: 'csv', name: 'Planilha (CSV)', desc: 'Grupo, votos, texto, retorno, esforço e data de criação.', short: 'CSV', cta: 'Baixar planilha' },
  png: { id: 'png', name: 'Imagem (PNG)', desc: 'Só do Mural e da Teia.', short: 'PNG', cta: 'Salvar imagem' },
};

export interface ExportBrainstormingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  /** A etapa atual gera imagem (Mural e Teia): só então a opção aparece. */
  canExportImage: boolean;
  onExportImage: () => void;
}

/** Exportar o brainstorming: resumo em Markdown (copia), planilha CSV (baixa) e, no Mural e na Teia, a imagem (PNG). */
export function ExportBrainstormingDialog({ open, onOpenChange, title, ideas, groups, canExportImage, onExportImage }: ExportBrainstormingDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>('md');

  const formats = (canExportImage ? ['md', 'csv', 'png'] : ['md', 'csv']) as ExportFormat[];
  const current: ExportFormat = formats.includes(format) ? format : 'md';

  const markdown = useMemo(
    () => (open ? buildMarkdown({ title, date: new Date().toLocaleDateString('pt-BR'), ideas, groups }) : ''),
    [open, title, ideas, groups]
  );

  const exportNow = async () => {
    if (current === 'md') {
      const ok = await copyToClipboard(markdown);
      toast(ok ? { title: 'Resumo copiado!', description: 'Cole no Slack, Teams ou Confluence.' } : { title: 'Erro ao copiar', description: 'Ocorreu um erro ao copiar para a área de transferência.', variant: 'destructive' });
      return;
    }
    if (current === 'csv') {
      // BOM de UTF-8 para o Excel abrir os acentos certos
      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), buildCsv(ideas, groups)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = csvFileName(title);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Download iniciado!', description: 'O arquivo CSV foi gerado com sucesso.' });
      return;
    }
    onOpenChange(false);
    // espera a janela sumir para a imagem não sair com ela por cima
    setTimeout(onExportImage, 300);
  };

  return (
    <ExportDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Exportar o brainstorming"
      summary={`${title || 'Sem título'} · ${totalsLine(boardTotals(ideas.filter((i) => !i.hidden), groups))}`}
      formats={formats.map((f) => FORMATS[f])}
      selected={current}
      onSelect={(id) => setFormat(id as ExportFormat)}
      onExport={() => void exportNow()}
      ctaLabel={FORMATS[current].cta}
    >
      {current === 'md' && (
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">Prévia</span>
          <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">{markdown || 'Sem ideias ainda.'}</pre>
        </div>
      )}
    </ExportDialogShell>
  );
}
