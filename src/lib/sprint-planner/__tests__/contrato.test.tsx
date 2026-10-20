/**
 * Teste de contrato do Escopo (E3): os JSONs de `fixtures/` foram montados a partir dos records de
 * `SprintPlanDtos.java` (ScopeView, ItemView, ScopeSubtaskView, ScopeTotals, PlanView, Thermometer). Se o backend
 * mudar um campo, a lista de chaves abaixo (copiada dos records) é o primeiro lugar a conferir.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import scopeJson from './fixtures/scope-view.json';
import planJson from './fixtures/plan-view.json';
import { CeremonyApiError } from '../../ceremony-api';
import type { PlanView, ScopeView } from '../api';

const h = vi.hoisted(() => ({ authFetch: vi.fn(), toast: vi.fn(), backlog: { get: vi.fn(), sync: vi.fn() } }));

vi.mock('../../auth-client', () => ({ authFetch: h.authFetch }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, backlogApi: h.backlog };
});

import { parseScopeView, sprintPlanApi } from '../api';
import { applyScope, buildScope, canAdvanceFromScope, noticesFromItem, scopeSummary } from '../scope';
import { ScopeStep } from '../../../components/sprint-planner/ScopeStep';

const scope = scopeJson as unknown as ScopeView;
const plan = planJson as unknown as PlanView;

// Componentes dos records Java, na ordem em que estão declarados.
const ITEM_VIEW = ['id', 'parentKey', 'title', 'titleDevHours', 'titleQaHours', 'sortOrder', 'carryOver', 'devHours', 'qaHours', 'subtaskDevH', 'subtaskQaH', 'subtaskDevEstimateH', 'subtaskDevRemainingH', 'subtaskQaEstimateH', 'subtaskQaRemainingH', 'divergenceDev', 'divergenceQa', 'divergent', 'noEstimate', 'inBacklog', 'unclassifiedCount', 'unclassifiedHours', 'subtasks'];
const SUBTASK_VIEW = ['key', 'title', 'typeId', 'typeName', 'cls', 'estimateH', 'remainingH', 'countedH', 'defaultHoursApplied', 'assigneeId', 'assigneeName'];
const SCOPE_TOTALS = ['itemCount', 'allocated', 'carryOverCount', 'carryOverDevHours', 'carryOverQaHours', 'divergentCount', 'noEstimateCount', 'unclassifiedCount', 'unclassifiedHours', 'unclassifiedTypes'];
const SCOPE_VIEW = ['planId', 'status', 'syncedAt', 'items', 'totals', 'thermometer', 'canEditPlan'];
const THERMOMETER = ['allocatedHours', 'capacityHours', 'pct', 'zone', 'state', 'reservePct', 'reserveLimitHours'];
const PLAN_VIEW = ['id', 'squadId', 'version', 'status', 'sprint', 'goal', 'reserve', 'syncedAt', 'capacity', 'absences', 'holidays', 'items', 'scope', 'assignments', 'thermometer', 'permissions', 'goalSavedInJira', 'updatedAt'];

const sorted = (o: object) => Object.keys(o).sort();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  h.backlog.get.mockResolvedValue({ status: 'ok', data: { syncedAt: null, sprintKey: 'plan:plan-1', items: [], unclassifiedTypes: [] } });
});
afterEach(cleanup);

describe('contrato: forma dos JSONs (records de SprintPlanDtos)', () => {
  it('ScopeView, ItemView, subtarefa, totais e termômetro têm exatamente os campos do backend', () => {
    expect(sorted(scope)).toEqual([...SCOPE_VIEW].sort());
    for (const i of scope.items) {
      expect(sorted(i)).toEqual([...ITEM_VIEW].sort());
      for (const s of i.subtasks) expect(sorted(s)).toEqual([...SUBTASK_VIEW].sort());
    }
    expect(sorted(scope.totals)).toEqual([...SCOPE_TOTALS].sort());
    expect(Object.keys(scope.thermometer).sort()).toEqual(['DEV', 'QA']);
    for (const t of Object.values(scope.thermometer)) expect(sorted(t)).toEqual([...THERMOMETER].sort());
  });

  it('PlanView traz items, scope, goalSavedInJira e o termômetro com as horas dos itens', () => {
    expect(sorted(plan)).toEqual([...PLAN_VIEW].sort());
    expect(plan.items).toEqual(scope.items);
    expect(plan.scope).toEqual(scope.totals);
    expect(plan.thermometer).toEqual(scope.thermometer);
  });

  it('parseScopeView aceita o ScopeView e recusa o que não é (PlanView, vazio)', () => {
    expect(parseScopeView(scope)).toBe(scope);
    expect(() => parseScopeView(plan)).toThrow(CeremonyApiError);
    expect(() => parseScopeView(null)).toThrow(CeremonyApiError);
    expect(() => parseScopeView({})).toThrow(CeremonyApiError);
  });
});

describe('contrato: cliente REST do escopo', () => {
  it('GET /items e POST /items (201) devolvem o ScopeView; o corpo do POST é { parentKeys }', async () => {
    h.authFetch.mockResolvedValueOnce(json(scope)).mockResolvedValueOnce(json(scope, 201));
    expect(await sprintPlanApi.getScope('SQ', 'plan-1')).toEqual(scope);
    expect(await sprintPlanApi.addItems('SQ', 'plan-1', ['SQ-101', 'SQ-103'])).toEqual(scope);
    const [url, init] = h.authFetch.mock.calls[1];
    expect(String(url)).toMatch(/\/squads\/SQ\/sprint-plans\/plan-1\/items$/);
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ parentKeys: ['SQ-101', 'SQ-103'] }) });
  });

  it('DELETE /items/{id} é 204 sem corpo: resolve sem ler nada', async () => {
    h.authFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(sprintPlanApi.removeItem('SQ', 'plan-1', 'it-101')).resolves.toBeUndefined();
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('PUT /items/order devolve o ScopeView', async () => {
    h.authFetch.mockResolvedValueOnce(json(scope));
    expect(await sprintPlanApi.reorderItems('SQ', 'plan-1', ['it-103', 'it-101'])).toEqual(scope);
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ orderedItemIds: ['it-103', 'it-101'] }) });
  });

  it('erros 4xx mostram a mensagem do servidor; resposta fora do formato vira erro, não dado errado', async () => {
    h.authFetch.mockResolvedValueOnce(json({ message: 'Essa tarefa já está no plano.' }, 409));
    await expect(sprintPlanApi.addItems('SQ', 'plan-1', ['SQ-101'])).rejects.toMatchObject({ status: 409, message: 'Essa tarefa já está no plano.' });
    h.authFetch.mockResolvedValueOnce(json(plan, 201));
    await expect(sprintPlanApi.addItems('SQ', 'plan-1', ['SQ-101'])).rejects.toBeInstanceOf(CeremonyApiError);
  });
});

describe('contrato: lógica sobre o PlanView real', () => {
  it('as horas que contam são devHours/qaHours do servidor, e o resumo usa os totais dele', () => {
    const entries = buildScope(plan.items, [], new Set(), new Set());
    expect(entries.map((e) => [e.key, e.dev, e.qa])).toEqual([['SQ-101', 10, 4], ['SQ-5823', 5, 2], ['SQ-103', 6, 1]]);
    expect(scopeSummary(plan, entries, false)).toEqual({ count: 3, DEV: 21, QA: 7 });
    expect(canAdvanceFromScope(plan)).toBe(true);
  });

  it('applyScope (resposta do POST) atualiza itens e termômetro sem mexer na versão', () => {
    const next = applyScope({ ...plan, items: [], version: 9 }, scope);
    expect(next.version).toBe(9);
    expect(next.items).toHaveLength(3);
    expect(next.thermometer.DEV.allocatedHours).toBe(21);
  });

  it('caso 5823: vale o título (5h) e a divergência 5 ≠ 6 vem sinalizada pelo servidor', () => {
    const it5823 = plan.items.find((i) => i.parentKey === 'SQ-5823')!;
    expect([it5823.devHours, it5823.subtaskDevH, it5823.divergenceDev]).toEqual([5, 6, true]);
    expect(noticesFromItem(it5823).divergences).toEqual(['Título diz DEV 5h, subtarefas Codificação e Code Review somam 6h. Vale o título']);
  });
});

describe('contrato: ScopeStep com o PlanView real', () => {
  const renderStep = () => {
    const props = { plan, onScope: vi.fn(), onReload: vi.fn().mockResolvedValue(undefined), onPatch: vi.fn(), onOpenTypes: vi.fn() };
    return { ...render(<ScopeStep {...props} />), props };
  };

  it('mostra totais, barras, avisos de divergência, sobra e tipo sem classificação vindos do servidor', async () => {
    renderStep();
    expect(screen.getByTestId('escopo-totais').textContent).toBe('3 tarefas · DEV 21 h · QA 7 h');
    expect(screen.getByTestId('escopo-resumo-DEV').textContent).toBe('DEV 21/90 h · 23%');
    expect(screen.getByTestId('escopo-resumo-QA').textContent).toBe('QA 7/75 h · 9%');
    const d = screen.getByTestId('escopo-SQ-5823');
    expect(d.textContent).toContain('DEV 5 h');
    expect(d.textContent).toContain('Título diz DEV 5h, subtarefas Codificação e Code Review somam 6h. Vale o título');
    const carry = screen.getByTestId('sobra-SQ-103').textContent ?? '';
    expect(carry).toContain('Tempo Estimado 24 h');
    expect(carry).toContain('Tempo Restante 7 h');
    expect(screen.getByTestId('escopo-SQ-103').textContent).toContain('1 subtarefa de tipo sem classificação não entra no total');
    expect(screen.getByTestId('escopo-sem-classificacao').textContent).toContain('Especificação (1)');
    expect(screen.queryByText('Calculando')).toBeNull();
    await waitFor(() => expect(h.backlog.get).toHaveBeenCalled());
  });

  it('adicionar chama o POST, aplica o ScopeView devolvido e recarrega o plano (a versão mudou)', async () => {
    h.backlog.get.mockResolvedValue({
      status: 'ok',
      data: {
        syncedAt: null, sprintKey: 'plan:plan-1', unclassifiedTypes: [],
        items: [{ key: 'SQ-9', title: 'Nova', status: 'Refinamento Concluído', carryOver: false, titleHours: { dev: 2, qa: 1 }, subtasks: [], sumByClass: { DEV: 2, QA: 1 }, divergenceDev: false, divergenceQa: false, divergent: false }],
      },
    });
    h.authFetch.mockResolvedValueOnce(json(scope, 201));
    const { props } = renderStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar SQ-9 ao escopo' }));
    await waitFor(() => expect(props.onScope).toHaveBeenCalledWith(scope));
    await waitFor(() => expect(props.onReload).toHaveBeenCalled());
    expect(String(h.authFetch.mock.calls[0][0])).toMatch(/\/sprint-plans\/plan-1\/items$/);
  });

  it('remover chama o DELETE (204) e recarrega o plano', async () => {
    h.authFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { props } = renderStep();
    fireEvent.click(within(screen.getByTestId('escopo-SQ-101')).getByRole('button', { name: 'Remover SQ-101 do escopo' }));
    await waitFor(() => expect(props.onReload).toHaveBeenCalled());
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(String(h.authFetch.mock.calls[0][0])).toMatch(/\/items\/it-101$/);
  });
});
