import type { jsPDF } from 'jspdf';
import {
  SITUATION_LABEL,
  formatHours,
  formatNumber,
  type ReportTask,
  type SessionReportData,
  type TaskSituation,
} from './poker-report';
import { roleTotalsText } from './poker-report-export';
import { SEGMENT_COLOR as SEGMENT, buildReportKpiItems, buildResultsPage, roleBarColor, type ResultsPageData } from './poker-report-results';

/**
 * PDF do relatório do refinamento, desenhado em vetor (texto e linhas, sem
 * rasterizar a tela) direto no navegador. A4 paisagem (297 x 210 mm), com
 * cabeçalho, indicadores, tabela paginada com cabeçalho repetido, destaques e
 * rodapé "Página X de Y". Lê o mesmo `SessionReportData` da tela e da impressão,
 * então os números batem. Fontes padrão do PDF (Helvetica): acentos do português
 * funcionam; caracteres fora de Latin-1/Windows-1252 são trocados ou removidos.
 */

// ---------------------------------------------------------------------------
// Medidas (mm) e cores
// ---------------------------------------------------------------------------

export const PDF_PAGE = { width: 297, height: 210 } as const;
const M = { left: 12, right: 12, top: 12 };
const CW = PDF_PAGE.width - M.left - M.right;
const FOOT_Y = PDF_PAGE.height - 8; // linha de base do rodapé
const BOTTOM = PDF_PAGE.height - 15; // fim da área de conteúdo
const CONT_TOP = 22; // início do conteúdo nas páginas de continuação
const PT = 25.4 / 72;

const INK = '#0f172a';
const MUTED = '#475569';
const RULE = '#cbd5e1';
const NAVY = '#002233';
const CYAN = '#00DBFF';
const PAPER_TINT = '#f8fafc';
const RED = '#991b1b';

const CHIP: Record<TaskSituation, { bg: string; fg: string }> = {
  consenso: { bg: '#dcfce7', fg: '#166534' },
  revotada: { bg: '#e0f2fe', fg: '#075985' },
  divergencia: { bg: '#fee2e2', fg: '#991b1b' },
  estimada: { bg: '#f1f5f9', fg: '#334155' },
  adiada: { bg: '#fef3c7', fg: '#92400e' },
  pulada: { bg: '#fef3c7', fg: '#92400e' },
  cancelada: { bg: '#f1f5f9', fg: '#475569' },
  nao_abordada: { bg: '#f1f5f9', fg: '#334155' },
};

// ---------------------------------------------------------------------------
// Texto seguro para as fontes padrão
// ---------------------------------------------------------------------------

const CP1252_EXTRA = new Set(['—', '–', '‘', '’', '‚', '“', '”', '„', '•', '…', '€', '™', '†', '‡', '‰', 'Š', 'š', 'Ž', 'ž', 'Œ', 'œ', 'Ÿ', 'ƒ', 'ˆ', '˜']);
const REPLACE: Record<string, string> = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '≈': '~', '−': '-', '‑': '-', ' ': ' ', ' ': ' ', ' ': ' ' };

/** Mantém só o que as fontes padrão do PDF desenham (Latin-1 e Windows-1252). */
export function pdfSafe(input: string | null | undefined): string {
  const out: string[] = [];
  for (const ch of (input ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0) as number;
    if (c === 9 || c === 10 || c === 13) out.push(' ');
    else if (c < 32 || (c >= 0x7f && c < 0xa0)) continue;
    else if (REPLACE[ch] !== undefined) out.push(REPLACE[ch]);
    else if (c <= 0xff || CP1252_EXTRA.has(ch)) out.push(ch);
    // o resto (emojis, setas, símbolos) é descartado
  }
  return out.join('').replace(/ {2,}/g, ' ').trim();
}

function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

export interface ReportPdfOptions {
  /** Folha de resultados como primeira página. */
  includeResults?: boolean;
  /** Só a folha de resultados (1 página). */
  resultsOnly?: boolean;
  /** Para testes: carimbo de geração. */
  now?: Date;
}

type Align = 'left' | 'right' | 'center';

class Sheet {
  y = M.top;
  /** Páginas de continuação ganham o cabeçalho corrido. */
  runningHeader = false;
  onNewPage: (() => void) | null = null;

  constructor(readonly doc: jsPDF, readonly footerLeft: string, readonly title: string) {}

  color(hex: string, kind: 'text' | 'fill' | 'draw') {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (kind === 'text') this.doc.setTextColor(r, g, b);
    else if (kind === 'fill') this.doc.setFillColor(r, g, b);
    else this.doc.setDrawColor(r, g, b);
  }

  font(style: 'normal' | 'bold', size: number, color = INK) {
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    this.color(color, 'text');
  }

  lh(size: number, factor = 1.3) {
    return size * factor * PT;
  }

  width(text: string, style: 'normal' | 'bold', size: number) {
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    return this.doc.getTextWidth(pdfSafe(text));
  }

