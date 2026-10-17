import { describe, expect, it } from 'vitest';
import type { ShowcaseSession, ShowcaseTask } from '../types';
import {
  ALL,
  EMPTY_FILTERS,
  REVIEW_PHASES,
  REVIEW_STALE_MS,
  activeFilterChips,
  buildInviteText,
  canDecide,
  cleanRoomUrl,
  clearAllFilters,
  clearFilterChip,
  decisionCounts,
  effortTotals,
  filterHistory,
  filterOptions,
  filterTasks,
  hubTotals,
  hubTotalsText,
  jqlPresets,
  normalizeChecklist,
  normalizeReviewStatus,
  openDecisionCount,
  parseJoinInput,
  readinessOf,
  reviewPhase,
  reviewStatusLabel,
  sessionActionLabel,
  sessionApprovalRate,
  sessionHref,
  sortTasks,
  sprintCaption,
  squadLabel,
  squadOptions,
  topBarStatus,
  topBarStatusLabel,
} from '../review-room-logic';

function task(over: Partial<ShowcaseTask> & { dev?: string; qa?: string; problem?: string; solution?: string; screenshot?: string; video?: string }): ShowcaseTask {
  const { dev = '', qa = '', problem = '', solution = '', screenshot = '', video = '', ...rest } = over;
  return {
    id: rest.id ?? rest.key ?? 'x',
    key: rest.key ?? 'PTV-1',
    title: rest.title ?? 'Título',
    description: '',
    acceptanceCriteria: '',
    type: rest.type ?? 'História',
    status: 'Done',
    priority: 'Medium',
    points: 0,
    assignee: '',
    url: '',
    evidence: { problem, solution, dev, qa, screenshot, video, timeSpent: 0, timeEstimate: 0 },
    decision: 'open',
    preparationStatus: 'todo',
    feedback: '',
    ...rest,
  } as ShowcaseTask;
}

const session = (over: Partial<ShowcaseSession>): ShowcaseSession => ({
  id: 's1', name: 'Review da Sprint 42', sprintName: 'Sprint 42', tasks: [], createdAt: '2026-10-01T10:00:00Z', status: 'planning', ...over,
});

describe('status e fases', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');

  it('só planning, active e finished existem; o resto (inclusive "presenting") vira planning, como no servidor', () => {
    expect(normalizeReviewStatus('planning')).toBe('planning');
    expect(normalizeReviewStatus('finished')).toBe('finished');
    expect(normalizeReviewStatus('presenting')).toBe('planning');
    expect(normalizeReviewStatus(undefined)).toBe('planning');
    expect(normalizeReviewStatus('  FINISHED ')).toBe('finished');
  });

  it('active recente é Ao vivo; active sem atividade há mais de 12 h volta a Em preparação', () => {
    expect(normalizeReviewStatus('active', '2026-10-17T11:00:00Z', now)).toBe('active');
    expect(normalizeReviewStatus('active', new Date(now - REVIEW_STALE_MS - 1000).toISOString(), now)).toBe('planning');
    // sem data de atualização, confia no status gravado
    expect(normalizeReviewStatus('active', undefined, now)).toBe('active');
  });

  it('rótulos do hub e do cabeçalho da sala', () => {
    expect(reviewStatusLabel('planning')).toBe('Em preparação');
    expect(reviewStatusLabel('active')).toBe('Ao vivo');
    expect(reviewStatusLabel('finished')).toBe('Finalizada');
    expect(topBarStatus('planning')).toBe('waiting');
    expect(topBarStatus('active')).toBe('live');
    expect(topBarStatus('finished')).toBe('done');
    expect(topBarStatusLabel('planning')).toBe('Em preparação');
    expect(topBarStatusLabel('finished')).toBe('Encerrada');
  });

  it('fase em destaque: Resumo depois de finalizar, Apresentar ao vivo ou com o Teatro aberto, senão Preparar', () => {
    expect(REVIEW_PHASES.map((p) => p.id)).toEqual(['prepare', 'present', 'summary']);
    expect(reviewPhase('planning', false)).toBe('prepare');
    expect(reviewPhase('planning', true)).toBe('present');
    expect(reviewPhase('active', false)).toBe('present');
    expect(reviewPhase('finished', false)).toBe('summary');
    expect(reviewPhase('finished', true)).toBe('present');
  });
});

