import { describe, it, expect } from 'vitest';
import type { Issue, Participant, Vote, VotingRound } from '../types';
import {
  buildSessionReport,
  countBySituation,
  criticalDivergence,
  formatDurationMins,
  formatEstimateLabel,
  formatHours,
  formatNumber,
  formatPercent,
  parseNum,
  sortTasks,
  summarizeParticipants,
  type SessionReportData,
} from '../poker-report';
import { buildCsv, buildEstimatesCopy, buildMarkdown, buildSummaryText, buildTdnText, csvCell } from '../poker-report-export';

const TZ = 'America/Sao_Paulo';
const P = (id: string, role: Participant['role'], globalRole: string, extra: Partial<Participant> = {}): Participant =>
  ({ id, nickname: id, roomId: 'r', isFacilitator: false, role, globalRole, ...extra } as Participant);
const people: Participant[] = [
  P('d1', 'dev', 'Developer'), P('d2', 'dev', 'Developer'), P('q1', 'qa', 'QA'), P('u1', 'dev', 'UX'),
  P('sm', 'organizador', 'Scrum Master', { nickname: 'Gabriela Nunes', isFacilitator: true }),
  P('obs', 'spectator', 'Stakeholder / Observador'),
];

const V = (participantId: string, value: string, at: string): Vote => ({ id: `${participantId}-${at}`, participantId, roomId: 'r', value, timestamp: at } as Vote);
const R = (issueId: string, at: string, votes: Array<[string, string]>): VotingRound => ({
  id: `${issueId}-${at}`, roomId: 'r', topic: issueId, issueId, deckType: 'hours', timestamp: at,
  votes: votes.map(([p, v]) => V(p, v, at)), stats: { avg: '0', min: '0', max: '0', consensus: false },
} as VotingRound);

const I = (id: string, extra: Partial<Issue>): Issue => ({ id, key: `PTV-${id}`, title: `Tarefa ${id}`, status: 'pending', estimatedPoints: null, ...extra } as Issue);

const issues: Issue[] = [
  I('1', { title: 'Login', status: 'completed', estimatedPoints: '11', rolePoints: { Developer: '8', QA: '3' }, decisionNote: 'Reaproveita o SSO.', jiraLink: 'https://jira/PTV-1' }),
  I('2', { title: 'Pagamento', status: 'completed', estimatedPoints: '16', rolePoints: { Developer: '10', QA: '4', UX: '2' }, devNotes: 'Usar o gateway novo.', qaNotes: 'Cobrir estorno.' }),
  I('3', { title: 'Relatório', status: 'completed', estimatedPoints: '16', rolePoints: { Developer: '12', QA: '4' } }),
  I('4', { title: 'Timer', status: 'completed', skipped: true, note: 'Falta definição de UX' }),
  I('5', { title: 'Atalhos', status: 'pending', cancelled: true, note: 'Duplicada com PTV-1188' }),
  I('6', { title: 'Modo anônimo', status: 'pending', parkCount: 2, parked: true, parkedNote: 'Aguardando o PO', jiraAssignee: 'Carlos' }),
  I('7', { title: 'E-mail =resumo' }),
  I('8', { title: 'Régua', status: 'completed', estimatedPoints: '4', rolePoints: { Developer: '4' }, parkCount: 1 }),
];

const rounds: VotingRound[] = [
  R('1', '2026-10-14T13:40:00Z', [['d1', '8'], ['d2', '8'], ['q1', '3']]),
  R('2', '2026-10-14T13:50:00Z', [['d1', '4'], ['d2', '16'], ['q1', '4'], ['u1', '2']]),
  R('2', '2026-10-14T13:58:00Z', [['d1', '10'], ['d2', '10'], ['q1', '4'], ['u1', '2']]),
  R('3', '2026-10-14T14:10:00Z', [['d1', '6'], ['d2', '18'], ['q1', '4']]),
  R('8', '2026-10-14T14:20:00Z', [['d1', '4'], ['d2', '4']]),
];

const build = (over: Partial<Parameters<typeof buildSessionReport>[0]> = {}) =>
  buildSessionReport({
    roomTitle: 'Refinamento Phoenix', roomTeam: 'Squad Phoenix', deck: 'hours', issues, participants: people, rounds,
    sessionStartedAt: '2026-10-14T13:30:00Z', sessionEndedAt: '2026-10-14T15:12:00Z', perTopicTime: true, timeZone: TZ, ...over,
  });

