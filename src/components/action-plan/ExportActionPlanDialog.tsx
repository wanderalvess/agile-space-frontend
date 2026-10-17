"use client";

import { useMemo, useState } from 'react';
import { ExportDialogShell, type ExportFormatOption } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { planCsv, planCsvFileName, planMarkdown, summarizeTasks } from '@/lib/action-plan';
import type { ActionPlanBoard, ActionPlanTask } from '@/lib/types';

interface ExportActionPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: ActionPlanBoard;
  tasks: ActionPlanTask[];
}

const FORMATS: ExportFormatOption[] = [
  { id: 'markdown', name: 'Markdown', short: 'MD', desc: 'Uma seção por ação, com os sete campos e o status. Copia para a área de transferência.' },
  { id: 'csv', name: 'Planilha (CSV)', short: 'CSV', desc: 'Uma linha por ação, com os sete campos e o status em português.' },
];

/** Exportar o plano: Markdown (copiar) ou CSV (baixar). O arquivo é gerado aqui; a janela é a do kit. */
export function ExportActionPlanDialog({ isOpen, onClose, boardData, tasks }: ExportActionPlanDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState('markdown');

  const markdown = useMemo(
    () => (isOpen ? planMarkdown(boardData, tasks, new Date().toLocaleDateString('pt-BR')) : ''),
    [isOpen, boardData, tasks],
  );
  const summary = summarizeTasks(tasks);

  const copyMarkdown = async () => {
    const ok = await copyToClipboard(markdown);
    if (ok) {
      toast({ title: 'Resumo copiado!', description: 'Cole no Slack, Teams ou Confluence.' });
      onClose();
    } else {
      toast({ title: 'Erro ao copiar', description: 'Ocorreu um erro ao copiar para a área de transferência.', variant: 'destructive' });
    }
  };

  const downloadCsv = () => {
    // BOM na frente para o Excel abrir os acentos corretamente
    const blob = new Blob(['﻿' + planCsv(tasks)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', planCsvFileName(boardData.title));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Download iniciado', description: 'Seu arquivo CSV está sendo baixado.' });
    onClose();
  };

  return (
    <ExportDialogShell
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Exportar o plano"
      summary={`${boardData.title || 'Plano de ação'} · ${summary.total} ${summary.total === 1 ? 'ação' : 'ações'} · ${summary.done} ${summary.done === 1 ? 'concluída' : 'concluídas'}`}
      formats={FORMATS}
      selected={format}
      onSelect={setFormat}
      ctaLabel={format === 'csv' ? 'Baixar planilha' : 'Copiar Markdown'}
      onExport={format === 'csv' ? downloadCsv : copyMarkdown}
    >
      {format === 'markdown' && (
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">Prévia</span>
          <pre className="m-0 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
            {markdown || 'Nenhuma ação no plano ainda.'}
          </pre>
        </div>
      )}
    </ExportDialogShell>
  );
}
