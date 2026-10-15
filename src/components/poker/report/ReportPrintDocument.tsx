'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  SITUATION_LABEL,
  formatHours,
  formatNumber,
  formatPercent,
  type ReportTask,
  type SessionReportData,
  type TaskSituation,
} from '@/lib/poker-report';
import { roleTotalsText } from '@/lib/poker-report-export';
import { safeHref, taskNoteLines } from './shared';

/**
 * Documento impresso/PDF do relatório. É um layout próprio (não a tela) porque a
 * impressão precisa ser sempre clara, A4 paisagem, sem cores de tema, com tabela
 * que não corta linha e cabeçalho que se repete. Fica fora da árvore da sala, como
 * filho direto do <body>, e o CSS de impressão esconde todo o resto.
 */

const INK = '#0f172a';
const MUTED = '#475569';
const RULE = '#cbd5e1';
const NAVY = '#002233';

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

/** Texto seguro para dentro de uma string CSS ("content: ..."). */
function cssString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
}

function buildCss(report: SessionReportData): string {
  const footerLeft = cssString(`Scrum Poker · Portal Tech V&D · ${report.header.title}`);
  return `
@page {
  size: A4 landscape;
  margin: 12mm 12mm 16mm 12mm;
  @bottom-left { content: "${footerLeft}"; font: 8pt sans-serif; color: #64748b; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt sans-serif; color: #64748b; }
}
.prd-root { display: none; }
@media print {
  html, body { background: #fff !important; color: ${INK} !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(.prd-root) { display: none !important; }
  body > .prd-root { display: block !important; }
  .prd-root, .prd-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.prd-root { box-sizing: border-box; color: ${INK}; background: #fff; color-scheme: light; font-size: 9pt; line-height: 1.35; font-variant-numeric: tabular-nums; }
.prd-root *, .prd-root *::before, .prd-root *::after { box-sizing: border-box; }
.prd-root h1, .prd-root h2, .prd-root h3, .prd-root p, .prd-root dl, .prd-root dd, .prd-root ul { margin: 0; padding: 0; }
.prd-root ul { list-style: none; }
.prd-root a { color: inherit; text-decoration: none; }

.prd-head { border-top: 3pt solid #00DBFF; padding-top: 4mm; margin-bottom: 4mm; }
.prd-brand { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${MUTED}; }
.prd-titlerow { display: flex; align-items: baseline; justify-content: space-between; gap: 8mm; margin-top: 1mm; }
.prd-titlerow h1 { font-size: 20pt; line-height: 1.1; font-weight: 700; color: ${NAVY}; }
.prd-when { font-size: 10pt; font-weight: 600; color: ${INK}; text-align: right; }
.prd-session { font-size: 11pt; font-weight: 600; margin-top: 1.5mm; }
.prd-session span { color: ${MUTED}; font-weight: 500; }
.prd-meta { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; margin-top: 3.5mm; padding-top: 3mm; border-top: 0.75pt solid ${RULE}; }
.prd-meta dt { font-size: 7.5pt; color: ${MUTED}; }
.prd-meta dd { font-size: 9pt; font-weight: 600; }

.prd-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 2.5mm; margin-bottom: 5mm; }
.prd-kpi { border: 0.75pt solid ${RULE}; border-radius: 1.5mm; padding: 2.2mm 2.8mm; break-inside: avoid; }
.prd-kpi.is-main { border-color: ${NAVY}; border-width: 1.25pt; }
.prd-kpi-l { font-size: 7.5pt; color: ${MUTED}; }
.prd-kpi-v { font-size: 17pt; line-height: 1.1; font-weight: 700; color: ${NAVY}; margin-top: 0.8mm; }
.prd-kpi-v small { font-size: 8.5pt; font-weight: 600; color: ${MUTED}; white-space: nowrap; }
.prd-kpi-s { font-size: 7.5pt; line-height: 1.3; color: ${MUTED}; margin-top: 0.8mm; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.prd-h2 { font-size: 11pt; font-weight: 700; color: ${NAVY}; margin: 0 0 2mm; break-after: avoid; }
.prd-sec { margin-bottom: 5mm; }

.prd-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.prd-table thead { display: table-header-group; }
.prd-table tfoot { display: table-row-group; }
.prd-table tr { break-inside: avoid; page-break-inside: avoid; }
.prd-table th { text-align: left; font-size: 7.5pt; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.04em; padding: 1.6mm 1.8mm; border-bottom: 1.25pt solid ${NAVY}; background: #f8fafc; }
.prd-table td { padding: 1.7mm 1.8mm; border-bottom: 0.5pt solid ${RULE}; vertical-align: top; }
.prd-table .n { text-align: right; white-space: nowrap; width: 1%; }
.prd-table .c { text-align: center; white-space: nowrap; width: 1%; }
.prd-table .t { width: 36%; }
.prd-table .o { width: 32%; }
.prd-key { font-size: 7.5pt; font-weight: 700; color: ${MUTED}; display: block; }
.prd-title { font-weight: 600; }
.prd-title.is-cancelled { text-decoration: line-through; color: ${MUTED}; }
.prd-total { font-weight: 700; color: ${NAVY}; }
.prd-chip { display: inline-block; border-radius: 99px; padding: 0.4mm 2.2mm; font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
.prd-note { display: block; }
.prd-note + .prd-note { margin-top: 0.8mm; }
.prd-note.is-div { color: #991b1b; font-weight: 700; }
.prd-note.is-muted { color: ${MUTED}; }
.prd-table tfoot td, .prd-table tfoot th { border-top: 1.5pt solid ${NAVY}; border-bottom: 0; font-weight: 700; background: #f8fafc; color: ${INK}; font-size: 9pt; text-transform: none; letter-spacing: 0; }
.prd-foot-note { font-size: 7.5pt; color: ${MUTED}; margin-top: 1.5mm; }

.prd-hl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
.prd-card { border: 0.75pt solid ${RULE}; border-radius: 1.5mm; padding: 2.5mm 3mm; break-inside: avoid; page-break-inside: avoid; }
.prd-card h3 { font-size: 9pt; font-weight: 700; color: ${NAVY}; margin-bottom: 1.5mm; }
.prd-card li { display: flex; justify-content: space-between; gap: 4mm; padding: 1mm 0; border-top: 0.5pt solid #e2e8f0; font-size: 8.5pt; }
.prd-card li:first-of-type { border-top: 0; }
.prd-card li b { font-weight: 700; white-space: nowrap; }
.prd-card li .sub { display: block; font-size: 7.5pt; color: ${MUTED}; }
.prd-notes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
.prd-notes .prd-card p { font-size: 8.5pt; margin-top: 0.8mm; }
.prd-notes .prd-card p b { color: ${NAVY}; }

.prd-timing { width: 60%; border-collapse: collapse; font-size: 8.5pt; }
.prd-timing tr { break-inside: avoid; }
.prd-timing td { padding: 1mm 1.8mm; border-bottom: 0.5pt solid #e2e8f0; }
.prd-timing td:last-child { text-align: right; white-space: nowrap; font-weight: 700; }

.prd-end { margin-top: 4mm; padding-top: 2mm; border-top: 0.75pt solid ${RULE}; font-size: 7.5pt; color: ${MUTED}; break-inside: avoid; }
`;
}