describe('permissão do PO/SME', () => {
  it('só PO (nas duas grafias) e SME decidem', () => {
    expect(canDecide('Product Owner')).toBe(true);
    expect(canDecide('Product Owner (PO)')).toBe(true);
    expect(canDecide('SME')).toBe(true);
    expect(canDecide('Developer')).toBe(false);
    expect(canDecide('Scrum Master')).toBe(false);
    expect(canDecide(undefined)).toBe(false);
    expect(canDecide('')).toBe(false);
  });

  // Vínculos do servidor (MembershipService): a mesma regra que devolve 403 DECISION_RESTRICTED.
  const role = (roleKey: string, roleName: string, leadership = false) => ({ roleKey, roleName, leadership, source: null, primary: true });
  const membership = (projectId: string, roles: ReturnType<typeof role>[], over: Record<string, unknown> = {}) => ({
    projectId, projectName: projectId, roleName: roles[0].roleName, roleKey: roles[0].roleKey, leadership: roles[0].leadership,
    direct: true, scope: 'SQUAD' as const, source: null, roles, ...over,
  });
  const mine = (...ms: ReturnType<typeof membership>[]) => ({ contractVersion: '1', activeProjectId: ms[0]?.projectId ?? null, legacyOnly: false, transversalLeader: false, memberships: ms });

  it('com vínculos: PO e SME da squad da Review decidem; dev e QA não', () => {
    expect(canDecide({ memberships: mine(membership('DDW', [role('PRODUCT_OWNER', 'Product Owner')])), squadId: 'DDW' })).toBe(true);
    expect(canDecide({ memberships: mine(membership('DDW', [role('SME', 'SME')])), squadId: 'ddw' })).toBe(true);
    expect(canDecide({ memberships: mine(membership('DDW', [role('DEVELOPER', 'Developer')])), squadId: 'DDW' })).toBe(false);
    expect(canDecide({ memberships: mine(membership('DDW', [role('QA', 'QA')])), squadId: 'DDW' })).toBe(false);
  });

  it('com vínculos: o papel PO só vale na squad da Review', () => {
    const m = mine(membership('OUTRA', [role('PRODUCT_OWNER', 'Product Owner')]), membership('DDW', [role('DEVELOPER', 'Developer')]));
    expect(canDecide({ memberships: m, squadId: 'DDW', role: 'Product Owner' })).toBe(false);
    expect(canDecide({ memberships: m, squadId: 'SEM-VINCULO', role: 'Product Owner' })).toBe(false);
  });

  it('com vínculos: liderança da squad (qualquer papel com poder de liderança) decide, mesmo sem ser PO', () => {
    expect(canDecide({ memberships: mine(membership('DDW', [role('AGILE_MASTER', 'Agile Master', true)])), squadId: 'DDW' })).toBe(true);
    // liderança num dos papéis, o primário é de dev
    expect(canDecide({ memberships: mine(membership('DDW', [role('DEVELOPER', 'Developer'), role('TECH_LEAD', 'Tech Lead', true)], { leadership: false })), squadId: 'DDW' })).toBe(true);
    // liderança transversal (tribo): vínculo derivado com leadership
    expect(canDecide({ memberships: mine(membership('DDW', [role('TRIBE_LEAD', 'Tribe Lead', true)], { scope: 'TRIBE', direct: false })), squadId: 'DDW' })).toBe(true);
  });

  it('com vínculos: o PO pode ser um papel secundário e o nome também vale', () => {
    expect(canDecide({ memberships: mine(membership('DDW', [role('DEVELOPER', 'Developer'), role('PRODUCT_OWNER', 'Product Owner')])), squadId: 'DDW' })).toBe(true);
    expect(canDecide({ memberships: mine(membership('DDW', [role('X', 'Product Owner (PO)')])), squadId: 'DDW' })).toBe(true);
  });

  it('administrador decide sempre, com ou sem vínculos', () => {
    expect(canDecide({ isAdmin: true })).toBe(true);
    expect(canDecide({ isAdmin: true, memberships: mine(membership('X', [role('DEVELOPER', 'Developer')])), squadId: 'DDW' })).toBe(true);
  });

  it('Review sem squad: só administrador e criador', () => {
    const m = mine(membership('DDW', [role('PRODUCT_OWNER', 'Product Owner', true)]));
    expect(canDecide({ memberships: m, squadId: '' })).toBe(false);
    expect(canDecide({ memberships: m, squadId: undefined, role: 'Product Owner' })).toBe(false);
    expect(canDecide({ memberships: m, squadId: '', isCreator: true })).toBe(true);
    expect(canDecide({ memberships: m, squadId: '  ', isAdmin: true })).toBe(true);
  });

  it('sem dados de vínculos (backend antigo): vale o cargo do perfil, como antes', () => {
    expect(canDecide({ role: 'Product Owner', squadId: 'DDW' })).toBe(true);
    expect(canDecide({ role: 'SME', memberships: null, squadId: 'DDW' })).toBe(true);
    expect(canDecide({ role: 'Developer', memberships: null, squadId: 'DDW' })).toBe(false);
    expect(canDecide({ role: 'Product Owner', memberships: mine(), squadId: 'DDW' })).toBe(true);
    // conta só com rastro legado (sem nenhum vínculo): também o cargo
    expect(canDecide({ role: 'SME', memberships: { ...mine(), legacyOnly: true } })).toBe(true);
  });
});

