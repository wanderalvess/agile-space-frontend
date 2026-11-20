import { describe, expect, it } from 'vitest';
import {
  CSV_HEADER,
  FILTER_ALL,
  FILTER_UNASSIGNED,
  NO_FILTERS,
  boardIsPublic,
  csvCell,
  dateInputToText,
  dateToText,
  extractPlanId,
  filterPlanRows,
  filterTasks,
  findPersonByName,
  foldText,
  formatAgo,
  formatShortDate,
  hasActiveFilters,
  inviteText,
  mergePlanRows,
  nextStatus,
  normalizeStatus,
  numberTasks,
  planCsv,
  planCsvFileName,
  planMarkdown,
  planPath,
  planUrl,
  responsibleOptions,
  statusLabel,
  suggestPeople,
  summarizeTasks,
  taskFormPayload,
  taskToForm,
  toPlanPeople,
  validateTaskForm,
} from '../action-plan';
import type { ActionPlanBoard, ActionPlanTask } from '../types';

const task = (over: Partial<ActionPlanTask> & { id: string }): ActionPlanTask => ({
  boardId: 'b1',
  what: 'Criar o checklist',
  why: 'Ideia priorizada',
  where: 'Primeiros passos',
  when: '25/10',
  who: 'Ana Ribeiro',
  how: 'Componente com progresso',
  howMuch: '16 h',
  status: 'todo',
  createdAt: '2026-10-16T10:00:00Z',
  updatedAt: '2026-10-16T10:00:00Z',
  authorId: 'u1',
  order: 0,
  ...over,
});

const board = (over: Partial<ActionPlanBoard> = {}): ActionPlanBoard => ({
  id: '9b2e41d8-6c37-4f5a-8d10-2a7c5e93b0f4',
  creatorId: 'u1',
  title: 'Redesenho do onboarding',
  team: 'PHOENIX',
  createdAt: '2026-10-16T10:00:00Z',
  ...over,
});

describe('status', () => {
  it('traduz para português e tolera valor desconhecido, nulo ou em outra caixa', () => {
    expect(statusLabel('todo')).toBe('A fazer');
    expect(statusLabel('doing')).toBe('Em andamento');
    expect(statusLabel('done')).toBe('Concluído');
    expect(statusLabel('blocked')).toBe('Impedido');
    expect(statusLabel(' DONE ')).toBe('Concluído');
    expect(normalizeStatus('xyz')).toBe('todo');
    expect(normalizeStatus(null)).toBe('todo');
    expect(normalizeStatus(undefined)).toBe('todo');
  });

  it('o clique avança na ordem e volta ao primeiro depois de Impedido', () => {
    expect(nextStatus('todo')).toBe('doing');
    expect(nextStatus('doing')).toBe('done');
    expect(nextStatus('done')).toBe('blocked');
    expect(nextStatus('blocked')).toBe('todo');
    expect(nextStatus('lixo')).toBe('doing');
  });
});

describe('resumo por status', () => {
  it('conta cada status e o percentual de concluídas', () => {
    const tasks = [
      task({ id: '1', status: 'todo' }),
      task({ id: '2', status: 'doing' }),
      task({ id: '3', status: 'done' }),
      task({ id: '4', status: 'done' }),
      task({ id: '5', status: 'blocked' }),
      task({ id: '6', status: 'qualquer' as ActionPlanTask['status'] }),
    ];
    expect(summarizeTasks(tasks)).toEqual({ total: 6, todo: 2, doing: 1, done: 2, blocked: 1, donePct: 33 });
  });

  it('plano sem ações: tudo zero, sem divisão por zero', () => {
    expect(summarizeTasks([])).toEqual({ total: 0, todo: 0, doing: 0, done: 0, blocked: 0, donePct: 0 });
  });
});