describe('formatação pt-BR', () => {
  it('números, horas, percentuais e durações', () => {
    expect(formatNumber(7.5)).toBe('7,5');
    expect(formatNumber(1234.56)).toBe('1.234,6');
    expect(formatNumber(12)).toBe('12');
    expect(formatHours(7.5)).toBe('7,5h');
    expect(formatPercent(66.6667)).toBe('67%');
    expect(formatDurationMins(58)).toBe('58 min');
    expect(formatDurationMins(72)).toBe('1h12');
    expect(formatDurationMins(125)).toBe('2h05');
    expect(formatDurationMins(120)).toBe('2h');
    expect(parseNum('7,5')).toBe(7.5);
    expect(parseNum('7.5')).toBe(7.5);
    expect(parseNum('M')).toBeNull();
    expect(parseNum('')).toBeNull();
    expect(parseNum(null)).toBeNull();
  });

  it('rótulo da estimativa por baralho', () => {
    expect(formatEstimateLabel('14', 'hours')).toBe('14h');
    expect(formatEstimateLabel('7.5', 'hours')).toBe('7,5h');
    expect(formatEstimateLabel('5', 'fibonacci')).toBe('5 SP');
    expect(formatEstimateLabel('M', 'tshirt')).toBe('M');
    expect(formatEstimateLabel('16', 'tshirt')).toBe('16h');
    expect(formatEstimateLabel(null, 'hours')).toBe('—');
    expect(formatEstimateLabel('N/A', 'hours')).toBe('—');
  });
});