describe('ordem e filtros', () => {
  const tasks = [
    task({ key: 'PTV-10', type: 'Melhoria', dev: 'Bruno', qa: 'Carla', title: 'Painel' }),
    task({ key: 'PTV-2', type: 'História', dev: 'Ana', qa: 'Diego', title: 'Fila do Poker' }),
    task({ key: 'PTV-1', type: 'História', dev: 'Ana', qa: 'Carla', title: 'Convite' }),
  ];

  it('chave em ordem natural: PTV-2 vem antes de PTV-10', () => {
    expect(sortTasks(tasks, 'key').map((t) => t.key)).toEqual(['PTV-1', 'PTV-2', 'PTV-10']);
  });

  it('ordena por tipo, dev e QA com desempate pela chave', () => {
    expect(sortTasks(tasks, 'type').map((t) => t.key)).toEqual(['PTV-1', 'PTV-2', 'PTV-10']);
    expect(sortTasks(tasks, 'dev').map((t) => t.key)).toEqual(['PTV-1', 'PTV-2', 'PTV-10']);
    expect(sortTasks(tasks, 'qa').map((t) => t.key)).toEqual(['PTV-1', 'PTV-10', 'PTV-2']);
  });

  it('busca por chave, título, dev ou QA, sem diferenciar caixa', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, search: 'fila' }).map((t) => t.key)).toEqual(['PTV-2']);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, search: 'ptv-1' }).map((t) => t.key)).toEqual(['PTV-10', 'PTV-1']);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, search: 'DIEGO' }).map((t) => t.key)).toEqual(['PTV-2']);
  });

  it('filtros de dev, QA e tipo se combinam', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, dev: 'Ana', qa: 'Carla' }).map((t) => t.key)).toEqual(['PTV-1']);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, type: 'Melhoria' }).map((t) => t.key)).toEqual(['PTV-10']);
    expect(filterTasks(tasks, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('listas dos filtros vêm dos cards, sem repetir', () => {
    expect(filterOptions(tasks)).toEqual({ devs: ['Ana', 'Bruno'], qas: ['Carla', 'Diego'], types: ['História', 'Melhoria'] });
  });

  it('um chip por filtro ativo, inclusive QA, com a ordem certa (o defeito antigo mostrava a ordem por QA como "Tipo")', () => {
    const chips = activeFilterChips({ search: 'fila', dev: 'Ana', qa: 'Carla', type: 'História' }, 'qa');
    expect(chips.map((c) => c.id)).toEqual(['search', 'dev', 'qa', 'type', 'sort']);
    expect(chips.find((c) => c.id === 'qa')?.label).toBe('QA: Carla');
    expect(chips.find((c) => c.id === 'sort')?.label).toBe('Ordem: Validador / QA');
    expect(activeFilterChips(EMPTY_FILTERS, 'key')).toEqual([]);
  });

  it('a ordem só vira chip quando difere da ordem da Review', () => {
    expect(activeFilterChips(EMPTY_FILTERS, 'dev', 'dev')).toEqual([]);
    expect(activeFilterChips(EMPTY_FILTERS, 'key', 'dev').map((c) => c.id)).toEqual(['sort']);
  });

  it('remover um chip tira só aquele filtro; a ordem volta para a da Review', () => {
    const f = { search: 'x', dev: 'Ana', qa: 'Carla', type: 'História' };
    expect(clearFilterChip(f, 'qa', 'qa').filters).toEqual({ ...f, qa: ALL });
    expect(clearFilterChip(f, 'qa', 'sort', 'dev').sortBy).toBe('dev');
    expect(clearFilterChip(f, 'qa', 'sort', 'dev').filters).toEqual(f);
  });

  it('Limpar tudo limpa busca, dev, QA, tipo e ordem', () => {
    expect(clearAllFilters()).toEqual({ filters: EMPTY_FILTERS, sortBy: 'key' });
    expect(clearAllFilters('type').sortBy).toBe('type');
  });
});

