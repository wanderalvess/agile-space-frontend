'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { ExportDialogShell, FIELD, type ExportFormatOption } from '@/components/room-kit';
import { cn } from '@/lib/utils';
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
}

export function ExportRetroDialog({
  isOpen,
  onClose,
  boardData,
  cards,
  participants = [],
}: ExportRetroDialogProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [slideLink, setSlideLink] = useState('');
  const [exportFormat, setExportFormat] = useState('pdf');

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
      return col?.theme === 'action' || c.columnKey === 'actions';
    });
  }, [validCards, columns]);

  const completedActions = useMemo(() => actionCards.filter(c => c.isDone).length, [actionCards]);
  const pendingActions = actionCards.length - completedActions;

  // Data da retro, não a de quem exporta: exportar uma semana depois carimbava o relatório com a data errada.
  const formatDate = () => {
    const created = boardData.createdAt ? new Date(boardData.createdAt) : null;
    return format(created && !isNaN(created.getTime()) ? created : new Date(), 'dd/MM/yyyy', { locale: ptBR });
  };
  const formatDue = (d?: string) =>
    /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d!.slice(0, 10).split('-').reverse().join('/') : (d || '');
  // Compartilhado pelo markdown e pelo texto TDN: uma quebra de linha dentro
  // do conteúdo de um card vira um item de lista quebrado em ambos os
  // formatos, então os dois builders sanitizam pela mesma função.
  const cleanContent = (content: string) => content.replace(/\r?\n/g, ' ');
  // Célula de tabela markdown: um "|" no texto abriria uma coluna a mais.
  const mdCell = (content: string) => cleanContent(content).replace(/\|/g, '\\|');
  const groupedNote = (c: { originalTexts?: string[] }, wrap: 'md' | 'plain') =>
    c.originalTexts && c.originalTexts.length > 0
      ? (wrap === 'md'
          ? ` _(agrupado com: ${c.originalTexts.map(mdCell).join('; ')})_`
          : ` (agrupado com: ${c.originalTexts.map(cleanContent).join('; ')})`)
      : '';
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
      const colCards = validCards.filter(c => c.columnKey === col.id).sort((a, b) => a.order - b.order);
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
          const dueDate = c.dueDate ? `📅 ${formatDue(c.dueDate)}` : '-';
          lines.push(`| ${status} | ${mdCell(c.content)}${groupedNote(c, 'md')} | ${mdCell(assignee)} | ${dueDate} |`);
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
          lines.push(`| ${votes} | ${mdCell(c.content)}${groupedNote(c, 'md')} | ${mdCell(author)} |`);
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

  // navigator.clipboard.writeText só resolve quando o navegador de fato concede
  // a permissão — em vários contextos (ex: sem foco no documento, política de
  // permissão restritiva) ela rejeita com NotAllowedError, e sem tratar isso o
  // toast de sucesso disparava mesmo sem nada ir pra área de transferência.
  const copyToClipboard = async (text: string, successTitle: string, successDescription: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API indisponível');
      await navigator.clipboard.writeText(text);
      toast({ title: successTitle, description: successDescription });
      return;
    } catch {
      // segue pro fallback abaixo
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!ok) throw new Error('execCommand copy falhou');
      toast({ title: successTitle, description: successDescription });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Permissão de área de transferência negada. Copie manualmente pela pré-visualização abaixo (Ctrl+C).',
        variant: 'destructive',
      });
    }
  };

  const handleMarkdown = () => {
    copyToClipboard(markdown, 'Markdown Copiado!', 'Pronto para colar no Jira, Confluence, Teams ou Slack.');
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
      const colCards = validCards.filter(c => c.columnKey === col.id).sort((a, b) => a.order - b.order);
      if (colCards.length === 0) return;

      const isAction = col.theme === 'action' || col.id === 'actions';
      lines.push(col.title);

      if (isAction) {
        colCards.forEach(c => {
          const checkbox = c.isDone ? '[x]' : '[ ]';
          const meta = [c.assignee, c.dueDate ? formatDue(c.dueDate) : ''].filter(Boolean).join(' — ');
          lines.push(`${checkbox} ${cleanContent(c.content)}${groupedNote(c, 'plain')}${meta ? ` (${meta})` : ''}`);
        });
      } else {
        const sorted = [...colCards].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
        sorted.forEach(c => lines.push(`- ${cleanContent(c.content)}${groupedNote(c, 'plain')}`));
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }, [boardData, participantsByRole, slideLink, columns, validCards]);

  const handleTdn = () => {
    copyToClipboard(tdnText, 'Texto TDN Copiado!', 'Cole na página do TDN e ajuste tabela, embed do slide e checklist.');
  };

  // ---------------------------------------------------------------- CSV
  // Célula que começa com = + - @ vira fórmula no Excel/Sheets: o apóstrofo força texto.
  const csvCell = (v: string | number | null | undefined) => {
    let text = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };

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
      const colCards = validCards.filter(c => c.columnKey === col.id).sort((a, b) => a.order - b.order);
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
          formatDue(c.dueDate),
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: 'CSV Baixado!', description: 'Planilha exportada com sucesso.' });
  };

  // ---------------------------------------------------------------- PDF
  /**
   * PDF de alta precisão montado diretamente com as APIs de texto do jsPDF.
   * Não utiliza html2canvas para evitar borramentos, recortes e perda de texto selecionável.
   * Todas as caixas são medidas antes da renderização garantindo paginação suave sem quebras indesejadas.
   */
  // A fonte padrão do jsPDF não tem emoji nem símbolos fora do Latin-1: imprimiriam lixo no lugar.
  const pdfSafe = (text: string) =>
    (text || '').replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();

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
      const measure = (
        text: string,
        width: number,
        size: number,
        lineH = size * 0.42 + 1.2,
        style: 'normal' | 'bold' | 'italic' = 'normal'
      ) => {
        // A fonte precisa ser a mesma do desenho: bold é mais largo e quebra em mais linhas.
        doc.setFont('helvetica', style);
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
      doc.text('PORTAL TECH V&D', M, 15);
      
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
        const colCards = validCards.filter(c => c.columnKey === col.id).sort((a, b) => a.order - b.order);
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
          const cardContent = pdfSafe(card.content);
          const contentH = measure(cardContent, cardTextW - 24, 9.5, 4.8, 'bold');
          let extraH = 0;

          if (isActionCol) {
            extraH += 5; // linha de responsável e prazo
          } else if (author || card.carriedFromBoardTitle) {
            extraH += 4;
          }

          if (card.originalTexts && card.originalTexts.length > 0) {
            extraH += measure(`Agrupado de: ${card.originalTexts.map(pdfSafe).join('  •  ')}`, cardTextW, 7, 3.8, 'italic');
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
            const statusText = card.isDone ? '[X] CONCLUÍDO' : '[ ] PENDENTE';
            const statusColor: [number, number, number] = card.isDone ? [16, 185, 129] : [217, 119, 6];
            setFont(8, 'bold', statusColor);
            doc.text(statusText, M + CW - 4, innerY, { align: 'right' });
          } else if (votesCount > 0) {
            setFont(8, 'bold', [79, 70, 229]);
            doc.text(`${votesCount} voto${votesCount !== 1 ? 's' : ''}`, M + CW - 4, innerY, { align: 'right' });
          }

          // Conteúdo do card
          setFont(9.5, 'bold', [15, 23, 42]);
          const contentLines = doc.splitTextToSize(cardContent, cardTextW - 24) as string[];
          contentLines.forEach(line => {
            doc.text(line, M + 5.5, innerY);
            innerY += 4.8;
          });

          // Metadados específicos
          if (isActionCol) {
            setFont(7.5, 'normal', [100, 116, 139]);
            const meta = `Responsável: ${pdfSafe(card.assignee || '') || 'Não definido'}    |    Prazo: ${formatDue(card.dueDate) || 'Sem prazo'}`;
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
            const groupedText = `Agrupado de: ${card.originalTexts.map(pdfSafe).join('  •  ')}`;
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
        doc.text('Gerado automaticamente por Portal Tech V&D', M, PH - 7.5);
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

  const formats: ExportFormatOption[] = [
    { id: 'pdf', name: 'Documento executivo', desc: 'PDF com números, ações e autores, pronto para compartilhar', short: 'PDF' },
    { id: 'markdown', name: 'Markdown', desc: 'Tabelas e checklists para colar no Jira, Confluence, Teams ou Slack (copia)', short: 'MD' },
    { id: 'csv', name: 'Planilha', desc: 'Uma linha por cartão, com votos, responsáveis e prazos', short: 'CSV' },
    { id: 'tdn', name: 'Texto para o TDN', desc: 'Participantes por papel, colunas e ações no formato da wiki (copia)', short: 'TDN' },
  ];
  const ctaLabels: Record<string, string> = { pdf: 'Baixar PDF', markdown: 'Copiar Markdown', csv: 'Baixar planilha', tdn: 'Copiar texto do TDN' };

  const handleExport = () => {
    if (exportFormat === 'pdf') void handlePDF();
    else if (exportFormat === 'markdown') handleMarkdown();
    else if (exportFormat === 'csv') handleCSV();
    else handleTdn();
  };

  return (
    <ExportDialogShell
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Exportar retrospectiva"
      summary={
        <>
          <strong className="text-foreground">{totalCards}</strong> {totalCards !== 1 ? 'contribuições' : 'contribuição'} ·{' '}
          <strong className="text-foreground">{totalVotes}</strong> {totalVotes !== 1 ? 'votos' : 'voto'} ·{' '}
          <strong className="text-foreground">{actionCards.length}</strong> {actionCards.length !== 1 ? 'ações' : 'ação'}
        </>
      }
      formats={formats}
      selected={exportFormat}
      onSelect={setExportFormat}
      onExport={handleExport}
      exporting={isExporting}
      ctaLabel={isExporting ? undefined : ctaLabels[exportFormat]}
    >
      {exportFormat === 'tdn' && (
        <div className="room-rise mt-4 flex flex-col gap-1.5">
          <label htmlFor="retro-export-slide" className="text-[13px] font-semibold text-foreground">Link do slide <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <input id="retro-export-slide" value={slideLink} onChange={(e) => setSlideLink(e.target.value)} placeholder="https://…" className={cn(FIELD, 'h-10')} />
          </div>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          aria-expanded={showPreview}
          className="flex w-full items-center justify-between rounded-[10px] bg-muted/50 px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showPreview ? 'Ocultar a prévia do texto' : 'Ver a prévia do texto'}
          {showPreview ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
        </button>
        {showPreview && (
          <div className="mt-2 max-h-48 select-all overflow-y-auto rounded-[10px] border border-border bg-muted/40 p-3 font-code text-xs leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{exportFormat === 'tdn' ? tdnText : markdown}</pre>
          </div>
        )}
      </div>
    </ExportDialogShell>
  );
}
