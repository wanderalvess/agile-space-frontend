import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import type { BacklogParent, BacklogView, PlanItem, PlanView, Thermometer } from '../../../lib/sprint-planner/api';
import { planItem, scopeTotalsOf, scopeViewOf } from '../../../lib/sprint-planner/__tests__/fixtures/scope';
import { applyScope } from '../../../lib/sprint-planner/scope';
import type { ScopeView } from '../../../lib/sprint-planner/api';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  api: {
    get: vi.fn(), patch: vi.fn(), changeStatus: vi.fn(), addItems: vi.fn(), removeItem: vi.fn(),
    updatePerson: vi.fn(), addAbsence: vi.fn(), deleteAbsence: vi.fn(), replaceHolidays: vi.fn(),
  },
  backlog: { get: vi.fn(), sync: vi.fn() },
  types: { get: vi.fn(), update: vi.fn() },
}));

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../lib/sprint-planner/api', async (orig) => {
  const actual = await orig<typeof import('../../../lib/sprint-planner/api')>();
  return { ...actual, sprintPlanApi: h.api, backlogApi: h.backlog, subtaskTypesApi: h.types };
});

import { PlanScreen } from '../PlanScreen';
import { ScopeStep } from '../ScopeStep';
import { barSummary } from '../ScopeBars';

const thermo = (alloc: number, cap: number, over: Partial<Thermometer> = {}): Thermometer => {
  const pct = (alloc / cap) * 100;
  return {
    allocatedHours: alloc, capacityHours: cap, pct, reservePct: 12, reserveLimitHours: cap * 1.12,
    zone: pct < 85 ? 'VERDE' : pct <= 95 ? 'AMARELO' : 'VERMELHO',
    state: pct <= 100 ? 'DENTRO_DA_CAPACIDADE' : alloc <= cap * 1.12 ? 'COBERTO_PELA_RESERVA' : 'ACIMA_DA_RESERVA',
    ...over,
  };
};

const sub = (over: Partial<BacklogParent['subtasks'][number]> = {}) => ({
  key: 'S-1', title: 'sub', typeId: '1', typeName: 'Codificação', subtaskClass: 'DEV' as const, estimateH: 16, remainingH: 16, countedH: 16,
  defaultHoursApplied: false, status: null, statusCategory: null, assigneeId: null, assigneeName: null, ...over,
});

const task = (over: Partial<BacklogParent> = {}): BacklogParent => ({
  key: 'SQ-1', title: 'Troca de produto', status: 'Refinamento Concluído', carryOver: false, titleHours: { dev: 10, qa: 4 },
  subtasks: [sub({ estimateH: 10, countedH: 10 }), sub({ key: 'S-2', typeName: 'Teste', subtaskClass: 'QA', estimateH: 4, countedH: 4 })],
  sumByClass: { DEV: 10, QA: 4 }, divergenceDev: false, divergenceQa: false, divergent: false, ...over,
});

const view = (items: BacklogParent[], over: Partial<BacklogView> = {}): BacklogView => ({
  syncedAt: new Date(Date.now() - 3 * 60000).toISOString(), sprintKey: 'plan:p1', items, unclassifiedTypes: [], ...over,
});

function planView(over: Partial<PlanView> = {}, canEditPlan = true): PlanView {
  return {
    id: 'p1', squadId: 'SQ', version: 3, status: 'ESCOPO',
    sprint: { jiraSprintId: null, name: 'Sprint 2026.10/2', startDate: '2026-10-21', endDate: '2026-11-03', sprintKey: 'plan:p1' },
    goal: 'Entregar o checkout',
    reserve: { mode: 'HORAS', pct: 12, focusPct: null, types: [] },
    syncedAt: null,
    capacity: { byClass: { DEV: 90, QA: 75 }, workingDays: 9, people: [] },
    absences: [], holidays: [], items: [], scope: scopeTotalsOf([]), assignments: [], goalSavedInJira: false,
    thermometer: { DEV: thermo(0, 90), QA: thermo(0, 75) },
    permissions: { canEditPlan, canEditTypes: canEditPlan, myAccountId: 'a1' },
    updatedAt: null,
    ...over,
  };
}