describe('buildSessionReport · números', () => {
  const r = build();

  it('totais por papel e total geral', () => {
    expect(r.kpis.total).toBe(47);
    expect(r.kpis.totalLabel).toBe('47h');
    expect(r.kpis.roleTotals.map((t) => [t.label, t.hours, t.tasks])).toEqual([['DEV', 34, 4], ['QA', 11, 3], ['UX', 2, 1]]);
    expect(r.roles.map((x) => x.label)).toEqual(['DEV', 'QA', 'UX']);
    expect(r.totals.roles).toEqual({ Developer: 34, QA: 11, UX: 2 });
    expect(r.totals.rolesDiffer).toBe(false);
  });

  it('situação de cada tarefa', () => {
    expect(r.tasks.map((t) => t.situation)).toEqual(['consenso', 'revotada', 'divergencia', 'pulada', 'cancelada', 'adiada', 'nao_abordada', 'consenso']);
    expect(countBySituation(r.tasks)).toMatchObject({ consenso: 2, revotada: 1, divergencia: 1, pulada: 1, cancelada: 1, adiada: 1, nao_abordada: 1, estimada: 0 });
  });

  it('consenso na 1ª rodada, média de rodadas e divergência', () => {
    expect(r.kpis.withRounds).toBe(4);
    expect(r.kpis.firstRoundClosed).toBe(2);
    expect(r.kpis.firstRoundPct).toBe(50);
    expect(r.kpis.avgRounds).toBe(1.25);
    expect(r.kpis.revoted).toBe(1);
    expect(r.kpis.divergent).toBe(1);
    expect(r.tasks[2].divergence?.text).toBe('Divergência crítica no DEV · 6h a 18h');
    expect(r.tasks[1].divergence).toBeNull(); // a rodada final convergiu
  });

  it('fora da estimativa, maior estimativa e contagem de rodadas', () => {
    expect(r.kpis.agenda).toBe(8);
    expect(r.kpis.estimated).toBe(4);
    expect(r.kpis.outside).toBe(4);
    expect(r.kpis.skipped).toBe(1);
    expect(r.kpis.cancelled).toBe(1);
    expect(r.kpis.parkedPending).toBe(1);
    expect(r.kpis.untouched).toBe(1);
    expect(r.kpis.largest?.task.id).toBe('2');
    expect(r.kpis.largest?.label).toBe('16h');
    expect(r.tasks.map((t) => t.rounds)).toEqual([1, 2, 1, 0, 0, 0, 0, 1]);
  });

  it('batem com o resumo legado da sala (computeSessionBreakdown)', () => {
    expect(r.breakdown).toMatchObject({ total: 8, estimated: 4, discussed: 4, skipped: 1, cancelled: 1, parked: 2, untouched: 2 });
  });

  it('adiada e retomada mantém o histórico; adiada pendente traz o motivo', () => {
    expect(r.tasks[7].parkCount).toBe(1);
    expect(r.tasks[7].parkOutcome).toBe('retomada e estimada');
    expect(r.tasks[5].parkOutcome).toBe('ficou pendente');
    expect(r.tasks[5].parkedNote).toBe('Aguardando o PO');
    expect(r.tasks[5].assignee).toBe('Carlos');
  });

  it('texto "(DEV 10h / QA 4h / UX 2h)" idêntico ao do Copiar estimativa', () => {
    expect(r.tasks[1].copyText).toBe('(DEV 10h / QA 4h / UX 2h)');
    expect(r.tasks[0].copyText).toBe('(DEV 8h / QA 3h)');
    expect(r.tasks[3].copyText).toBe('');
  });

  it('destaques', () => {
    expect(r.highlights.largest.map((t) => t.id)).toEqual(['2', '3', '1']);
    expect(r.highlights.mostDiscussed.map((t) => t.id)).toEqual(['2']);
    expect(r.highlights.divergent.map((t) => t.id)).toEqual(['3']);
    expect(r.highlights.pending.map((t) => t.id)).toEqual(['4', '6', '7']);
    expect(r.highlights.cancelled.map((t) => t.id)).toEqual(['5']);
    expect(r.highlights.withNotes.map((t) => t.id)).toEqual(['2']);
  });

  it('cabeçalho: data, horário, duração ativa, facilitador e participantes', () => {
    expect(r.header.dateLabel).toBe('14/10/2026');
    expect(r.header.timeRange).toBe('10:30 às 12:12');
    expect(r.header.durationMins).toBe(50);
    expect(r.header.durationLabel).toBe('50 min');
    expect(r.header.facilitators).toEqual(['Gabriela Nunes']);
    expect(r.header.participantsCount).toBe(6);
    expect(r.header.participantsByRole).toEqual([
      { label: 'DEV', count: 2 }, { label: 'QA', count: 1 }, { label: 'UX', count: 1 }, { label: 'Gestão', count: 1 }, { label: 'Observadores', count: 1 },
    ]);
    expect(r.kpis.avgMinsPerTopic).toBe(12.5);
    expect(r.topicTiming).toHaveLength(4);
    expect(r.activeMins).toBe(50);
  });

  it('sem tempo por tópico quando a flag está desligada, mas a duração continua', () => {
    const off = build({ perTopicTime: false });
    expect(off.topicTiming).toEqual([]);
    expect(off.header.durationMins).toBe(50);
  });

  it('sem rodadas: usa início-fim da sessão como duração', () => {
    const none = build({ rounds: [] });
    expect(none.header.durationMins).toBe(102);
    expect(none.header.durationLabel).toBe('1h42');
    expect(none.tasks.filter((t) => t.estimated).every((t) => t.situation === 'estimada' && t.rounds === 0)).toBe(true);
    expect(none.kpis.firstRoundPct).toBeNull();
    expect(none.kpis.avgRounds).toBeNull();
  });

  it('soma dos papéis diferente da soma das estimativas é sinalizada (ajuste manual)', () => {
    const adjusted = build({ issues: issues.map((i) => (i.id === '1' ? { ...i, estimatedPoints: '12' } : i)) });
    expect(adjusted.kpis.total).toBe(48);
    expect(adjusted.totals.rolesDiffer).toBe(true);
  });

  it('aceita decimais com vírgula ou ponto e arredonda só na exibição', () => {
    const dec = buildSessionReport({
      deck: 'hours', participants: people, rounds: [],
      issues: [I('a', { status: 'completed', estimatedPoints: '7,5', rolePoints: { Developer: '4.5', QA: '3' } }), I('b', { status: 'completed', estimatedPoints: '2.25', rolePoints: { Developer: '2.25' } })],
    });
    expect(dec.kpis.total).toBe(9.75);
    expect(dec.kpis.totalLabel).toBe('9,8h');
    expect(dec.tasks[0].totalLabel).toBe('7,5h');
    expect(dec.tasks[0].copyText).toBe('(DEV 4.5h / QA 3h)');
    expect(dec.totals.roles).toEqual({ Developer: 6.75, QA: 3 });
  });
});

describe('outros baralhos', () => {
  it('fibonacci soma SP e não monta colunas de papel', () => {
    const r = buildSessionReport({
      deck: 'fibonacci', participants: people, rounds: [],
      issues: [I('a', { status: 'completed', estimatedPoints: '5' }), I('b', { status: 'completed', estimatedPoints: '8' })],
    });
    expect(r.kpis.totalLabel).toBe('13 SP');
    expect(r.roles).toEqual([]);
    expect(r.tasks[0].totalLabel).toBe('5 SP');
    expect(r.tasks[0].copyText).toBe('');
  });

  it('camisetas puras não têm soma: mostram a distribuição', () => {
    const r = buildSessionReport({
      deck: 'tshirt', participants: people, rounds: [],
      issues: [I('a', { status: 'completed', estimatedPoints: 'M' }), I('b', { status: 'completed', estimatedPoints: 'G' }), I('c', { status: 'completed', estimatedPoints: 'M' })],
    });
    expect(r.kpis.total).toBeNull();
    expect(r.kpis.totalLabel).toBe('—');
    expect(r.kpis.distribution).toEqual([{ label: 'M', count: 2 }, { label: 'G', count: 1 }]);
  });
});

