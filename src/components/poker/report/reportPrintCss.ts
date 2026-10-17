/**
 * CSS do documento impresso do relatório (A4 paisagem). É um bloco próprio,
 * sempre presente enquanto a tela do relatório está aberta: o `@page` precisa
 * existir ANTES de o navegador abrir a impressão para ele decidir o papel; se o
 * CSS só entrasse no `beforeprint`, alguns navegadores já teriam escolhido Carta.
 *
 * Tudo aqui usa cores fixas (nada de tokens do tema) e fundo branco.
 */

export const PRD_INK = '#0f172a';
export const PRD_MUTED = '#475569';
export const PRD_RULE = '#cbd5e1';
export const PRD_NAVY = '#002233';

/** Texto seguro para dentro de uma string CSS ("content: ..."). */
export function cssString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
}

export function buildReportPrintCss(footerTitle: string): string {
  const INK = PRD_INK;
  const MUTED = PRD_MUTED;
  const RULE = PRD_RULE;
  const NAVY = PRD_NAVY;
  const footerLeft = cssString(`Scrum Poker · Portal Tech V&D · ${footerTitle}`);
  return `
@page {
  size: A4 landscape;
  margin: 12mm 12mm 16mm 12mm;
  @bottom-left { content: "${footerLeft}"; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #475569; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #475569; }
}
.prd-root { display: none; }
@media print {
  html, body { background: #fff !important; color: ${INK} !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(.prd-root) { display: none !important; }
  body > .prd-root { display: block !important; }
  .prd-root, .prd-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
/* Firefox não desenha as caixas de margem do @page: rodapé fixo (sem número de página). */
.prd-fixedfoot { display: none; }
@supports (-moz-appearance: none) {
  @media print {
    .prd-fixedfoot { display: block; position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: ${MUTED}; border-top: 0.5pt solid ${RULE}; padding-top: 1mm; background: #fff; }
    .prd-root { padding-bottom: 8mm; }
  }
}

.prd-root { box-sizing: border-box; color: ${INK}; background: #fff; color-scheme: light; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; font-variant-numeric: tabular-nums; }
.prd-root *, .prd-root *::before, .prd-root *::after { box-sizing: border-box; }
:where(.prd-root) :where(h1, h2, h3, p, dl, dd, ul) { margin: 0; padding: 0; }
:where(.prd-root) ul { list-style: none; }
.prd-root a { color: inherit; text-decoration: none; }

.prd-head { border-top: 3pt solid #00DBFF; padding-top: 4mm; margin-bottom: 4mm; }
.prd-brand { font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${MUTED}; }
.prd-titlerow { display: flex; align-items: baseline; justify-content: space-between; gap: 8mm; margin-top: 1mm; }
.prd-titlerow h1 { font-size: 20pt; line-height: 1.1; font-weight: 700; color: ${NAVY}; }
.prd-when { font-size: 10pt; font-weight: 700; color: ${INK}; text-align: right; }
.prd-session { font-size: 11pt; font-weight: 700; margin-top: 1.5mm; }
.prd-session span { color: ${MUTED}; font-weight: 400; }
.prd-meta { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5mm; margin-top: 3.5mm; padding-top: 3mm; border-top: 0.75pt solid ${RULE}; }
.prd-meta dt { font-size: 8pt; color: ${MUTED}; }
.prd-meta dd { font-size: 9pt; font-weight: 700; }

.prd-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3mm; margin-bottom: 5mm; }
.prd-kpi { border: 0.75pt solid ${RULE}; border-radius: 1.5mm; padding: 2.2mm 2.8mm; break-inside: avoid; page-break-inside: avoid; }
.prd-kpi.is-main { border-color: ${NAVY}; border-width: 1.25pt; }
.prd-kpi-l { font-size: 8pt; color: ${MUTED}; }
.prd-kpi-v { font-size: 17pt; line-height: 1.1; font-weight: 700; color: ${NAVY}; margin-top: 0.8mm; }
.prd-kpi-v small { font-size: 8.5pt; font-weight: 700; color: ${MUTED}; white-space: nowrap; }
.prd-kpi-s { font-size: 8pt; line-height: 1.3; color: ${MUTED}; margin-top: 0.8mm; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.prd-h2 { font-size: 11pt; font-weight: 700; color: ${NAVY}; margin: 0 0 2mm; break-after: avoid; page-break-after: avoid; }
.prd-sec { margin-bottom: 5mm; }

.prd-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.prd-table thead { display: table-header-group; }
.prd-table tfoot { display: table-row-group; }
.prd-table tr { break-inside: avoid; page-break-inside: avoid; }
.prd-table th { text-align: left; font-size: 8pt; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.04em; padding: 1.6mm 1.8mm; border-bottom: 1.25pt solid ${NAVY}; background: #f8fafc; }
.prd-table td { padding: 1.7mm 1.8mm; border-bottom: 0.5pt solid ${RULE}; vertical-align: top; }
.prd-table .n { text-align: right; white-space: nowrap; width: 1%; }
.prd-table .c { text-align: center; white-space: nowrap; width: 1%; }
.prd-table .t { width: 36%; }
.prd-table .o { width: 32%; }
.prd-key { font-size: 8pt; font-weight: 700; color: ${MUTED}; display: block; }
.prd-title { font-weight: 700; }
.prd-title.is-cancelled { text-decoration: line-through; color: ${MUTED}; }
.prd-total { font-weight: 700; color: ${NAVY}; }
.prd-chip { display: inline-block; border-radius: 99px; padding: 0.4mm 2.2mm; font-size: 8pt; font-weight: 700; white-space: nowrap; }
.prd-note { display: block; }
.prd-note + .prd-note { margin-top: 0.8mm; }
.prd-note.is-div { color: #991b1b; font-weight: 700; }
.prd-note.is-muted { color: ${MUTED}; }
.prd-table tfoot td, .prd-table tfoot th { border-top: 1.5pt solid ${NAVY}; border-bottom: 0; font-weight: 700; background: #f8fafc; color: ${INK}; font-size: 9pt; text-transform: none; letter-spacing: 0; }
.prd-foot-note { font-size: 8pt; color: ${MUTED}; margin-top: 1.5mm; }

.prd-hl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
.prd-card { border: 0.75pt solid ${RULE}; border-radius: 1.5mm; padding: 2.5mm 3mm; break-inside: avoid; page-break-inside: avoid; }
.prd-card h3 { font-size: 9.5pt; font-weight: 700; color: ${NAVY}; margin-bottom: 1.5mm; }
.prd-card li { display: flex; justify-content: space-between; gap: 4mm; padding: 1mm 0; border-top: 0.5pt solid #e2e8f0; font-size: 9pt; }
.prd-card li:first-of-type { border-top: 0; }
.prd-card li b { font-weight: 700; white-space: nowrap; }
.prd-card li .sub { display: block; font-size: 8pt; color: ${MUTED}; font-weight: 400; }
.prd-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
.prd-notes .prd-card p { font-size: 9pt; margin-top: 0.8mm; }
.prd-notes .prd-card p b { color: ${NAVY}; }

.prd-timing { width: 55%; border-collapse: collapse; font-size: 9pt; }
.prd-timing tr { break-inside: avoid; page-break-inside: avoid; }
.prd-timing td { padding: 1mm 1.8mm; border-bottom: 0.5pt solid #e2e8f0; }
.prd-timing td:last-child { text-align: right; white-space: nowrap; font-weight: 700; }

.prd-end { margin-top: 4mm; padding-top: 2mm; border-top: 0.75pt solid ${RULE}; font-size: 8pt; color: ${MUTED}; break-inside: avoid; page-break-inside: avoid; }
.prd-end p + p { margin-top: 0.8mm; }

/* ---- Página de resultados (1 folha) ---- */
.prd-rs { height: 181mm; max-height: 181mm; overflow: hidden; break-after: page; page-break-after: always; break-inside: avoid; display: flex; flex-direction: column; }
.prd-rs.is-last { break-after: auto; page-break-after: auto; }
.prd-rs .prd-titlerow h1 { font-size: 22pt; }
.prd-rs .prd-session { margin-top: 2.5mm; }
.prd-rs .prd-head { margin-bottom: 0; }
.prd-rs .prd-meta { margin-top: 2.5mm; padding-top: 2mm; }
.prd-rs .prd-kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); margin: 3.5mm 0 4.5mm; }
.prd-rs .prd-kpi { height: 23.5mm; padding: 2.4mm 2.8mm; }
.prd-rs .prd-kpi-v { font-size: 19pt; }
.prd-rs .prd-kpi-v.is-long { font-size: 13pt; }
.prd-rs .prd-kpi-v.is-danger { color: #991b1b; }
.prd-rs-cols { display: grid; grid-template-columns: 158fr 106fr; gap: 9mm; flex: 1 1 auto; min-height: 0; }
.prd-rs-h { font-size: 11pt; font-weight: 700; color: ${NAVY}; margin-bottom: 1.8mm; }
.prd-rs-bars { display: flex; flex-direction: column; gap: 2.4mm; margin-bottom: 5mm; }
.prd-rs-bar { display: grid; grid-template-columns: 22mm 1fr 34mm; align-items: center; gap: 0 3mm; font-size: 9pt; font-weight: 700; }
.prd-rs-bar-track { height: 5.2mm; background: #eef2f6; }
.prd-rs-bar-fill { height: 100%; }
.prd-rs-stack { display: flex; height: 7mm; margin-bottom: 3.6mm; }
.prd-rs-legend { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.6mm 0; font-size: 9pt; }
.prd-rs-legend span.sw { display: inline-block; width: 3mm; height: 3mm; margin-right: 1.6mm; vertical-align: -0.4mm; }
.prd-rs-legend b { margin-right: 1.4mm; }
.prd-rs-list { margin-bottom: 4mm; }
.prd-rs-list li { display: flex; justify-content: space-between; gap: 4mm; padding: 1mm 0; border-top: 0.5pt solid #e2e8f0; font-size: 9pt; }
.prd-rs-list li:first-child { border-top: 0; }
.prd-rs-list li > b { white-space: nowrap; color: ${NAVY}; }
.prd-rs-list .nm { font-weight: 700; color: ${INK}; }
.prd-rs-list .sub { display: block; font-size: 8pt; color: ${MUTED}; font-weight: 400; }
.prd-rs-small { font-size: 8pt; color: ${MUTED}; }
.prd-rs-omit { margin-top: auto; padding-top: 2mm; border-top: 0.75pt solid ${RULE}; font-size: 8pt; color: ${MUTED}; }
.prd-rs-gen { margin-top: 2mm; font-size: 8pt; color: ${MUTED}; }
`;
}