describe('busca e filtros', () => {
  const tasks = [
    task({ id: '1', what: 'Criar o checklist interativo', who: 'Ana Ribeiro', status: 'doing' }),
    task({ id: '2', what: 'Gravar o vídeo', who: 'Diego Alves', status: 'todo', why: 'Roteiro com a PO' }),
    task({ id: '3', what: 'Tour guiado', who: '', status: 'todo' }),
    task({ id: '4', what: 'Importar pelo Jira', who: 'ana ribeiro', status: 'done', howMuch: '40 h' }),
  ];

  it('sem filtro devolve tudo', () => {
    expect(filterTasks(tasks, NO_FILTERS)).toHaveLength(4);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it('busca em todos os campos, sem diferenciar acento nem caixa', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, query: 'VIDEO' }).map((t) => t.id)).toEqual(['2']);
    expect(filterTasks(tasks, { ...NO_FILTERS, query: 'roteiro' }).map((t) => t.id)).toEqual(['2']);
    expect(filterTasks(tasks, { ...NO_FILTERS, query: '40 h' }).map((t) => t.id)).toEqual(['4']);
    expect(hasActiveFilters({ ...NO_FILTERS, query: 'x' })).toBe(true);
  });

  it('filtra por status e por responsável (mesma pessoa em caixas diferentes conta uma só)', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, status: 'todo' }).map((t) => t.id)).toEqual(['2', '3']);
    expect(filterTasks(tasks, { ...NO_FILTERS, who: 'Ana Ribeiro' }).map((t) => t.id)).toEqual(['1', '4']);
    expect(filterTasks(tasks, { ...NO_FILTERS, who: FILTER_UNASSIGNED }).map((t) => t.id)).toEqual(['3']);
  });

  it('combina os filtros', () => {
    expect(filterTasks(tasks, { query: 'ana', status: 'done', who: FILTER_ALL }).map((t) => t.id)).toEqual(['4']);
  });

  it('lista os responsáveis sem repetir e avisa se há ação sem responsável', () => {
    expect(responsibleOptions(tasks)).toEqual({ names: ['Ana Ribeiro', 'Diego Alves'], hasUnassigned: true });
    expect(responsibleOptions([task({ id: '1' })])).toEqual({ names: ['Ana Ribeiro'], hasUnassigned: false });
  });

  it('a numeração segue a posição no plano, não a do filtro', () => {
    const numbers = numberTasks(tasks);
    expect(numbers.get('3')).toBe(3);
    expect(numbers.get('4')).toBe(4);
  });

  it('foldText tira acento e caixa', () => {
    expect(foldText('  AÇÃO ')).toBe('acao');
    expect(foldText(null)).toBe('');
  });
});

describe('formulário da ação', () => {
  it('O quê e Quem são obrigatórios na tela', () => {
    expect(validateTaskForm({ what: '', who: '' })).toEqual({ what: expect.any(String), who: expect.any(String) });
    expect(validateTaskForm({ what: '  ', who: 'Ana' })).toEqual({ what: expect.any(String) });
    expect(validateTaskForm({ what: 'Criar', who: 'Ana' })).toEqual({});
  });

  it('taskToForm normaliza campos nulos e status', () => {
    expect(taskToForm(null).status).toBe('todo');
    const form = taskToForm(task({ id: '1', why: null as unknown as string, howMuch: undefined as unknown as string, status: 'DOING' as ActionPlanTask['status'] }));
    expect(form.why).toBe('');
    expect(form.howMuch).toBe('');
    expect(form.status).toBe('doing');
  });
});

describe('datas e tempo', () => {
  it('formata dd/MM e devolve vazio para data inválida', () => {
    expect(formatShortDate('2026-10-16T12:00:00')).toBe('16/10');
    expect(formatShortDate('')).toBe('');
    expect(formatShortDate('não é data')).toBe('');
    expect(formatShortDate(undefined)).toBe('');
  });

  it('o calendário escreve dd/MM/aaaa', () => {
    expect(dateToText(new Date(2026, 9, 5))).toBe('05/10/2026');
    expect(dateInputToText('2026-10-25')).toBe('25/10/2026');
    expect(dateInputToText('')).toBe('');
    expect(dateInputToText('25/10/2026')).toBe('');
  });

  it('"Atualizado há N s"', () => {
    expect(formatAgo(0)).toBe('agora');
    expect(formatAgo(4_000)).toBe('agora');
    expect(formatAgo(8_000)).toBe('há 8 s');
    expect(formatAgo(125_000)).toBe('há 2 min');
    expect(formatAgo(2 * 3_600_000)).toBe('há 2 h');
    expect(formatAgo(-5000)).toBe('agora');
  });
});

