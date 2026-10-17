/**
 * PDF do resultado do Radar de clima, desenhado em vetor (texto e retângulos do jsPDF, sem rasterizar a tela):
 * páginas A4 de verdade, texto selecionável, cada bloco medido antes de desenhar (nada é cortado quando há muitas
 * dimensões ou comentários) e texto de 9 pt (12 px) ou mais. Lê o mesmo `HealthReport` do Markdown e do CSV, então
 * os números batem. Fontes padrão do PDF (Helvetica): acentos do português funcionam; o que não é Latin-1 é trocado
 * por um equivalente ou removido.
 */
import { LEVEL_LABELS, formatScore, groupLabels, type HealthTone } from '@/lib/health-check-rules';
import { respondentsText, type HealthReport } from '@/lib/health-check-export';

type RGB = [number, number, number];

const COLORS = {
  ink: [15, 23, 42] as RGB,
  text: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  line: [226, 232, 240] as RGB,
  paper: [248, 250, 252] as RGB,
  navy: [0, 34, 51] as RGB,
  good: [4, 120, 87] as RGB,
  mid: [251, 191, 36] as RGB,
  bad: [220, 38, 38] as RGB,
  onDark: [255, 255, 255] as RGB,
  midText: [69, 26, 3] as RGB,
};

const SEGMENT: Record<HealthTone, RGB> = { good: COLORS.good, mid: COLORS.mid, bad: COLORS.bad };
const SEGMENT_TEXT: Record<HealthTone, RGB> = { good: COLORS.onDark, mid: COLORS.midText, bad: COLORS.onDark };

