import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { buildSessionReport } from '../poker-report';
import { drawReportPdf, pdfSafe, reportPdfFileName, type ReportPdfOptions } from '../poker-report-pdf';
import { bigSession, smallSession } from './fixtures/poker-report-sample';

const NOW = new Date('2026-10-16T18:30:00Z');

function make(input: ReturnType<typeof bigSession>, options: ReportPdfOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const drawn: Array<{ page: number; text: string; size: number }> = [];
  const original = doc.text.bind(doc);
  (doc as unknown as { text: unknown }).text = (text: string | string[], ...rest: unknown[]) => {
    drawn.push({ page: doc.getCurrentPageInfo().pageNumber, text: Array.isArray(text) ? text.join(' ') : String(text), size: doc.getFontSize() });
    return (original as (...a: unknown[]) => unknown)(text, ...rest);
  };
  drawReportPdf(doc, buildSessionReport(input), { now: NOW, ...options });
  return { doc, drawn, raw: doc.output() };
}

describe('PDF do relatório', () => {
  it('toda página é A4 paisagem (842 x 595 pt)', () => {
    const { doc, raw } = make(bigSession(), { includeResults: true });
    const boxes = [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
    expect(boxes.length).toBe(doc.getNumberOfPages());
    boxes.forEach((m) => {
      expect(Number(m[1])).toBeCloseTo(841.89, 1);
      expect(Number(m[2])).toBeCloseTo(595.28, 1);
    });
  });

  it('só a página de resultados tem 1 página', () => {
    const { doc, drawn } = make(bigSession(), { resultsOnly: true });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(drawn.some((d) => d.text === 'Resultados da sessão')).toBe(true);
    expect(drawn.some((d) => d.text === 'Relatório do refinamento')).toBe(false);
    expect(drawn.some((d) => d.text.includes('Página 1 de 1'))).toBe(true);
  });

  it('com resultados: 1ª página é a folha-resumo e o relatório começa na 2ª', () => {
    const { doc, drawn } = make(bigSession(), { includeResults: true });
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(drawn.find((d) => d.text === 'Resultados da sessão')?.page).toBe(1);
    expect(drawn.find((d) => d.text === 'Relatório do refinamento')?.page).toBe(2);
  });

  it('sem resultados: relatório direto na página 1', () => {
    const { drawn } = make(bigSession(), { includeResults: false });
    expect(drawn.find((d) => d.text === 'Relatório do refinamento')?.page).toBe(1);
    expect(drawn.some((d) => d.text === 'Resultados da sessão')).toBe(false);
  });

  it('tabela pagina sem perder tarefas e repete o cabeçalho', () => {
    const { drawn } = make(bigSession(), { includeResults: false });
    const headerPages = drawn.filter((d) => d.text === 'TAREFA').map((d) => d.page);
    expect(headerPages.length).toBeGreaterThanOrEqual(2);
    expect(new Set(headerPages).size).toBe(headerPages.length);
    for (let n = 1; n <= 12; n++) expect(drawn.some((d) => d.text === `PTV-${1200 + n}`)).toBe(true);
    expect(drawn.some((d) => d.text.startsWith('Total da sessão'))).toBe(true);
  });

  it('rodapé numerado "Página X de Y" em todas as páginas', () => {
    const { doc, drawn } = make(bigSession(), { includeResults: true });
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      expect(drawn.some((d) => d.page === p && d.text.includes(`Página ${p} de ${total}`))).toBe(true);
    }
    expect(drawn.some((d) => d.text.includes('Scrum Poker · Portal Tech V&D · Refinamento Phoenix'))).toBe(true);
    expect(drawn.some((d) => d.text.includes('Gerado em'))).toBe(true);
  });

  it('nenhum texto abaixo de 8 pt', () => {
    const { drawn } = make(bigSession(), { includeResults: true });
    drawn.forEach((d) => expect(d.size).toBeGreaterThanOrEqual(8));
  });

  it('sessão pequena cabe em poucas páginas', () => {
    const { doc } = make(smallSession(), { includeResults: true });
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(3);
  });

  it('texto fora de Latin-1 é limpo e acentos ficam', () => {
    expect(pdfSafe('Ação — revisão \u{1F680} → ok')).toBe('Ação — revisão -> ok');
    expect(pdfSafe('a b\n c')).toBe('a b c');
  });

  it('nome do arquivo', () => {
    const r = buildSessionReport(bigSession());
    expect(reportPdfFileName(r)).toBe('relatorio-refinamento-phoenix-sprint-42-14-10-2026.pdf');
    expect(reportPdfFileName(r, { resultsOnly: true })).toMatch(/^resultados-/);
  });
});