  /** Quebra o texto na largura dada; `maxLines` corta com reticências. */
  wrap(text: string, w: number, style: 'normal' | 'bold', size: number, maxLines = Infinity): string[] {
    const safe = pdfSafe(text);
    if (safe === '') return [];
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(safe, w) as string[];
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && this.doc.getTextWidth(`${last}…`) > w) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }

  /** Escreve uma linha (o `y` é o topo da linha). */
  line(text: string, x: number, y: number, align: Align = 'left') {
    if (text === '') return;
    this.doc.text(text, x, y, { baseline: 'top', align });
  }

  lines(lines: string[], x: number, y: number, size: number, align: Align = 'left', factor = 1.3): number {
    const step = this.lh(size, factor);
    lines.forEach((l, i) => this.line(l, x, y + i * step, align));
    return lines.length * step;
  }

  rule(x1: number, y: number, x2: number, color = RULE, weight = 0.2) {
    this.color(color, 'draw');
    this.doc.setLineWidth(weight);
    this.doc.line(x1, y, x2, y);
  }

  box(x: number, y: number, w: number, h: number, opts: { fill?: string; stroke?: string; weight?: number; radius?: number } = {}) {
    const { fill, stroke, weight = 0.2, radius = 0 } = opts;
    if (fill) this.color(fill, 'fill');
    if (stroke) {
      this.color(stroke, 'draw');
      this.doc.setLineWidth(weight);
    }
    const mode = fill && stroke ? 'FD' : fill ? 'F' : 'S';
    if (radius > 0) this.doc.roundedRect(x, y, w, h, radius, radius, mode);
    else this.doc.rect(x, y, w, h, mode);
  }

  newPage() {
    this.doc.addPage('a4', 'landscape');
    this.y = this.runningHeader ? CONT_TOP : M.top;
    if (this.runningHeader) {
      this.font('bold', 8, MUTED);
      this.line('SCRUM POKER · PORTAL TECH V&D', M.left, M.top);
      this.font('normal', 8, MUTED);
      this.line(pdfSafe(this.title), PDF_PAGE.width - M.right, M.top, 'right');
      this.rule(M.left, M.top + 5, PDF_PAGE.width - M.right, RULE, 0.2);
    }
    this.onNewPage?.();
  }

  /** Garante `h` mm livres; senão abre uma página nova. Retorna true se quebrou. */
  ensure(h: number): boolean {
    if (this.y + h <= BOTTOM) return false;
    this.newPage();
    return true;
  }

  heading(text: string) {
    this.font('bold', 11, NAVY);
    this.line(text, M.left, this.y);
    this.y += this.lh(11) + 1.6;
  }
}

// ----------------------------------------------------------------- Folha de resultados