describe('prontidão e esforço', () => {
  const complete = task({ key: 'A-1', problem: 'p', solution: 's', screenshot: 'https://x/a.png', preparationStatus: 'done' });
  const manualOnly = task({ key: 'A-2', preparationStatus: 'done' });
  const contentOnly = task({ key: 'A-3', problem: 'p', solution: 's', video: 'https://x/v', preparationStatus: 'doing' });
  const empty = task({ key: 'A-4' });

  it('conta o conteúdo real e aponta os cards em que o status manual discorda', () => {
    const r = readinessOf([complete, manualOnly, contentOnly, empty]);
    expect(r.total).toBe(4);
    expect(r.readyCount).toBe(2);
    expect(r.mismatchCount).toBe(2);
    expect(r.percent).toBe(50);
    expect(r.rows.filter((x) => x.mismatch).map((x) => x.task.key)).toEqual(['A-2', 'A-3']);
  });

  it('anexo vale como evidência; card de métricas pede campo e valor', () => {
    const withFile = task({ key: 'B-1', problem: 'p', solution: 's', attachments: [{ id: 'f', taskId: 'B-1', name: 'a.png', contentType: 'image/png', size: 1 }] });
    expect(readinessOf([withFile]).readyCount).toBe(1);
    const metrics = task({ key: 'B-2', cardKind: 'metrics', metrics: [{ field: 'Horas', value: 4 }] });
    const metricsEmpty = task({ key: 'B-3', cardKind: 'metrics', metrics: [{ field: '', value: 0 }] });
    expect(readinessOf([metrics, metricsEmpty]).readyCount).toBe(1);
  });

  it('lista vazia não divide por zero', () => {
    expect(readinessOf([])).toMatchObject({ total: 0, readyCount: 0, percent: 0 });
  });

  it('soma as horas gastas e estimadas', () => {
    const a = task({ key: 'C-1' }); a.evidence.timeSpent = 3600 * 8; a.evidence.timeEstimate = 3600 * 6;
    const b = task({ key: 'C-2' }); b.evidence.timeSpent = 1800; b.evidence.timeEstimate = 3600;
    const e = effortTotals([a, b]);
    expect(e.spentLabel).toBe('8h 30m');
    expect(e.estimateLabel).toBe('7h');
    expect(effortTotals([]).spentLabel).toBe('0h');
  });

  it('cards sem decisão', () => {
    const decided = task({ key: 'D-1', decision: 'approved' });
    expect(openDecisionCount([decided, task({ key: 'D-2' }), task({ key: 'D-3', decision: 'open' })])).toBe(2);
  });
});

