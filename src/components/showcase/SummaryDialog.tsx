'use client';

import React, { useState } from 'react';
import {
  Download, FileText, CheckCircle2, AlertCircle, XCircle, Clock3, Copy, Loader2, UserCheck2, Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ShowcaseSession, ShowcaseTask, Decision, DECISION } from './types';
import { formatTime, getDirectImageUrl } from './utils';
import { useToast } from '@/hooks/use-toast';

interface SummaryDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: ShowcaseTask[];
  sessionName: string;
  session: ShowcaseSession | null;
}

const decidedWhen = (iso?: string) => {
  if (!iso) return '';
  try {
    return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
};

const versionsText = (t: ShowcaseTask) => [
  t.project ? `Projeto: ${t.project}` : '',
  t.versionMaster ? `Master: ${t.versionMaster}` : '',
  t.versionDevelop ? `Develop: ${t.versionDevelop}` : '',
  t.versionRelease ? `Release: ${t.versionRelease}` : ''
].filter(Boolean).join(' | ');

type LoadedImage = { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' | 'WEBP' };

/**
 * Baixa a evidência (screenshot) e converte pra dataURL — addImage do jsPDF
 * não aceita URL remota, só dado já em mãos. Best-effort: hosts que não
 * liberam fetch cross-origin (ou link quebrado/não-imagem) simplesmente
 * retornam null e a exportação segue sem a imagem, com o link como texto.
 */
const loadImageForPdf = async (url: string): Promise<LoadedImage | null> => {
  const direct = getDirectImageUrl(url);
  if (!/^https?:\/\//i.test(direct)) return null;
  try {
    const res = await fetch(direct);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    const format: LoadedImage['format'] = blob.type.includes('png') ? 'PNG' : blob.type.includes('webp') ? 'WEBP' : 'JPEG';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, width, height, format };
  } catch {
    return null;
  }
};

export function SummaryDialog({ open, onClose, tasks, sessionName, session }: SummaryDialogProps) {
  const { toast } = useToast();
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const approved = tasks.filter(t => t.decision === 'approved');
  const adjustments = tasks.filter(t => t.decision === 'needs_adjustment');
  const rejected = tasks.filter(t => t.decision === 'rejected');
  const pending = tasks.filter(t => t.decision === 'open');

  // Mesma fórmula do ShowcaseDashboard (acceptanceRate): só sobre o que já
  // foi revisado — task ainda pendente não deve puxar a taxa pra baixo. Antes
  // dividia por totalTasks e os dois lugares do app mostravam número diferente
  // pro mesmo dado.
  const totalReviewed = approved.length + adjustments.length + rejected.length;
  const approvalRate = totalReviewed > 0 ? Math.round((approved.length / totalReviewed) * 100) : null;

  const totalSpent = tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);
  const totalEstimate = tasks.reduce((acc, t) => acc + (t.evidence.timeEstimate || 0), 0);
  // null (não 100%) quando não há hora lançada — "100% de eficiência" sem
  // nenhum dado real só confundia.
  const efficiency = totalSpent > 0 ? Math.round((totalEstimate / totalSpent) * 100) : null;

  // ---------------------------------------------------------------- Markdown
  const generateLog = () => {
    const lines = [
      `# 📋 Relatório de Sprint Review — ${sessionName}`,
      `Data: ${new Date().toLocaleString('pt-BR')}\n`,
      session?.members && session.members.length > 0
        ? `## 👥 Squad\n${session.members.map(m => `- ${m.name} (${m.role})`).join('\n')}\n`
        : '',
      `\n## ✅ Entregas Aprovadas (${approved.length})`,
      ...approved.map(t => [
        `### ${t.key} — ${t.title}`,
        `**Problema:** ${t.evidence.problem}`,
        `**Solução:** ${t.evidence.solution}`,
        `**Time:** Dev: ${t.evidence.dev} / QA: ${t.evidence.qa}`,
        versionsText(t) ? `**Projeto & Versões:** ${versionsText(t)}` : '',
        `**Evidência:** ${t.evidence.video || t.evidence.screenshot || 'Sem link'}`,
        t.decidedByName ? `**Aprovado por:** ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : '',
        `---`
      ].filter(Boolean).join('\n')),
      `\n## ⚠️ Pendências (${adjustments.length + rejected.length})`,
      ...[...adjustments, ...rejected].map(t => [
        `- [${t.key}] ${t.title}`,
        versionsText(t) ? `  → Projeto & Versões: ${versionsText(t)}` : '',
        `  → Motivo: ${t.feedback || 'Sem feedback registrado'}`,
        t.decidedByName ? `  → Decidido por: ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : ''
      ].filter(Boolean).join('\n'))
    ].join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines], { type: 'text/markdown' }));
    a.download = `review-log-${sessionName.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
  };

  const generateApprovalsSummary = () => {
    const tableHeader = [
      `# 🏆 Resumo de Aprovações — ${sessionName}`,
      `Data: ${new Date().toLocaleString('pt-BR')}\n`,
      `| Issue | URL | Dev | QA | Projeto | Master | Develop | Release |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`
    ];

    const tableRows = approved.map(t =>
      `| ${t.key} | ${t.url || '—'} | ${t.evidence.dev || '—'} | ${t.evidence.qa || '—'} | ${t.project || '—'} | ${t.versionMaster || '—'} | ${t.versionDevelop || '—'} | ${t.versionRelease || '—'} |`
    );

    const lines = [...tableHeader, ...tableRows].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lines).then(() => {
        toast({ title: "Resumo Copiado!", description: "O resumo de aprovações foi copiado para a área de transferência." });
      }).catch(err => {
        console.error('Erro ao copiar resumo:', err);
      });
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines], { type: 'text/markdown' }));
    a.download = `resumo-aprovacoes-${sessionName.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
  };

  // --------------------------------------------------------------------- PDF
  /**
   * PDF montado com as APIs de texto do jsPDF (mesmo princípio do relatório
   * do Scrum Poker, ver ExportDialog.tsx:239) — não mais HTML + window.print().
   *
   * A versão anterior abria uma aba com uma página impressa e deixava o
   * usuário escolher "Salvar como PDF" no diálogo de impressão do navegador
   * (podia ser bloqueado por popup blocker, formatação de impressão varia
   * por navegador). Aqui o download acontece direto, texto é real/selecionável
   * e cada bloco é medido antes de desenhar, então nada quebra ou é cortado.
   */
  const handlePDF = async () => {
    if (!session) return;
    setIsExportingPdf(true);
    try {
      const images = new Map<string, LoadedImage>();
      await Promise.all(tasks.map(async t => {
        if (!t.evidence.screenshot) return;
        const loaded = await loadImageForPdf(t.evidence.screenshot);
        if (loaded) images.set(t.id, loaded);
      }));

      const doc = new jsPDF('l', 'mm', 'a4');
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 16;
      const CW = PW - M * 2;
      const BOTTOM = PH - 14;
      let y = M;

      const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
      };
      const addPage = () => { doc.addPage(); y = M; };
      const ensure = (h: number) => { if (y + h > BOTTOM) addPage(); };
      const wrapped = (text: string, x: number, width: number, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59], lineH = size * 0.42 + 1.3) => {
        setFont(size, style, color);
        const lines = doc.splitTextToSize(text || '', width) as string[];
        lines.forEach(line => { ensure(lineH); doc.text(line, x, y); y += lineH; });
        return lines.length * lineH;
      };
      const measure = (text: string, width: number, size: number, lineH = size * 0.42 + 1.3) => {
        doc.setFontSize(size);
        return (doc.splitTextToSize(text || '', width) as string[]).length * lineH;
      };
      const decisionRGB = (d: Decision): [number, number, number] =>
        d === 'approved' ? [5, 150, 105] : d === 'rejected' ? [225, 29, 72] : d === 'needs_adjustment' ? [217, 119, 6] : [100, 116, 139];

      // ------------------------------------------------------------ Capa
      doc.setFillColor(76, 29, 149); // violet-900, cor de marca do Showcase
      doc.rect(0, 0, PW, PH, 'F');
      doc.setFillColor(139, 92, 246); // acento violet-500
      doc.rect(0, 0, 3, PH, 'F');

      setFont(10, 'bold', [216, 180, 254]);
      doc.text((session.squadName || 'Product Team').toUpperCase(), M, 30);
      setFont(34, 'bold', [255, 255, 255]);
      (doc.splitTextToSize(session.name || 'Sprint Review', CW * 0.62) as string[]).forEach((line, i) => {
        doc.text(line, M, 46 + i * 13);
      });
      setFont(11, 'normal', [221, 214, 254]);
      doc.text(session.period || 'Ciclo de entrega atual', M, PH - 20);

      const kpis: Array<[string, string, [number, number, number]]> = [
        ['Tarefas', String(tasks.length), [255, 255, 255]],
        ['Aprovadas', String(approved.length), [110, 231, 183]],
        ['Ajustes', String(adjustments.length), [252, 211, 77]],
        ['Rejeitadas', String(rejected.length), [253, 164, 175]],
      ];
      const kpiW = 48;
      kpis.forEach((kpi, idx) => {
        const x = PW - M - kpiW * (kpis.length - idx);
        setFont(8, 'bold', [216, 180, 254]);
        doc.text(kpi[0].toUpperCase(), x, 26);
        setFont(22, 'bold', kpi[2]);
        doc.text(kpi[1], x, 38);
      });

      // -------------------------------------------------- Uma página por task
      tasks.forEach((task, idx) => {
        if (idx > 0) addPage();

        const image = images.get(task.id);
        const textW = CW * 0.42;
        const imgX = M + textW + 10;
        const imgW = CW - textW - 10;
        const imgTop = M + 20;
        const imgBottom = BOTTOM;

        // Cabeçalho: chave + tipo + título à esquerda, decisão à direita
        doc.setFillColor(124, 58, 237);
        doc.roundedRect(M, y, 26, 7, 1.5, 1.5, 'F');
        setFont(8, 'bold', [255, 255, 255]);
        doc.text(task.key, M + 13, y + 4.8, { align: 'center' });
        setFont(8, 'bold', [148, 163, 184]);
        doc.text(task.type.toUpperCase(), M + 30, y + 4.8);

        const dColor = decisionRGB(task.decision);
        const dLabel = DECISION[task.decision]?.label.toUpperCase() || 'ABERTA';
        setFont(9, 'bold', dColor);
        doc.text(dLabel, M + CW, y + 4.8, { align: 'right' });
        if (task.decidedByName) {
          setFont(7, 'normal', [148, 163, 184]);
          doc.text(`${task.decidedByName}${decidedWhen(task.decidedAt) ? ` · ${decidedWhen(task.decidedAt)}` : ''}`, M + CW, y + 9.5, { align: 'right' });
        }
        y += 12;
        wrapped(task.title, M, textW, 15, 'bold', [15, 23, 42], 6.5);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y, M + CW, y);
        y += 6;

        wrapped('O PROBLEMA', M, textW, 8, 'bold', [225, 29, 72]);
        wrapped(task.evidence.problem || 'Não informado.', M, textW, 9.5, 'normal', [51, 65, 85]);
        y += 3;

        wrapped('A SOLUÇÃO', M, textW, 8, 'bold', [5, 150, 105]);
        wrapped(task.evidence.solution || 'Não informado.', M, textW, 9.5, 'normal', [51, 65, 85]);
        y += 3;

        if (task.acceptanceCriteria) {
          wrapped('CRITÉRIOS DE ACEITE', M, textW, 8, 'bold', [124, 58, 237]);
          wrapped(task.acceptanceCriteria, M, textW, 8.5, 'normal', [100, 116, 139]);
          y += 3;
        }

        const vText = versionsText(task);
        if (vText) {
          wrapped('CI/CD & VERSÕES', M, textW, 8, 'bold', [8, 145, 178]);
          wrapped(vText, M, textW, 8.5, 'normal', [100, 116, 139]);
          y += 3;
        }

        ensure(10);
        setFont(7.5, 'bold', [148, 163, 184]);
        doc.text('DEV', M, y);
        doc.text('QA', M + textW / 2, y);
        y += 5;
        setFont(10, 'bold', [15, 23, 42]);
        doc.text(task.evidence.dev || '—', M, y);
        doc.text(task.evidence.qa || '—', M + textW / 2, y);

        // Coluna direita: evidência visual (imagem real quando carregou) ou link
        if (image) {
          const boxW = imgW, boxH = imgBottom - imgTop;
          const scale = Math.min(boxW / image.width, boxH / image.height);
          const w = image.width * scale, h = image.height * scale;
          const x = imgX + (boxW - w) / 2, yPos = imgTop + (boxH - h) / 2;
          doc.setFillColor(15, 23, 42);
          doc.roundedRect(imgX, imgTop, boxW, boxH, 3, 3, 'F');
          try {
            doc.addImage(image.dataUrl, image.format, x, yPos, w, h);
          } catch {
            // Formato que o jsPDF não decodificou apesar do content-type — não
            // trava a exportação, só fica sem a imagem nessa task.
          }
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.roundedRect(imgX, imgTop, imgW, imgBottom - imgTop, 3, 3, 'S');
          const link = task.evidence.video || task.evidence.screenshot;
          setFont(9, 'bold', [148, 163, 184]);
          doc.text(link ? 'Ver evidência:' : 'Sem evidência vinculada', imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2 - (link ? 4 : 0), { align: 'center' });
          if (link) {
            setFont(7.5, 'normal', [100, 116, 139]);
            (doc.splitTextToSize(link, imgW - 16) as string[]).forEach((line, i) => {
              doc.text(line, imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2 + 3 + i * 4, { align: 'center' });
            });
          }
        }
      });

      doc.save(`sprint-review-${sessionName.replace(/\s+/g, '-').toLowerCase() || 'showcase'}.pdf`);
      toast({ title: 'PDF Baixado!', description: 'Slides exportados com sucesso.' });
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const statBoxes: Array<{ label: string; count: number; icon: React.ElementType; wrap: string; box: string; text: string; sub: string }> = [
    { label: 'Aprovados', count: approved.length, icon: CheckCircle2, wrap: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40', box: 'text-emerald-500 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', sub: 'text-emerald-600/60 dark:text-emerald-400/60' },
    { label: 'Ajustes', count: adjustments.length, icon: AlertCircle, wrap: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40', box: 'text-amber-500 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', sub: 'text-amber-600/60 dark:text-amber-400/60' },
    { label: 'Rejeitados', count: rejected.length, icon: XCircle, wrap: 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/40', box: 'text-rose-500 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400', sub: 'text-rose-600/60 dark:text-rose-400/60' },
    { label: DECISION.open.label, count: pending.length, icon: Clock3, wrap: 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800', box: 'text-slate-400 dark:text-slate-500', text: 'text-slate-600 dark:text-slate-300', sub: 'text-slate-500/60 dark:text-slate-400/60' },
  ];

  // Agrupado por decisão (não na ordem crua de importação) — antes era uma
  // lista só, difícil de achar "o que ainda precisa de atenção" no meio de
  // aprovados e pendentes misturados.
  const groups: Array<{ label: string; items: ShowcaseTask[] }> = [
    { label: 'Precisam de ajuste', items: adjustments },
    { label: 'Rejeitadas', items: rejected },
    { label: DECISION.open.label, items: pending },
    { label: 'Aprovadas', items: approved },
  ].filter(g => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] rounded-[3.5rem] p-0 border-none shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 focus:outline-none">
        <div className="sr-only">
          <DialogHeader>
            <DialogTitle>Resumo da Sprint Review - {sessionName}</DialogTitle>
            <DialogDescription>Métricas de governança, aprovações e pendências da sessão.</DialogDescription>
          </DialogHeader>
        </div>

        {/* Header */}
        <div className="bg-slate-950 p-10 text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/15 blur-[90px] rounded-full" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">Resumo da Review</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-none max-w-[420px]">
                {sessionName}
              </h2>

              {session?.members && session.members.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {session.members.map(m => (
                    <Badge key={m.id} className="bg-white/5 hover:bg-white/10 text-white/60 border-white/5 rounded-lg px-2.5 py-1 font-black text-[7px] uppercase tracking-widest transition-colors">
                      {m.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="px-6 py-4 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/5 text-center min-w-[120px]">
                <p className="text-2xl font-black italic text-white leading-none mb-1">{approvalRate === null ? '—' : `${approvalRate}%`}</p>
                <p className="text-[7px] font-black uppercase tracking-widest text-white/40">Taxa Aprovação</p>
              </div>
              <div className="px-6 py-4 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/5 text-center min-w-[120px]">
                <p className={cn("text-2xl font-black italic leading-none mb-1", efficiency === null ? "text-white/40" : efficiency > 100 ? "text-rose-400" : "text-emerald-400")}>
                  {efficiency === null ? '—' : `${efficiency}%`}
                </p>
                <p className="text-[7px] font-black uppercase tracking-widest text-white/40">Eficiência Time</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#fafafa] dark:bg-slate-950">
          {/* Stats Sidebar */}
          <div className="w-full md:w-[300px] p-8 space-y-6 border-r border-slate-200/60 dark:border-slate-800 shrink-0">
            <div className="grid grid-cols-2 gap-2.5">
              {statBoxes.map(s => (
                <div key={s.label} className={cn("p-3.5 rounded-2xl border flex flex-col gap-2", s.wrap)}>
                  <s.icon className={cn("h-4 w-4", s.box)} />
                  <div>
                    <p className={cn("text-xl font-black italic leading-none", s.text)}>{s.count}</p>
                    <p className={cn("text-[7px] font-black uppercase tracking-widest mt-1", s.sub)}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white space-y-4">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-4 w-4 text-violet-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Tempo Total</span>
                </div>
                <p className="text-3xl font-black italic tracking-tighter leading-none">{formatTime(totalSpent) || '—'}</p>
                <p className="text-[8px] font-medium text-white/40 uppercase leading-relaxed tracking-tighter">
                  Investimento total da squad no ciclo atual.
                </p>
              </div>
            </div>
          </div>

          {/* Log Feed — agrupado por decisão */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-10 pt-8 pb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Linha do Tempo da Review</h3>
              <Badge variant="outline" className="rounded-lg font-black text-[8px] uppercase border-slate-200 dark:border-slate-800 dark:text-slate-400">{tasks.length} Entradas</Badge>
            </div>
            <ScrollArea className="flex-1 px-10 pb-8">
              <div className="space-y-7">
                {groups.map(group => (
                  <div key={group.label} className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{group.label} ({group.items.length})</p>
                    {group.items.map(t => (
                      <div key={t.id} className="group p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 hover:border-violet-200 dark:hover:border-violet-500/40 transition-all shadow-sm hover:shadow-md">
                        <div className="flex justify-between items-start mb-3 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-[9px] font-black text-slate-400 dark:text-slate-400 border border-slate-100 dark:border-slate-800 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:border-violet-100 dark:group-hover:border-violet-950 transition-colors">
                              {t.key.split('-').pop()}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-100 leading-none mb-1 truncate">{t.title}</p>
                              <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate">{t.type} • {t.evidence.dev || 'Sem autor'}</p>
                            </div>
                          </div>
                          <Badge className={cn("text-[7px] font-black uppercase border-none h-5 rounded-lg shrink-0", DECISION[t.decision].cls)}>
                            {DECISION[t.decision].label}
                          </Badge>
                        </div>
                        {t.decidedByName && (
                          <div className="flex items-center gap-1.5 mb-2 text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                            <UserCheck2 className="h-3 w-3" />
                            {t.decidedByName}{decidedWhen(t.decidedAt) && ` · ${decidedWhen(t.decidedAt)}`}
                          </div>
                        )}
                        {t.feedback && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                              <span className="font-bold text-slate-700 dark:text-slate-300 not-italic uppercase text-[7px] mr-2">Feedback:</span>
                              {t.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <Button
            onClick={onClose}
            variant="ghost"
            className="rounded-2xl font-black uppercase tracking-widest text-[9px] text-slate-400 px-6 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Fechar Painel
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={generateApprovalsSummary}
              variant="outline"
              className="h-12 px-6 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[9px] rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 transition-all"
            >
              <Copy className="h-3.5 w-3.5" /> Resumo de Aprovações
            </Button>
            <Button
              onClick={generateLog}
              variant="outline"
              className="h-12 px-6 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[9px] rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 transition-all"
            >
              <FileText className="h-3.5 w-3.5" /> Log Markdown
            </Button>
            <Button
              onClick={handlePDF}
              disabled={isExportingPdf}
              className="h-12 px-10 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-[9px] rounded-2xl shadow-xl shadow-violet-600/20 gap-2 transition-all active:scale-95 disabled:opacity-60"
            >
              {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {isExportingPdf ? 'Gerando PDF...' : 'Exportar Slides PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