/** Item do plano no formato do backend para uma tarefa do backlog (horas: sobra = restante; senão título; senão subtarefas). */
const itemOf = (t: BacklogParent, id: string, sortOrder: number): PlanItem => {
  const dev = t.carryOver ? t.sumByClass.DEV ?? 0 : t.titleHours?.dev ?? t.sumByClass.DEV ?? 0;
  const qa = t.carryOver ? t.sumByClass.QA ?? 0 : t.titleHours?.qa ?? t.sumByClass.QA ?? 0;
  return planItem({
    id, parentKey: t.key, title: t.title, sortOrder, carryOver: t.carryOver, titleDevHours: t.titleHours?.dev ?? null, titleQaHours: t.titleHours?.qa ?? null,
    devHours: dev, qaHours: qa, subtaskDevH: t.sumByClass.DEV ?? 0, subtaskQaH: t.sumByClass.QA ?? 0,
    divergenceDev: t.divergenceDev, divergenceQa: t.divergenceQa, divergent: t.divergent,
  });
};

const withItem = (p: PlanView, t: BacklogParent, id = 'i1'): PlanView => {
  const items = [...p.items, itemOf(t, id, p.items.length + 1)];
  return { ...p, items, scope: scopeTotalsOf(items) };
};

function mockMedia(mobile: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: mobile && q.includes('max-width'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderStep(plan: PlanView, onOver: Partial<React.ComponentProps<typeof ScopeStep>> = {}) {
  const props = { plan, onScope: vi.fn(), onReload: vi.fn().mockResolvedValue(undefined), onPatch: vi.fn(), onOpenTypes: vi.fn(), ...onOver };
  return { ...render(<ScopeStep {...props} />), props };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMedia(false);
  h.backlog.get.mockResolvedValue({ status: 'ok', data: view([task()]) });
  h.types.get.mockResolvedValue({ status: 'ok', data: { sprintKey: 'plan:p1', canEdit: true, types: [] } });
});
afterEach(cleanup);

describe('Escopo: barras', () => {
  it('escreve o resumo como no design', () => {
    expect(barSummary('DEV', thermo(96, 90))).toBe('DEV 96/90 h · 107% · coberto pela reserva (12%)');
    expect(barSummary('QA', thermo(70, 75))).toBe('QA 70/75 h · 93%');
    expect(barSummary('QA', thermo(100, 90, { state: 'ACIMA_DA_RESERVA' }))).toContain('acima da reserva');
  });

  it('mostra as barras do backend e o alerta forte acima da reserva, sem bloquear nada', async () => {
    const p = planView({ thermometer: { DEV: thermo(120, 90), QA: thermo(70, 75) } });
    renderStep(p);
    expect(screen.getByTestId('escopo-resumo-QA').textContent).toBe('QA 70/75 h · 93%');
    expect(screen.getByTestId('escopo-alerta-DEV').textContent).toMatch(/DEV passou do limite da reserva/);
    expect(screen.queryByTestId('escopo-alerta-QA')).toBeNull();
    expect((await screen.findByRole('button', { name: /Adicionar SQ-1/ })).hasAttribute('disabled')).toBe(false);
  });
});

describe('Escopo: selecionar e recalcular', () => {
  it('adiciona: barras se mexem na hora (provisório) e depois valem as do servidor', async () => {
    let resolve!: (v: ScopeView) => void;
    h.api.addItems.mockReturnValue(new Promise((r) => { resolve = r; }));
    const p = planView({ thermometer: { DEV: thermo(80, 90), QA: thermo(60, 75) } });
    const { props, rerender } = renderStep(p);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar SQ-1 ao escopo' }));

    // estimativa: 80 + 10 = 90 h de 90 h (100%); QA 64/75
    expect(screen.getByTestId('escopo-resumo-DEV').textContent).toBe('DEV 90/90 h · 100%');
    expect(screen.getByTestId('escopo-resumo-QA').textContent).toBe('QA 64/75 h · 85%');
    expect(screen.getAllByText('Calculando')).toHaveLength(2);
    expect(screen.getByTestId('escopo-SQ-1')).toBeTruthy();
    expect(h.api.addItems).toHaveBeenCalledWith('SQ', 'p1', ['SQ-1']);

    // O POST devolve o ScopeView (201), não o PlanView.
    const sv = scopeViewOf([itemOf(task(), 'i1', 1)], { DEV: thermo(91, 90), QA: thermo(64, 75) });
    resolve(sv);
    await waitFor(() => expect(props.onScope).toHaveBeenCalledWith(sv));
    await waitFor(() => expect(props.onReload).toHaveBeenCalled()); // a versão do plano mudou: recarrega
    const fromServer = applyScope(p, sv);
    rerender(<ScopeStep {...props} plan={fromServer} />);
    await waitFor(() => expect(screen.queryByText('Calculando')).toBeNull());
    expect(screen.getByTestId('escopo-resumo-DEV').textContent).toBe('DEV 91/90 h · 101% · coberto pela reserva (12%)');
    expect(screen.queryByRole('button', { name: /Adicionar SQ-1/ })).toBeNull();
  });

  it('remove: tira da lista na hora, chama o servidor (204, sem corpo) e recarrega o plano', async () => {
    h.api.removeItem.mockResolvedValue(undefined);
    const p = withItem(planView({ thermometer: { DEV: thermo(10, 90), QA: thermo(4, 75) } }), task());
    const { props } = renderStep(p);
    fireEvent.click(await screen.findByRole('button', { name: 'Remover SQ-1 do escopo' }));
    expect(screen.queryByTestId('escopo-SQ-1')).toBeNull();
    expect(screen.getByTestId('escopo-resumo-DEV').textContent).toBe('DEV 0/90 h · 0%');
    await waitFor(() => expect(h.api.removeItem).toHaveBeenCalledWith('SQ', 'p1', 'i1'));
    await waitFor(() => expect(props.onReload).toHaveBeenCalled());
  });

  it('erro ao adicionar: desfaz a estimativa e mostra a mensagem do servidor', async () => {
    h.api.addItems.mockRejectedValue(new CeremonyApiError('A tarefa já está no plano.', 409));
    const { props } = renderStep(planView());
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar SQ-1 ao escopo' }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'A tarefa já está no plano.', variant: 'destructive' })));
    await waitFor(() => expect(props.onReload).toHaveBeenCalled());
    expect(screen.queryByTestId('escopo-SQ-1')).toBeNull();
    expect(screen.getByTestId('escopo-resumo-DEV').textContent).toBe('DEV 0/90 h · 0%');
  });
});

describe('Escopo: sinalizações nas tarefas', () => {
  it('divergência, sem estimativa, carry-over e tipos sem classificação', async () => {
    const divergent = task({
      key: 'SQ-2', title: 'Pagamento', titleHours: { dev: 18, qa: 4 }, sumByClass: { DEV: 16, QA: 4 }, divergenceDev: true, divergent: true,
      subtasks: [sub({ estimateH: 16, countedH: 16 }), sub({ key: 'S-9', subtaskClass: 'SEM_CLASSIFICACAO', typeName: 'Especificação', estimateH: 3, countedH: 3 })],
    });
    const none = task({ key: 'SQ-3', title: 'Sem nada', titleHours: null, subtasks: [], sumByClass: {} });
    const carry = task({
      key: 'SQ-4', title: 'Sobra', carryOver: true, titleHours: null, sumByClass: { DEV: 6, QA: 0 },
      subtasks: [sub({ estimateH: 20, remainingH: 6, countedH: 6 })],
    });
    h.backlog.get.mockResolvedValue({
      status: 'ok',
      data: view([divergent, none, carry], { unclassifiedTypes: [{ typeId: '7', typeName: 'Especificação', count: 1, hours: 3 }] }),
    });
    const unclassifiedTypes = [{ typeId: '7', typeName: 'Especificação', count: 1, hours: 3 }];
    const { props } = renderStep(planView({ scope: { ...scopeTotalsOf([]), unclassifiedCount: 1, unclassifiedHours: 3, unclassifiedTypes } }));

    const d = await screen.findByTestId('refinada-SQ-2');
    expect(d.textContent).toContain('Título diz DEV 18h, subtarefa Codificação tem 16h. Vale o título');
    expect(d.textContent).toContain('1 subtarefa de tipo sem classificação não entra no total');
    expect(screen.getByTestId('refinada-SQ-3').textContent).toContain('Sem estimativa');
    const c = screen.getByTestId('sobra-SQ-4').textContent ?? '';
    expect(c).toContain('Veio da sprint anterior');
    expect(c).toContain('Tempo Estimado 20 h');
    expect(c).toContain('Tempo Restante 6 h');

    const banner = screen.getByTestId('escopo-sem-classificacao');
    expect(banner.textContent).toContain('1 subtarefa de tipo sem classificação (3 h) não entram no total');
    fireEvent.click(within(banner).getByRole('button', { name: 'Mapear tipos' }));
    expect(props.onOpenTypes).toHaveBeenCalledTimes(1);
  });

  it('busca e filtros', async () => {
    h.backlog.get.mockResolvedValue({ status: 'ok', data: view([task(), task({ key: 'SQ-8', title: 'Cancelamento parcial' })]) });
    renderStep(planView());
    await screen.findByTestId('refinada-SQ-1');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nas refinadas' }), { target: { value: 'cancel' } });
    expect(screen.queryByTestId('refinada-SQ-1')).toBeNull();
    expect(screen.getByTestId('refinada-SQ-8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sobra da anterior' }));
    expect(screen.getByText('Nenhuma refinada com esse filtro.')).toBeTruthy();
  });
});