describe('criticalDivergence', () => {
  it('usa os limites da sala e ignora gestão', () => {
    const round = R('x', '2026-10-14T13:00:00Z', [['d1', '4'], ['d2', '9'], ['sm', '40']]);
    expect(criticalDivergence(round, people, 'hours')).toBeNull(); // 5 não passa de 5
    expect(criticalDivergence(round, people, 'hours', { warn: 1, high: 3 })?.text).toBe('Divergência crítica no DEV · 4h a 9h');
    expect(criticalDivergence(R('x', 'a', [['d1', '4'], ['q1', '20']]), people, 'hours')).toBeNull(); // 1 voto por papel
  });

  it('baralhos sem horas: qualquer voto diferente no papel é crítico', () => {
    const round = R('x', '2026-10-14T13:00:00Z', [['d1', '3'], ['d2', '8']]);
    expect(criticalDivergence(round, people, 'fibonacci')?.role).toBe('Developer');
    expect(criticalDivergence(R('x', 'a', [['d1', '3'], ['d2', '3']]), people, 'fibonacci')).toBeNull();
    // menor e maior em ordem de valor, não de votação
    expect(criticalDivergence(R('x', 'a', [['d1', '8'], ['d2', '3'], ['d3', '5']]), [...people, P('d3', 'dev', 'Developer')], 'fibonacci')?.text).toBe('Divergência crítica no DEV · 3 a 8');
    expect(criticalDivergence(R('x', 'a', [['d1', 'G'], ['d2', 'P']]), people, 'tshirt')?.text).toBe('Divergência crítica no DEV · P a G');
  });

  it('voto de quem saiu da sala usa a identidade congelada', () => {
    const round = { votes: [{ ...V('gone1', '2', 'a'), participantRole: 'dev', participantGlobalRole: 'Developer' }, { ...V('gone2', '12', 'a'), participantRole: 'dev', participantGlobalRole: 'Developer' }] } as VotingRound;
    expect(criticalDivergence(round, [], 'hours')?.text).toBe('Divergência crítica no DEV · 2h a 12h');
  });
});

