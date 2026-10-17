'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  SITUATION_LABEL,
  formatHours,
  formatNumber,
  type ReportTask,
  type SessionReportData,
  type TaskSituation,
} from '@/lib/poker-report';
import { roleTotalsText } from '@/lib/poker-report-export';
import { SEGMENT_COLOR, buildReportKpiItems, buildResultsPage, roleBarColor } from '@/lib/poker-report-results';
import { buildReportPrintCss } from './reportPrintCss';
import { safeHref, taskNoteLines } from './shared';

/**
 * Documento impresso do relatório. É um layout próprio (não a tela) porque a
 * impressão precisa ser sempre clara, A4 paisagem, sem cores de tema, com tabela
 * que não corta linha e cabeçalho que se repete. Fica fora da árvore da sala, como
 * filho direto do <body>; o CSS de impressão esconde todo o resto. Na tela fica
 * escondido (`display: none`).
 */

export interface ReportPrintMode {
  /** Página de resultados como primeira folha. */
  includeResults: boolean;
  /** Só a página de resultados. */
  resultsOnly: boolean;
}

export const DEFAULT_PRINT_MODE: ReportPrintMode = { includeResults: true, resultsOnly: false };

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

function stamp(now: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now);
}

/** Cabeçalho do documento: identificação da sessão e metadados. */
function DocHead({ title, h, agenda, durationLabel }: { title: string; h: SessionReportData['header']; agenda: number; durationLabel: string }) {
  const when = `${h.dateLong.charAt(0).toUpperCase()}${h.dateLong.slice(1)}${h.timeRange ? ` · ${h.timeRange}` : ''}`;
  return (
    <header className="prd-head">
      <div className="prd-brand">Scrum Poker · Portal Tech V&amp;D</div>
      <div className="prd-titlerow">
        <h1>{title}</h1>
        <div className="prd-when">{when}</div>
      </div>
      <p className="prd-session">{h.title}{h.team && <span> · {h.team}</span>}</p>
      <dl className="prd-meta">
        <div><dt>Facilitador</dt><dd>{h.facilitators.length > 0 ? h.facilitators.join(', ') : '—'}</dd></div>
        <div><dt>Participantes</dt><dd>{h.participantsCount}{h.participantsByRole.length > 0 && ` · ${h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')}`}</dd></div>
        <div><dt>Duração ativa</dt><dd>{durationLabel}</dd></div>
        <div><dt>Baralho</dt><dd>{h.deckLabel}</dd></div>
        <div><dt>Tarefas na pauta</dt><dd>{agenda}</dd></div>
      </dl>
    </header>
  );
}

