/**
 * PDF dos slides da Review, montado com as APIs de texto do jsPDF (mesmo princípio do relatório do Scrum
 * Poker): o download acontece direto, o texto é real e selecionável e cada bloco é medido antes de
 * desenhar, então nada quebra ou é cortado. Paleta TOTVS (azul institucional e ciano), sem violeta.
 */
import jsPDF from 'jspdf';
import { showcaseApi } from '@/app/showcase/api';
import { DECISION, type Decision, type ShowcaseSession, type ShowcaseTask } from './types';
import { decidedWhen, fileSlug, groupByDecision, versionsText } from './review-export';
import { getDirectImageUrl, stripNonLatin1ForPdf, stripWikiMarkup } from './utils';

type RGB = [number, number, number];

/** Paleta do PDF (RGB). Azul TOTVS #002233, ciano #00DBFF; verde, âmbar e vermelho só para a decisão. */
export const PDF_COLORS = {
  navy: [0, 34, 51] as RGB,
  navyLight: [10, 48, 72] as RGB,
  cyan: [0, 219, 255] as RGB,
  cyanDark: [0, 150, 180] as RGB,
  mint: [0, 255, 212] as RGB,
  ink: [15, 23, 42] as RGB,
  text: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  soft: [148, 163, 184] as RGB,
  line: [226, 232, 240] as RGB,
  onNavy: [255, 255, 255] as RGB,
  onNavyMuted: [148, 184, 198] as RGB,
  approved: [5, 150, 105] as RGB,
  adjustment: [217, 119, 6] as RGB,
  rejected: [225, 29, 72] as RGB,
  open: [100, 116, 139] as RGB,
} as const;

/** Cor da decisão no PDF. */
export const decisionRGB = (d: Decision): RGB =>
  d === 'approved' ? PDF_COLORS.approved : d === 'rejected' ? PDF_COLORS.rejected : d === 'needs_adjustment' ? PDF_COLORS.adjustment : PDF_COLORS.open;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const imageSize = (dataUrl: string) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
  img.onerror = reject;
  img.src = dataUrl;
});