describe('visibilidade, ID e link', () => {
  it('lê isPublic, ou settings.isPublic (tipo antigo); sem nenhum é público', () => {
    expect(boardIsPublic(board({ isPublic: false }))).toBe(false);
    expect(boardIsPublic(board({ settings: { isPublic: false } }))).toBe(false);
    expect(boardIsPublic(board({ isPublic: true, settings: { isPublic: false } }))).toBe(true);
    expect(boardIsPublic(board())).toBe(true);
    expect(boardIsPublic(null)).toBe(true);
  });

  it('extrai o ID de um link, de um ID em maiúsculas ou de um texto qualquer', () => {
    const id = '9b2e41d8-6c37-4f5a-8d10-2a7c5e93b0f4';
    expect(extractPlanId(`https://portal.espacoagil.com.br/action-plan/${id}`)).toEqual({ id, fromLink: true });
    expect(extractPlanId(`  /action-plan/${id}?x=1#y `)).toEqual({ id, fromLink: true });
    expect(extractPlanId(id.toUpperCase())).toEqual({ id, fromLink: false });
    expect(extractPlanId('abc123')).toEqual({ id: 'abc123', fromLink: false });
    expect(extractPlanId('https://x.com/action-plan/abc123?a=1')).toEqual({ id: 'abc123', fromLink: true });
    expect(extractPlanId('   ')).toEqual({ id: '', fromLink: false });
  });

  it('monta o caminho e o endereço do plano', () => {
    expect(planPath('abc')).toBe('/action-plan/abc');
    expect(planUrl('https://portal.x.com/', 'abc')).toBe('https://portal.x.com/action-plan/abc');
  });

  it('convite em texto', () => {
    expect(inviteText({ title: 'Onboarding', squadName: 'Phoenix', total: 9, url: 'https://x/y' })).toBe(
      'Plano de ação "Onboarding" da squad Phoenix: 9 ações com responsável e prazo. Confira a sua e atualize o status. Link: https://x/y',
    );
    expect(inviteText({ title: 'Onboarding', total: 1, url: 'u' })).toContain('1 ação com');
    expect(inviteText({ title: ' ', total: 0, url: 'u' })).toBe('Plano de ação "Plano de ação": ainda sem ações. Confira a sua e atualize o status. Link: u');
  });
});

describe('exportação', () => {
  const tasks = [
    task({ id: '1', what: 'Criar "checklist"', status: 'done', howMuch: '' }),
    task({ id: '2', what: '=SOMA(A1)', status: 'blocked', who: '', why: 'a,b' }),
  ];

  it('Markdown: sem emoji, sete campos e status em português', () => {
    const md = planMarkdown(board(), tasks, '17/10/2026');
    expect(md.startsWith('# Plano de ação - Redesenho do onboarding (17/10/2026)')).toBe(true);
    expect(md).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(md).toContain('### 1. Criar "checklist"');
    expect(md).toContain('- **Status:** Concluído');
    expect(md).toContain('- **Status:** Impedido');
    expect(md).not.toContain('Custo/Esforço:** \n');
    expect(md).toContain('- **Custo/Esforço:** 16 h'.slice(0, 0) + '');
  });

  it('Markdown: título vazio vira "Sem título" e o custo só sai quando existe', () => {
    expect(planMarkdown(board({ title: '' }), [], 'hoje')).toBe('# Plano de ação - Sem título (hoje)');
    const md = planMarkdown(board(), [task({ id: '1', howMuch: '8 h' }), task({ id: '2', howMuch: '' })], 'd');
    expect(md.match(/Custo\/Esforço/g)).toHaveLength(1);
  });

  it('CSV: cabeçalho, aspas duplicadas e status em português (nunca o valor cru)', () => {
    const csv = planCsv(tasks);
    const [head, first, second] = csv.split('\n');
    expect(head.split(',')).toHaveLength(CSV_HEADER.length);
    expect(first).toContain('"Criar ""checklist"""');
    expect(first.endsWith('"Concluído"')).toBe(true);
    expect(second.endsWith('"Impedido"')).toBe(true);
    expect(csv).not.toMatch(/"(todo|doing|done|blocked)"/);
  });

  it('CSV: texto que começaria uma fórmula abre como texto', () => {
    expect(csvCell('=SOMA(A1)')).toBe(`"'=SOMA(A1)"`);
    expect(csvCell('+55')).toBe(`"'+55"`);
    expect(csvCell('@user')).toBe(`"'@user"`);
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell(null)).toBe('""');
    expect(planCsv(tasks)).toContain(`"'=SOMA(A1)"`);
  });

  it('nome do arquivo sem espaço nem caractere proibido', () => {
    expect(planCsvFileName('Plano: Redesenho / v2')).toBe('Plano_Acao_Plano_Redesenho__v2.csv');
    expect(planCsvFileName('')).toBe('Plano_Acao_plano.csv');
  });
});