describe('números do hub', () => {
  const s1 = session({ id: 'a', tasks: [task({ key: 'A-1', decision: 'approved', preparationStatus: 'done' }), task({ key: 'A-2', decision: 'needs_adjustment' }), task({ key: 'A-3' })] });
  const s2 = session({ id: 'b', status: 'finished', tasks: [task({ key: 'B-1', decision: 'approved', preparationStatus: 'done' }), task({ key: 'B-2', decision: 'rejected', preparationStatus: 'done' })] });

  it('taxa de aceite = aprovadas ÷ avaliadas (card sem decisão não puxa a taxa para baixo)', () => {
    const t = hubTotals([s1, s2]);
    expect(t).toMatchObject({ sessions: 2, total: 5, approved: 2, adjustment: 1, rejected: 1, pending: 1, evaluated: 4, ready: 3 });
    expect(t.acceptanceRate).toBe(50);
    expect(t.readyRate).toBe(60);
  });

  it('o texto separa cards de avaliados (o antigo dizia "N tarefas avaliadas" contando todas)', () => {
    expect(hubTotalsText({ total: 44, evaluated: 30 })).toBe('44 cards, 30 avaliados pelo PO.');
    expect(hubTotalsText({ total: 1, evaluated: 1 })).toBe('1 card, 1 avaliado pelo PO.');
  });

  it('sem Reviews ou sem decisões, tudo zero', () => {
    expect(hubTotals([])).toMatchObject({ sessions: 0, total: 0, acceptanceRate: 0, readyRate: 0 });
    expect(decisionCounts([])).toMatchObject({ total: 0, evaluated: 0 });
  });

  it('aprovação da linha do histórico = aprovadas ÷ cards; sem cards não mostra', () => {
    expect(sessionApprovalRate(s1.tasks)).toBe(33);
    expect(sessionApprovalRate([])).toBeNull();
  });

  it('legenda: a sprint, ou "Sem sprint informada" (antes dizia "Sem squad atribuído")', () => {
    expect(sprintCaption({ sprintName: 'Sprint 42' })).toBe('Sprint 42');
    expect(sprintCaption({ sprintName: '  ' })).toBe('Sem sprint informada');
    expect(sprintCaption({ sprintName: '' })).toBe('Sem sprint informada');
  });
});

describe('histórico do hub', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const list = [
    session({ id: '1', name: 'Review da Sprint 42', sprintName: 'Sprint 42', status: 'planning' }),
    session({ id: '2', name: 'Review da Sprint 41', sprintName: 'Sprint 41', status: 'finished' }),
    session({ id: '3', name: 'Review especial', sprintName: 'Sprint 40', status: 'active', updatedAt: '2026-10-17T11:00:00Z' }),
    session({ id: '4', name: 'Review antiga', sprintName: 'Sprint 39', status: 'active', updatedAt: '2026-10-01T11:00:00Z' }),
  ];

  it('filtra por status: Em preparação inclui ao vivo e abandonadas; Finalizadas só as finalizadas', () => {
    expect(filterHistory(list, 'all', '', now)).toHaveLength(4);
    expect(filterHistory(list, 'planning', '', now).map((s) => s.id)).toEqual(['1', '3', '4']);
    expect(filterHistory(list, 'finished', '', now).map((s) => s.id)).toEqual(['2']);
  });

  it('busca por nome ou sprint', () => {
    expect(filterHistory(list, 'all', 'sprint 41', now).map((s) => s.id)).toEqual(['2']);
    expect(filterHistory(list, 'all', 'especial', now).map((s) => s.id)).toEqual(['3']);
    expect(filterHistory(list, 'finished', 'especial', now)).toEqual([]);
  });

  it('botão e endereço dependem do estado: finalizada abre o resumo', () => {
    expect(sessionActionLabel('planning')).toBe('Retomar');
    expect(sessionActionLabel('active')).toBe('Entrar');
    expect(sessionActionLabel('finished')).toBe('Ver resumo');
    expect(sessionHref('abc', 'planning')).toBe('/showcase/abc');
    expect(sessionHref('abc', 'finished')).toBe('/showcase/abc?resumo=1');
  });
});

describe('entrar por ID ou link', () => {
  it('aceita o ID puro (com a caixa original) ou o link colado', () => {
    expect(parseJoinInput('  AbC-123 ')).toEqual({ id: 'AbC-123', fromLink: false });
    expect(parseJoinInput('https://portal.totvs.com.br/showcase/7c1e5f0a-93b4?setup=1')).toEqual({ id: '7c1e5f0a-93b4', fromLink: true });
    expect(parseJoinInput('Veja http://localhost:9002/showcase/XyZ9 agora')).toEqual({ id: 'XyZ9', fromLink: true });
  });
  it('vazio não entra', () => {
    expect(parseJoinInput('')).toBeNull();
    expect(parseJoinInput('   ')).toBeNull();
  });
});