describe('ordenação e participantes', () => {
  const r = build();
  it('ordena por pauta, maior estimativa e rodadas', () => {
    expect(sortTasks(r.tasks, 'pauta').map((t) => t.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(sortTasks(r.tasks, 'maior').slice(0, 4).map((t) => t.id)).toEqual(['2', '3', '1', '8']);
    expect(sortTasks(r.tasks, 'rodadas').slice(0, 2).map((t) => t.id)).toEqual(['2', '1']);
  });
  it('resume participantes por papel', () => {
    expect(summarizeParticipants([P('a', 'dev', 'Developer'), P('b', 'dev', 'Developer')])).toEqual([{ label: 'DEV', count: 2 }]);
  });
});

describe('exportações batem com a tela', () => {
  const r: SessionReportData = build();

  it('markdown traz totais, tarefas e destaques', () => {
    const md = buildMarkdown(r);
    expect(md).toContain('# Relatório de Estimativas: Refinamento Phoenix');
    expect(md).toContain('**Data:** 14/10/2026 | **Squad:** Squad Phoenix');
    expect(md).toContain('Facilitador: Gabriela Nunes');
    expect(md).toContain('**Total estimado:** 47h (DEV 34h / QA 11h / UX 2h)');
    expect(md).toContain('**Fechadas na 1ª rodada:** 50% (2 de 4)');
    expect(md).toContain('**Média de rodadas por tarefa:** 1,3');
    expect(md).toContain('| PTV-2 Pagamento | 16h | 10h | 4h | 2h | - | - | 2 | Revotada |');
    expect(md).toContain('| **Total** | **47h** | **34h** | **11h** | **2h** |');
    expect(md).toContain('Divergência crítica no DEV · 6h a 18h');
    expect(md).toContain('- DEV: Usar o gateway novo.');
    expect(md).toContain('## Tarefas puladas (não estimadas)');
    expect(md).toContain('## Tempo por tópico');
    expect(md).toContain('**Tempo ativo** | **50 min**');
  });

  it('csv tem uma linha por tarefa na pauta, colunas legadas primeiro e números iguais', () => {
    const csv = buildCsv(r);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Resumo,Valor');
    expect(csv).toContain('Tarefas na fila,8');
    expect(csv).toContain('Estimadas,4');
    expect(csv).toContain('Total estimado,"47h"');
    expect(csv).toContain('"Total DEV (h)","34"');
    expect(csv).toContain('"Fechadas na 1ª rodada (%)",50');
    const header = lines.find((l) => l.startsWith('"Tarefa","Situação"'))!;
    expect(header).toBe('"Tarefa","Situação","Estimativa Final","DEV (h)","QA (h)","UX (h)","Vezes adiada","Observação","Link Jira","Chave","Rodadas","Situação detalhada","Notas DEV","Notas QA"');
    expect(csv).toContain('"Pagamento","Estimada","16h","10","4","2","0","","","PTV-2","2","Revotada","Usar o gateway novo.","Cobrir estorno."');
    expect(csv).toContain('"Timer","Pulada","N/A","0","0","0","0","Falta definição de UX"');
    expect(csv).toContain('"Modo anônimo","Não abordada","N/A","0","0","0","2","Aguardando o PO"');
    // 8 tarefas depois do cabeçalho
    const start = lines.indexOf(header);
    expect(lines.slice(start + 1, start + 9).every((l) => l.startsWith('"'))).toBe(true);
    expect(lines.slice(start + 1, start + 9)).toHaveLength(8);
  });

  it('csv neutraliza fórmulas', () => {
    expect(csvCell('=SOMA(A1)')).toBe(`"'=SOMA(A1)"`);
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell(5)).toBe('"5"');
    expect(buildCsv(r)).toContain('"E-mail =resumo"'); // só o início da célula conta
  });

  it('texto copiado: totais, lista de tarefas e pendências', () => {
    const txt = buildSummaryText(r);
    expect(txt).toContain('Refinamento: Refinamento Phoenix (Squad Phoenix)');
    expect(txt).toContain('14/10/2026 · 10:30 às 12:12 · duração 50 min · facilitador Gabriela Nunes · 6 participantes');
    expect(txt).toContain('Estimadas: 4 de 8 · Total: 47h (DEV 34h / QA 11h / UX 2h)');
    expect(txt).toContain('Fechadas na 1ª rodada: 50% · Média de rodadas: 1,3 · Divergência crítica: 1');
    expect(txt).toContain('Fora da estimativa: 1 pulada, 1 adiada, 1 cancelada, 1 não abordada');
    expect(txt).toContain('- PTV-2 Pagamento: (DEV 10h / QA 4h / UX 2h) = 16h');
    expect(txt).toContain('- PTV-3 Relatório: (DEV 12h / QA 4h) = 16h [divergência]');
    expect(txt).toContain('- PTV-6 Modo anônimo: Adiada (Aguardando o PO)');
    expect(txt).not.toContain('PTV-5'); // cancelada não é pendência
  });

  it('copiar estimativas: uma linha por tarefa estimada', () => {
    expect(buildEstimatesCopy(r).split('\n')).toEqual([
      'PTV-1 (DEV 8h / QA 3h)', 'PTV-2 (DEV 10h / QA 4h / UX 2h)', 'PTV-3 (DEV 12h / QA 4h)', 'PTV-8 (DEV 4h)',
    ]);
  });

  it('texto do TDN', () => {
    const tdn = buildTdnText(r);
    expect(tdn.startsWith('Refinamento: Refinamento Phoenix')).toBe(true);
    expect(tdn).toContain('Participantes: 6 (2 DEV, 1 QA, 1 UX, 1 Gestão, 1 Observadores)');
    expect(tdn).toContain('- Total estimado: 47h (DEV 34h / QA 11h / UX 2h)');
    expect(tdn).toContain('- PTV-2 Pagamento: (DEV 10h / QA 4h / UX 2h) = 16h — 2 rodadas');
    expect(tdn).toContain('- PTV-1 Login: (DEV 8h / QA 3h) = 11h — Reaproveita o SSO. (https://jira/PTV-1)');
    expect(tdn).toContain('Tarefas adiadas');
    expect(tdn).toContain('- PTV-6 Modo anônimo: adiada 2x, ficou pendente — Aguardando o PO');
  });

  it('tudo vazio não quebra', () => {
    const empty = buildSessionReport({ deck: 'hours', issues: [], participants: [], rounds: [] });
    expect(empty.kpis.total).toBeNull();
    expect(empty.header.durationLabel).toBe('N/A');
    expect(() => [buildMarkdown(empty), buildCsv(empty), buildTdnText(empty), buildSummaryText(empty), buildEstimatesCopy(empty)]).not.toThrow();
  });
});