/** Texto que vai para o PDF: pontuação tipográfica vira ASCII e o que passa de Latin-1 (emoji) sai. */
export function pdfSafe(text: string): string {
  const typographic = (text || '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●▪]/g, '-')
    .replace(/[  ]/g, ' ');
  return Array.from(typographic).filter((ch) => (ch.codePointAt(0) ?? 0) <= 0xff).join('');
}

/** Gera e baixa o PDF. `fileName` já vem pronto (sem acento nem espaço). */
export async function exportHealthPdf(report: HealthReport, fileName: string): Promise<void> {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF('p', 'mm', 'a4');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - M * 2;
  const BOTTOM = PH - 18;
  let y = M;

  const font = (size: number, style: 'normal' | 'bold' = 'normal', color: RGB = COLORS.text) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };
  const wrap = (text: string, width: number, size: number): string[] => {
    font(size);
    return doc.splitTextToSize(pdfSafe(text), width) as string[];
  };
  const paragraph = (text: string, x: number, width: number, size = 10, style: 'normal' | 'bold' = 'normal', color: RGB = COLORS.text) => {
    const lineH = size * 0.42 + 1.4;
    font(size, style, color);
    for (const line of wrap(text, width, size)) {
      ensure(lineH);
      font(size, style, color);
      doc.text(line, x, y);
      y += lineH;
    }
  };

  // Cabeçalho
  font(16, 'bold', COLORS.ink);
  doc.text('Portal Tech V&D', M, y + 5);
  font(10, 'normal', COLORS.muted);
  doc.text(pdfSafe(`Radar de clima${report.squad ? ` · squad ${report.squad}` : ''}`), M, y + 11);
  font(10, 'normal', COLORS.muted);
  doc.text(report.date, PW - M, y + 5, { align: 'right' });
  font(12, 'bold', COLORS.ink);
  const titleLines = wrap(report.title, CW * 0.55, 12);
  titleLines.slice(0, 2).forEach((line, i) => { font(12, 'bold', COLORS.ink); doc.text(line, PW - M, y + 11 + i * 5.5, { align: 'right' }); });
  y += 14 + (titleLines.length > 1 ? 5.5 : 0);
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.line(M, y, PW - M, y);
  y += 8;

  // Nota de clima
  fill(COLORS.paper);
  doc.roundedRect(M, y, 34, 30, 3, 3, 'F');
  font(26, 'bold', COLORS.ink);
  doc.text(formatScore(report.climate), M + 17, y + 15, { align: 'center' });
  font(9, 'normal', COLORS.muted);
  doc.text('de 10', M + 17, y + 21, { align: 'center' });
  if (report.bandLabel) { font(9, 'bold', COLORS.ink); doc.text(pdfSafe(report.bandLabel), M + 17, y + 26.5, { align: 'center' }); }
  const sx = M + 40;
  const sw = CW - 40;
  const saveY = y;
  y += 4;
  paragraph(`${respondentsText(report.respondents)}, ${report.totalVotes} ${report.totalVotes === 1 ? 'voto' : 'votos'} em ${report.dimensions.length} ${report.dimensions.length === 1 ? 'dimensão' : 'dimensões'}.`, sx, sw, 10.5, 'normal', COLORS.ink);
  paragraph(`Pontos fortes: ${report.strong.length}. Em atenção: ${report.attention.length}. Escala: ${report.scaleLabel}.`, sx, sw, 10, 'normal', COLORS.muted);
  y = Math.max(y, saveY + 30) + 8;

  // Frequência por dimensão
  font(11, 'bold', COLORS.ink);
  ensure(10);
  doc.text('Frequência de respostas por dimensão', M, y);
  y += 6;
  const labels = groupLabels(report.scale);
  let lx = M;
  (['good', 'mid', 'bad'] as const).forEach((tone) => {
    fill(SEGMENT[tone]);
    doc.rect(lx, y - 2.6, 3, 3, 'F');
    font(9, 'normal', COLORS.muted);
    doc.text(pdfSafe(labels[tone]), lx + 4.5, y);
    lx += 4.5 + doc.getTextWidth(pdfSafe(labels[tone])) + 6;
  });
  font(9, 'normal', COLORS.muted);
  doc.text('Nota de 0 a 10', PW - M, y, { align: 'right' });
  y += 5;

  const nameW = 58;
  const scoreW = 16;
  const barX = M + nameW + 4;
  const barW = CW - nameW - scoreW - 8;
  for (const d of report.dimensions) {
    const nameLines = wrap(d.title, nameW, 10);
    const rowH = Math.max(8, nameLines.length * 4.6 + 3);
    ensure(rowH + 1);
    font(10, 'bold', COLORS.ink);
    nameLines.forEach((line, i) => doc.text(line, M, y + 4.5 + i * 4.6));
    const groups = (['good', 'mid', 'bad'] as const).map((tone) => ({
      tone,
      count: d.counts.reduce((sum, c) => sum + (c.tone === tone ? c.count : 0), 0),
    }));
    const total = groups.reduce((s, g) => s + g.count, 0);
    if (total === 0) {
      fill(COLORS.paper);
      doc.rect(barX, y + 1, barW, 6, 'F');
      font(9, 'normal', COLORS.muted);
      doc.text('Sem respostas', barX + 2, y + 5.2);
    } else {
      let x = barX;
      for (const g of groups.filter((g) => g.count > 0)) {
        const w = (g.count / total) * barW;
        fill(SEGMENT[g.tone]);
        doc.rect(x, y + 1, w, 6, 'F');
        if (w > 5) {
          const t = SEGMENT_TEXT[g.tone];
          font(9, 'bold', t);
          doc.text(String(g.count), x + w / 2, y + 5.2, { align: 'center' });
        }
        x += w;
      }
    }
    font(10, 'bold', COLORS.ink);
    doc.text(formatScore(d.score), PW - M, y + 5.2, { align: 'right' });
    y += rowH;
  }
  y += 4;

  // Fortes e atenção
  const listBlock = (title: string, lines: string[], empty: string, color: RGB) => {
    const wrapped = lines.flatMap((l) => wrap(`- ${l}`, CW - 4, 10));
    const body = wrapped.length ? wrapped : [empty];
    ensure(8 + body.length * 4.8);
    font(11, 'bold', color);
    doc.text(pdfSafe(title), M, y);
    y += 5.5;
    body.forEach((line) => {
      ensure(5);
      font(10, 'normal', wrapped.length ? COLORS.text : COLORS.muted);
      doc.text(line, M + 2, y);
      y += 4.8;
    });
    y += 3;
  };
  listBlock(`Pontos fortes (${report.strong.length})`, report.strong, 'Nenhum ponto forte destacado.', COLORS.good);
  listBlock(
    `Em atenção (${report.attention.length})`,
    report.attention.map((a) => `${a.title} (${LEVEL_LABELS[a.level].toLowerCase()}): ${a.text}`),
    'Nenhuma dimensão em atenção.',
    COLORS.bad
  );

  // Comentários anônimos (a partir de uma página nova)
  const withComments = report.dimensions.filter((d) => d.comments.length > 0);
  doc.addPage();
  y = M;
  font(14, 'bold', COLORS.ink);
  doc.text('Comentários anônimos', M, y + 4);
  y += 11;
  if (withComments.length === 0) {
    paragraph('Nenhum comentário neste radar.', M, CW, 10, 'normal', COLORS.muted);
  }
  for (const d of withComments) {
    ensure(14);
    font(11, 'bold', COLORS.ink);
    doc.text(pdfSafe(`${d.title} (${d.comments.length})`), M, y);
    y += 5.5;
    for (const c of d.comments) {
      const lines = wrap(c, CW - 8, 10);
      ensure(lines.length * 4.8 + 3);
      fill(COLORS.line);
      doc.rect(M, y - 3.6, 1, lines.length * 4.8 + 0.6, 'F');
      lines.forEach((line) => {
        font(10, 'normal', COLORS.text);
        doc.text(line, M + 4, y);
        y += 4.8;
      });
      y += 2.5;
    }
    y += 2;
  }

  // Rodapé com a página
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.line(M, PH - 12, PW - M, PH - 12);
    font(9, 'normal', COLORS.muted);
    doc.text(`Gerado pelo Portal Tech V&D · Radar de clima · ${report.date}`, M, PH - 7);
    doc.text(`Página ${p} de ${pages}`, PW - M, PH - 7, { align: 'right' });
  }

  doc.save(fileName);
}
