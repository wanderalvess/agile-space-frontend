'use client';

import React, { useState } from 'react';
import {
  Download, FileText, CheckCircle2, AlertCircle, XCircle, Clock3, Copy, Loader2, UserCheck2, ExternalLink, Link2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShowcaseSession, ShowcaseTask, Decision, DECISION } from './types';
import { formatTime, getDirectImageUrl, stripWikiMarkup, stripNonLatin1ForPdf, getEvidenceUrls } from './utils';
import { useToast } from '@/hooks/use-toast';
import { showcaseApi } from '@/app/showcase/api';

/** Nome de arquivo seguro: sem acento, barra ou dois-pontos. */
const fileSlug = (name: string, fallback: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

/** Célula de tabela markdown: "|" e quebra de linha quebrariam a tabela. */
const mdCell = (value?: string) => (value || '—').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

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
  t.versionSuporte ? `Suporte: ${t.versionSuporte}` : '',
  t.versionMaster ? `Master: ${t.versionMaster}` : '',
  t.versionRelease ? `Release: ${t.versionRelease}` : '',
  t.versionDevelop ? `Develop: ${t.versionDevelop}` : ''
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
  const pending = tasks.filter(t => !t.decision || t.decision === 'open');

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
        `**Evidência${getEvidenceUrls(t.evidence).length > 1 ? 's' : ''}:** ${getEvidenceUrls(t.evidence).join(' | ') || 'Sem link'}`,
        t.attachments && t.attachments.length > 0 ? `**Arquivos anexados:** ${t.attachments.map(a => a.name).join(', ')}` : '',
        t.decidedByName ? `**Aprovado por:** ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : '',
        `---`
      ].filter(Boolean).join('\n')),
      `\n## ⚠️ Pendências (${adjustments.length + rejected.length})`,
      ...[...adjustments, ...rejected].map(t => [
        `- [${t.key}] ${t.title}`,
        versionsText(t) ? `  → Projeto & Versões: ${versionsText(t)}` : '',
        `  → Motivo: ${t.feedback || 'Sem feedback registrado'}`,
        t.decidedByName ? `  → Decidido por: ${t.decidedByName}${decidedWhen(t.decidedAt) ? ` em ${decidedWhen(t.decidedAt)}` : ''}` : ''
      ].filter(Boolean).join('\n')),
      `\n## 🕓 Sem decisão (${pending.length})`,
      ...pending.map(t => `- [${t.key}] ${t.title}`)
    ].join('\n');

    const a = document.createElement('a');
    const href = URL.createObjectURL(new Blob([lines], { type: 'text/markdown' }));
    a.href = href;
    a.download = `review-log-${fileSlug(sessionName, 'review')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  };

  const generateApprovalsSummary = () => {
    const tableHeader = [
      `# 🏆 Resumo de Aprovações — ${sessionName}`,
      `Data: ${new Date().toLocaleString('pt-BR')}\n`,
      `| Issue | URL | Dev | QA | Projeto | Suporte | Master | Release | Develop |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`
    ];

    const tableRows = approved.map(t =>
      `| ${mdCell(t.key)} | ${mdCell(t.url)} | ${mdCell(t.evidence.dev)} | ${mdCell(t.evidence.qa)} | ${mdCell(t.project)} | ${mdCell(t.versionSuporte)} | ${mdCell(t.versionMaster)} | ${mdCell(t.versionRelease)} | ${mdCell(t.versionDevelop)} |`
    );

    const lines = [...tableHeader, ...tableRows].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lines).then(() => {
        toast({ title: "Resumo Copiado!", description: "O resumo de aprovações foi copiado para a área de transferência." });
      }).catch(err => {
        console.error('Erro ao copiar resumo:', err);
        toast({ title: 'Não foi possível copiar', description: 'Permita o acesso à área de transferência e tente de novo.', variant: 'destructive' });
      });
    }
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
        let loaded = t.evidence.screenshot ? await loadImageForPdf(t.evidence.screenshot) : null;
        // Sem print por link que carregue: usa a primeira imagem anexada ao card (PNG/JPEG enviados na Review).
        const attached = t.attachments?.find(a => a.contentType === 'image/png' || a.contentType === 'image/jpeg');
        if (!loaded && attached && session?.id) {
          try {
            const blob = await showcaseApi.fetchTaskFileBlob(session.id, attached.id);
            const dataUrl = await blobToDataUrl(blob);
            const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
              img.onerror = reject;
              img.src = dataUrl;
            });
            loaded = { dataUrl, ...size, format: attached.contentType === 'image/png' ? 'PNG' : 'JPEG' };
          } catch {
            loaded = null;
          }
        }
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
      // Ponto único de saída de texto pro PDF — texto vindo do Jira ainda pode
      // trazer marcação wiki crua ("h2. *Solução:*") e emoji, que as fontes
      // padrão do jsPDF (Helvetica/WinAnsi) não sabem desenhar e viram lixo
      // visual ("Ø=ÜÝ"). Sanitiza aqui pra cobrir título/problema/solução/
      // critérios/versões/nomes de uma vez, sem repetir em cada chamada.
      const forPdf = (text: string) => stripNonLatin1ForPdf(stripWikiMarkup(text));
      const wrapped = (text: string, x: number, width: number, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59], lineH = size * 0.42 + 1.3) => {
        setFont(size, style, color);
        const lines = doc.splitTextToSize(forPdf(text || ''), width) as string[];
        lines.forEach(line => { ensure(lineH); doc.text(line, x, y); y += lineH; });
        return lines.length * lineH;
      };
      const measure = (text: string, width: number, size: number, lineH = size * 0.42 + 1.3) => {
        doc.setFontSize(size);
        return (doc.splitTextToSize(forPdf(text || ''), width) as string[]).length * lineH;
      };
      const decisionRGB = (d: Decision): [number, number, number] =>
        d === 'approved' ? [5, 150, 105] : d === 'rejected' ? [225, 29, 72] : d === 'needs_adjustment' ? [217, 119, 6] : [100, 116, 139];

      // ------------------------------------------------------------ Capa
      doc.setFillColor(76, 29, 149); // violet-900, cor de marca do Showcase
      doc.rect(0, 0, PW, PH, 'F');
      doc.setFillColor(139, 92, 246); // acento violet-500
      doc.rect(0, 0, 3, PH, 'F');

      setFont(10, 'bold', [216, 180, 254]);
      doc.text(forPdf((session.squadName || 'Product Team').toUpperCase()), M, 30);

      // Título em quase largura cheia — não só 62% — porque os KPIs saíram
      // do canto superior direito (colidiam com qualquer nome de sessão
      // normal) e agora formam uma faixa própria mais abaixo.
      const titleLines = doc.splitTextToSize(forPdf(session.name || 'Sprint Review'), CW * 0.85) as string[];
      setFont(34, 'bold', [255, 255, 255]);
      titleLines.forEach((line, i) => doc.text(line, M, 62 + i * 13));
      const titleBottom = 62 + (titleLines.length - 1) * 13;

      setFont(11, 'normal', [221, 214, 254]);
      doc.text(session.period || 'Ciclo de entrega atual', M, titleBottom + 12);

      // Faixa de KPIs: linha divisória + 4 colunas de largura igual
      // ocupando a página toda, sempre abaixo do título (nunca em cima).
      const kpiY = 145;
      doc.setDrawColor(139, 92, 246);
      doc.setLineWidth(0.4);
      doc.line(M, kpiY - 14, PW - M, kpiY - 14);

      const kpis: Array<[string, string, [number, number, number]]> = [
        ['Tarefas', String(tasks.length), [255, 255, 255]],
        ['Aprovadas', String(approved.length), [110, 231, 183]],
        ['Ajustes', String(adjustments.length), [252, 211, 77]],
        ['Rejeitadas', String(rejected.length), [253, 164, 175]],
      ];
      const kpiColW = CW / kpis.length;
      kpis.forEach((kpi, idx) => {
        const x = M + idx * kpiColW;
        setFont(8, 'bold', [216, 180, 254]);
        doc.text(kpi[0].toUpperCase(), x, kpiY - 4);
        setFont(26, 'bold', kpi[2]);
        doc.text(kpi[1], x, kpiY + 14);
      });

      // -------------------------------------------------- Uma página por task
      // addPage() sempre, mesmo na primeira: a capa já ocupa a página 1
      // inteira, então a task 0 precisa da sua própria página nova também
      // (sem isso ela era desenhada por cima da capa, ambas na página 1).
      tasks.forEach((task) => {
        addPage();

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
        doc.text(forPdf(task.key || ''), M + 13, y + 4.8, { align: 'center' });
        setFont(8, 'bold', [148, 163, 184]);
        doc.text(forPdf((task.type || '').toUpperCase()), M + 30, y + 4.8);

        const dColor = decisionRGB(task.decision);
        const dLabel = DECISION[task.decision]?.label.toUpperCase() || 'ABERTA';
        setFont(9, 'bold', dColor);
        doc.text(dLabel, M + CW, y + 4.8, { align: 'right' });
        if (task.decidedByName) {
          setFont(7, 'normal', [148, 163, 184]);
          doc.text(forPdf(`${task.decidedByName}${decidedWhen(task.decidedAt) ? ` · ${decidedWhen(task.decidedAt)}` : ''}`), M + CW, y + 9.5, { align: 'right' });
        }
        y += 12;
        wrapped(task.title, M, textW, 15, 'bold', [15, 23, 42], 6.5);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(M, y, M + CW, y);
        y += 6;

        const isMetricsCard = task.cardKind === 'metrics';
        const metrics = task.metrics?.filter(m => (m.field || '').trim()) || [];

        if (isMetricsCard) {
          wrapped('CONTEXTO', M, textW, 8, 'bold', [124, 58, 237]);
          wrapped(task.description || 'Não informado.', M, textW, 9.5, 'normal', [51, 65, 85]);
          y += 3;
        } else {
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
        doc.text(forPdf(task.evidence.dev) || '—', M, y);
        doc.text(forPdf(task.evidence.qa) || '—', M + textW / 2, y);

        // Coluna direita: gráfico de métricas (card de métricas), imagem real
        // (quando carregou) ou link de evidência
        if (isMetricsCard) {
          setFont(7, 'bold', [129, 140, 248]);
          doc.text(forPdf((task.chartTitle || 'MÉTRICAS DE IMPACTO').toUpperCase()), imgX, imgTop);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.roundedRect(imgX, imgTop + 4, imgW, imgBottom - imgTop - 4, 3, 3, 'S');
          if (metrics.length > 0) {
            const chartX = imgX + 8;
            const chartW = imgW - 16;
            const maxValue = Math.max(...metrics.map(m => Math.max(0, m.value)), 1);
            const rowH = Math.min(16, (imgBottom - imgTop - 16) / metrics.length);
            let cy = imgTop + 12;
            metrics.forEach(m => {
              setFont(8.5, 'bold', [51, 65, 85]);
              doc.text(forPdf(m.field || ''), chartX, cy);
              setFont(9, 'bold', [124, 58, 237]);
              doc.text((m.value ?? 0).toLocaleString('pt-BR'), chartX + chartW, cy, { align: 'right' });
              const barY = cy + 2.5;
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(chartX, barY, chartW, 3, 1.5, 1.5, 'F');
              const barW = Math.max(3, (Math.max(0, m.value) / maxValue) * chartW);
              doc.setFillColor(124, 58, 237);
              doc.roundedRect(chartX, barY, barW, 3, 1.5, 1.5, 'F');
              cy += rowH;
            });
          } else {
            setFont(9, 'bold', [148, 163, 184]);
            doc.text('Sem métricas preenchidas', imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2, { align: 'center' });
          }
        } else if (image) {
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

      doc.save(`sprint-review-${fileSlug(sessionName, 'showcase')}.pdf`);
      toast({ title: 'PDF Baixado!', description: 'Slides exportados com sucesso.' });
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast({ title: 'Erro na exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const statBoxes: Array<{ label: string; count: number; icon: React.ElementType; wrap: string; text: string }> = [
    { label: 'Aprovadas', count: approved.length, icon: CheckCircle2, wrap: 'border-emerald-500/30 bg-emerald-500/5', text: 'text-emerald-500' },
    { label: 'Precisam de ajuste', count: adjustments.length, icon: AlertCircle, wrap: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-500' },
    { label: 'Rejeitadas', count: rejected.length, icon: XCircle, wrap: 'border-rose-500/30 bg-rose-500/5', text: 'text-rose-500' },
    { label: DECISION.open.label, count: pending.length, icon: Clock3, wrap: 'border-border bg-muted/30', text: 'text-muted-foreground' },
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

  // Links das issues para o PO abrir no Jira: copia agrupado por decisão, um por linha.
  const copyText = (text: string, title: string) => {
    navigator.clipboard?.writeText(text)
      .then(() => toast({ title }))
      .catch(() => toast({ title: 'Não foi possível copiar', description: 'Permita o acesso à área de transferência e tente de novo.', variant: 'destructive' }));
  };
  const linkedCount = tasks.filter(t => t.url).length;
  const copyAllLinks = () => {
    const text = groups
      .map(g => ({ ...g, items: g.items.filter(t => t.url) }))
      .filter(g => g.items.length > 0)
      .map(g => [`${g.label} (${g.items.length})`, ...g.items.map(t => `${t.key} - ${t.title}\n${t.url}`)].join('\n'))
      .join('\n\n');
    copyText(text, `${linkedCount} ${linkedCount === 1 ? 'link copiado' : 'links copiados'}`);
  };

  // Eficiência = estimado ÷ gasto: acima de 100% a squad gastou menos do que estimou.
  const efficiencyTone = efficiency === null ? 'text-muted-foreground' : efficiency >= 100 ? 'text-emerald-500' : 'text-amber-500';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1080px] w-[96vw] max-h-[90vh] rounded-[2rem] p-0 border border-border shadow-2xl overflow-hidden flex flex-col gap-0 bg-card text-card-foreground focus:outline-none">
        <div className="px-6 pt-6 pb-4 shrink-0 border-b border-border">
          <DialogHeader className="text-left space-y-0">
            <DialogTitle className="text-2xl font-black tracking-tight leading-none pr-8">Resumo da Review</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5">
              {sessionName} · {tasks.length} {tasks.length === 1 ? 'entrega' : 'entregas'}
            </DialogDescription>
          </DialogHeader>
          {session?.members && session.members.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Participantes:</span>
              {session.members.map(m => (
                <Badge key={m.id} variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {m.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Rolagem simples: o ScrollArea do Radix envolve o conteúdo num `display: table`
            que cresce com títulos longos e empurrava cards e indicadores para fora do modal. */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-6 space-y-6">
            {/* Indicadores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statBoxes.map(st => (
                <div key={st.label} className={cn('rounded-2xl border p-4 flex items-center gap-3', st.wrap)}>
                  <st.icon className={cn('h-5 w-5 shrink-0', st.text)} />
                  <div className="min-w-0">
                    <p className={cn('text-2xl font-black leading-none', st.text)}>{st.count}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-1 truncate">{st.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground">Taxa de aprovação</p>
                <p className="text-2xl font-black leading-none mt-2">{approvalRate === null ? '—' : `${approvalRate}%`}</p>
                <p className="text-xs text-muted-foreground mt-1.5">Sobre as entregas que já foram avaliadas pelo PO.</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground">Estimado ÷ gasto</p>
                <p className={cn('text-2xl font-black leading-none mt-2', efficiencyTone)}>{efficiency === null ? '—' : `${efficiency}%`}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {efficiency === null ? 'Sem horas lançadas nas entregas.' : efficiency >= 100 ? 'A squad gastou menos horas do que estimou.' : 'A squad gastou mais horas do que estimou.'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-violet-500" /> Tempo total gasto</p>
                <p className="text-2xl font-black leading-none mt-2">{formatTime(totalSpent) || '—'}</p>
                <p className="text-xs text-muted-foreground mt-1.5">Soma das horas lançadas em todas as entregas.</p>
              </div>
            </div>

            {/* Entregas por decisão */}
            <div className="space-y-5 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-foreground">Entregas por decisão</h3>
                {linkedCount > 0 && (
                  <Button onClick={copyAllLinks} variant="outline" className="h-8 px-3 rounded-lg text-xs font-bold gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> Copiar links das issues
                  </Button>
                )}
              </div>
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma entrega nesta Review.</p>
              )}
              {groups.map(group => (
                <div key={group.label} className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label} ({group.items.length})</p>
                  {group.items.map(t => (
                    <div key={t.id} className="rounded-2xl border border-border bg-muted/20 p-4 hover:border-violet-500/40 transition-colors">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="h-8 min-w-8 px-1.5 shrink-0 rounded-lg bg-violet-600/10 text-violet-500 flex items-center justify-center text-xs font-bold" title={t.key}>
                            {t.key.split('-').pop()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground line-clamp-2" title={t.title}>{t.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.type} · {t.evidence.dev || 'Sem autor'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.url && (
                            <>
                              <Button
                                variant="ghost" size="icon" asChild
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-violet-500"
                              >
                                <a href={t.url} target="_blank" rel="noopener noreferrer" title={`Abrir ${t.key} no Jira`} aria-label={`Abrir ${t.key} no Jira`}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => copyText(t.url, `Link de ${t.key} copiado`)}
                                title={`Copiar link de ${t.key}`} aria-label={`Copiar link de ${t.key}`}
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-violet-500"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Badge className={cn('text-xs font-semibold border-none rounded-lg', DECISION[t.decision].cls)}>
                            {DECISION[t.decision].label}
                          </Badge>
                        </div>
                      </div>
                      {t.decidedByName && (
                        <p className="flex items-center gap-1.5 mt-2.5 text-xs text-muted-foreground">
                          <UserCheck2 className="h-3.5 w-3.5" />
                          Decidido por {t.decidedByName}{decidedWhen(t.decidedAt) && ` · ${decidedWhen(t.decidedAt)}`}
                        </p>
                      )}
                      {t.feedback && (
                        <div className="mt-2.5 rounded-xl border border-border bg-background/60 p-3">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-bold text-foreground mr-1.5">Feedback:</span>
                            {t.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé — o texto dos botões some abaixo de md e ficam só ícones (com title/aria-label) */}
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Button onClick={onClose} variant="ghost" className="rounded-xl font-bold text-sm text-muted-foreground hover:text-foreground">
            Fechar
          </Button>
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={generateApprovalsSummary}
              variant="outline"
              title="Copiar resumo das aprovações"
              aria-label="Copiar resumo das aprovações"
              className="h-10 px-4 rounded-xl font-bold text-sm gap-2"
            >
              <Copy className="h-4 w-4" /> <span className="hidden md:inline">Copiar aprovações</span>
            </Button>
            <Button
              onClick={generateLog}
              variant="outline"
              title="Baixar o log em Markdown"
              aria-label="Baixar o log em Markdown"
              className="h-10 px-4 rounded-xl font-bold text-sm gap-2"
            >
              <FileText className="h-4 w-4" /> <span className="hidden md:inline">Baixar log (.md)</span>
            </Button>
            <Button
              onClick={handlePDF}
              disabled={isExportingPdf}
              title="Exportar slides em PDF"
              aria-label="Exportar slides em PDF"
              className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-lg shadow-violet-600/25 gap-2 transition-all active:scale-95 disabled:opacity-60"
            >
              {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden md:inline">{isExportingPdf ? 'Gerando PDF…' : 'Exportar slides (PDF)'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