function Chip({ situation }: { situation: TaskSituation }) {
  const c = CHIP[situation];
  return <span className="prd-chip" style={{ background: c.bg, color: c.fg }}>{SITUATION_LABEL[situation]}</span>;
}

function TaskCell({ t }: { t: ReportTask }) {
  const href = safeHref(t.jiraLink);
  return (
    <>
      {t.key && (href ? <a className="prd-key" href={href}>{t.key}</a> : <span className="prd-key">{t.key}</span>)}
      <span className={`prd-title${t.situation === 'cancelada' ? ' is-cancelled' : ''}`}>{t.title}</span>
    </>
  );
}

function NoteCell({ t }: { t: ReportTask }) {
  const lines = taskNoteLines(t);
  if (lines.length === 0) return <span className="prd-note is-muted">—</span>;
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} className={`prd-note${l.kind === 'divergence' ? ' is-div' : l.kind === 'decision' ? '' : ' is-muted'}`}>{l.text}</span>
      ))}
    </>
  );
}

export function ReportPrintDocument({ report, now }: { report: SessionReportData; now: Date }) {
  const { header: h, kpis: k, totals, highlights: hl } = report;
  const isHours = h.deck === 'hours';
  const generated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now);

  const kpiItems: Array<{ l: string; v: string; u?: string; s?: string; main?: boolean }> = [
    { l: 'Tarefas estimadas', v: String(k.estimated), u: `de ${k.agenda}`, s: `${k.discussed} ${k.discussed === 1 ? 'debatida' : 'debatidas'}` },
  ];
  if (k.total !== null) kpiItems.push({ l: isHours ? 'Total de horas' : h.deck === 'fibonacci' ? 'Total de pontos' : 'Total estimado', v: formatNumber(k.total), u: isHours || h.deck === 'tshirt' ? 'h' : 'SP', s: 'Esforço estimado', main: true });
  else if (k.distribution.length > 0) kpiItems.push({ l: 'Tamanhos estimados', v: k.distribution.map((d) => `${d.count}×${d.label}`).join(' '), s: 'Quantidade por tamanho', main: true });
  k.roleTotals.forEach((t) => kpiItems.push({ l: `Esforço ${t.label}`, v: formatNumber(t.hours), u: 'h', s: `${t.tasks} ${t.tasks === 1 ? 'tarefa' : 'tarefas'}` }));
  kpiItems.push({ l: 'Fechadas na 1ª rodada', v: k.firstRoundPct !== null ? formatPercent(k.firstRoundPct) : '—', s: k.withRounds > 0 ? `${k.firstRoundClosed} de ${k.withRounds} estimadas` : undefined });
  kpiItems.push({ l: 'Média de rodadas', v: k.avgRounds !== null ? formatNumber(k.avgRounds) : '—', u: k.avgRounds !== null ? 'por tarefa' : undefined, s: k.revoted > 0 ? `${k.revoted} revotada${k.revoted === 1 ? '' : 's'}` : 'Nenhuma revotação' });
  kpiItems.push({ l: 'Divergência crítica', v: String(k.divergent), s: k.divergent > 0 ? 'Estimadas com votos distantes' : 'Nenhuma tarefa' });
  kpiItems.push({
    l: 'Fora da estimativa', v: String(k.outside),
    s: [k.skipped && `${k.skipped} pulada${k.skipped === 1 ? '' : 's'}`, k.parkedPending && `${k.parkedPending} adiada${k.parkedPending === 1 ? '' : 's'}`, k.cancelled && `${k.cancelled} cancelada${k.cancelled === 1 ? '' : 's'}`, k.untouched && `${k.untouched} não abordada${k.untouched === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || 'Todas estimadas',
  });
  if (k.largest) kpiItems.push({ l: 'Maior estimativa', v: k.largest.label, s: `${k.largest.task.key ? `${k.largest.task.key} · ` : ''}${k.largest.task.title}` });
  kpiItems.push({ l: 'Tempo gasto', v: h.durationLabel, s: k.avgMinsPerTopic !== null ? `${formatNumber(k.avgMinsPerTopic)} min por tarefa debatida` : undefined });

  const colSpanRest = 3; // rodadas, situação, observações
  return (
    <div className="prd-root" id="poker-report-print-root" lang="pt-BR">
      <style dangerouslySetInnerHTML={{ __html: buildCss(report) }} />

      <header className="prd-head">
        <div className="prd-brand">Scrum Poker · Portal Tech V&amp;D</div>
        <div className="prd-titlerow">
          <h1>Relatório do refinamento</h1>
          <div className="prd-when">{h.dateLong.charAt(0).toUpperCase() + h.dateLong.slice(1)}{h.timeRange ? ` · ${h.timeRange}` : ''}</div>
        </div>
        <p className="prd-session">{h.title}{h.team && <span> · {h.team}</span>}</p>
        <dl className="prd-meta">
          <div><dt>Facilitador</dt><dd>{h.facilitators.length > 0 ? h.facilitators.join(', ') : '—'}</dd></div>
          <div><dt>Participantes</dt><dd>{h.participantsCount}{h.participantsByRole.length > 0 && ` · ${h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')}`}</dd></div>
          <div><dt>Duração ativa</dt><dd>{h.durationLabel}</dd></div>
          <div><dt>Baralho</dt><dd>{h.deckLabel}</dd></div>
          <div><dt>Tarefas na pauta</dt><dd>{k.agenda}</dd></div>
        </dl>
      </header>

      <section className="prd-kpis" aria-label="Resumo executivo">
        {kpiItems.map((i) => (
          <div key={i.l} className={`prd-kpi${i.main ? ' is-main' : ''}`}>
            <div className="prd-kpi-l">{i.l}</div>
            <div className="prd-kpi-v">{i.v}{i.u && <small> {i.u}</small>}</div>
            {i.s && <div className="prd-kpi-s">{i.s}</div>}
          </div>
        ))}
      </section>

      <section className="prd-sec">
        <h2 className="prd-h2">Tarefas da sessão</h2>
        <table className="prd-table">
          <thead>
            <tr>
              <th className="t">Tarefa</th>
              {report.roles.map((r) => <th key={r.role} className="n">{r.label}</th>)}
              <th className="n">Total</th>
              <th className="c">Rodadas</th>
              <th className="c">Situação</th>
              <th className="o">Decisão e observações</th>
            </tr>
          </thead>
          <tbody>
            {report.tasks.map((t) => (
              <tr key={t.id}>
                <td className="t"><TaskCell t={t} /></td>
                {report.roles.map((r) => <td key={r.role} className="n">{t.roles[r.role] !== undefined ? formatHours(t.roles[r.role]) : '—'}</td>)}
                <td className="n prd-total">{t.totalLabel}</td>
                <td className="c">{t.rounds > 0 ? t.rounds : '—'}</td>
                <td className="c"><Chip situation={t.situation} /></td>
                <td className="o"><NoteCell t={t} /></td>
              </tr>
            ))}
          </tbody>
          {k.estimated > 0 && (
            <tfoot>
              <tr>
                <th className="t">Total da sessão · {k.estimated} {k.estimated === 1 ? 'estimada' : 'estimadas'}</th>
                {report.roles.map((r) => <td key={r.role} className="n">{formatHours(totals.roles[r.role] ?? 0)}</td>)}
                <td className="n prd-total">{k.totalLabel}</td>
                <td className="c">{report.tasks.reduce((s, t) => s + t.rounds, 0)}</td>
                <td colSpan={colSpanRest - 1} />
              </tr>
            </tfoot>
          )}
        </table>
        {totals.rolesDiffer && (
          <p className="prd-foot-note">A soma dos papéis ({formatNumber(Object.values(totals.roles).reduce((a, b) => a + b, 0))}h) difere do total por ajuste manual de estimativa.</p>
        )}
      </section>

      {(hl.largest.length + hl.mostDiscussed.length + hl.divergent.length + hl.pending.length > 0) && (
        <section className="prd-sec">
          <h2 className="prd-h2">Destaques para a gestão</h2>
          <div className="prd-hl">
            {hl.largest.length > 0 && (
              <div className="prd-card">
                <h3>Maiores estimativas</h3>
                <ul>{hl.largest.map((t) => <li key={t.id}><span>{t.key && <b>{t.key} </b>}{t.title}{t.copyText && <span className="sub">{t.copyText}</span>}</span><b>{t.totalLabel}</b></li>)}</ul>
              </div>
            )}
            {hl.mostDiscussed.length > 0 && (
              <div className="prd-card">
                <h3>Mais discutidas</h3>
                <ul>{hl.mostDiscussed.map((t) => <li key={t.id}><span>{t.key && <b>{t.key} </b>}{t.title}<span className="sub">Estimada em {t.totalLabel}</span></span><b>{t.rounds} rodadas</b></li>)}</ul>
              </div>
            )}
            {hl.divergent.length > 0 && (
              <div className="prd-card">
                <h3>Com divergência ({hl.divergent.length})</h3>
                <ul>{hl.divergent.map((t) => <li key={t.id}><span>{t.key && <b>{t.key} </b>}{t.title}<span className="sub">{t.divergence?.text}</span></span><b>{t.totalLabel}</b></li>)}</ul>
              </div>
            )}
            {hl.pending.length > 0 && (
              <div className="prd-card">
                <h3>Pendências sem estimativa ({hl.pending.length})</h3>
                <ul>
                  {hl.pending.map((t) => (
                    <li key={t.id}>
                      <span>
                        {t.key && <b>{t.key} </b>}{t.title}
                        {(t.reason ?? t.parkedNote) && <span className="sub">{t.reason ?? t.parkedNote}</span>}
                        {t.assignee && <span className="sub">Responsável no Jira: {t.assignee}</span>}
                      </span>
                      <b>{SITUATION_LABEL[t.situation]}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {hl.withNotes.length > 0 && (
        <section className="prd-sec">
          <h2 className="prd-h2">Notas de refinamento</h2>
          <div className="prd-notes">
            {hl.withNotes.map((t) => (
              <div key={t.id} className="prd-card">
                <h3>{t.key && `${t.key} · `}{t.title}</h3>
                {t.devNotes && <p><b>DEV</b> {t.devNotes}</p>}
                {t.qaNotes && <p><b>QA</b> {t.qaNotes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {report.topicTiming.length > 0 && (
        <section className="prd-sec" style={{ breakInside: 'avoid' }}>
          <h2 className="prd-h2">Tempo por tópico</h2>
          <table className="prd-timing">
            <tbody>
              {report.topicTiming.map((x, i) => (
                <tr key={i}><td>{x.title}{x.skipped && ' (pulado)'}</td><td>{x.mins} min</td></tr>
              ))}
              <tr><td><b>Tempo ativo</b></td><td>{report.activeMins} min</td></tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="prd-end">
        <p>
          Fechadas na 1ª rodada: tarefas estimadas em uma única rodada, sem divergência crítica. Divergência crítica: diferença entre votos do mesmo papel acima de {formatNumber(report.criteria.divergenceHigh)}{isHours ? 'h' : ''} (nos demais baralhos, qualquer voto diferente no papel).
          {k.total !== null && roleTotalsText(report) && ` Totais por papel: ${roleTotalsText(report)}.`}
        </p>
        <p>Gerado em {generated} pelo Portal Tech V&amp;D · Scrum Poker.</p>
      </footer>
    </div>
  );
}

/** Monta o documento como filho direto do <body> (o CSS de impressão esconde o resto da página). */
export function ReportPrintPortal({ report, now }: { report: SessionReportData; now?: Date }) {
  const stamp = React.useMemo(() => now ?? new Date(), [now]);
  if (typeof document === 'undefined') return null;
  return createPortal(<ReportPrintDocument report={report} now={stamp} />, document.body);
}
