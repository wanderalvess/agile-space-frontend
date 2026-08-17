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
import { Copy, Check, FileText, DownloadCloud, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BrainstormingIdea, BrainstormingBoard, BrainstormingGroup } from "@/lib/types";

interface ExportBrainstormingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: BrainstormingBoard;
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  onExportImage: () => void;
}

export function ExportBrainstormingDialog({ 
  isOpen, 
  onClose, 
  boardData, 
  ideas, 
  groups,
  onExportImage 
}: ExportBrainstormingDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    if (!isOpen) return '';

    const date = new Date().toLocaleDateString('pt-BR');
    let md = `# 💡 Brainstorming - ${boardData.title || 'Sem Título'} (${date})\n\n`;

    // Group ideas
    const groupsWithIdeas = groups.map(group => ({
      ...group,
      ideas: ideas.filter(i => i.groupId === group.id)
    })).sort((a, b) => a.order - b.order);

    const unassignedIdeas = ideas.filter(i => !i.groupId);

    // Render assigned groups
    groupsWithIdeas.forEach(group => {
      if (group.ideas.length === 0) return;
      md += `## 📁 ${group.title}\n\n`;
      
      const sorted = [...group.ideas].sort((a, b) => b.votes.length - a.votes.length);
      sorted.forEach(idea => {
        const roi = idea.qualifiers?.roi !== undefined ? ` | ROI: ${idea.qualifiers.roi}%` : '';
        const effort = idea.qualifiers?.effort !== undefined ? ` | Esforço: ${idea.qualifiers.effort}%` : '';
        md += `- [🔼 ${idea.votes.length} votos] ${idea.content.replace(/\n/g, ' ')}${roi}${effort}\n`;
      });
      md += '\n';
    });

    // Render unassigned
    if (unassignedIdeas.length > 0) {
      md += `## 📎 Sem Grupo\n\n`;
      const sorted = [...unassignedIdeas].sort((a, b) => b.votes.length - a.votes.length);
      sorted.forEach(idea => {
        const roi = idea.qualifiers?.roi !== undefined ? ` | ROI: ${idea.qualifiers.roi}%` : '';
        const effort = idea.qualifiers?.effort !== undefined ? ` | Esforço: ${idea.qualifiers.effort}%` : '';
        md += `- [🔼 ${idea.votes.length} votos] ${idea.content.replace(/\n/g, ' ')}${roi}${effort}\n`;
      });
      md += '\n';
    }

    return md.trim();
  }, [isOpen, boardData, ideas, groups]);

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
      ['Grupo', 'Votos', 'Conteúdo', 'ROI', 'Esforço', 'Data Criação'],
    ];

    const groupMap = new Map(groups.map(g => [g.id, g.title]));

    ideas.forEach(idea => {
      const row = [
        idea.groupId ? (groupMap.get(idea.groupId) || 'Desconhecido') : 'Sem Grupo',
        idea.votes.length.toString(),
        idea.content.replace(/"/g, '""'),
        idea.qualifiers?.roi?.toString() || '',
        idea.qualifiers?.effort?.toString() || '',
        new Date(idea.createdAt).toLocaleString()
      ];
      csvRows.push(row);
    });

    const csvString = csvRows
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel
    const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `brainstorming_${boardData.title?.replace(/\s+/g, '_') || 'summary'}.csv`);
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
      title="Exportar Brainstorming"
      description="Escolha o formato ideal para documentar suas ideias."
      markdownContent={markdown}
      onDownloadCSV={handleDownloadCSV}
      onExportImage={onExportImage}
      theme="amber"
    />
  );
}