/** Página de resultados: uma folha A4 com os números-chave, gráficos simples e pendências. */
export function ReportResultsPrint({ report, now, last }: { report: SessionReportData; now: Date; last: boolean }) {
  const d = buildResultsPage(report);
  const total = d.situation.reduce((n, s) => n + s.count, 0);
  return (
    <section className={`prd-rs${last ? ' is-last' : ''}`} aria-label="Página de resultados">
      <DocHead title="Resultados da sessão" h={report.header} agenda={d.agenda} durationLabel={d.durationLabel ?? '—'} />

      <div className="prd-kpis">
        {d.kpis.slice(0, 6).map((k) => (
          <div key={k.id} className={`prd-kpi${k.main ? ' is-main' : ''}`}>
            <div className="prd-kpi-l">{k.label}</div>
            <div className={`prd-kpi-v${k.value.length > 7 ? ' is-long' : ''}${k.tone === 'danger' ? ' is-danger' : ''}`}>{k.value}{k.unit && <small> {k.unit}</small>}</div>
            {k.sub && <div className="prd-kpi-s">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="prd-rs-cols">
        <div>
          {d.roleBars.length > 0 && (
            <>
              <h2 className="prd-rs-h">Horas por papel</h2>
              <div className="prd-rs-bars">
                {d.roleBars.slice(0, 6).map((b) => (
                  <div key={b.key} className="prd-rs-bar">
                    <span>{b.label}</span>
                    <div className="prd-rs-bar-track"><div className="prd-rs-bar-fill" style={{ width: `${Math.max(1, b.ratio * 100)}%`, background: roleBarColor(b.key) }} /></div>
                    <span>{b.valueLabel} · {Math.round(b.share * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <h2 className="prd-rs-h">Situação das tarefas</h2>
          <div className="prd-rs-stack" role="img" aria-label={d.situation.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', ')}>
            {d.situation.map((s) => <div key={s.situation} style={{ flex: `${s.count} 0 0`, background: SEGMENT_COLOR[s.situation] }} />)}
          </div>
          <div className="prd-rs-legend">
            {d.situation.map((s) => (
              <div key={s.situation}><span className="sw" style={{ background: SEGMENT_COLOR[s.situation] }} /><b>{s.count}</b>{s.label} ({Math.round((s.count / Math.max(1, total)) * 100)}%)</div>
            ))}
          </div>
        </div>

        <div>
          {d.largest.length > 0 && (
            <>
              <h2 className="prd-rs-h">Maiores estimativas</h2>
              <ul className="prd-rs-list">
                {d.largest.map(({ task, detail }) => (
                  <li key={task.id}><span><span className="nm">{task.key && `${task.key} `}{task.title}</span>{detail && <span className="sub">{detail}</span>}</span><b>{task.totalLabel}</b></li>
                ))}
              </ul>
            </>
          )}
          <h2 className="prd-rs-h">Pendências sem estimativa{d.pending.length > 0 ? ` (${d.pending.length})` : ''}</h2>
          {d.pending.length === 0 ? (
            <p className="prd-rs-small">Nenhuma pendência: todas as tarefas da pauta foram tratadas.</p>
          ) : (
            <ul className="prd-rs-list">
              {d.pending.slice(0, 3).map(({ task, detail }) => (
                <li key={task.id}><span><span className="nm">{task.key && `${task.key} `}{task.title}</span>{detail && <span className="sub">{detail}</span>}</span><b>{SITUATION_LABEL[task.situation]}</b></li>
              ))}
            </ul>
          )}
          {d.pending.length > 3 && <p className="prd-rs-small">Outras pendências (+{d.pending.length - 3}). Veja o relatório completo.</p>}
          {d.cancelled > 0 && <p className="prd-rs-small">{d.cancelled} {d.cancelled === 1 ? 'tarefa cancelada' : 'tarefas canceladas'} no refinamento (fora da contagem de pendências).</p>}
        </div>
      </div>

      {d.omitted.length > 0 && (
        <p className="prd-rs-omit"><b>Não incluído nesta folha (dado não registrado na sessão):</b> {d.omitted.join(' ')}</p>
      )}
      <p className="prd-rs-gen">Scrum Poker · Portal Tech V&amp;D · gerado em {stamp(now)}</p>
    </section>
  );
}

function ReportBody({ report, now }: { report: SessionReportData; now: Date }) {
  const { header: h, kpis: k, totals, highlights: hl } = report;
  const isHours = h.deck === 'hours';
  const kpiItems = buildReportKpiItems(report);
  const colSpanRest = 3; // rodadas, situação, observações

  return (
    <>
      <DocHead title="Relatório do refinamento" h={h} agenda={k.agenda} durationLabel={h.durationLabel} />

      <section className="prd-kpis" aria-label="Resumo executivo">
        {kpiItems.map((i) => (
          <div key={i.label} className={`prd-kpi${i.main ? ' is-main' : ''}`}>
            <div className="prd-kpi-l">{i.label}</div>
            <div className="prd-kpi-v">{i.value}{i.unit && <small> {i.unit}</small>}</div>
            {i.sub && <div className="prd-kpi-s">{i.sub}</div>}
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
        <p>Gerado em {stamp(now)} pelo Portal Tech V&amp;D · Scrum Poker.</p>
      </footer>
    </>
  );
}

export function ReportPrintDocument({ report, now, mode = DEFAULT_PRINT_MODE }: { report: SessionReportData; now: Date; mode?: ReportPrintMode }) {
  return (
    <div className="prd-root" id="poker-report-print-root" lang="pt-BR">
      {(mode.includeResults || mode.resultsOnly) && <ReportResultsPrint report={report} now={now} last={mode.resultsOnly} />}
      {!mode.resultsOnly && <ReportBody report={report} now={now} />}
      <div className="prd-fixedfoot">Scrum Poker · Portal Tech V&amp;D · {report.header.title} · gerado em {stamp(now)}</div>
    </div>
  );
}

/**
 * Monta o CSS (sempre presente) e o documento como filhos diretos do <body>
 * (o CSS de impressão esconde o resto da página).
 */
export function ReportPrintPortal({ report, now, mode }: { report: SessionReportData; now: Date; mode?: ReportPrintMode }) {
  const css = React.useMemo(() => buildReportPrintCss(report.header.title), [report.header.title]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <style id="poker-report-print-css" dangerouslySetInnerHTML={{ __html: css }} />
      <ReportPrintDocument report={report} now={now} mode={mode} />
    </>,
    document.body
  );
}
