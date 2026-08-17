'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EliteExportDialog } from "@/components/shared/EliteExportDialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, DownloadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RetroCard, RetroBoard, RetroColumnKey, RetroColumnDef } from "@/lib/types";
import { RETRO_TEMPLATES } from "@/lib/types";

interface ExportRetroDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: RetroBoard;
  cards: RetroCard[];
}

export function ExportRetroDialog({ isOpen, onClose, boardData, cards }: ExportRetroDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    if (!isOpen) return '';

    const date = new Date().toLocaleDateString('pt-BR');
    let md = `# 🎯 Resumo da Retrospectiva - ${boardData.title || 'Sem Título'} (${date})\n\n`;

    const columns: RetroColumnDef[] = boardData.columns && boardData.columns.length > 0
      ? [...boardData.columns].sort((a, b) => a.order - b.order)
      : RETRO_TEMPLATES.classic;

    const themeEmojis: Record<string, string> = {
      success: '🟢',
      warning: '🟠',
      action: '🔵',
      purple: '🟣',
      pink: '💗',
      cyan: '💎',
      neutral: '⚪',
    };

    columns.forEach(col => {
      const colCards = cards.filter(c => c.columnKey === col.id && c.content.trim() !== '');
      if (colCards.length === 0) return;

      const emoji = themeEmojis[col.theme] || '⚪';
      md += `## ${emoji} ${col.title}\n\n`;

      if (col.theme === 'action') {
        colCards.forEach(c => {
          const assignee = c.assignee ? `👤 **Dono:** ${c.assignee}` : '👤 **Dono:** Não definido';
          const dueDate = c.dueDate ? `📅 **Prazo:** ${c.dueDate}` : '📅 **Prazo:** Sem prazo';
          md += `- [${c.isDone ? 'x' : ' '}] ${c.content.replace(/\n/g, ' ')} ${assignee} ${dueDate}\n`;
        });
      } else {
        // Sort by votes
        const sorted = [...colCards].sort((a, b) => b.votes.length - a.votes.length);
        sorted.forEach(c => {
          md += `- [🔼 ${c.votes.length} votos] ${c.content.replace(/\n/g, ' ')}\n`;
        });
      }
      md += '\n';
    });

    return md.trim();
  }, [isOpen, boardData, cards]);

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
      ['Coluna', 'Votos', 'Conteúdo', 'Responsável', 'Prazo'],
    ];

    const columns: RetroColumnDef[] = boardData.columns && boardData.columns.length > 0
      ? [...boardData.columns].sort((a, b) => a.order - b.order)
      : RETRO_TEMPLATES.classic;

    columns.forEach(col => {
      const colCards = cards.filter(c => c.columnKey === col.id && c.content.trim() !== '');
      if (colCards.length === 0) return;

      colCards.forEach(c => {
        const row = [
          col.title,
          c.votes.length.toString(),
          c.content.replace(/"/g, '""'), // Escape quotes
          c.assignee || '',
          c.dueDate || ''
        ];
        csvRows.push(row);
      });
    });

    const csvString = csvRows
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel
    const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `retro_${boardData.title?.replace(/\s+/g, '_') || 'summary'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Iniciado!",
      description: "O arquivo CSV foi gerado com sucesso.",
    });
  };

  return (
    <EliteExportDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Resumo da Retrospectiva"
      description="Ata automática gerada em formato Markdown para compartilhamento."
      markdownContent={markdown}
      onDownloadCSV={handleDownloadCSV}
      theme="primary"
    />
  );
}
