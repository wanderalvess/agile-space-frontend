/**
 * PDF de uma página (A4 retrato) com o resumo executivo de uso do portal: texto real (não imagem),
 * pensado para imprimir ou anexar num e-mail para a liderança. Mesmo princípio do relatório do
 * Sprint Review. O cabeçalho usa o azul-escuro da marca TOTVS (#002233), igual em qualquer tema:
 * o PDF não herda a cor do tema escolhido na tela.
 */
import jsPDF from 'jspdf';
import { barPercent, formatDecimal, formatDuration, formatInt, type GrowthMetrics } from './admin-platform-utils';

/** Azul-escuro do guia de marca TOTVS (#002233). */
export const PDF_BRAND_RGB: [number, number, number] = [0, 34, 51];
const PDF_INK: [number, number, number] = [15, 23, 42];
const PDF_TEXT: [number, number, number] = [51, 65, 85];
const PDF_MUTED: [number, number, number] = [100, 116, 139];
const PDF_TRACK: [number, number, number] = [226, 232, 240];
const PDF_CARD_FILL: [number, number, number] = [248, 250, 252];

export interface PdfKpi {
  title: string;
  value: string;
  subtitle: string;
}

/** Os seis cartões do PDF (títulos em caixa alta, como saem no papel). */
export function growthPdfKpis(g: GrowthMetrics): PdfKpi[] {
  return [
    { title: 'TOTAL DE SESSÕES', value: formatInt(g.sessions), subtitle: 'Cerimônias em grupo realizadas' },
    { title: 'TOTAL DE PARTICIPAÇÕES', value: formatInt(g.participations), subtitle: 'Soma de participantes por sessão*' },
    {
      title: g.avgDurationMinutes != null ? 'TEMPO DE USO MÉDIO' : 'TEMPO DE USO',
      value: g.avgDurationMinutes != null ? formatDuration(g.avgDurationMinutes) : 'Em breve',
      subtitle: g.avgDurationMinutes != null ? `Retro e Sprint Review · ${g.durationSampleSize} sessão(ões)` : 'Aguardando a próxima sessão finalizada',
    },
    { title: 'USUÁRIOS TOTAIS', value: formatInt(g.users), subtitle: 'Perfis cadastrados na plataforma' },
    { title: 'TOTAL DE INTERAÇÕES', value: formatInt(g.interactions), subtitle: 'Sessões de todas as ferramentas' },
    {
      title: 'TAXA DE FEEDBACK',
      value: `${formatDecimal(g.feedbackRate)}%`,
      subtitle: `${formatInt(g.feedbacks)} feedbacks ÷ ${formatInt(g.users)} usuários cadastrados`,
    },
  ];
}

export function growthPdfFilename(now: Date = new Date()): string {
  return `relatorio-uso-espaco-agil-${now.toISOString().slice(0, 10)}.pdf`;
}

export function buildGrowthPdf(g: GrowthMetrics, now: Date = new Date()): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const PW = doc.internal.pageSize.getWidth();
  const M = 16;
  const CW = PW - M * 2;
  let y = M;

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = PDF_TEXT) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  // Cabeçalho
  doc.setFillColor(...PDF_BRAND_RGB);
  doc.rect(0, 0, PW, 38, 'F');
  setFont(9, 'bold', [203, 213, 225]);
  doc.text('PORTAL TECH V&D', M, 14);
  setFont(20, 'bold', [255, 255, 255]);
  doc.text('Relatório de Uso do Sistema', M, 26);
  setFont(9, 'normal', [203, 213, 225]);
  doc.text(`Gerado em ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, M, 33);
  y = 50;

  // Seis números
  const kpis = growthPdfKpis(g);
  const colW = CW / 2 - 4;
  kpis.forEach((k, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = M + col * (colW + 8);
    const boxY = y + row * 34;
    doc.setFillColor(...PDF_CARD_FILL);
    doc.setDrawColor(...PDF_TRACK);
    doc.roundedRect(x, boxY, colW, 28, 3, 3, 'FD');
    setFont(18, 'bold', PDF_INK);
    doc.text(k.value, x + 6, boxY + 13);
    setFont(8, 'bold', PDF_BRAND_RGB);
    doc.text(k.title, x + 6, boxY + 19);
    setFont(7, 'normal', PDF_MUTED);
    doc.text(k.subtitle, x + 6, boxY + 24, { maxWidth: colW - 12 });
  });
  y += Math.ceil(kpis.length / 2) * 34 + 10;

  // Ranking de módulos
  setFont(13, 'bold', PDF_INK);
  doc.text('Adoção por Módulo', M, y);
  y += 3;
  setFont(8, 'normal', PDF_MUTED);
  doc.text('Ranking de utilização real, em sessões', M, y + 4);
  y += 12;

  const max = Math.max(...g.modules.map((m) => m.count), 0);
  g.modules.forEach((m) => {
    setFont(9, 'bold', PDF_TEXT);
    doc.text(m.label.toUpperCase(), M, y);
    setFont(9, 'bold', PDF_MUTED);
    doc.text(`${formatInt(m.count)} ${m.count === 1 ? 'SESSÃO' : 'SESSÕES'}`, M + CW, y, { align: 'right' });
    y += 3;
    doc.setFillColor(...PDF_TRACK);
    doc.roundedRect(M, y, CW, 4, 2, 2, 'F');
    const barW = (barPercent(m.count, max) / 100) * CW;
    if (barW > 0) {
      doc.setFillColor(...PDF_BRAND_RGB);
      doc.roundedRect(M, y, Math.max(barW, 4), 4, 2, 2, 'F');
    }
    y += 11;
  });

  // Notas
  y += 4;
  setFont(7, 'normal', PDF_MUTED);
  doc.text('* Retrospectivas ainda não registram participantes e não entram nesse total.', M, y, { maxWidth: CW });
  y += 4;
  doc.text('O tempo de uso considera só Retro e Sprint Review.', M, y, { maxWidth: CW });

  return doc;
}

/** Gera e baixa o PDF (relatorio-uso-espaco-agil-AAAA-MM-DD.pdf). */
export function exportGrowthPdf(g: GrowthMetrics, now: Date = new Date()): void {
  buildGrowthPdf(g, now).save(growthPdfFilename(now));
}