function drawResultsPage(s: Sheet, data: ResultsPageData) {
  const { doc } = s;
  const R = PDF_PAGE.width - M.right;

  // faixa e identificação
  s.box(M.left, M.top, CW, 1, { fill: CYAN });
  s.font('bold', 8, MUTED);
  doc.setCharSpace(0.4);
  s.line('SCRUM POKER · PORTAL TECH V&D', M.left, M.top + 3.6);
  doc.setCharSpace(0);
  s.font('bold', 22, NAVY);
  s.line('Resultados da sessão', M.left, M.top + 8.6);
  s.font('bold', 10.5, INK);
  s.line(`${data.dateLong}${data.timeRange ? ` · ${data.timeRange}` : ''}`, R, M.top + 11.4, 'right');

  let y = M.top + 8.6 + s.lh(22) + 2;
  s.font('bold', 12, INK);
  const titleW = s.width(data.title, 'bold', 12);
  s.line(data.title, M.left, y);
  if (data.team) {
    s.font('normal', 12, MUTED);
    s.line(` · ${data.team}`, M.left + titleW, y);
  }
  y += s.lh(12) + 2.5;

  // metadados
  s.rule(M.left, y, R, RULE, 0.2);
  y += 2.6;
  const participants = `${data.participantsCount}${data.participantsByRole.length > 0 ? ` · ${data.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')}` : ''}`;
  const metas: Array<[string, string]> = [
    ['Facilitador', data.facilitators.length > 0 ? data.facilitators.join(', ') : '—'],
    ['Participantes', participants],
    ['Duração ativa', data.durationLabel ?? '—'],
    ['Baralho', data.deckLabel],
    ['Tarefas na pauta', String(data.agenda)],
  ];
  const mw = (CW - 4 * 5) / 5;
  let metaH = 0;
  metas.forEach(([label, value], i) => {
    const x = M.left + i * (mw + 5);
    s.font('normal', 8, MUTED);
    s.line(label, x, y);
    const lines = s.wrap(value, mw, 'bold', 9, 3);
    s.font('bold', 9, INK);
    const h = s.lines(lines, x, y + s.lh(8) + 0.4, 9);
    metaH = Math.max(metaH, s.lh(8) + 0.4 + h);
  });
  y += metaH + 3.5;

  // indicadores
  const kpiW = (CW - 5 * 3) / 6;
  const kpiH = 26;
  data.kpis.slice(0, 6).forEach((k, i) => {
    const x = M.left + i * (kpiW + 3);
    s.box(x, y, kpiW, kpiH, { stroke: k.main ? NAVY : RULE, weight: k.main ? 0.45 : 0.25, radius: 1.5 });
    s.font('normal', 8, MUTED);
    s.line(k.label, x + 2.8, y + 2.4);
    const valueColor = k.tone === 'danger' ? RED : NAVY;
    const smallVal = k.value.length > 7;
    s.font('bold', smallVal ? 13 : 19, valueColor);
    const vw = s.width(k.value, 'bold', smallVal ? 13 : 19);
    s.line(k.value, x + 2.8, y + 7.2);
    if (k.unit) {
      s.font('bold', 9, MUTED);
      s.line(` ${k.unit}`, x + 2.8 + vw, y + 7.2 + ((smallVal ? 13 : 19) - 9) * PT * 0.8);
    }
    if (k.sub) {
      const sub = s.wrap(k.sub, kpiW - 5.6, 'normal', 8, 2);
      s.font('normal', 8, MUTED);
      s.lines(sub, x + 2.8, y + 15.6, 8);
    }
  });
  y += kpiH + 6;

  // ---- coluna esquerda: horas por papel e situação
  const leftW = 158;
  const rightX = M.left + leftW + 9;
  const rightW = R - rightX;
  let ly = y;

  if (data.roleBars.length > 0) {
    s.font('bold', 11, NAVY);
    s.line('Horas por papel', M.left, ly);
    ly += s.lh(11) + 2.4;
    const labelW = 22;
    const valueW = 34;
    const trackW = leftW - labelW - valueW - 4;
    data.roleBars.slice(0, 6).forEach((b) => {
      s.font('bold', 9, INK);
      s.line(b.label, M.left, ly + 0.7);
      s.box(M.left + labelW, ly, trackW, 5.2, { fill: '#eef2f6' });
      s.box(M.left + labelW, ly, Math.max(0.8, trackW * b.ratio), 5.2, { fill: roleBarColor(b.key) });
      s.font('bold', 9, INK);
      s.line(`${b.valueLabel} · ${Math.round(b.share * 100)}%`, M.left + labelW + trackW + 3, ly + 0.7);
      ly += 7.6;
    });
    ly += 3;
  }

  s.font('bold', 11, NAVY);
  s.line('Situação das tarefas', M.left, ly);
  ly += s.lh(11) + 2.4;
  const total = data.situation.reduce((n, x) => n + x.count, 0);
  let sx = M.left;
  data.situation.forEach((seg, i) => {
    const w = i === data.situation.length - 1 ? M.left + leftW - sx : (leftW * seg.count) / Math.max(1, total);
    s.box(sx, ly, w, 7, { fill: SEGMENT[seg.situation] });
    sx += w;
  });
  ly += 7 + 3.6;
  const cols = 3;
  const colW = leftW / cols;
  data.situation.forEach((seg, i) => {
    const cx = M.left + (i % cols) * colW;
    const cy = ly + Math.floor(i / cols) * 5.4;
    s.box(cx, cy + 0.5, 3, 3, { fill: SEGMENT[seg.situation] });
    s.font('bold', 9, INK);
    s.line(String(seg.count), cx + 4.6, cy);
    s.font('normal', 9, INK);
    s.line(`${seg.label} (${Math.round(seg.share * 100)}%)`, cx + 4.6 + 5.2, cy);
  });
  ly += Math.ceil(data.situation.length / cols) * 5.4;

  // ---- coluna direita: maiores e pendências
  let ry = y;
  const list = (title: string, rows: Array<{ task: ReportTask; detail: string }>, aside: (t: ReportTask) => string, max: number, moreLabel: string) => {
    s.font('bold', 11, NAVY);
    s.line(title, rightX, ry);
    ry += s.lh(11) + 1.8;
    rows.slice(0, max).forEach((row, i) => {
      const asideText = aside(row.task);
      const asideW = Math.max(14, s.width(asideText, 'bold', 9) + 1);
      const textW = rightW - asideW - 3;
      const name = `${row.task.key ? `${row.task.key}  ` : ''}${row.task.title}`;
      const lines = s.wrap(name, textW, 'bold', 9, 2);
      const sub = row.detail ? s.wrap(row.detail, textW, 'normal', 8, 2) : [];
      const h = lines.length * s.lh(9) + sub.length * s.lh(8) + 2.4;
      if (i > 0) s.rule(rightX, ry - 0.8, R, '#e2e8f0', 0.15);
      s.font('bold', 9, INK);
      s.lines(lines, rightX, ry, 9);
      s.font('bold', 9, NAVY);
      s.line(asideText, R, ry, 'right');
      s.font('normal', 8, MUTED);
      s.lines(sub, rightX, ry + lines.length * s.lh(9), 8);
      ry += h;
    });
    if (rows.length > max) {
      s.font('normal', 8, MUTED);
      s.line(`${moreLabel} (+${rows.length - max}). Veja o relatório completo.`, rightX, ry);
      ry += s.lh(8) + 1;
    }
  };

  if (data.largest.length > 0) {
    list('Maiores estimativas', data.largest, (t) => t.totalLabel, 3, 'Outras');
    ry += 3;
  }
  if (data.pending.length > 0) {
    list(`Pendências sem estimativa (${data.pending.length})`, data.pending, (t) => SITUATION_LABEL[t.situation], 4, 'Outras pendências');
  } else {
    s.font('bold', 11, NAVY);
    s.line('Pendências sem estimativa', rightX, ry);
    ry += s.lh(11) + 1.8;
    s.font('normal', 9, MUTED);
    s.line('Nenhuma pendência: todas as tarefas da pauta foram tratadas.', rightX, ry);
    ry += s.lh(9);
  }
  if (data.cancelled > 0) {
    s.font('normal', 8, MUTED);
    s.line(`${data.cancelled} ${data.cancelled === 1 ? 'tarefa cancelada' : 'tarefas canceladas'} no refinamento (fora da contagem de pendências).`, rightX, ry + 1);
    ry += s.lh(8) + 2;
  }

  // ---- avisos de dados que faltaram
  const bottom = Math.max(ly, ry) + 4;
  if (data.omitted.length > 0) {
    const noteY = Math.max(bottom, 168);
    s.rule(M.left, noteY - 1.6, R, RULE, 0.2);
    s.font('bold', 8, MUTED);
    s.line('Não incluído nesta folha (dado não registrado na sessão)', M.left, noteY);
    s.font('normal', 8, MUTED);
    const text = s.wrap(data.omitted.join(' '), CW, 'normal', 8, 3);
    s.lines(text, M.left, noteY + s.lh(8) + 0.4, 8);
  }
}

// ----------------------------------------------------------------- Relatório completo

interface Col {
  id: string;
  label: string;
  w: number;
  align: Align;
}

function drawReportBody(s: Sheet, report: SessionReportData, now: Date) {
  const { doc } = s;
  const { header: h, kpis: k, totals, highlights: hl } = report;
  const R = PDF_PAGE.width - M.right;
  const isHours = h.deck === 'hours';

  // ---- cabeçalho do documento
  s.box(M.left, s.y, CW, 1, { fill: CYAN });
  s.y += 4;
  s.font('bold', 8, MUTED);
  doc.setCharSpace(0.4);
  s.line('SCRUM POKER · PORTAL TECH V&D', M.left, s.y);
  doc.setCharSpace(0);
  s.y += s.lh(8) + 0.8;
  s.font('bold', 20, NAVY);
  s.line('Relatório do refinamento', M.left, s.y);
  s.font('bold', 10, INK);
  s.line(`${h.dateLong.charAt(0).toUpperCase()}${h.dateLong.slice(1)}${h.timeRange ? ` · ${h.timeRange}` : ''}`, R, s.y + 4.2, 'right');
  s.y += s.lh(20) + 1.6;
  s.font('bold', 11, INK);
  const tw = s.width(h.title, 'bold', 11);
  s.line(h.title, M.left, s.y);
  if (h.team) {
    s.font('normal', 11, MUTED);
    s.line(` · ${h.team}`, M.left + tw, s.y);
  }
  s.y += s.lh(11) + 2.4;
  s.rule(M.left, s.y, R, RULE, 0.2);
  s.y += 2.6;

  const participants = `${h.participantsCount}${h.participantsByRole.length > 0 ? ` · ${h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')}` : ''}`;
  const metas: Array<[string, string]> = [
    ['Facilitador', h.facilitators.length > 0 ? h.facilitators.join(', ') : '—'],
    ['Participantes', participants],
    ['Duração ativa', h.durationLabel],
    ['Baralho', h.deckLabel],
    ['Tarefas na pauta', String(k.agenda)],
  ];
  const mw = (CW - 4 * 5) / 5;
  let metaH = 0;
  metas.forEach(([label, value], i) => {
    const x = M.left + i * (mw + 5);
    s.font('normal', 8, MUTED);
    s.line(label, x, s.y);
    const lines = s.wrap(value, mw, 'bold', 9, 3);
    s.font('bold', 9, INK);
    const hh = s.lines(lines, x, s.y + s.lh(8) + 0.4, 9);
    metaH = Math.max(metaH, s.lh(8) + 0.4 + hh);
  });
  s.y += metaH + 4;

  // ---- indicadores
  const items = buildReportKpiItems(report);
  const perRow = 6;
  const gap = 3;
  const kw = (CW - (perRow - 1) * gap) / perRow;
  const kh = 22;
  items.forEach((it, i) => {
    const col = i % perRow;
    if (col === 0 && i > 0) s.y += kh + gap;
    const x = M.left + col * (kw + gap);
    const y = s.y;
    s.box(x, y, kw, kh, { stroke: it.main ? NAVY : RULE, weight: it.main ? 0.45 : 0.25, radius: 1.5 });
    s.font('normal', 8, MUTED);
    s.line(it.label, x + 2.6, y + 2);
    const small = it.value.length > 7;
    s.font('bold', small ? 12 : 17, NAVY);
    const vw = s.width(it.value, 'bold', small ? 12 : 17);
    s.line(it.value, x + 2.6, y + 6.4);
    if (it.unit) {
      s.font('bold', 8.5, MUTED);
      s.line(` ${it.unit}`, x + 2.6 + vw, y + 6.4 + ((small ? 12 : 17) - 8.5) * PT * 0.8);
    }
    if (it.sub) {
      s.font('normal', 8, MUTED);
      s.lines(s.wrap(it.sub, kw - 5.2, 'normal', 8, 2), x + 2.6, y + 14, 8);
    }
  });
  s.y += kh + 6;

  // ---- tabela de tarefas
  s.runningHeader = true;
  const roleW = 17;
  const fixed = report.roles.length * roleW + 19 + 17 + 28;
  const rest = CW - fixed;
  const taskW = Math.round(rest * 0.5 * 10) / 10;
  const cols: Col[] = [
    { id: 'task', label: 'TAREFA', w: taskW, align: 'left' },
    ...report.roles.map((r): Col => ({ id: `role:${r.role}`, label: r.label.toUpperCase(), w: roleW, align: 'right' })),
    { id: 'total', label: 'TOTAL', w: 19, align: 'right' },
    { id: 'rounds', label: 'RODADAS', w: 17, align: 'center' },
    { id: 'sit', label: 'SITUAÇÃO', w: 28, align: 'center' },
    { id: 'notes', label: 'DECISÃO E OBSERVAÇÕES', w: rest - taskW, align: 'left' },
  ];
  const PADX = 1.8;
  const PADY = 1.7;
  const xs: number[] = [];
  cols.reduce((x, c) => {
    xs.push(x);
    return x + c.w;
  }, M.left);

  const drawTableHeader = () => {
    const hh = 7.4;
    s.box(M.left, s.y, CW, hh, { fill: PAPER_TINT });
    s.rule(M.left, s.y + hh, R, NAVY, 0.45);
    s.font('bold', 8, MUTED);
    cols.forEach((c, i) => {
      const tx = c.align === 'left' ? xs[i] + PADX : c.align === 'right' ? xs[i] + c.w - PADX : xs[i] + c.w / 2;
      s.line(c.label, tx, s.y + 2.3, c.align);
    });
    s.y += hh;
  };

  let inTable = false;
  s.onNewPage = () => {
    if (inTable) drawTableHeader();
  };
  s.ensure(7 + 7.4 + 12);
  s.heading('Tarefas da sessão');
  drawTableHeader();
  inTable = true;

  const noteLines = (t: ReportTask) => {
    const out: Array<{ text: string; style: 'normal' | 'bold'; color: string }> = [];
    if (t.divergence) out.push({ text: t.divergence.text, style: 'bold', color: RED });
    if (t.decisionNote) out.push({ text: t.decisionNote, style: 'normal', color: INK });
    if (t.reason) out.push({ text: t.reason, style: 'normal', color: MUTED });
    if (t.parkCount > 0) {
      const head = `Adiada ${t.parkCount}x${t.parkOutcome ? `, ${t.parkOutcome}` : ''}`;
      out.push({ text: t.parkedNote ? `${head}: ${t.parkedNote}` : head, style: 'normal', color: MUTED });
    }
    return out;
  };

  const notesW = cols[cols.length - 1].w - 2 * PADX;
  const taskTextW = cols[0].w - 2 * PADX;

  report.tasks.forEach((t) => {
    const titleLines = s.wrap(t.title, taskTextW, 'bold', 9, 5);
    const keyH = t.key ? s.lh(8) : 0;
    const taskH = keyH + titleLines.length * s.lh(9);
    const notes = noteLines(t).map((n) => ({ ...n, lines: s.wrap(n.text, notesW, n.style, 9, 6) }));
    const notesH = notes.reduce((a, n, i) => a + n.lines.length * s.lh(9) + (i > 0 ? 0.8 : 0), 0);
    const rowH = Math.max(7.4, Math.max(taskH, notesH, 4.6) + 2 * PADY);

    s.ensure(rowH);
    const top = s.y;
    let ty = top + PADY;
    if (t.key) {
      s.font('bold', 8, MUTED);
      s.line(t.key, xs[0] + PADX, ty);
      const href = safeHref(t.jiraLink);
      if (href) doc.link(xs[0] + PADX, ty, s.width(t.key, 'bold', 8), s.lh(8), { url: href });
      ty += keyH;
    }
    s.font('bold', 9, t.situation === 'cancelada' ? MUTED : INK);
    s.lines(titleLines, xs[0] + PADX, ty, 9);
    if (t.situation === 'cancelada') {
      titleLines.forEach((l, i) => {
        const ly = ty + i * s.lh(9) + s.lh(9) * 0.42;
        s.rule(xs[0] + PADX, ly, xs[0] + PADX + s.width(l, 'bold', 9), MUTED, 0.2);
      });
    }

    cols.forEach((c, i) => {
      const right = xs[i] + c.w - PADX;
      if (c.id.startsWith('role:')) {
        const v = t.roles[c.id.slice(5)];
        s.font('normal', 9, v !== undefined ? INK : MUTED);
        s.line(v !== undefined ? formatHours(v) : '—', right, top + PADY, 'right');
      } else if (c.id === 'total') {
        s.font(t.estimated ? 'bold' : 'normal', 9, t.estimated ? NAVY : MUTED);
        s.line(t.totalLabel, right, top + PADY, 'right');
      } else if (c.id === 'rounds') {
        s.font('normal', 9, t.rounds > 0 ? INK : MUTED);
        s.line(t.rounds > 0 ? String(t.rounds) : '—', xs[i] + c.w / 2, top + PADY, 'center');
      } else if (c.id === 'sit') {
        const label = SITUATION_LABEL[t.situation];
        const chip = CHIP[t.situation];
        const w = Math.min(c.w - 2, s.width(label, 'bold', 8) + 4.4);
        const cx = xs[i] + (c.w - w) / 2;
        s.box(cx, top + PADY - 0.3, w, 4.7, { fill: chip.bg, radius: 2.3 });
        s.font('bold', 8, chip.fg);
        s.line(label, xs[i] + c.w / 2, top + PADY + 0.55, 'center');
      }
    });

    // observações
    let ny = top + PADY;
    const nx = xs[cols.length - 1] + PADX;
    if (notes.length === 0) {
      s.font('normal', 9, MUTED);
      s.line('—', nx, ny);
    }
    notes.forEach((n, i) => {
      if (i > 0) ny += 0.8;
      s.font(n.style, 9, n.color);
      ny += s.lines(n.lines, nx, ny, 9);
    });

    s.rule(M.left, top + rowH, R, RULE, 0.18);
    s.y = top + rowH;
  });

  // totais
  if (k.estimated > 0) {
    const rowH = 8;
    s.ensure(rowH + 4);
    const top = s.y;
    s.box(M.left, top, CW, rowH, { fill: PAPER_TINT });
    s.rule(M.left, top, R, NAVY, 0.5);
    s.font('bold', 9, INK);
    s.line(`Total da sessão · ${k.estimated} ${k.estimated === 1 ? 'estimada' : 'estimadas'}`, xs[0] + PADX, top + 2.4);
    cols.forEach((c, i) => {
      const right = xs[i] + c.w - PADX;
      if (c.id.startsWith('role:')) {
        s.font('bold', 9, INK);
        s.line(formatHours(totals.roles[c.id.slice(5)] ?? 0), right, top + 2.4, 'right');
      } else if (c.id === 'total') {
        s.font('bold', 9, NAVY);
        s.line(k.totalLabel, right, top + 2.4, 'right');
      } else if (c.id === 'rounds') {
        s.font('bold', 9, INK);
        s.line(String(report.tasks.reduce((a, t) => a + t.rounds, 0)), xs[i] + c.w / 2, top + 2.4, 'center');
      }
    });
    s.y = top + rowH + 1.6;
  }
  inTable = false;
  s.onNewPage = null;
  if (totals.rolesDiffer) {
    s.font('normal', 8, MUTED);
    const text = `A soma dos papéis (${formatNumber(Object.values(totals.roles).reduce((a, b) => a + b, 0))}h) difere do total por ajuste manual de estimativa.`;
    s.ensure(s.lh(8) + 2);
    s.line(text, M.left, s.y);
    s.y += s.lh(8) + 1.4;
  }
  s.y += 4;

  // ---- destaques
  type Card = { title: string; items: Array<{ task: ReportTask; aside: string; detail: string[] }>; total: number };
  const cards: Card[] = [];
  const CAP = 8;
  const mk = (title: string, list: ReportTask[], aside: (t: ReportTask) => string, detail: (t: ReportTask) => string[], count = false) => {
    if (list.length === 0) return;
    cards.push({
      title: count ? `${title} (${list.length})` : title,
      total: list.length,
      items: list.slice(0, CAP).map((t) => ({ task: t, aside: aside(t), detail: detail(t).filter(Boolean) })),
    });
  };
  mk('Maiores estimativas', hl.largest, (t) => t.totalLabel, (t) => [t.copyText]);
  mk('Mais discutidas', hl.mostDiscussed, (t) => `${t.rounds} rodadas`, (t) => [`Estimada em ${t.totalLabel}`]);
  mk('Com divergência', hl.divergent, (t) => t.totalLabel, (t) => [t.divergence?.text ?? ''], true);
  mk('Pendências sem estimativa', hl.pending, (t) => SITUATION_LABEL[t.situation], (t) => [t.reason ?? t.parkedNote ?? '', t.assignee ? `Responsável no Jira: ${t.assignee}` : ''], true);

  const colW = (CW - 4) / 2;
  const cardW = colW;
  const measureCard = (c: Card) => {
    const innerW = cardW - 6;
    let hh = 3 + s.lh(9.5) + 1.8;
    const laid = c.items.map((it) => {
      const asideW = Math.max(16, s.width(it.aside, 'bold', 9) + 1);
      const textW = innerW - asideW - 3;
      const name = `${it.task.key ? `${it.task.key}  ` : ''}${it.task.title}`;
      const lines = s.wrap(name, textW, 'bold', 9, 3);
      const detail = it.detail.flatMap((d) => s.wrap(d, textW, 'normal', 8, 2));
      const ih = lines.length * s.lh(9) + detail.length * s.lh(8) + 2.4;
      hh += ih;
      return { it, lines, detail, ih };
    });
    const more = c.total > c.items.length;
    if (more) hh += s.lh(8) + 1;
    return { hh: hh + 2.2, laid, more };
  };
  const drawCard = (c: Card, x: number, y: number, m: ReturnType<typeof measureCard>, height: number) => {
    s.box(x, y, cardW, height, { stroke: RULE, weight: 0.25, radius: 1.5 });
    s.font('bold', 9.5, NAVY);
    s.line(c.title, x + 3, y + 3);
    let cy = y + 3 + s.lh(9.5) + 1.8;
    const innerR = x + cardW - 3;
    m.laid.forEach((row, i) => {
      if (i > 0) s.rule(x + 3, cy - 0.9, innerR, '#e2e8f0', 0.15);
      s.font('bold', 9, INK);
      s.lines(row.lines, x + 3, cy, 9);
      s.font('bold', 9, NAVY);
      s.line(row.it.aside, innerR, cy, 'right');
      s.font('normal', 8, MUTED);
      s.lines(row.detail, x + 3, cy + row.lines.length * s.lh(9), 8);
      cy += row.ih;
    });
    if (m.more) {
      s.font('normal', 8, MUTED);
      s.line(`+ ${c.total - c.items.length} na tabela de tarefas`, x + 3, cy);
    }
  };

  if (cards.length > 0) {
    s.ensure(s.lh(11) + 30);
    s.heading('Destaques para a gestão');
    for (let i = 0; i < cards.length; i += 2) {
      const pair = cards.slice(i, i + 2);
      const ms = pair.map(measureCard);
      const rowH = Math.max(...ms.map((m) => m.hh));
      s.ensure(rowH);
      pair.forEach((c, j) => drawCard(c, M.left + j * (colW + 4), s.y, ms[j], rowH));
      s.y += rowH + 3.5;
    }
    s.y += 2;
  }

  // ---- notas de refinamento
  if (hl.withNotes.length > 0) {
    s.ensure(s.lh(11) + 24);
    s.heading('Notas de refinamento');
    for (let i = 0; i < hl.withNotes.length; i += 2) {
      const pair = hl.withNotes.slice(i, i + 2);
      const laid = pair.map((t) => {
        const innerW = cardW - 6;
        const head = s.wrap(`${t.key ? `${t.key} · ` : ''}${t.title}`, innerW, 'bold', 9, 2);
        const dev = t.devNotes ? s.wrap(`DEV  ${t.devNotes}`, innerW, 'normal', 9, 8) : [];
        const qa = t.qaNotes ? s.wrap(`QA  ${t.qaNotes}`, innerW, 'normal', 9, 8) : [];
        const hh = 3 + head.length * s.lh(9) + 1 + (dev.length + qa.length) * s.lh(9) + 3;
        return { head, dev, qa, hh };
      });
      const rowH = Math.max(...laid.map((l) => l.hh));
      s.ensure(rowH);
      laid.forEach((l, j) => {
        const x = M.left + j * (colW + 4);
        s.box(x, s.y, cardW, rowH, { stroke: RULE, weight: 0.25, radius: 1.5 });
        s.font('bold', 9, NAVY);
        let ny = s.y + 3;
        ny += s.lines(l.head, x + 3, ny, 9) + 1;
        [...l.dev, ...l.qa].forEach((line) => {
          const m = /^(DEV|QA) /.exec(line);
          if (m) {
            s.font('bold', 9, NAVY);
            s.line(m[1], x + 3, ny);
            s.font('normal', 9, INK);
            s.line(line.slice(m[0].length), x + 3 + s.width(m[1], 'bold', 9) + 1.6, ny);
          } else {
            s.font('normal', 9, INK);
            s.line(line, x + 3, ny);
          }
          ny += s.lh(9);
        });
      });
      s.y += rowH + 3.5;
    }
    s.y += 2;
  }

  // ---- tempo por tópico
  if (report.topicTiming.length > 0) {
    s.ensure(s.lh(11) + 14);
    s.heading('Tempo por tópico');
    const tw2 = 150;
    report.topicTiming.forEach((x) => {
      const label = `${x.title}${x.skipped ? ' (pulado)' : ''}`;
      const lines = s.wrap(label, tw2 - 30, 'normal', 9, 2);
      const rh = Math.max(6, lines.length * s.lh(9) + 2.6);
      s.ensure(rh);
      s.font('normal', 9, INK);
      s.lines(lines, M.left + 1.8, s.y + 1.3, 9);
      s.font('bold', 9, INK);
      s.line(`${x.mins} min`, M.left + tw2 - 1.8, s.y + 1.3, 'right');
      s.rule(M.left, s.y + rh, M.left + tw2, '#e2e8f0', 0.15);
      s.y += rh;
    });
    s.ensure(6.4);
    s.font('bold', 9, INK);
    s.line('Tempo ativo', M.left + 1.8, s.y + 1.3);
    s.line(`${report.activeMins} min`, M.left + tw2 - 1.8, s.y + 1.3, 'right');
    s.y += 8;
  }

  // ---- critérios
  const crit =
    `Fechadas na 1ª rodada: tarefas estimadas em uma única rodada, sem divergência crítica. Divergência crítica: diferença entre votos do mesmo papel acima de ${formatNumber(report.criteria.divergenceHigh)}${isHours ? 'h' : ''} (nos demais baralhos, qualquer voto diferente no papel).` +
    (k.total !== null && roleTotalsText(report) ? ` Totais por papel: ${roleTotalsText(report)}.` : '');
  const critLines = s.wrap(crit, CW, 'normal', 8);
  s.ensure(critLines.length * s.lh(8) + 4);
  s.rule(M.left, s.y, R, RULE, 0.2);
  s.y += 1.8;
  s.font('normal', 8, MUTED);
  s.lines(critLines, M.left, s.y, 8);
  s.y += critLines.length * s.lh(8);
  void now;
}

// ----------------------------------------------------------------- Rodapé numerado

function drawFooters(s: Sheet, generated: string) {
  const { doc } = s;
  const total = doc.getNumberOfPages();
  const R = PDF_PAGE.width - M.right;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    s.rule(M.left, PDF_PAGE.height - 11.6, R, RULE, 0.2);
    s.font('normal', 8, MUTED);
    s.line(s.footerLeft, M.left, FOOT_Y - 2.4);
    s.line(`Gerado em ${generated} · Página ${p} de ${total}`, R, FOOT_Y - 2.4, 'right');
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Desenha o relatório num documento jsPDF já criado em A4 paisagem (mm). */
export function drawReportPdf(doc: jsPDF, report: SessionReportData, options: ReportPdfOptions = {}): void {
  const now = options.now ?? new Date();
  const generated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now);
  const footerLeft = pdfSafe(`Scrum Poker · Portal Tech V&D · ${report.header.title}`);
  const s = new Sheet(doc, footerLeft, report.header.title);
  doc.setLineHeightFactor(1.3);

  const wantResults = options.resultsOnly || options.includeResults;
  if (wantResults) drawResultsPage(s, buildResultsPage(report));
  if (!options.resultsOnly) {
    if (wantResults) s.newPage();
    drawReportBody(s, report, now);
  }
  drawFooters(s, generated);
  doc.setProperties({
    title: `Relatório do refinamento - ${report.header.title}`,
    subject: 'Scrum Poker · Portal Tech V&D',
    creator: 'Portal Tech V&D',
  });
}

/** Cria o documento (carrega o jsPDF sob demanda) com o relatório desenhado. */
export async function buildReportPdf(report: SessionReportData, options: ReportPdfOptions = {}): Promise<jsPDF> {
  const { jsPDF: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  drawReportPdf(doc, report, options);
  return doc;
}

const slug = (t: string) =>
  pdfSafe(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);

export function reportPdfFileName(report: SessionReportData, options: ReportPdfOptions = {}): string {
  const date = report.header.dateLabel.replace(/\//g, '-');
  return `${options.resultsOnly ? 'resultados' : 'relatorio'}-${slug(report.header.title) || 'refinamento'}-${date}.pdf`;
}

/** Gera o PDF e dispara o download. Retorna o nome do arquivo. */
export async function downloadReportPdf(report: SessionReportData, options: ReportPdfOptions = {}): Promise<string> {
  const doc = await buildReportPdf(report, options);
  const name = reportPdfFileName(report, options);
  doc.save(name);
  return name;
}
