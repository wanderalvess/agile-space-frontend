'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Download,
  FileText,
  ClipboardCopy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookText,
  Link2,
} from 'lucide-react';
import type { RetroCard, RetroBoard, RetroColumnDef, RetroParticipant, TeamRole } from '@/lib/types';
import { RETRO_TEMPLATES } from '@/lib/types';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportRetroDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: RetroBoard;
  cards: RetroCard[];
  participants?: RetroParticipant[];
  triggerNode?: React.ReactNode;
}

export function ExportRetroDialog({
  isOpen,
  onClose,
  boardData,
  cards,
  participants = [],
  triggerNode,
}: ExportRetroDialogProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [slideLink, setSlideLink] = useState('');

  // Mapeamento de participantes para recuperar nomes de autores
  const participantMap = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach(p => {
      if (p.id && p.nickname) map.set(p.id, p.nickname);
    });
    return map;
  }, [participants]);

  // Participantes agrupados por papel, no padrão das páginas do TDN (AM/PO/SME/DEV TEAM...)
  const participantsByRole = useMemo(() => {
    const order: TeamRole[] = ['AM', 'PO', 'PL', 'DEV', 'QA', 'UX', 'SME', 'OUTRO'];
    return order
      .map(role => ({
        label: role === 'DEV' ? 'DEV TEAM' : role,
        names: participants.filter(p => p.role === role).map(p => p.nickname),
      }))
      .filter(g => g.names.length > 0);
  }, [participants]);

  // Colunas ordenadas do quadro
  const columns: RetroColumnDef[] = useMemo(() => {
    if (boardData.columns && boardData.columns.length > 0) {
      return [...boardData.columns].sort((a, b) => a.order - b.order);
    }
    return RETRO_TEMPLATES.classic;
  }, [boardData.columns]);

  // Métricas consolidadas da sessão
  const validCards = useMemo(() => cards.filter(c => c.content && c.content.trim() !== ''), [cards]);
  const totalCards = validCards.length;
  const totalVotes = useMemo(() => validCards.reduce((acc, c) => acc + (c.votes?.length || 0), 0), [validCards]);

  const actionCards = useMemo(() => {
    return validCards.filter(c => {
      const col = columns.find(col => col.id === c.columnKey);
      return col?.theme === 'action' || c.columnKey === 'actions' || c.assignee || c.dueDate;
    });
  }, [validCards, columns]);

  const completedActions = useMemo(() => actionCards.filter(c => c.isDone).length, [actionCards]);
  const pendingActions = actionCards.length - completedActions;

  const formatDate = () => format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  // Compartilhado pelo markdown e pelo texto TDN: uma quebra de linha dentro
  // do conteúdo de um card vira um item de lista quebrado em ambos os
  // formatos, então os dois builders sanitizam pela mesma função.
  const cleanContent = (content: string) => content.replace(/\n/g, ' ');
  const formatFilename = (title: string, ext: string) => {
    const cleanTitle = (title || 'retrospectiva')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    return `relatorio-${cleanTitle}-${dateStr}.${ext}`;
  };

  // ---------------------------------------------------------------- Markdown
  const markdown = useMemo(() => {
    const lines: string[] = [];
    const title = boardData.title || 'Quadro de Retrospectiva';
    lines.push(`# 🎯 Relatório de Retrospectiva: ${title}`);
    lines.push(`**Data:** ${formatDate()} | **Squad:** ${boardData.team || 'Geral'}`);
    lines.push('');

    lines.push('## Resumo da Sessão');
    lines.push('');
    lines.push(`- **Total de contribuições:** ${totalCards}`);
    lines.push(`- **Votos computados:** ${totalVotes}`);
    lines.push(`- **Planos de Ação definidos:** ${actionCards.length} (${completedActions} concluídos, ${pendingActions} pendentes)`);
    if (participants.length > 0) {
      lines.push(`- **Participantes presentes:** ${participants.length}`);
    }
    lines.push('');

    columns.forEach(col => {
      const colCards = validCards.filter(c => c.columnKey === col.id);
      if (colCards.length === 0) return;

      const isAction = col.theme === 'action' || col.id === 'actions';
      lines.push(`## ${col.title} (${colCards.length})`);
      lines.push('');

      if (isAction) {
        lines.push('| Status | Ação | Responsável | Prazo |');
        lines.push('|:---:|---|---|---|');
        colCards.forEach(c => {
          const status = c.isDone ? '[x] Concluído' : '[ ] Pendente';
          const assignee = c.assignee ? `👤 ${c.assignee}` : '-';
          const dueDate = c.dueDate ? `📅 ${c.dueDate}` : '-';
          lines.push(`| ${status} | ${cleanContent(c.content)} | ${assignee} | ${dueDate} |`);
        });
      } else {
        const sorted = [...colCards].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
        lines.push('| Votos | Contribuição | Autor |');
        lines.push('|:---:|---|---|');
        sorted.forEach(c => {
          const votes = c.votes?.length || 0;
          const author = boardData.isAuthorsRevealed && c.authorId && participantMap.has(c.authorId)
            ? participantMap.get(c.authorId)!
            : '-';
          lines.push(`| ${votes} | ${cleanContent(c.content)} | ${author} |`);
        });
      }
      lines.push('');
    });

    if (participants.length > 0) {
      lines.push('## Squad Participante');
      lines.push('');
      const names = participants.map(p => {
        let label = p.nickname;
        if (p.role) label += ` (${p.role})`;
        if (p.isCreator) label += ' [Facilitador]';
        return label;
      });
      lines.push(names.join(' • '));
      lines.push('');
    }

    return lines.join('\n');
  }, [boardData, validCards, columns, actionCards, completedActions, pendingActions, participants, totalCards, totalVotes, participantMap]);

  const handleMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    toast({
      title: 'Markdown Copiado!',
      description: 'Pronto para colar no Jira, Confluence, Teams ou Slack.',
    });
  };

  // ---------------------------------------------------------------- Texto TDN
  const tdnText = useMemo(() => {
    const lines: string[] = [];
    lines.push(boardData.title || 'Quadro de Retrospectiva');
    lines.push('');
    lines.push(`Data: ${formatDate()}`);
    lines.push('');

    if (participantsByRole.length > 0) {
      lines.push('Participantes:');
      participantsByRole.forEach(g => lines.push(`${g.label}: ${g.names.join(', ')}`));
      lines.push('');
    }

    if (slideLink.trim()) {
      lines.push(`Slides: ${slideLink.trim()}`);
      lines.push('');
    }

    columns.forEach(col => {
      const colCards = validCards.filter(c => c.columnKey === col.id);
      if (colCards.length === 0) return;

      const isAction = col.theme === 'action' || col.id === 'actions';
      lines.push(col.title);

      if (isAction) {
        colCards.forEach(c => {
          const checkbox = c.isDone ? '[x]' : '[ ]';
          const meta = [c.assignee, c.dueDate].filter(Boolean).join(' — ');
          lines.push(`${checkbox} ${cleanContent(c.content)}${meta ? ` (${meta})` : ''}`);
        });
      } else {
        const sorted = [...colCards].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
        sorted.forEach(c => lines.push(`- ${cleanContent(c.content)}`));
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }, [boardData, participantsByRole, slideLink, columns, validCards]);

  const handleTdn = () => {
    navigator.clipboard.writeText(tdnText);
    toast({
      title: 'Texto TDN Copiado!',
      description: 'Cole na página do TDN e ajuste tabela, embed do slide e checklist.',
    });
  };

  // ---------------------------------------------------------------- CSV
  const csvCell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const handleCSV = () => {
    const rows: string[] = [];

    rows.push('Resumo da Retrospectiva,Valor');
    rows.push(`Quadro,${csvCell(boardData.title || 'Retrospectiva')}`);
    rows.push(`Squad,${csvCell(boardData.team || 'Geral')}`);
    rows.push(`Data,${csvCell(formatDate())}`);
    rows.push(`Total de Itens,${totalCards}`);
    rows.push(`Total de Votos,${totalVotes}`);
    rows.push(`Planos de Ação,${actionCards.length}`);
    rows.push(`Ações Concluídas,${completedActions}`);
    rows.push(`Ações Pendentes,${pendingActions}`);
    rows.push(`Participantes,${participants.length}`);
    rows.push('');

    rows.push(['Coluna', 'Votos', 'Status', 'Conteúdo', 'Responsável', 'Prazo', 'Autor', 'Agrupado de'].map(csvCell).join(','));

    columns.forEach(col => {
      const colCards = validCards.filter(c => c.columnKey === col.id);
      const isAction = col.theme === 'action' || col.id === 'actions';

      const sorted = isAction 
        ? colCards 
        : [...colCards].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));

      sorted.forEach(c => {
        const author = boardData.isAuthorsRevealed && c.authorId && participantMap.has(c.authorId)
          ? participantMap.get(c.authorId)!
          : '';
        const status = isAction ? (c.isDone ? 'Concluído' : 'Pendente') : '-';
        const grouped = c.originalTexts && c.originalTexts.length > 0 ? c.originalTexts.join(' | ') : '';

        rows.push([
          col.title,
          c.votes?.length || 0,
          status,
          c.content,
          c.assignee || '',
          c.dueDate || '',
          author,
          grouped,
        ].map(csvCell).join(','));
      });
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = formatFilename(boardData.title || 'retro', 'csv');
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Baixado!', description: 'Planilha exportada com sucesso.' });
  };

  // ---------------------------------------------------------------- PDF
  /**
   * PDF de alta precisão montado diretamente com as APIs de texto do jsPDF.
   * Não utiliza html2canvas para evitar borramentos, recortes e perda de texto selecionável.
   * Todas as caixas são medidas antes da renderização garantindo paginação suave sem quebras indesejadas.
   */
  const handlePDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 14;              // margem lateral
      const CW = PW - M * 2;     // largura útil (182mm)
      const BOTTOM = PH - 16;    // reserva para o rodapé

      let y = M;

      const setFont = (
        size: number, 
        style: 'normal' | 'bold' | 'italic' = 'normal', 
        color: [number, number, number] = [30, 41, 59]
      ) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const addPage = () => {
        doc.addPage();
        y = M;
      };

      /** Garante espaço vertical; avança a página se não couber */
      const ensure = (h: number) => {
        if (y + h > BOTTOM) addPage();
      };

      /** Escreve texto quebrado em `width`, paginando linha a linha */
      const wrapped = (
        text: string,
        x: number,
        width: number,
        size: number,
        style: 'normal' | 'bold' | 'italic' = 'normal',
        color: [number, number, number] = [30, 41, 59],
        lineH = size * 0.42 + 1.2
      ) => {
        setFont(size, style, color);
        const lines = doc.splitTextToSize(text || '', width) as string[];
        lines.forEach(line => {
          ensure(lineH);
          doc.text(line, x, y);
          y += lineH;
        });
        return lines.length;
      };

      /** Altura que um texto ocuparia (para medir antes de desenhar) */
      const measure = (text: string, width: number, size: number, lineH = size * 0.42 + 1.2) => {
        doc.setFontSize(size);
        return (doc.splitTextToSize(text || '', width) as string[]).length * lineH;
      };

      const sectionTitle = (label: string, color: [number, number, number] = [5, 150, 105]) => {
        ensure(15);
        y += 4;
        setFont(11, 'bold', color);
        doc.text(label.toUpperCase(), M, y);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y, M + CW, y);
        y += 5;
      };

      // ------------------------------------------------------------ Capa / Header
      // Fundo esmeralda institucional
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, PW, 34, 'F');
      
      setFont(18, 'bold', [255, 255, 255]);
      doc.text('ESPAÇO ÁGIL', M, 15);
      
      setFont(9, 'normal', [209, 250, 229]);
      doc.text('Relatório Oficial de Retrospectiva', M, 21);
      
      setFont(12, 'bold', [255, 255, 255]);
      const roomTitleStr = boardData.title || 'Quadro de Retrospectiva';
      doc.text(doc.splitTextToSize(roomTitleStr, CW * 0.58)[0], M, 29);
      
      setFont(9, 'normal', [209, 250, 229]);
      const squadInfo = `${formatDate()}${boardData.team ? `  |  ${boardData.team}` : ''}`;
      doc.text(squadInfo, PW - M, 29, { align: 'right' });
      
      y = 42;

      // -------------------------------------------------- Resumo Executivo (KPIs)
      const kpis: Array<[string, string]> = [
        ['CONTRIBUIÇÕES', String(totalCards)],
        ['VOTOS TOTAIS', String(totalVotes)],
        ['PLANOS DE AÇÃO', `${actionCards.length} (${completedActions} concl.)`],
        ['PARTICIPANTES', String(participants.length || 'Squad')],
      ];

      const perRow = 4;
      const gap = 3.5;
      const boxW = (CW - gap * (perRow - 1)) / perRow;
      const boxH = 17;

      ensure(boxH + 6);
      kpis.forEach((kpi, idx) => {
        const x = M + idx * (boxW + gap);
        const top = y;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, top, boxW, boxH, 2, 2, 'FD');

        setFont(6.5, 'bold', [100, 116, 139]);
        doc.text(kpi[0], x + 3.5, top + 5.5);

        setFont(11.5, 'bold', [15, 23, 42]);
        doc.text(kpi[1], x + 3.5, top + 12.5);
      });
      y += boxH + 6;

      // Contexto da sessão
      setFont(8, 'normal', [100, 116, 139]);
      const contextLine = `Sessão com ${columns.length} colunas no quadro. ${completedActions} plano(s) de ação concluído(s) de ${actionCards.length} registrado(s).`;
      wrapped(contextLine, M, CW, 8, 'normal', [100, 116, 139]);
      y += 2;

      // Mapeamento de cores RGB por tema de coluna
      const themeColors: Record<string, [number, number, number]> = {
        success: [16, 185, 129], // Emerald
        warning: [217, 119, 6],   // Amber
        action: [79, 70, 229],   // Indigo
        purple: [147, 51, 234],  // Purple
        pink: [219, 39, 119],    // Pink
        cyan: [8, 145, 178],     // Cyan
        neutral: [71, 85, 105],  // Slate
      };

      // -------------------------------------------- Colunas do Quadro
      columns.forEach(col => {
        const colCards = validCards.filter(c => c.columnKey === col.id);
        if (colCards.length === 0) return;

        const isActionCol = col.theme === 'action' || col.id === 'actions';
        const color = themeColors[col.theme] || themeColors.neutral;

        sectionTitle(`${col.title} (${colCards.length})`, color);

        // Ordenar cards por votos se não for coluna de ação
        const sorted = isActionCol
          ? colCards
          : [...colCards].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));

        sorted.forEach(card => {
          const votesCount = card.votes?.length || 0;
          const author = boardData.isAuthorsRevealed && card.authorId && participantMap.has(card.authorId)
            ? participantMap.get(card.authorId)!
            : null;

          const cardTextW = CW - 12;

          // Cálculo da altura do card
          let contentH = measure(card.content, cardTextW, 9.5, 4.8);
          let extraH = 0;

          if (isActionCol) {
            extraH += 5; // linha de responsável e prazo
          } else if (author || card.carriedFromBoardTitle) {
            extraH += 4;
          }

          if (card.originalTexts && card.originalTexts.length > 0) {
            extraH += measure(`Agrupado: ${card.originalTexts.join(' | ')}`, cardTextW, 7.5, 3.8);
          }

          const totalCardH = Math.max(14, contentH + extraH + 7);
          ensure(totalCardH + 3);

          const cardTop = y;

          // Fundo do card com leve borda e listra lateral da cor do tema
          doc.setFillColor(252, 253, 254);
          doc.setDrawColor(235, 240, 245);
          doc.roundedRect(M, cardTop, CW, totalCardH, 2, 2, 'FD');

          // Tarja colorida na borda esquerda
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(M, cardTop, 2.2, totalCardH, 1, 1, 'F');

          let innerY = cardTop + 5.5;

          // Badge de status para Ações ou Votos
          if (isActionCol) {
            const statusText = card.isDone ? '[X] CONCLUIDO' : '[ ] PENDENTE';
            const statusColor: [number, number, number] = card.isDone ? [16, 185, 129] : [217, 119, 6];
            setFont(8, 'bold', statusColor);
            doc.text(statusText, M + CW - 4, innerY, { align: 'right' });
          } else if (votesCount > 0) {
            setFont(8, 'bold', [79, 70, 229]);
            doc.text(`${votesCount} voto${votesCount !== 1 ? 's' : ''}`, M + CW - 4, innerY, { align: 'right' });
          }

          // Conteúdo do card
          setFont(9.5, 'bold', [15, 23, 42]);
          const contentLines = doc.splitTextToSize(card.content, cardTextW - 24) as string[];
          contentLines.forEach(line => {
            doc.text(line, M + 5.5, innerY);
            innerY += 4.8;
          });

          // Metadados específicos
          if (isActionCol) {
            setFont(7.5, 'normal', [100, 116, 139]);
            const meta = `Responsavel: ${card.assignee || 'Nao definido'}    |    Prazo: ${card.dueDate || 'Sem prazo'}`;
            doc.text(meta, M + 5.5, innerY + 0.5);
            innerY += 4;
          } else if (author) {
            setFont(7.5, 'normal', [100, 116, 139]);
            doc.text(`Autor: ${author}`, M + 5.5, innerY + 0.5);
            innerY += 4;
          }

          // Histórico de fusão/agrupamento
          if (card.originalTexts && card.originalTexts.length > 0) {
            setFont(7, 'italic', [148, 163, 184]);
            const groupedText = `Agrupado de: ${card.originalTexts.join('  •  ')}`;
            const groupedLines = doc.splitTextToSize(groupedText, cardTextW) as string[];
            groupedLines.forEach(gLine => {
              doc.text(gLine, M + 5.5, innerY + 0.5);
              innerY += 3.8;
            });
          }

          y = cardTop + totalCardH + 2.5;
        });
      });

      // -------------------------------------------- Participantes
      if (participants.length > 0) {
        sectionTitle(`Squad Participante (${participants.length})`, [71, 85, 105]);
        const roster = participants.map(p => {
          let str = p.nickname;
          if (p.role) str += ` (${p.role})`;
          if (p.isCreator) str += ' [Facilitador]';
          return str;
        }).join('   •   ');

        wrapped(roster, M, CW, 8, 'normal', [71, 85, 105], 4.2);
        y += 3;
      }

      // ------------------------------------------------------- Rodapé
      const pages: number = (doc as any).getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(M, PH - 12, PW - M, PH - 12);
        
        setFont(7.5, 'normal', [148, 163, 184]);
        doc.text('Gerado automaticamente por Espaço Ágil', M, PH - 7.5);
        doc.text(`Página ${p} de ${pages}`, PW - M, PH - 7.5, { align: 'right' });
      }

      doc.save(formatFilename(boardData.title || 'retro', 'pdf'));
      toast({
        title: 'PDF Baixado com Sucesso!',
        description: 'Relatório executivo gerado em alta definição.',
      });
    } catch (err) {
      console.error('Erro ao gerar PDF da retrospectiva:', err);
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível gerar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-2xl border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-border/50 flex flex-col items-center gap-3 text-center bg-gradient-to-b from-emerald-500/5 to-transparent">
          <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 mb-1 shadow-inner">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic text-foreground">
            Exportar Retrospectiva
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-medium px-4 leading-relaxed">
            <strong className="text-foreground">{totalCards}</strong> contribuiç{totalCards !== 1 ? 'ões' : 'ão'} • <strong className="text-foreground">{totalVotes}</strong> voto{totalVotes !== 1 ? 's' : ''} • <strong className="text-foreground">{actionCards.length}</strong> plano{actionCards.length !== 1 ? 's' : ''} de ação. Escolha o formato ideal para relatar e compartilhar os resultados da cerimônia.
          </p>
        </div>

        {/* Grade de Ações de Exportação */}
        <div className="p-6 grid gap-3">
          {/* Opção 1: PDF Visual */}
          <Button
            onClick={handlePDF}
            disabled={isExporting}
            variant="default"
            className="h-16 justify-start px-4 border-2 border-transparent hover:border-emerald-400/30 shadow-lg shadow-emerald-500/20 group transition-all rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <div className="h-9 w-9 rounded-xl bg-white/20 text-white flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[11px] flex items-center gap-1.5">
                {isExporting ? 'Gerando relatório em PDF...' : 'Documento Executivo (PDF)'}
                <span className="bg-white/20 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                  Recomendado
                </span>
              </span>
              <span className="text-[10px] text-emerald-100">
                Diagramação profissional com KPIs, ações e autores (Sem cortes)
              </span>
            </div>
          </Button>

          {/* Opção 2: Markdown (Jira/Confluence) */}
          <Button
            onClick={handleMarkdown}
            variant="outline"
            className="h-14 justify-start px-4 border-2 hover:bg-blue-500/5 hover:border-blue-500/40 group transition-all rounded-xl"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <ClipboardCopy className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[10px] text-foreground">
                Jira & Confluence Ready (Markdown)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Tabelas e checklists prontos para copiar e colar
              </span>
            </div>
          </Button>

          {/* Opção 3: CSV (Excel) */}
          <Button
            onClick={handleCSV}
            variant="outline"
            className="h-14 justify-start px-4 border-2 hover:bg-emerald-500/5 hover:border-emerald-500/40 group transition-all rounded-xl"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[10px] text-foreground">
                Excel / Planilha (CSV)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Linha a linha com votos, responsáveis, prazos e BOM UTF-8
              </span>
            </div>
          </Button>

          {/* Opção 4: Texto TDN (Wiki) */}
          <div className="border-2 hover:border-indigo-500/40 rounded-xl overflow-hidden transition-all group">
            <Button
              onClick={handleTdn}
              variant="outline"
              className="h-14 w-full justify-start px-4 border-0 hover:bg-indigo-500/5 rounded-none"
            >
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <BookText className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start truncate text-left">
                <span className="font-black uppercase tracking-widest text-[10px] text-foreground">
                  Texto TDN (Wiki)
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Participantes por papel, colunas e ações no padrão da wiki
                </span>
              </div>
            </Button>
            <div className="flex items-center gap-2 px-3 pb-3 pt-1 bg-muted/20 border-t border-border/50">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                value={slideLink}
                onChange={e => setSlideLink(e.target.value)}
                placeholder="Link do slide (opcional)"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Pré-visualização do Markdown (opcional) */}
        <div className="px-6 pb-6 pt-0">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center justify-between w-full py-2 px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 rounded-xl transition-all"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              {showPreview ? 'Ocultar Pré-visualização' : 'Inspecionar Resumo Markdown'}
            </span>
            {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showPreview && (
            <div className="mt-3 p-3 bg-muted/40 rounded-xl border border-border/50 max-h-48 overflow-y-auto font-code text-[10px] leading-relaxed select-all">
              <pre className="whitespace-pre-wrap break-words">{markdown}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
