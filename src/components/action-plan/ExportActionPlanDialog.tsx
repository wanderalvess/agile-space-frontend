"use client";

import { useState, useMemo } from 'react';
import { EliteExportDialog } from "@/components/shared/EliteExportDialog";
import { useToast } from "@/hooks/use-toast";
import type { ActionPlanBoard, ActionPlanTask } from "@/lib/types";

interface ExportActionPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: ActionPlanBoard;
  tasks: ActionPlanTask[];
}

export function ExportActionPlanDialog({ 
  isOpen, 
  onClose, 
  boardData, 
  tasks,
}: ExportActionPlanDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    if (!isOpen) return '';

    const date = new Date().toLocaleDateString('pt-BR');
    let md = `# 📋 Plano de Ação - ${boardData.title || 'Sem Título'} (${date})\n\n`;

    const statuses = {
      todo: 'A Fazer',
      doing: 'Em Andamento',
      done: 'Concluído',
      blocked: 'Impedido'
    };

    tasks.forEach((task, index) => {
      md += `### ${index + 1}. ${task.what}\n`;
      md += `- **Por que:** ${task.why}\n`;
      md += `- **Como:** ${task.how}\n`;
      if (task.howMuch) md += `- **Custo/Esforço:** ${task.howMuch}\n`;
      md += `- **Onde:** ${task.where}\n`;
      md += `- **Quando:** ${task.when}\n`;
      md += `- **Quem:** ${task.who}\n`;
      md += `- **Status:** ${statuses[task.status]}\n\n`;
    });

    return md.trim();
  }, [isOpen, boardData, tasks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast({
        title: "Resumo copiado!",
        description: "Cole no Slack, Teams ou Confluence.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Ocorreu um erro ao copiar para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = () => {
    const csvRows = [
      ['ID', 'O Quê (What)', 'Por Que (Why)', 'Como (How)', 'Custo/Esforço (How Much)', 'Onde (Where)', 'Quando (When)', 'Quem (Who)', 'Status']
    ];

    tasks.forEach((t, i) => {
      csvRows.push([
        (i + 1).toString(),
        t.what,
        t.why,
        t.how,
        t.howMuch || '',
        t.where,
        t.when,
        t.who,
        t.status
      ].map(field => `"${(field || '').replace(/"/g, '""')}"`));
    });

    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Plano_Acao_${boardData.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Iniciado",
      description: "Seu arquivo CSV está sendo baixado.",
    });
  };

  return (
    <EliteExportDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar Plano de Ação"
      description="Leve seu 5W2H para fora do Espaço Ágil. Escolha o formato ideal para seu time."
      markdownContent={markdown}
      onDownloadCSV={handleDownloadCSV}
      theme="primary"
    />
  );
}
