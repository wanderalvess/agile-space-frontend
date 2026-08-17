'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, ClipboardCopy, CheckCircle2 } from 'lucide-react';
import type { Issue, Participant, DeckType, VotingRound } from '@/lib/types';
import { computeTopicTiming, computeSessionBreakdown } from '@/lib/poker-utils';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportDialogProps {
  roomTitle: string;
  roomTeam?: string;
  issues: Issue[];
  participants: Participant[];
  deck: DeckType;
  triggerNode?: React.ReactNode;
  // Tempo por tópico no relatório — só inclui a seção quando o facilitador
  // ligou "Tempo por tópico" nas configs (mesma flag da visão ao vivo).
  rounds?: VotingRound[];
  sessionStartedAt?: string;
  perTopicTime?: boolean;
}

export function ExportDialog({ roomTitle, roomTeam, issues, participants, deck, triggerNode, rounds, sessionStartedAt, perTopicTime }: ExportDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const topicTimingRows = useMemo(
    () => (perTopicTime ? computeTopicTiming(rounds || [], issues, sessionStartedAt) : []),
    [perTopicTime, rounds, issues, sessionStartedAt]
  );
  const activeMins = topicTimingRows.reduce((sum, r) => sum + r.mins, 0);
  const idleMins = topicTimingRows.reduce((sum, r) => sum + r.idleMins, 0);

  const breakdown = useMemo(() => computeSessionBreakdown(issues, rounds || []), [issues, rounds]);

  // Um item pode aparecer em mais de uma lista de propósito (ex.: adiada e
  // depois estimada) — o relatório precisa contar a história completa.
  const estimatedIssues = useMemo(() => issues.filter(i => !i.skipped && i.status === 'completed'), [issues]);
  const skippedIssues = useMemo(() => issues.filter(i => i.skipped), [issues]);
  const parkedIssues = useMemo(() => issues.filter(i => (i.parkCount || 0) > 0 || i.parked), [issues]);
  const untouchedIssues = useMemo(() => issues.filter(i => !i.skipped && i.status !== 'completed'), [issues]);

  const formatPoints = (points: string | null | undefined, deckType: string) => {
    if (!points || points === 'N/A') return 'N/A';
    const cleanPoints = points.trim().toUpperCase();
    const isTShirt = ['PP', 'P', 'M', 'G', 'GG', '?'].includes(cleanPoints);

    if (isTShirt) return cleanPoints;

    if (deckType === 'hours') return `${points}h`;
    if (deckType === 'tshirt') return points;
    return `${points} SP`;
  };
  const formatDate = () => format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

  // Helper para minerar todos os papéis presentes nas issues para o cabeçalho
  const activeRoles = useMemo(() => {
    if (deck !== 'hours') return [];
    const roles = new Set<string>();
    estimatedIssues.forEach(i => {
      if (i.rolePoints) {
        Object.keys(i.rolePoints).forEach(r => {
          if (i.rolePoints![r] && i.rolePoints![r] !== '0') roles.add(r);
        });
      } else {
        if (i.devPoints && i.devPoints !== '0') roles.add('Developer');
        if (i.qaPoints && i.qaPoints !== '0') roles.add('QA');
      }
    });
    return Array.from(roles).sort();
  }, [estimatedIssues, deck]);

  const roleValue = (issue: Issue, role: string) =>
    issue.rolePoints ? issue.rolePoints[role] : (role === 'Developer' ? issue.devPoints : (role === 'QA' ? issue.qaPoints : '0'));

  const parkStatusLabel = (i: Issue) =>
    i.skipped ? 'terminou pulada' : i.status === 'completed' ? 'retomada e estimada' : 'ficou pendente';

  const hasNotes = estimatedIssues.some(i => i.decisionNote);

  // ---------------------------------------------------------------- Markdown
  const handleMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# Relatório de Estimativas: ${roomTitle || 'Scrum Poker'}`);
    lines.push(`**Data:** ${formatDate()} | **Squad:** ${roomTeam || 'N/A'}`);
    lines.push('');
    lines.push('## Resumo da sessão');
    lines.push('');
    lines.push(`- **Tarefas debatidas:** ${breakdown.discussed} de ${breakdown.total} na fila`);
    lines.push(`- **Estimadas:** ${breakdown.estimated}`);
    lines.push(`- **Puladas:** ${breakdown.skipped}`);
    lines.push(`- **Adiadas durante a sessão:** ${breakdown.parked}`);
    lines.push(`- **Não abordadas:** ${breakdown.untouched}`);
    if (activeMins > 0) {
      lines.push(`- **Tempo ativo de discussão:** ${activeMins} min${idleMins > 0 ? ` (${idleMins} min de intervalo fora da discussão não contabilizados)` : ''}`);
    }
    lines.push('');

    if (estimatedIssues.length > 0) {
      const roleHeaders = activeRoles.map(r => ` ${r.toUpperCase()} `).join('|');
      lines.push('## Tarefas estimadas');
      lines.push('');
      lines.push(`| Tarefa | Estimativa Final |${roleHeaders ? roleHeaders + '|' : ''} Link Jira |${hasNotes ? ' Nota de Decisão |' : ''}`);
      lines.push(`|---|---|${activeRoles.map(() => '---|').join('')}---|${hasNotes ? '---|' : ''}`);
      estimatedIssues.forEach(i => {
        const link = i.jiraLink ? `[Ver no Jira](${i.jiraLink})` : '-';
        const points = formatPoints(i.estimatedPoints, deck);
        let rolesData = '';
        if (deck === 'hours') {
          rolesData = activeRoles.map(r => ` ${roleValue(i, r) || '0'}h `).join('|');
          if (rolesData) rolesData += '|';
        }
        const note = hasNotes ? ` ${(i.decisionNote || '-').replace(/\n/g, ' ')} |` : '';
        lines.push(`| ${i.title} | ${points} |${rolesData} ${link} |${note}`);
      });
      lines.push('');
    }

    if (skippedIssues.length > 0) {
      lines.push('## Tarefas puladas (não estimadas)');
      lines.push('');
      lines.push('| Tarefa | Motivo |');
      lines.push('|---|---|');
      skippedIssues.forEach(i => lines.push(`| ${i.title} | ${(i.note || '-').replace(/\n/g, ' ')} |`));
      lines.push('');
    }

    if (parkedIssues.length > 0) {
      lines.push('## Tarefas adiadas durante a sessão');
      lines.push('');
      lines.push('| Tarefa | Vezes adiada | Desfecho | Motivo |');
      lines.push('|---|---|---|---|');
      parkedIssues.forEach(i =>
        lines.push(`| ${i.title} | ${i.parkCount || 1} | ${parkStatusLabel(i)} | ${(i.parkedNote || '-').replace(/\n/g, ' ')} |`)
      );
      lines.push('');
    }

    if (untouchedIssues.length > 0) {
      lines.push('## Tarefas não abordadas');
      lines.push('');
      untouchedIssues.forEach(i => lines.push(`- ${i.title}`));
      lines.push('');
    }

    if (topicTimingRows.length > 0) {
      lines.push('## Tempo por tópico');
      lines.push('');
      lines.push('| Tópico | Tempo | Situação |');
      lines.push('|---|---|---|');
      topicTimingRows.forEach(r =>
        lines.push(`| ${r.title} | ${r.mins} min | ${r.skipped ? 'pulado' : r.discussed ? 'debatido' : '-'} |`)
      );
      lines.push(`| **Tempo ativo** | **${activeMins} min** | |`);
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: 'Markdown Copiado!', description: 'Pronto para colar no Jira, Confluence ou Notion.' });
  };

  // --------------------------------------------------------------------- CSV
  const csvCell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const handleCSV = () => {
    const rows: string[] = [];

    rows.push('Resumo,Valor');
    rows.push(`Tarefas na fila,${breakdown.total}`);
    rows.push(`Debatidas,${breakdown.discussed}`);
    rows.push(`Estimadas,${breakdown.estimated}`);
    rows.push(`Puladas,${breakdown.skipped}`);
    rows.push(`Adiadas,${breakdown.parked}`);
    rows.push(`Nao abordadas,${breakdown.untouched}`);
    if (activeMins > 0) {
      rows.push(`Tempo ativo (min),${activeMins}`);
      rows.push(`Intervalo descartado (min),${idleMins}`);
    }
    rows.push('');

    // Tabela única com uma coluna "Situação": deixa a planilha filtrável por
    // debatida/pulada/adiada em vez de espalhar em blocos separados.
    const roleHeaders = activeRoles.map(r => `${r.toUpperCase()} (h)`);
    rows.push(['Tarefa', 'Situação', 'Estimativa Final', ...roleHeaders, 'Vezes adiada', 'Observação', 'Link Jira'].map(csvCell).join(','));

    const situationOf = (i: Issue) =>
      i.skipped ? 'Pulada' : i.status === 'completed' ? 'Estimada' : 'Não abordada';

    issues.forEach(issue => {
      const roleData = activeRoles.map(r => roleValue(issue, r) || '0');
      const obs = issue.skipped ? (issue.note || '') : (issue.decisionNote || issue.parkedNote || '');
      rows.push([
        issue.title,
        situationOf(issue),
        issue.skipped ? 'N/A' : formatPoints(issue.estimatedPoints, deck),
        ...roleData,
        issue.parkCount || 0,
        obs,
        issue.jiraLink || '',
      ].map(csvCell).join(','));
    });

    if (topicTimingRows.length > 0) {
      rows.push('');
      rows.push(['Tópico', 'Tempo (min)', 'Situação'].map(csvCell).join(','));
      topicTimingRows.forEach(r =>
        rows.push([r.title, r.mins, r.skipped ? 'pulado' : r.discussed ? 'debatido' : '-'].map(csvCell).join(','))
      );
      rows.push([`Tempo ativo`, activeMins, ''].map(csvCell).join(','));
    }

    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${roomTitle || 'poker'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Baixado!', description: 'Arquivo CSV gerado com sucesso.' });
  };

  // --------------------------------------------------------------------- PDF
  /**
   * PDF montado com as APIs de texto do jsPDF, não mais com html2canvas.
   *
   * A versão anterior fotografava um <div> escondido e fatiava a imagem em
   * páginas: qualquer texto mais longo que o card era CORTADO (o container
   * tinha overflow-hidden), a quebra de página não respeitava o conteúdo e o
   * arquivo saía pesado e sem texto selecionável. Aqui cada bloco é medido
   * antes de ser desenhado e a página vira quando não cabe, então nada é
   * truncado — títulos, notas e motivos quebram em várias linhas.
   */
  const handlePDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 14;              // margem lateral
      const CW = PW - M * 2;     // largura útil
      const BOTTOM = PH - 16;    // reserva para o rodapé

      let y = M;

      const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const addPage = () => {
        doc.addPage();
        y = M;
      };

      /** Garante espaço vertical; vira a página quando não cabe. */
      const ensure = (h: number) => {
        if (y + h > BOTTOM) addPage();
      };

      /** Escreve texto quebrado em `width`, paginando linha a linha. */
      const wrapped = (
        text: string,
        x: number,
        width: number,
        size: number,
        style: 'normal' | 'bold' = 'normal',
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

      /** Altura que um texto ocuparia, sem desenhar (para medir o bloco). */
      const measure = (text: string, width: number, size: number, lineH = size * 0.42 + 1.2) => {
        doc.setFontSize(size);
        return (doc.splitTextToSize(text || '', width) as string[]).length * lineH;
      };

      const sectionTitle = (label: string, color: [number, number, number] = [37, 99, 235]) => {
        ensure(14);
        y += 4;
        setFont(11, 'bold', color);
        doc.text(label.toUpperCase(), M, y);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y, M + CW, y);
        y += 5;
      };

      // ------------------------------------------------------------ Capa
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, PW, 34, 'F');
      setFont(18, 'bold', [255, 255, 255]);
      doc.text('ESPAÇO ÁGIL', M, 15);
      setFont(9, 'normal', [219, 234, 254]);
      doc.text('Relatório de Refinamento', M, 21);
      setFont(12, 'bold', [255, 255, 255]);
      doc.text(doc.splitTextToSize(roomTitle || 'Scrum Poker', CW * 0.55)[0], M, 29);
      setFont(9, 'normal', [219, 234, 254]);
      doc.text(`${formatDate()}${roomTeam ? `  |  ${roomTeam}` : ''}`, PW - M, 29, { align: 'right' });
      y = 44;

      // -------------------------------------------------- Resumo (KPIs)
      const kpis: Array<[string, string]> = [
        ['Debatidas', String(breakdown.discussed)],
        ['Estimadas', String(breakdown.estimated)],
        ['Puladas', String(breakdown.skipped)],
        ['Adiadas', String(breakdown.parked)],
        ['Não abordadas', String(breakdown.untouched)],
      ];
      if (activeMins > 0) kpis.push(['Tempo ativo', `${activeMins} min`]);

      const perRow = 3;
      const gap = 4;
      const boxW = (CW - gap * (perRow - 1)) / perRow;
      const boxH = 18;
      kpis.forEach((kpi, idx) => {
        const col = idx % perRow;
        if (col === 0) ensure(boxH + gap);
        const x = M + col * (boxW + gap);
        const top = y;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, top, boxW, boxH, 2, 2, 'FD');
        setFont(7.5, 'bold', [100, 116, 139]);
        doc.text(kpi[0].toUpperCase(), x + 4, top + 6);
        setFont(14, 'bold', [15, 23, 42]);
        doc.text(kpi[1], x + 4, top + 14);
        if (col === perRow - 1 || idx === kpis.length - 1) y = top + boxH + gap;
      });

      setFont(8, 'normal', [100, 116, 139]);
      const contextLine = `Fila com ${breakdown.total} tarefa(s). Baralho: ${deck === 'hours' ? 'Horas' : deck === 'tshirt' ? 'T-Shirt' : 'Fibonacci'}. Participantes ativos: ${participants.filter(p => !p.role || p.role !== 'spectator').length}.`;
      wrapped(contextLine, M, CW, 8, 'normal', [100, 116, 139]);
      if (idleMins > 0) {
        wrapped(
          `${idleMins} min de intervalo fora da discussão (sala aberta antes da cerimônia ou pausa longa) não foram contabilizados no tempo ativo.`,
          M, CW, 8, 'normal', [148, 163, 184]
        );
      }

      // -------------------------------------------- Tarefas estimadas
      if (estimatedIssues.length > 0) {
        sectionTitle(`Tarefas estimadas (${estimatedIssues.length})`);
        const valueW = 30;
        const titleW = CW - valueW - 6;

        estimatedIssues.forEach(issue => {
          // Mede o bloco inteiro antes de desenhar para não quebrar no meio.
          let h = measure(issue.title, titleW, 10, 5) + 2;
          const rolesLine = deck === 'hours'
            ? activeRoles.map(r => {
                const v = roleValue(issue, r);
                return v && v !== '0' ? `${r === 'Developer' ? 'DEV' : r.toUpperCase()}: ${v}h` : null;
              }).filter(Boolean).join('   ')
            : '';
          if (rolesLine) h += measure(rolesLine, titleW, 8, 4);
          if (issue.jiraLink) h += measure(issue.jiraLink, titleW, 7, 3.6);
          if (issue.decisionNote) h += measure(`Decisão: ${issue.decisionNote}`, titleW, 8, 4) + 1;
          if ((issue.parkCount || 0) > 0) h += 4;

          ensure(h + 6);
          const top = y - 3;

          setFont(12, 'bold', [29, 78, 216]);
          doc.text(formatPoints(issue.estimatedPoints, deck), M + CW, y + 2, { align: 'right' });

          wrapped(issue.title, M, titleW, 10, 'bold', [15, 23, 42], 5);
          if (rolesLine) wrapped(rolesLine, M, titleW, 8, 'bold', [100, 116, 139], 4);
          if ((issue.parkCount || 0) > 0) {
            wrapped(`Adiada ${issue.parkCount}x antes de ser estimada.`, M, titleW, 8, 'normal', [2, 132, 199], 4);
          }
          if (issue.jiraLink) wrapped(issue.jiraLink, M, titleW, 7, 'normal', [148, 163, 184], 3.6);
          if (issue.decisionNote) wrapped(`Decisão: ${issue.decisionNote}`, M, titleW, 8, 'normal', [71, 85, 105], 4);

          y += 2;
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.3);
          if (y > top) doc.line(M, y, M + CW, y);
          y += 4;
        });
      }

      // ---------------------------------------------- Tarefas puladas
      if (skippedIssues.length > 0) {
        // Hífen simples, não travessão: as fontes padrão do jsPDF (WinAnsi) não
        // têm em-dash e o caractere desaparece do documento.
        sectionTitle(`Tarefas puladas - não estimadas (${skippedIssues.length})`, [217, 119, 6]);
        skippedIssues.forEach(issue => {
          const h = measure(issue.title, CW, 10, 5) + (issue.note ? measure(`Motivo: ${issue.note}`, CW, 8, 4) : 0) + 6;
          ensure(h);
          wrapped(issue.title, M, CW, 10, 'bold', [15, 23, 42], 5);
          if (issue.note) wrapped(`Motivo: ${issue.note}`, M, CW, 8, 'normal', [180, 83, 9], 4);
          y += 3;
        });
      }

      // ---------------------------------------------- Tarefas adiadas
      if (parkedIssues.length > 0) {
        sectionTitle(`Tarefas adiadas durante a sessão (${parkedIssues.length})`, [2, 132, 199]);
        parkedIssues.forEach(issue => {
          const status = `Adiada ${issue.parkCount || 1}x - ${parkStatusLabel(issue)}.`;
          const h = measure(issue.title, CW, 10, 5) + measure(status, CW, 8, 4)
            + (issue.parkedNote ? measure(`Motivo: ${issue.parkedNote}`, CW, 8, 4) : 0) + 6;
          ensure(h);
          wrapped(issue.title, M, CW, 10, 'bold', [15, 23, 42], 5);
          wrapped(status, M, CW, 8, 'bold', [2, 132, 199], 4);
          if (issue.parkedNote) wrapped(`Motivo: ${issue.parkedNote}`, M, CW, 8, 'normal', [71, 85, 105], 4);
          y += 3;
        });
      }

      // ----------------------------------------- Tarefas não abordadas
      if (untouchedIssues.length > 0) {
        sectionTitle(`Tarefas não abordadas (${untouchedIssues.length})`, [100, 116, 139]);
        untouchedIssues.forEach(issue => {
          ensure(measure(issue.title, CW - 4, 9, 4.6) + 2);
          // Hífen, não bullet: as fontes padrão do jsPDF (WinAnsi) não têm "•"
          // e o caractere sai como espaço em branco no PDF.
          wrapped(`- ${issue.title}`, M, CW, 9, 'normal', [71, 85, 105], 4.6);
        });
        y += 2;
      }

      // -------------------------------------------- Tempo por tópico
      if (topicTimingRows.length > 0) {
        sectionTitle('Tempo por tópico');
        const timeW = 22;
        const labelW = CW - timeW - 4;
        topicTimingRows.forEach(r => {
          const label = `${r.title}${r.skipped ? ' (pulado)' : ''}`;
          const h = measure(label, labelW, 9, 4.6);
          ensure(h + 2);
          const rowTop = y;
          setFont(9, 'bold', [15, 23, 42]);
          doc.text(`${r.mins} min`, M + CW, rowTop, { align: 'right' });
          wrapped(label, M, labelW, 9, 'normal', r.skipped ? [180, 83, 9] : [51, 65, 85], 4.6);
          y += 1;
        });
        ensure(10);
        doc.setDrawColor(226, 232, 240);
        doc.line(M, y, M + CW, y);
        y += 5;
        setFont(9, 'bold', [100, 116, 139]);
        doc.text('TEMPO ATIVO DE DISCUSSÃO', M, y);
        setFont(11, 'bold', [37, 99, 235]);
        doc.text(`${activeMins} min`, M + CW, y, { align: 'right' });
        y += 6;
        if (idleMins > 0) {
          wrapped(`Intervalo descartado: ${idleMins} min.`, M, CW, 8, 'normal', [148, 163, 184]);
        }
      }

      // ------------------------------------------------------- Rodapé
      // @types/jspdf ainda é o v1 neste projeto e não declara getNumberOfPages.
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

      doc.save(`relatorio-${roomTitle || 'poker'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF Baixado!', description: 'Relatório completo exportado com sucesso.' });
    } catch (e) {
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // Antes só aparecia com itens concluídos; uma sessão em que tudo foi pulado
  // também merece relatório (justamente para registrar o que não foi debatido).
  if (issues.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerNode || (
          <Button variant="outline" size="sm" className="hidden sm:flex h-8 px-3 font-black text-[9px] uppercase tracking-widest gap-2 bg-muted/50 border-primary/20 text-primary hover:bg-primary/5">
            <Download className="h-3.5 w-3.5" />
            EXPORTAR RESUMO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-2xl border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="p-6 border-b border-border/50 flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 shadow-inner">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic">Exportar Estimativas</DialogTitle>
          <p className="text-xs text-muted-foreground font-medium px-4">
            {breakdown.discussed} tarefa{breakdown.discussed !== 1 ? 's' : ''} debatida{breakdown.discussed !== 1 ? 's' : ''}
            {breakdown.skipped > 0 && `, ${breakdown.skipped} pulada${breakdown.skipped !== 1 ? 's' : ''}`}
            {breakdown.parked > 0 && `, ${breakdown.parked} adiada${breakdown.parked !== 1 ? 's' : ''}`}
            {breakdown.untouched > 0 && `, ${breakdown.untouched} não abordada${breakdown.untouched !== 1 ? 's' : ''}`}
            . Escolha o formato ideal para relatar a cerimônia.
          </p>
        </div>

        <div className="p-6 grid gap-3">
          <Button onClick={handleMarkdown} variant="outline" className="h-14 justify-start px-4 border-2 hover:bg-primary/5 hover:border-primary/50 group transition-all rounded-xl">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <ClipboardCopy className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[10px]">Jira Ready (Markdown)</span>
              <span className="text-[10px] text-muted-foreground">Tabela formatada pronta para colar</span>
            </div>
          </Button>

          <Button onClick={handleCSV} variant="outline" className="h-14 justify-start px-4 border-2 hover:bg-emerald-500/5 hover:border-emerald-500/50 group transition-all rounded-xl">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[10px]">Excel / Planilha (CSV)</span>
              <span className="text-[10px] text-muted-foreground">Uma linha por tarefa, com situação</span>
            </div>
          </Button>

          <Button onClick={handlePDF} disabled={isExporting} variant="default" className="h-14 justify-start px-4 border-2 border-transparent hover:border-white/20 shadow-lg shadow-primary/20 group transition-all rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
            <div className="h-8 w-8 rounded-lg bg-white/20 text-white flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
              <Download className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start truncate text-left">
              <span className="font-black uppercase tracking-widest text-[10px]">
                {isExporting ? 'Gerando relatório...' : 'Documento Visual (PDF)'}
              </span>
              <span className="text-[10px] opacity-80">Texto real, sem cortes (Ideal Anexo Jira)</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