type LoadedImage = { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' | 'WEBP' };

/**
 * Baixa a evidência (screenshot) e converte pra dataURL — addImage do jsPDF não aceita URL remota, só dado
 * já em mãos. Best-effort: hosts que não liberam fetch cross-origin (ou link quebrado/não-imagem)
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
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await imageSize(dataUrl);
    return { dataUrl, width, height, format };
  } catch {
    return null;
  }
};

/** Imagem de cada card: o print por link, ou (se não carregar) a primeira imagem anexada ao card. */
async function loadTaskImages(session: ShowcaseSession, tasks: readonly ShowcaseTask[]): Promise<Map<string, LoadedImage>> {
  const images = new Map<string, LoadedImage>();
  await Promise.all(tasks.map(async (t) => {
    let loaded = t.evidence.screenshot ? await loadImageForPdf(t.evidence.screenshot) : null;
    const attached = t.attachments?.find((a) => a.contentType === 'image/png' || a.contentType === 'image/jpeg');
    if (!loaded && attached && session.id) {
      try {
        const blob = await showcaseApi.fetchTaskFileBlob(session.id, attached.id);
        const dataUrl = await blobToDataUrl(blob);
        const size = await imageSize(dataUrl);
        loaded = { dataUrl, ...size, format: attached.contentType === 'image/png' ? 'PNG' : 'JPEG' };
      } catch {
        loaded = null;
      }
    }
    if (loaded) images.set(t.id, loaded);
  }));
  return images;
}

/** Gera e baixa `sprint-review-<nome>.pdf`: capa com indicadores e uma página por card. */
export async function exportReviewPdf(session: ShowcaseSession, tasks: readonly ShowcaseTask[], sessionName: string): Promise<void> {
  const images = await loadTaskImages(session, tasks);
  const C = PDF_COLORS;
  const { approved, adjustments, rejected } = groupByDecision(tasks);

  const doc = new jsPDF('l', 'mm', 'a4');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - M * 2;
  const BOTTOM = PH - 14;
  let y = M;

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: RGB = C.text) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const addPage = () => { doc.addPage(); y = M; };
  const ensure = (h: number) => { if (y + h > BOTTOM) addPage(); };
  // Ponto único de saída de texto pro PDF: texto vindo do Jira ainda pode trazer marcação wiki crua
  // ("h2. *Solução:*") e emoji, que as fontes padrão do jsPDF (Helvetica/WinAnsi) não sabem desenhar.
  const forPdf = (text: string) => stripNonLatin1ForPdf(stripWikiMarkup(text));
  const wrapped = (text: string, x: number, width: number, size: number, style: 'normal' | 'bold' = 'normal', color: RGB = C.text, lineH = size * 0.42 + 1.3) => {
    setFont(size, style, color);
    const lines = doc.splitTextToSize(forPdf(text || ''), width) as string[];
    lines.forEach((line) => { ensure(lineH); doc.text(line, x, y); y += lineH; });
    return lines.length * lineH;
  };

  // ------------------------------------------------------------ Capa
  doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]);
  doc.rect(0, 0, PW, PH, 'F');
  doc.setFillColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.rect(0, 0, 3, PH, 'F');

  setFont(11, 'bold', C.cyan);
  doc.text(forPdf((session.squadName || 'Product Team').toUpperCase()), M, 30);

  // Título em quase largura cheia; os indicadores formam uma faixa própria mais abaixo.
  const titleLines = doc.splitTextToSize(forPdf(session.name || 'Sprint Review'), CW * 0.85) as string[];
  setFont(34, 'bold', C.onNavy);
  titleLines.forEach((line, i) => doc.text(line, M, 62 + i * 13));
  const titleBottom = 62 + (titleLines.length - 1) * 13;

  setFont(12, 'normal', C.onNavyMuted);
  doc.text(session.period || 'Ciclo de entrega atual', M, titleBottom + 12);

  const kpiY = 145;
  doc.setDrawColor(C.cyan[0], C.cyan[1], C.cyan[2]);
  doc.setLineWidth(0.4);
  doc.line(M, kpiY - 14, PW - M, kpiY - 14);

  const kpis: Array<[string, string, RGB]> = [
    ['Tarefas', String(tasks.length), C.onNavy],
    ['Aprovadas', String(approved.length), [110, 231, 183]],
    ['Ajustes', String(adjustments.length), [252, 211, 77]],
    ['Rejeitadas', String(rejected.length), [253, 164, 175]],
  ];
  const kpiColW = CW / kpis.length;
  kpis.forEach((kpi, idx) => {
    const x = M + idx * kpiColW;
    setFont(11, 'bold', C.onNavyMuted);
    doc.text(kpi[0], x, kpiY - 4);
    setFont(26, 'bold', kpi[2]);
    doc.text(kpi[1], x, kpiY + 14);
  });

  // -------------------------------------------------- Uma página por task
  // addPage() sempre, mesmo na primeira: a capa já ocupa a página 1 inteira.
  tasks.forEach((task) => {
    addPage();

    const image = images.get(task.id);
    const textW = CW * 0.42;
    const imgX = M + textW + 10;
    const imgW = CW - textW - 10;
    const imgTop = M + 20;
    const imgBottom = BOTTOM;

    // Cabeçalho: chave + tipo + título à esquerda, decisão à direita
    doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]);
    doc.roundedRect(M, y, 28, 7, 1.5, 1.5, 'F');
    setFont(10, 'bold', C.onNavy);
    doc.text(forPdf(task.key || ''), M + 14, y + 4.9, { align: 'center' });
    setFont(10, 'bold', C.soft);
    doc.text(forPdf(task.type || ''), M + 32, y + 4.9);

    const dColor = decisionRGB(task.decision);
    const dLabel = DECISION[task.decision]?.label || 'Aberta';
    setFont(11, 'bold', dColor);
    doc.text(dLabel, M + CW, y + 4.9, { align: 'right' });
    if (task.decidedByName) {
      setFont(9, 'normal', C.soft);
      doc.text(forPdf(`${task.decidedByName}${decidedWhen(task.decidedAt) ? ` · ${decidedWhen(task.decidedAt)}` : ''}`), M + CW, y + 10, { align: 'right' });
    }
    y += 13;
    wrapped(task.title, M, textW, 15, 'bold', C.ink, 6.5);
    y += 2;
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + CW, y);
    y += 6;

    const isMetricsCard = task.cardKind === 'metrics';
    const metrics = task.metrics?.filter((m) => (m.field || '').trim()) || [];

    if (isMetricsCard) {
      wrapped('Contexto', M, textW, 10, 'bold', C.navyLight);
      wrapped(task.description || 'Não informado.', M, textW, 10, 'normal', C.text);
      y += 3;
    } else {
      wrapped('O problema', M, textW, 10, 'bold', C.rejected);
      wrapped(task.evidence.problem || 'Não informado.', M, textW, 10, 'normal', C.text);
      y += 3;

      wrapped('A solução', M, textW, 10, 'bold', C.approved);
      wrapped(task.evidence.solution || 'Não informado.', M, textW, 10, 'normal', C.text);
      y += 3;

      if (task.acceptanceCriteria) {
        wrapped('Critérios de aceite', M, textW, 10, 'bold', C.navyLight);
        wrapped(task.acceptanceCriteria, M, textW, 9, 'normal', C.muted);
        y += 3;
      }
    }

    const vText = versionsText(task);
    if (vText) {
      wrapped('CI/CD e versões', M, textW, 10, 'bold', C.cyanDark);
      wrapped(vText, M, textW, 9, 'normal', C.muted);
      y += 3;
    }

    ensure(10);
    setFont(9, 'bold', C.soft);
    doc.text('Dev', M, y);
    doc.text('QA', M + textW / 2, y);
    y += 5;
    setFont(11, 'bold', C.ink);
    doc.text(forPdf(task.evidence.dev) || '—', M, y);
    doc.text(forPdf(task.evidence.qa) || '—', M + textW / 2, y);

    // Coluna direita: gráfico de métricas (card de métricas), imagem real (quando carregou) ou link de evidência
    if (isMetricsCard) {
      setFont(9, 'bold', C.navyLight);
      doc.text(forPdf(task.chartTitle || 'Métricas de impacto'), imgX, imgTop);
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(imgX, imgTop + 4, imgW, imgBottom - imgTop - 4, 3, 3, 'S');
      if (metrics.length > 0) {
        const chartX = imgX + 8;
        const chartW = imgW - 16;
        const maxValue = Math.max(...metrics.map((m) => Math.max(0, m.value)), 1);
        const rowH = Math.min(16, (imgBottom - imgTop - 16) / metrics.length);
        let cy = imgTop + 12;
        metrics.forEach((m) => {
          setFont(10, 'bold', C.text);
          doc.text(forPdf(m.field || ''), chartX, cy);
          setFont(10, 'bold', C.navyLight);
          doc.text((m.value ?? 0).toLocaleString('pt-BR'), chartX + chartW, cy, { align: 'right' });
          const barY = cy + 2.5;
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(chartX, barY, chartW, 3, 1.5, 1.5, 'F');
          const barW = Math.max(3, (Math.max(0, m.value) / maxValue) * chartW);
          doc.setFillColor(C.cyanDark[0], C.cyanDark[1], C.cyanDark[2]);
          doc.roundedRect(chartX, barY, barW, 3, 1.5, 1.5, 'F');
          cy += rowH;
        });
      } else {
        setFont(10, 'bold', C.soft);
        doc.text('Sem métricas preenchidas', imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2, { align: 'center' });
      }
    } else if (image) {
      const boxW = imgW, boxH = imgBottom - imgTop;
      const scale = Math.min(boxW / image.width, boxH / image.height);
      const w = image.width * scale, h = image.height * scale;
      const x = imgX + (boxW - w) / 2, yPos = imgTop + (boxH - h) / 2;
      doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]);
      doc.roundedRect(imgX, imgTop, boxW, boxH, 3, 3, 'F');
      try {
        doc.addImage(image.dataUrl, image.format, x, yPos, w, h);
      } catch {
        // Formato que o jsPDF não decodificou apesar do content-type: não trava a exportação.
      }
    } else {
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(imgX, imgTop, imgW, imgBottom - imgTop, 3, 3, 'S');
      const link = task.evidence.video || task.evidence.screenshot;
      setFont(10, 'bold', C.soft);
      doc.text(link ? 'Ver evidência:' : 'Sem evidência vinculada', imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2 - (link ? 4 : 0), { align: 'center' });
      if (link) {
        setFont(9, 'normal', C.muted);
        (doc.splitTextToSize(link, imgW - 16) as string[]).forEach((line, i) => {
          doc.text(line, imgX + imgW / 2, imgTop + (imgBottom - imgTop) / 2 + 3 + i * 4, { align: 'center' });
        });
      }
    }
  });

  doc.save(`sprint-review-${fileSlug(sessionName, 'showcase')}.pdf`);
}