describe('checklist do hub', () => {
  it('sempre tem uma posição por passo, mesmo com lista curta, longa ou ausente', () => {
    expect(normalizeChecklist(undefined)).toEqual([false, false, false, false]);
    expect(normalizeChecklist([true, false])).toEqual([true, false, false, false]);
    expect(normalizeChecklist([true, true, true, true, true, true])).toEqual([true, true, true, true]);
  });
});

describe('predefinições de JQL', () => {
  it('"Review da sprint atual" usa a sprint ativa da squad, sem número fixo no código', () => {
    const withSprint = jqlPresets({ sprintId: '61234', squadKey: 'DDPDV' });
    const review = withSprint.find((p) => p.id === 'review-sprint')!;
    expect(review.jql).toContain('sprint = 61234');
    expect(review.jql).not.toContain('52188');
    expect(review.jql).not.toContain('NumeroDaSprint');
    expect(jqlPresets().find((p) => p.id === 'review-sprint')!.jql).toContain('sprint in openSprints()');
  });

  it('o refinamento usa a chave da squad (e some sem ela); os demais atalhos continuam', () => {
    expect(jqlPresets({ squadKey: 'DDPDV' }).find((p) => p.id === 'refinement')!.jql).toContain('project = "DDPDV"');
    expect(jqlPresets({ squadKey: 'DDPDV' }).find((p) => p.id === 'refinement')!.jql).not.toContain('DDWMISSI');
    expect(jqlPresets().some((p) => p.id === 'refinement')).toBe(false);
    expect(jqlPresets().map((p) => p.id)).toEqual(['review-sprint', 'mine', 'sprint', 'backlog', 'done-week', 'blocked']);
  });
});

describe('squads do vínculo', () => {
  const memberships = [
    { projectId: 'DDWPRIME', projectName: 'Prime' },
    { projectId: 'DDWMISSI', projectName: 'Missão' },
  ];

  it('lista as squads do vínculo em ordem alfabética, sem a squad fixa antiga', () => {
    expect(squadOptions(memberships, { squadId: 'DDWPRIME', squadName: 'Prime' })).toEqual([
      { value: 'DDWMISSI', label: 'Missão' },
      { value: 'DDWPRIME', label: 'Prime' },
    ]);
  });

  it('sem vínculos, só a squad ativa; sem nada, lista vazia (não cria Review sem squad)', () => {
    expect(squadOptions(null, { squadId: 'ABC', squadName: 'Alfa' })).toEqual([{ value: 'ABC', label: 'Alfa' }]);
    expect(squadOptions(undefined, {})).toEqual([]);
  });

  it('a squad que a Review já tem entra na lista mesmo fora do vínculo', () => {
    const opts = squadOptions(memberships, {}, 'LEGADO');
    expect(opts.map((o) => o.value)).toContain('LEGADO');
    expect(squadOptions(memberships, {}, 'ddwprime').filter((o) => o.value.toLowerCase() === 'ddwprime')).toHaveLength(1);
  });

  it('mostra o nome do vínculo para a chave guardada', () => {
    const opts = squadOptions(memberships, {});
    expect(squadLabel('ddwmissi', opts)).toBe('Missão');
    expect(squadLabel('OUTRA', opts)).toBe('OUTRA');
    expect(squadLabel('', opts)).toBe('');
  });
});

describe('convite e endereço', () => {
  it('convite em texto com nome, squad, pauta e link', () => {
    const text = buildInviteText({ name: 'Review da Sprint 42', squadName: 'Phoenix', cardCount: 26, url: 'https://x/showcase/1' });
    expect(text).toContain('Review da Sprint 42, squad Phoenix.');
    expect(text).toContain('Pauta: 26 cards.');
    expect(text).toContain('Link: https://x/showcase/1');
    expect(buildInviteText({ name: 'R', cardCount: 1, url: 'u', greeting: 'Bom dia' }).startsWith('Bom dia\n\nR.')).toBe(true);
    expect(buildInviteText({ name: '', cardCount: 0, url: 'u' })).toContain('Preparem as evidências');
  });

  it('o endereço copiado não leva ?setup=1 nem ?resumo=1', () => {
    expect(cleanRoomUrl('https://x.com/showcase/abc?setup=1')).toBe('https://x.com/showcase/abc');
    expect(cleanRoomUrl('https://x.com/showcase/abc?resumo=1#a')).toBe('https://x.com/showcase/abc');
  });
});