describe('linhas do lobby', () => {
  const server = [
    board({ id: 'a', title: 'Redesenho do onboarding', createdAt: '2026-10-16T10:00:00Z' }),
    board({ id: 'b', title: 'Preparar a migração', createdAt: '2026-09-02T10:00:00Z', isPublic: false }),
  ];

  it('junta os planos da squad e os abertos neste navegador, sem repetir, do mais novo ao mais antigo', () => {
    const rows = mergePlanRows(server, [
      { roomId: 'A', title: 'Redesenho (histórico)', createdAt: '2026-10-16T10:00:00Z' },
      { roomId: 'c', title: 'Plano antigo sem squad', createdAt: '2026-09-20T10:00:00Z' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(rows[1]).toMatchObject({ local: true, isPublic: null });
    expect(rows[2]).toMatchObject({ local: false, isPublic: false });
  });

  it('limita o histórico local', () => {
    const local = Array.from({ length: 8 }, (_, i) => ({ roomId: `l${i}`, title: `L${i}`, createdAt: `2026-08-0${i + 1}T10:00:00Z` }));
    expect(mergePlanRows([], local)).toHaveLength(5);
    expect(mergePlanRows([], local, 2)).toHaveLength(2);
  });

  it('busca por nome sem acento', () => {
    const rows = mergePlanRows(server, []);
    expect(filterPlanRows(rows, 'MIGRACAO').map((r) => r.id)).toEqual(['b']);
    expect(filterPlanRows(rows, '')).toHaveLength(2);
  });
});

describe('pessoas da squad', () => {
  const members = [
    { displayName: 'Diego Alves', email: 'diego@totvs.com.br', claimedByUid: 'u-diego' },
    { displayName: 'Ana Ribeiro', email: 'ana@totvs.com.br' },
    { displayName: 'ana ribeiro', email: 'ANA@totvs.com.br' },
    { displayName: '', email: 'sem.nome@totvs.com.br' },
    { displayName: '  ', email: '' },
  ];

  it('ordena, tira repetidos e usa o e-mail quando falta o nome', () => {
    const people = toPlanPeople(members);
    expect(people.map((p) => p.name)).toEqual(['Ana Ribeiro', 'Diego Alves', 'sem.nome@totvs.com.br']);
    expect(people.find((p) => p.name === 'Diego Alves')?.userId).toBe('u-diego');
    expect(toPlanPeople(null)).toEqual([]);
  });

  it('sugere por nome ou e-mail e respeita o limite', () => {
    const people = toPlanPeople(members);
    expect(suggestPeople(people, 'dieg').map((p) => p.name)).toEqual(['Diego Alves']);
    expect(suggestPeople(people, 'ANA@').map((p) => p.name)).toEqual(['Ana Ribeiro']);
    expect(suggestPeople(people, '')).toHaveLength(3);
    expect(suggestPeople(people, '', 2)).toHaveLength(2);
    expect(suggestPeople(people, 'zzz')).toEqual([]);
  });

  it('acha a pessoa pelo nome exato', () => {
    const people = toPlanPeople(members);
    expect(findPersonByName(people, ' diego ALVES ')?.userId).toBe('u-diego');
    expect(findPersonByName(people, 'Diego')).toBeUndefined();
    expect(findPersonByName(people, '')).toBeUndefined();
  });
});

describe('origem e prazo (V78)', () => {
  it('o formulário traz o prazo em data; ação antiga (sem dueDate) vem vazia', () => {
    expect(taskToForm(task({ id: '1', dueDate: '2026-11-05' })).dueDate).toBe('2026-11-05');
    expect(taskToForm(task({ id: '1' })).dueDate).toBe('');
    expect(taskToForm(task({ id: '1', dueDate: null })).dueDate).toBe('');
    expect(taskToForm(null).dueDate).toBe('');
  });

  it('gravação com servidor novo: manda dueDate; apagou um prazo que existia manda clearDueDate; sem prazo antes nem depois não manda nada', () => {
    const form = taskToForm(task({ id: '1', dueDate: '2026-11-05' }));
    expect(taskFormPayload(form, { dueDate: '2026-11-05' }, true)).toMatchObject({ what: 'Criar o checklist', when: '25/10', dueDate: '2026-11-05' });
    expect(taskFormPayload({ ...form, dueDate: '' }, { dueDate: '2026-11-05' }, true)).toMatchObject({ clearDueDate: true });
    expect(taskFormPayload({ ...form, dueDate: '' }, { dueDate: '2026-11-05' }, true)).not.toHaveProperty('dueDate');
    const semPrazo = taskFormPayload({ ...form, dueDate: '' }, { dueDate: null }, true);
    expect(semPrazo).not.toHaveProperty('dueDate');
    expect(semPrazo).not.toHaveProperty('clearDueDate');
    expect(taskFormPayload({ ...form, dueDate: '2026-12-01' }, null, true)).toMatchObject({ dueDate: '2026-12-01' });
  });

  it('gravação com servidor antigo: dueDate e clearDueDate nem saem (o prazo segue no texto livre)', () => {
    const form = taskToForm(task({ id: '1', dueDate: '2026-11-05' }));
    const body = taskFormPayload(form, { dueDate: '2026-11-05' }, false);
    expect(body).not.toHaveProperty('dueDate');
    expect(body).not.toHaveProperty('clearDueDate');
    expect(body.when).toBe('25/10');
  });

  it('as linhas do lobby levam origem e contagens; sem elas ficam sem origem e sem contagem', () => {
    const rows = mergePlanRows(
      [
        board({ id: 'a', sourceType: 'HEALTH_CHECK', sourceId: 'hc1', sourceTitle: 'Sprint 42', tasksTotal: 4, tasksDone: 1 }),
        board({ id: 'b', createdAt: '2026-09-01T10:00:00Z' }),
      ],
      [{ roomId: 'loc', title: 'Local', createdAt: '2026-08-01T10:00:00Z' }],
    );
    const a = rows.find((r) => r.id === 'a')!;
    expect(a).toMatchObject({ sourceType: 'HEALTH_CHECK', sourceId: 'hc1', sourceTitle: 'Sprint 42', counts: { total: 4, done: 1, open: 3, pct: 25 } });
    expect(rows.find((r) => r.id === 'b')).toMatchObject({ sourceType: undefined, counts: null });
    expect(rows.find((r) => r.id === 'loc')?.sourceType).toBeUndefined();
    expect(rows.find((r) => r.id === 'loc')?.counts).toBeNull();
  });

  it('filtros da lista: origem e andamento se combinam com a busca por nome', () => {
    const rows = mergePlanRows(
      [
        board({ id: 'r', title: 'Plano da retro', sourceType: 'RETRO', tasksTotal: 3, tasksDone: 3 }),
        board({ id: 'h', title: 'Plano do radar', sourceType: 'HEALTH_CHECK', tasksTotal: 5, tasksDone: 2 }),
        board({ id: 'm', title: 'Plano à mão', sourceType: 'MANUAL', tasksTotal: 0, tasksDone: 0 }),
      ],
      [],
    );
    const ids = (f: Parameters<typeof filterPlanRows>[2], q = '') => filterPlanRows(rows, q, f).map((r) => r.id).sort();
    expect(ids({ origin: 'RETRO' })).toEqual(['r']);
    expect(ids({ origin: 'MANUAL' })).toEqual(['m']);
    expect(ids({ progress: 'open' })).toEqual(['h']);
    expect(ids({ progress: 'done' })).toEqual(['r']);
    expect(ids({ origin: 'HEALTH_CHECK', progress: 'done' })).toEqual([]);
    expect(ids({ origin: FILTER_ALL, progress: 'all' }, 'radar')).toEqual(['h']);
  });

  it('Markdown e CSV exportam a data do prazo e a origem da ação', () => {
    const tasks = [task({ id: '1', dueDate: '2026-11-05', sourceLabel: 'Comunicação' }), task({ id: '2' })];
    const md = planMarkdown(board(), tasks, 'd');
    expect(md).toContain('- **Prazo:** 05/11/2026');
    expect(md).toContain('- **Origem:** Comunicação');
    expect(md.match(/\*\*Prazo:\*\*/g)).toHaveLength(1);
    const [head, first, second] = planCsv(tasks).split('\n');
    expect(head.split(',')).toContain('"Prazo (Due date)"');
    expect(first).toContain('"05/11/2026"');
    expect(second).toContain('"25/10","","Ana Ribeiro"');
  });
});
