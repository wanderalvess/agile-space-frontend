import { formatEstimateCopy } from './poker-utils';
import {
  SITUATION_LABEL,
  formatHours,
  formatNumber,
  formatPercent,
  taskName,
  type ReportTask,
  type SessionReportData,
} from './poker-report';

/**
 * Textos do relatório final: Markdown, CSV, texto do TDN e o resumo curto para
 * colar em e-mail/chat. Todos saem do mesmo `SessionReportData` da tela e do PDF,
 * então os números sempre batem.
 */

const oneLine = (t: string | null | undefined) => (t ?? '').replace(/\r?\n/g, ' ').trim();
const mdCell = (t: string | null | undefined) => oneLine(t).replace(/\|/g, '\\|');

function metaLine(r: SessionReportData): string {
  const h = r.header;
  const parts = [
    h.facilitators.length > 0 ? `Facilitador: ${h.facilitators.join(', ')}` : null,
    `${h.participantsCount} ${h.participantsCount === 1 ? 'participante' : 'participantes'}${h.participantsByRole.length > 0 ? ` (${h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')})` : ''}`,
    h.durationMins !== null ? `Duração: ${h.durationLabel}${h.timeRange ? ` (${h.timeRange})` : ''}` : null,
    `Baralho: ${h.deckLabel}`,
  ];
  return parts.filter(Boolean).join(' | ');
}

/** "(DEV 52h / QA 24h)" com os totais por papel. */
export function roleTotalsText(r: SessionReportData): string {
  return formatEstimateCopy(r.kpis.roleTotals.map((t) => ({ role: t.role, value: String(t.hours) })), 'h');
}

/** "KEY Título (DEV 10h / QA 4h)" por tarefa estimada — o "Copiar estimativas" da tabela. */
export function buildEstimatesCopy(r: SessionReportData): string {
  return r.tasks
    .filter((t) => t.estimated)
    .map((t) => `${t.key ?? t.title}${t.copyText ? ` ${t.copyText}` : t.totalLabel !== '—' ? ` ${t.totalLabel}` : ''}`)
    .join('\n');
}

// ---------------------------------------------------------------- Resumo curto

/** Texto curto com totais e a lista de tarefas, para colar em e-mail ou chat. */
export function buildSummaryText(r: SessionReportData): string {
  const { header: h, kpis: k } = r;
  const lines: string[] = [];
  lines.push(`Refinamento: ${h.title}${h.team ? ` (${h.team})` : ''}`);
  lines.push([h.dateLabel, h.timeRange, h.durationMins !== null ? `duração ${h.durationLabel}` : null,
    h.facilitators.length > 0 ? `facilitador ${h.facilitators.join(', ')}` : null,
    `${h.participantsCount} ${h.participantsCount === 1 ? 'participante' : 'participantes'}`].filter(Boolean).join(' · '));
  lines.push('');
  const totalPart = k.total !== null ? ` · Total: ${k.totalLabel}${roleTotalsText(r) ? ` ${roleTotalsText(r)}` : ''}` : '';
  lines.push(`Estimadas: ${k.estimated} de ${k.agenda}${totalPart}`);
  const quality = [
    k.firstRoundPct !== null ? `Fechadas na 1ª rodada: ${formatPercent(k.firstRoundPct)}` : null,
    k.avgRounds !== null ? `Média de rodadas: ${formatNumber(k.avgRounds)}` : null,
    `Divergência crítica: ${k.divergent}`,
  ].filter(Boolean);
  lines.push(quality.join(' · '));
  const outside = [
    k.skipped > 0 && `${k.skipped} ${k.skipped === 1 ? 'pulada' : 'puladas'}`,
    k.parkedPending > 0 && `${k.parkedPending} ${k.parkedPending === 1 ? 'adiada' : 'adiadas'}`,
    k.cancelled > 0 && `${k.cancelled} ${k.cancelled === 1 ? 'cancelada' : 'canceladas'}`,
    k.untouched > 0 && `${k.untouched} ${k.untouched === 1 ? 'não abordada' : 'não abordadas'}`,
  ].filter(Boolean);
  if (outside.length > 0) lines.push(`Fora da estimativa: ${outside.join(', ')}`);

  const estimated = r.tasks.filter((t) => t.estimated);
  if (estimated.length > 0) {
    lines.push('');
    lines.push('Tarefas estimadas:');
    estimated.forEach((t) => {
      const value = t.copyText ? `${t.copyText} = ${t.totalLabel}` : t.totalLabel;
      lines.push(`- ${taskName(t)}: ${value}${t.situation === 'divergencia' ? ' [divergência]' : ''}`);
    });
  }
  const open = r.tasks.filter((t) => !t.estimated && t.situation !== 'cancelada');
  if (open.length > 0) {
    lines.push('');
    lines.push('Sem estimativa:');
    open.forEach((t) => {
      const why = oneLine(t.reason ?? t.parkedNote);
      lines.push(`- ${taskName(t)}: ${SITUATION_LABEL[t.situation]}${why ? ` (${why})` : ''}`);
    });
  }
  return lines.join('\n');
}

// -------------------------------------------------------------------- Markdown

export function buildMarkdown(r: SessionReportData): string {
  const { header: h, kpis: k, breakdown: b } = r;
  const lines: string[] = [];
  lines.push(`# Relatório de Estimativas: ${h.title}`);
  lines.push(`**Data:** ${h.dateLabel} | **Squad:** ${h.team || 'N/A'}`);
  lines.push('');
  lines.push(metaLine(r));
  lines.push('');
  lines.push('## Resumo da sessão');
  lines.push('');
  lines.push(`- **Tarefas debatidas:** ${b.discussed} de ${b.total} na fila`);
  lines.push(`- **Estimadas:** ${b.estimated}`);
  lines.push(`- **Puladas:** ${b.skipped}`);
  lines.push(`- **Canceladas:** ${b.cancelled}`);
  lines.push(`- **Adiadas durante a sessão:** ${b.parked}`);
  lines.push(`- **Não abordadas:** ${b.untouched}`);
  if (r.activeMins > 0) {
    lines.push(`- **Tempo ativo de discussão:** ${r.activeMins} min${h.idleMins > 0 ? ` (${h.idleMins} min de intervalo fora da discussão não contabilizados)` : ''}`);
  }
  if (k.total !== null) lines.push(`- **Total estimado:** ${k.totalLabel}${roleTotalsText(r) ? ` ${roleTotalsText(r)}` : ''}`);
  if (k.firstRoundPct !== null) lines.push(`- **Fechadas na 1ª rodada:** ${formatPercent(k.firstRoundPct)} (${k.firstRoundClosed} de ${k.withRounds})`);
  if (k.avgRounds !== null) lines.push(`- **Média de rodadas por tarefa:** ${formatNumber(k.avgRounds)}`);
  lines.push(`- **Divergência crítica:** ${k.divergent}`);
  if (k.largest) lines.push(`- **Maior estimativa:** ${taskName(k.largest.task)} (${k.largest.label})`);
  lines.push('');

  const est = r.tasks.filter((t) => t.estimated);
  if (est.length > 0) {
    const hasNotes = est.some((t) => t.decisionNote);
    const roleHeaders = r.roles.map((x) => ` ${x.label} `).join('|');
    lines.push('## Tarefas estimadas');
    lines.push('');
    lines.push(`| Tarefa | Estimativa Final |${roleHeaders ? `${roleHeaders}|` : ''} Link Jira |${hasNotes ? ' Nota de Decisão |' : ''} Rodadas | Situação |`);
    lines.push(`|---|---|${r.roles.map(() => '---|').join('')}---|${hasNotes ? '---|' : ''}---|---|`);
    est.forEach((t) => {
      const link = t.jiraLink ? `[Ver no Jira](${t.jiraLink})` : '-';
      const roleCells = r.roles.length > 0 ? `${r.roles.map((x) => ` ${formatHours(t.roles[x.role] ?? 0)} `).join('|')}|` : '';
      const note = hasNotes ? ` ${mdCell(t.decisionNote) || '-'} |` : '';
      lines.push(`| ${mdCell(taskName(t))} | ${t.totalLabel} |${roleCells} ${link} |${note} ${t.rounds || '-'} | ${SITUATION_LABEL[t.situation]} |`);
    });
    const totalRoleCells = r.roles.length > 0 ? `${r.roles.map((x) => ` **${formatHours(r.totals.roles[x.role] ?? 0)}** `).join('|')}|` : '';
    lines.push(`| **Total** | **${k.totalLabel}** |${totalRoleCells} |${hasNotes ? ' |' : ''} | |`);
    lines.push('');
  }

  const hl = r.highlights;
  const hasHighlights = hl.largest.length + hl.mostDiscussed.length + hl.divergent.length + hl.pending.length > 0;
  if (hasHighlights) {
    lines.push('## Destaques para a gestão');
    lines.push('');
    if (hl.largest.length > 0) {
      lines.push('**Maiores estimativas**');
      hl.largest.forEach((t) => lines.push(`- ${taskName(t)}: ${t.totalLabel}${t.copyText ? ` ${t.copyText}` : ''}`));
      lines.push('');
    }
    if (hl.mostDiscussed.length > 0) {
      lines.push('**Mais discutidas**');
      hl.mostDiscussed.forEach((t) => lines.push(`- ${taskName(t)}: ${t.rounds} rodadas`));
      lines.push('');
    }
    if (hl.divergent.length > 0) {
      lines.push('**Com divergência**');
      hl.divergent.forEach((t) => lines.push(`- ${taskName(t)}: ${t.divergence?.text ?? 'divergência crítica'}`));
      lines.push('');
    }
    if (hl.pending.length > 0) {
      lines.push('**Pendências (sem estimativa)**');
      hl.pending.forEach((t) => {
        const why = oneLine(t.reason ?? t.parkedNote);
        lines.push(`- ${taskName(t)}: ${SITUATION_LABEL[t.situation]}${why ? ` — ${why}` : ''}${t.assignee ? ` (Jira: ${t.assignee})` : ''}`);
      });
      lines.push('');
    }
  }

  if (hl.withNotes.length > 0) {
    lines.push('## Notas de refinamento');
    lines.push('');
    hl.withNotes.forEach((t) => {
      lines.push(`**${taskName(t)}**`);
      if (t.devNotes) lines.push(`- DEV: ${oneLine(t.devNotes)}`);
      if (t.qaNotes) lines.push(`- QA: ${oneLine(t.qaNotes)}`);
      lines.push('');
    });
  }

  const skipped = r.tasks.filter((t) => t.situation === 'pulada');
  if (skipped.length > 0) {
    lines.push('## Tarefas puladas (não estimadas)');
    lines.push('');
    lines.push('| Tarefa | Motivo |');
    lines.push('|---|---|');
    skipped.forEach((t) => lines.push(`| ${mdCell(taskName(t))} | ${mdCell(t.reason) || '-'} |`));
    lines.push('');
  }
  const cancelled = r.tasks.filter((t) => t.situation === 'cancelada');
  if (cancelled.length > 0) {
    lines.push('## Tarefas canceladas no refinamento');
    lines.push('');
    lines.push('| Tarefa | Motivo |');
    lines.push('|---|---|');
    cancelled.forEach((t) => lines.push(`| ${mdCell(taskName(t))} | ${mdCell(t.reason) || '-'} |`));
    lines.push('');
  }
  const parked = r.tasks.filter((t) => t.parkCount > 0);
  if (parked.length > 0) {
    lines.push('## Tarefas adiadas durante a sessão');
    lines.push('');
    lines.push('| Tarefa | Vezes adiada | Desfecho | Motivo |');
    lines.push('|---|---|---|---|');
    parked.forEach((t) => lines.push(`| ${mdCell(taskName(t))} | ${t.parkCount || 1} | ${t.parkOutcome ?? '-'} | ${mdCell(t.parkedNote) || '-'} |`));
    lines.push('');
  }
  const untouched = r.tasks.filter((t) => t.situation === 'nao_abordada' || t.situation === 'adiada');
  if (untouched.length > 0) {
    lines.push('## Tarefas não abordadas');
    lines.push('');
    untouched.forEach((t) => lines.push(`- ${taskName(t)}`));
    lines.push('');
  }

  if (r.topicTiming.length > 0) {
    lines.push('## Tempo por tópico');
    lines.push('');
    lines.push('| Tópico | Tempo | Situação |');
    lines.push('|---|---|---|');
    r.topicTiming.forEach((x) => lines.push(`| ${mdCell(x.title)} | ${x.mins} min | ${x.skipped ? 'pulado' : x.discussed ? 'debatido' : '-'} |`));
    lines.push(`| **Tempo ativo** | **${r.activeMins} min** | |`);
    lines.push('');
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------------- CSV

/** Célula entre aspas; a que começa com = + - @ vira fórmula no Excel/Sheets, então ganha apóstrofo. */
export function csvCell(v: string | number | null | undefined): string {
  let text = String(v ?? '');
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const legacySituation = (t: ReportTask) =>
  t.situation === 'cancelada' ? 'Cancelada' : t.situation === 'pulada' ? 'Pulada' : t.estimated ? 'Estimada' : 'Não abordada';

export function buildCsv(r: SessionReportData): string {
  const { header: h, kpis: k, breakdown: b } = r;
  const rows: string[] = [];
  rows.push('Resumo,Valor');
  rows.push(`Tarefas na fila,${b.total}`);
  rows.push(`Debatidas,${b.discussed}`);
  rows.push(`Estimadas,${b.estimated}`);
  rows.push(`Puladas,${b.skipped}`);
  rows.push(`Canceladas,${b.cancelled}`);
  rows.push(`Adiadas,${b.parked}`);
  rows.push(`Não abordadas,${b.untouched}`);
  if (r.activeMins > 0) {
    rows.push(`Tempo ativo (min),${r.activeMins}`);
    rows.push(`Intervalo descartado (min),${h.idleMins}`);
  }
  rows.push(`${csvCell('Sessão')},${csvCell(h.title)}`);
  rows.push(`Squad,${csvCell(h.team ?? '')}`);
  rows.push(`Data,${h.dateLabel}`);
  rows.push(`Facilitador,${csvCell(h.facilitators.join(', '))}`);
  rows.push(`${csvCell('Participantes')},${h.participantsCount}`);
  rows.push(`Baralho,${csvCell(h.deckLabel)}`);
  if (k.total !== null) rows.push(`Total estimado,${csvCell(k.totalLabel)}`);
  r.kpis.roleTotals.forEach((t) => rows.push(`${csvCell(`Total ${t.label} (h)`)},${csvCell(formatNumber(t.hours))}`));
  if (k.firstRoundPct !== null) rows.push(`${csvCell('Fechadas na 1ª rodada (%)')},${Math.round(k.firstRoundPct)}`);
  if (k.avgRounds !== null) rows.push(`${csvCell('Média de rodadas')},${csvCell(formatNumber(k.avgRounds))}`);
  rows.push(`${csvCell('Divergência crítica')},${k.divergent}`);
  rows.push('');

  const roleHeaders = r.roles.map((x) => `${x.label} (h)`);
  rows.push(['Tarefa', 'Situação', 'Estimativa Final', ...roleHeaders, 'Vezes adiada', 'Observação', 'Link Jira', 'Chave', 'Rodadas', 'Situação detalhada', 'Notas DEV', 'Notas QA'].map(csvCell).join(','));
  r.tasks.forEach((t) => {
    const obs = t.situation === 'pulada' || t.situation === 'cancelada' ? t.reason ?? '' : t.decisionNote ?? t.parkedNote ?? '';
    rows.push([
      t.title,
      legacySituation(t),
      t.situation === 'pulada' || t.situation === 'cancelada' ? 'N/A' : t.estimated ? t.totalLabel : 'N/A',
      ...r.roles.map((x) => (t.roles[x.role] !== undefined ? formatNumber(t.roles[x.role]) : '0')),
      t.parkCount,
      oneLine(obs),
      t.jiraLink ?? '',
      t.key ?? '',
      t.rounds,
      SITUATION_LABEL[t.situation],
      oneLine(t.devNotes),
      oneLine(t.qaNotes),
    ].map(csvCell).join(','));
  });

  if (r.topicTiming.length > 0) {
    rows.push('');
    rows.push(['Tópico', 'Tempo (min)', 'Situação'].map(csvCell).join(','));
    r.topicTiming.forEach((x) => rows.push([x.title, x.mins, x.skipped ? 'pulado' : x.discussed ? 'debatido' : '-'].map(csvCell).join(',')));
    rows.push(['Tempo ativo', r.activeMins, ''].map(csvCell).join(','));
  }
  return rows.join('\n');
}

// ------------------------------------------------------------------------- TDN

/** Texto simples para colar na página do TDN (mesmo padrão do texto da retro). */
export function buildTdnText(r: SessionReportData): string {
  const { header: h, kpis: k } = r;
  const lines: string[] = [];
  lines.push(`Refinamento: ${h.title}`);
  lines.push('');
  lines.push(`Data: ${h.dateLabel}${h.timeRange ? ` (${h.timeRange})` : ''}`);
  if (h.team) lines.push(`Squad: ${h.team}`);
  if (h.facilitators.length > 0) lines.push(`Facilitador: ${h.facilitators.join(', ')}`);
  lines.push(`Participantes: ${h.participantsCount}${h.participantsByRole.length > 0 ? ` (${h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')})` : ''}`);
  if (h.durationMins !== null) lines.push(`Duração: ${h.durationLabel}`);
  lines.push('');
  lines.push('Resumo');
  lines.push(`- Estimadas: ${k.estimated} de ${k.agenda}`);
  if (k.total !== null) lines.push(`- Total estimado: ${k.totalLabel}${roleTotalsText(r) ? ` ${roleTotalsText(r)}` : ''}`);
  if (k.firstRoundPct !== null) lines.push(`- Fechadas na 1ª rodada: ${formatPercent(k.firstRoundPct)}`);
  if (k.avgRounds !== null) lines.push(`- Média de rodadas: ${formatNumber(k.avgRounds)}`);
  lines.push(`- Divergência crítica: ${k.divergent}`);
  lines.push('');

  const est = r.tasks.filter((t) => t.estimated);
  if (est.length > 0) {
    lines.push('Tarefas estimadas');
    est.forEach((t) => {
      const value = t.copyText ? `${t.copyText} = ${t.totalLabel}` : t.totalLabel;
      const note = oneLine(t.decisionNote);
      lines.push(`- ${taskName(t)}: ${value}${t.rounds > 1 ? ` — ${t.rounds} rodadas` : ''}${note ? ` — ${note}` : ''}${t.jiraLink ? ` (${t.jiraLink})` : ''}`);
    });
    lines.push('');
  }
  const section = (title: string, list: ReportTask[], why: (t: ReportTask) => string | null | undefined) => {
    if (list.length === 0) return;
    lines.push(title);
    list.forEach((t) => lines.push(`- ${taskName(t)}${why(t) ? `: ${oneLine(why(t))}` : ''}`));
    lines.push('');
  };
  section('Tarefas puladas (não estimadas)', r.tasks.filter((t) => t.situation === 'pulada'), (t) => t.reason);
  section('Tarefas canceladas', r.tasks.filter((t) => t.situation === 'cancelada'), (t) => t.reason);
  section('Tarefas adiadas', r.tasks.filter((t) => t.parkCount > 0), (t) => `adiada ${t.parkCount}x, ${t.parkOutcome ?? ''}${t.parkedNote ? ` — ${t.parkedNote}` : ''}`);
  section('Tarefas não abordadas', r.tasks.filter((t) => t.situation === 'nao_abordada' || t.situation === 'adiada'), () => null);
  if (r.highlights.withNotes.length > 0) {
    lines.push('Notas de refinamento');
    r.highlights.withNotes.forEach((t) => {
      lines.push(taskName(t));
      if (t.devNotes) lines.push(`- DEV: ${oneLine(t.devNotes)}`);
      if (t.qaNotes) lines.push(`- QA: ${oneLine(t.qaNotes)}`);
    });
    lines.push('');
  }
  return lines.join('\n').trim();
}