describe('Escopo: permissões', () => {
  it('membro lê: sem adicionar, remover, sincronizar nem editar a meta', async () => {
    const p = withItem(planView({}, false), task());
    renderStep(p);
    await screen.findByTestId('escopo-SQ-1');
    expect(screen.getByText(/A liderança está montando o escopo/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Meta da sprint' })).toBeNull();
    expect(screen.getByTestId('escopo-meta-leitura').textContent).toBe('Entregar o checkout');
    expect(screen.getByRole('button', { name: /Apresentar ao time/ })).toBeTruthy();
  });

  it('liderança salva a meta pelo PATCH do plano', async () => {
    const { props } = renderStep(planView());
    const box = await screen.findByRole('textbox', { name: 'Meta da sprint' });
    expect(screen.getByText('Será gravada no Sprint goal do Jira ao enviar.')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Nova meta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(props.onPatch).toHaveBeenCalledWith({ goal: 'Nova meta' });
  });
});

describe('Escopo: sincronizar o backlog', () => {
  it('sincroniza, mostra "há X min" e recarrega a lista', async () => {
    h.backlog.sync.mockResolvedValue({ syncedAt: new Date().toISOString(), parents: 5, carryOver: 1, subtasks: 12, truncated: false });
    const { props } = renderStep(planView());
    expect(await screen.findByTestId('escopo-sincronizado')).toBeTruthy();
    expect(screen.getByTestId('escopo-sincronizado').textContent).toBe('Jira sincronizado há 3 min');
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar backlog com o Jira/ }));
    await waitFor(() => expect(h.backlog.sync).toHaveBeenCalledWith('SQ'));
    await waitFor(() => expect(h.backlog.get).toHaveBeenCalledTimes(2));
    expect(props.onReload).toHaveBeenCalled();
  });

  it('429 mostra "Tente de novo em N s" e trava o botão', async () => {
    h.backlog.sync.mockRejectedValue(new CeremonyApiError('O backlog foi sincronizado há pouco. Tente de novo em 240 s (limite: 1 sincronização a cada 5 min).', 429));
    renderStep(planView());
    fireEvent.click(await screen.findByRole('button', { name: /Sincronizar backlog com o Jira/ }));
    expect((await screen.findByTestId('escopo-sync-aviso')).textContent).toContain('Tente de novo em 240 s');
    const btn = screen.getByRole('button', { name: /Tente de novo em 240 s/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('409 avisa que já há sincronização em andamento', async () => {
    h.backlog.sync.mockRejectedValue(new CeremonyApiError('Já existe uma sincronização em andamento para esta squad.', 409));
    renderStep(planView());
    fireEvent.click(await screen.findByRole('button', { name: /Sincronizar backlog com o Jira/ }));
    expect((await screen.findByTestId('escopo-sync-aviso')).textContent).toMatch(/sincronização em andamento/);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('vazio: convida a sincronizar; erro: oferece tentar de novo', async () => {
    h.backlog.get.mockResolvedValueOnce({ status: 'ok', data: view([]) });
    renderStep(planView());
    expect(await screen.findByText('Nenhuma tarefa refinada')).toBeTruthy();
    expect(screen.getByText(/Sincronize o backlog com o Jira/)).toBeTruthy();
    cleanup();

    h.backlog.get.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ status: 'ok', data: view([task()]) });
    renderStep(planView());
    fireEvent.click(await screen.findByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByTestId('refinada-SQ-1')).toBeTruthy();
  });
});

describe('Escopo: modo reunião', () => {
  it('mostra meta, números, barras e escopo sem nenhum controle de edição, e sai pelo botão ou pelo Esc', async () => {
    const t = task();
    const p = withItem(planView({ thermometer: { DEV: thermo(10, 90), QA: thermo(4, 75) } }), t);
    renderStep(p);
    await screen.findByTestId('escopo-SQ-1');
    fireEvent.click(screen.getByRole('button', { name: /Apresentar ao time/ }));

    const room = screen.getByTestId('modo-reuniao');
    expect(within(room).getByTestId('pres-meta-texto').textContent).toBe('Entregar o checkout');
    expect(within(room).getByTestId('pres-total-tarefas').textContent).toBe('1');
    expect(within(room).getByTestId('pres-total-DEV').textContent).toBe('10 h');
    expect(within(room).getByTestId('escopo-resumo-QA').textContent).toBe('QA 4/75 h · 5%');
    expect(within(room).getByTestId('pres-itens').textContent).toContain('SQ-1');
    expect(within(room).queryByRole('button', { name: /Adicionar|Remover|Sincronizar|Salvar/ })).toBeNull();
    expect(within(room).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(room).getByRole('button', { name: 'Lista' }));
    expect(within(room).getByTestId('pres-itens').className).toContain('grid-cols-1');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('modo-reuniao')).toBeNull();
    expect(screen.getByTestId('escopo-SQ-1')).toBeTruthy();
  });
});

describe('Escopo: celular', () => {
  it('em tela estreita vira duas abas, com as barras sempre visíveis', async () => {
    mockMedia(true);
    renderStep(withItem(planView(), task()));
    const tabs = await screen.findByRole('tablist', { name: 'Ver lista' });
    expect(within(tabs).getAllByRole('tab').map((x) => x.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Nesta sprint'), expect.stringContaining('Refinadas')]));
    expect(screen.getByTestId('escopo-barra-DEV')).toBeTruthy();
    expect(screen.queryByTestId('refinada-SQ-1')).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: /Refinadas/ }));
    expect(screen.queryByTestId('escopo-SQ-1')).toBeNull();
  });
});

describe('Avançar para Distribuição', () => {
  function renderScreen(plan: PlanView) {
    h.api.get.mockResolvedValue(plan);
    return render(<PlanScreen squadId="SQ" planId="p1" step="escopo" onStepChange={vi.fn()} />);
  }

  it('sem itens avisa e nem chama o servidor', async () => {
    renderScreen(planView());
    fireEvent.click(await screen.findByRole('button', { name: /Avançar para distribuição/ }));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'O escopo está vazio' }));
    expect(h.api.changeStatus).not.toHaveBeenCalled();
  });

  it('com itens avança; 422 do backend mostra a mensagem dele', async () => {
    h.api.changeStatus.mockRejectedValue(new CeremonyApiError('O escopo precisa de pelo menos uma tarefa.', 422));
    renderScreen(withItem(planView(), task()));
    fireEvent.click(await screen.findByRole('button', { name: /Avançar para distribuição/ }));
    await waitFor(() => expect(h.api.changeStatus).toHaveBeenCalledWith('SQ', 'p1', 3, 'DISTRIBUICAO'));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'O escopo precisa de pelo menos uma tarefa.' })));
  });
});
