import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import type { PlanSummary, PlanView, SubtaskType } from '../../../lib/sprint-planner/api';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  api: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    changeStatus: vi.fn(),
    remove: vi.fn(),
    updatePerson: vi.fn(),
    addAbsence: vi.fn(),
    deleteAbsence: vi.fn(),
    replaceHolidays: vi.fn(),
  },
  types: { get: vi.fn(), update: vi.fn() },
}));

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../lib/sprint-planner/api', async (orig) => {
  const actual = await orig<typeof import('../../../lib/sprint-planner/api')>();
  return { ...actual, sprintPlanApi: h.api, subtaskTypesApi: h.types };
});

import { PlannerLobby } from '../PlannerLobby';
import { CreatePlanDialog } from '../CreatePlanDialog';
import { CONFLICT_MESSAGE, PlanScreen } from '../PlanScreen';
import { validateAbsence } from '../AbsencesPanel';
import { SubtaskTypesSection } from '../SubtaskTypesSection';

const summary = (over: Partial<PlanSummary> = {}): PlanSummary => ({
  id: 'p1', jiraSprintId: null, sprintName: 'Sprint 2026.10/2', startDate: '2026-10-21', endDate: '2026-11-03',
  status: 'RASCUNHO', totals: { capDev: 120, capQa: 64, planDev: 0, planQa: 0 }, updatedAt: null, ...over,
});

function planView(over: Partial<PlanView> = {}, canEditPlan = true): PlanView {
  return {
    id: 'p1', squadId: 'SQ', version: 3, status: 'RASCUNHO',
    sprint: { jiraSprintId: null, name: 'Sprint 2026.10/2', startDate: '2026-10-21', endDate: '2026-11-03', sprintKey: 'plan:p1' },
    goal: 'Entregar o checkout',
    reserve: { mode: 'HORAS', pct: 10, focusPct: null, types: [] },
    syncedAt: null,
    capacity: {
      byClass: { DEV: 66, QA: 31.5 },
      workingDays: 9,
      people: [
        { accountId: 'a1', name: 'Ana', papel: 'DEV', diasCod: 8, diasReg: 1, horasProdutivas: 8, papelInherited: false, diasCodInherited: true, diasRegInherited: false, horasProdutivasInherited: false, papelSource: null, diasCodSource: 'GLOBAL', diasRegSource: null, horasProdutivasSource: null, included: true, personFocusPct: null, focusPct: null, baseHours: 72, holidaysHours: 8, absencesHours: 0, capacityHours: 66 },
        { accountId: 'a2', name: 'Bruno', papel: 'QA', diasCod: 7, diasReg: 2, horasProdutivas: 4.5, papelInherited: false, diasCodInherited: false, diasRegInherited: false, horasProdutivasInherited: false, papelSource: null, diasCodSource: null, diasRegSource: null, horasProdutivasSource: null, included: true, personFocusPct: null, focusPct: null, baseHours: 40.5, holidaysHours: 4.5, absencesHours: 4.5, capacityHours: 31.5 },
      ],
    },
    absences: [{ id: 'ab1', accountId: 'a2', startDate: '2026-10-23', endDate: '2026-10-23', hoursPerDay: null, reason: 'Consulta' }],
    holidays: [{ day: '2026-11-02', label: 'Finados' }],
    items: [], assignments: [],
    thermometer: {
      DEV: { allocatedHours: 0, capacityHours: 66, pct: 0, zone: 'VERDE', state: 'DENTRO_DA_CAPACIDADE', reservePct: 10, reserveLimitHours: 72.6 },
      QA: { allocatedHours: 30, capacityHours: 31.5, pct: 95.2, zone: 'VERMELHO', state: 'DENTRO_DA_CAPACIDADE', reservePct: 10, reserveLimitHours: 34.65 },
    },
    permissions: { canEditPlan, canEditTypes: canEditPlan, myAccountId: 'a1' },
    updatedAt: null,
    ...over,
  };
}

const type = (over: Partial<SubtaskType> = {}): SubtaskType => ({
  typeId: '10036', typeName: 'Codificação', subtaskClass: 'DEV', origin: 'PADRAO', qaByTitleException: false,
  defaultHours: null, inheritedFromSprint: null, updatedBy: null, updatedAt: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.types.get.mockResolvedValue({ status: 'ok', data: { sprintKey: 'plan:p1', canEdit: true, types: [type()] } });
});
afterEach(cleanup);

describe('Lobby', () => {
  it('mostra carregando e depois a lista com status, datas e totais DEV/QA', async () => {
    let resolve!: (v: PlanSummary[]) => void;
    h.api.list.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<PlannerLobby squadId="SQ" canCreate onCreate={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toMatch(/Carregando planejamentos/);
    resolve([summary(), summary({ id: 'p2', sprintName: 'Sprint 2026.10/1', status: 'REVISAO', totals: { capDev: 100, capQa: 50, planDev: 90, planQa: 40 } })]);
    expect(await screen.findByText('Sprint 2026.10/2')).toBeTruthy();
    expect(screen.getAllByText('21/10 a 03/11')).toHaveLength(2);
    expect(screen.getByText('Revisão')).toBeTruthy();
    expect(screen.getByText('de 120 h')).toBeTruthy();
    expect(screen.getByText('2 sprints')).toBeTruthy();
    // liderança: exclui só RASCUNHO/ESCOPO
    expect(screen.getAllByRole('button', { name: /Excluir o planejamento/ })).toHaveLength(1);
  });

  it('estado vazio: liderança vê o convite para começar; membro só lê', async () => {
    h.api.list.mockResolvedValue([]);
    const onCreate = vi.fn();
    render(<PlannerLobby squadId="SQ" canCreate onCreate={onCreate} />);
    expect(await screen.findByText('Nenhum planejamento ainda')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Planejar a próxima sprint/ }));
    expect(onCreate).toHaveBeenCalled();
    cleanup();

    render(<PlannerLobby squadId="SQ" canCreate={false} onCreate={vi.fn()} />);
    expect(await screen.findByText(/A liderança da squad ainda não começou/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Planejar a próxima sprint/ })).toBeNull();
  });

  it('membro não vê excluir em plano existente', async () => {
    h.api.list.mockResolvedValue([summary()]);
    render(<PlannerLobby squadId="SQ" canCreate={false} onCreate={vi.fn()} />);
    await screen.findByText('Sprint 2026.10/2');
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
    expect(screen.getByText(/Você acompanha em leitura/)).toBeTruthy();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    h.api.list.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce([summary()]);
    render(<PlannerLobby squadId="SQ" canCreate onCreate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText('Sprint 2026.10/2')).toBeTruthy();
    expect(h.api.list).toHaveBeenCalledTimes(2);
  });
});

describe('Criar plano', () => {
  it('valida localmente e envia sprint, datas e meta', async () => {
    const onCreated = vi.fn();
    h.api.create.mockResolvedValue(planView());
    render(<CreatePlanDialog open onOpenChange={vi.fn()} squadId="SQ" onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela capacidade' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/nome da sprint/);
    expect(h.api.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/Sprint 2026/), { target: { value: ' Sprint X ' } });
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText(/Meta da sprint/), { target: { value: 'Checkout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela capacidade' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(h.api.create).toHaveBeenCalledWith('SQ', { sprintName: 'Sprint X', startDate: '2026-10-21', endDate: '2026-11-03', goal: 'Checkout' });
  });

  it('409 (a sprint já tem plano) mostra a mensagem do servidor', async () => {
    h.api.create.mockRejectedValue(new CeremonyApiError('Já existe um planejamento para esta sprint.', 409));
    render(<CreatePlanDialog open onOpenChange={vi.fn()} squadId="SQ" onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Sprint 2026/), { target: { value: 'S' } });
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-10-21' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-11-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Começar pela capacidade' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Já existe um planejamento para esta sprint.');
  });
});

function renderPlan(step: 'capacidade' | 'escopo' | 'distribuicao' = 'capacidade') {
  return render(<PlanScreen squadId="SQ" planId="p1" step={step} onStepChange={vi.fn()} />);
}

describe('Capacidade', () => {
  it('mostra exatamente os números do PlanView (capacidade, totais, termômetro, dias úteis)', async () => {
    h.api.get.mockResolvedValue(planView());
    renderPlan();
    expect((await screen.findAllByTestId('cap-a1'))[0].textContent).toBe('66 h');
    expect(screen.getAllByTestId('cap-a2')[0].textContent).toBe('31,5 h');
    expect(screen.getByTestId('total-DEV').textContent).toContain('66 h');
    expect(screen.getByTestId('total-QA').textContent).toContain('31,5 h');
    const qa = screen.getByTestId('termometro-QA');
    expect(qa.textContent).toContain('95%');
    expect(qa.textContent).toContain('No limite');
    expect(qa.textContent).toContain('30 h de 31,5 h');
    expect(screen.getByText(/9 dias úteis/)).toBeTruthy();
    expect(screen.getAllByText('Consulta', { exact: false }).length).toBeGreaterThan(0);
  });

  it('membro: tudo em leitura, sem campos nem botões de etapa', async () => {
    h.api.get.mockResolvedValue(planView({}, false));
    h.types.get.mockResolvedValue({ status: 'ok', data: { sprintKey: 'plan:p1', canEdit: false, types: [type()] } });
    renderPlan();
    await screen.findAllByTestId('cap-a1');
    expect(screen.getByText(/Só a liderança da squad monta a capacidade/)).toBeTruthy();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryByRole('form', { name: 'Lançar ausência' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Avançar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    expect(await screen.findByText('DEV', { selector: 'span.rounded-full' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Classe do tipo/ })).toBeNull();
  });

  it('liderança edita a pessoa: grava e recarrega o plano', async () => {
    h.api.get.mockResolvedValue(planView());
    h.api.updatePerson.mockResolvedValue({});
    renderPlan();
    const [input] = await screen.findAllByRole('spinbutton', { name: 'Dias de codificação e teste de Ana' });
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    await waitFor(() => expect(h.api.updatePerson).toHaveBeenCalledWith('SQ', 'p1', 'a1', { diasCod: 7 }));
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
  });

  it('conflito 409 de version: recarrega e avisa', async () => {
    h.api.get.mockResolvedValueOnce(planView()).mockResolvedValueOnce(planView({ version: 4 }));
    h.api.patch.mockRejectedValue(new CeremonyApiError('O plano foi alterado por outra pessoa.', 409));
    renderPlan();
    await screen.findAllByTestId('cap-a1');
    fireEvent.click(screen.getByRole('radio', { name: /Fator de foco/ }));
    await waitFor(() => expect(h.api.patch).toHaveBeenCalledWith('SQ', 'p1', { reserveMode: 'FOCO', version: 3 }));
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: CONFLICT_MESSAGE }));
  });

  it('reserva grava com a version atual', async () => {
    h.api.get.mockResolvedValue(planView());
    h.api.patch.mockResolvedValue(planView({ version: 4, reserve: { mode: 'HORAS', pct: 15, focusPct: null, types: [] } }));
    renderPlan();
    const input = await screen.findByLabelText('Reserva desta sprint em porcentagem');
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);
    await waitFor(() => expect(h.api.patch).toHaveBeenCalledWith('SQ', 'p1', { reservePct: 15, version: 3 }));
  });

  it('etapas futuras são placeholders, sem dados', async () => {
    h.api.get.mockResolvedValue(planView());
    renderPlan('distribuicao');
    expect(await screen.findByText('Distribuição chega numa próxima entrega')).toBeTruthy();
    expect(screen.queryByTestId('total-DEV')).toBeNull();
  });
});

describe('Ausências', () => {
  const sprint = { startDate: '2026-10-21', endDate: '2026-11-03' };
  it('valida pessoa, datas dentro da sprint e horas', () => {
    expect(validateAbsence({ accountId: '', startDate: '2026-10-22', endDate: '', partial: false, hours: '' }, sprint)).toMatch(/pessoa/);
    expect(validateAbsence({ accountId: 'a1', startDate: '2026-10-01', endDate: '', partial: false, hours: '' }, sprint)).toMatch(/dentro da sprint/);
    expect(validateAbsence({ accountId: 'a1', startDate: '2026-10-25', endDate: '2026-10-22', partial: false, hours: '' }, sprint)).toMatch(/antes/);
    expect(validateAbsence({ accountId: 'a1', startDate: '2026-10-22', endDate: '', partial: true, hours: '0' }, sprint)).toMatch(/horas/);
    expect(validateAbsence({ accountId: 'a1', startDate: '2026-10-22', endDate: '', partial: true, hours: '4' }, sprint)).toBeNull();
  });

  it('liderança lança ausência de dia inteiro e remove outra', async () => {
    h.api.get.mockResolvedValue(planView());
    h.api.addAbsence.mockResolvedValue({});
    h.api.deleteAbsence.mockResolvedValue(undefined);
    renderPlan();
    const form = await screen.findByRole('form', { name: 'Lançar ausência' });
    fireEvent.change(within(form).getByLabelText('Pessoa'), { target: { value: 'a1' } });
    fireEvent.change(within(form).getByLabelText('De'), { target: { value: '2026-10-27' } });
    fireEvent.change(within(form).getByLabelText(/Motivo/), { target: { value: 'Folga' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar' }));
    await waitFor(() =>
      expect(h.api.addAbsence).toHaveBeenCalledWith('SQ', 'p1', { accountId: 'a1', startDate: '2026-10-27', endDate: '2026-10-27', hoursPerDay: null, reason: 'Folga' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remover ausência de Bruno' }));
    await waitFor(() => expect(h.api.deleteAbsence).toHaveBeenCalledWith('SQ', 'p1', 'ab1'));
  });
});

describe('Tipos de subtarefa', () => {
  it('liderança troca a classe e grava pelo contrato da E1b', async () => {
    h.types.get.mockResolvedValue({ status: 'ok', data: { sprintKey: 'GLOBAL', canEdit: true, types: [type(), type({ typeId: '999', typeName: 'Reunião', subtaskClass: 'SEM_CLASSIFICACAO' })] } });
    h.types.update.mockResolvedValue({ sprintKey: 'GLOBAL', canEdit: true, types: [type({ typeId: '999', typeName: 'Reunião', subtaskClass: 'FORA_DA_CONTA', origin: 'MANUAL' })] });
    render(<SubtaskTypesSection squadId="SQ" sprintKey="GLOBAL" canEdit />);
    expect(await screen.findByText(/1 tipo sem classificação/)).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Classe do tipo Reunião' }), { target: { value: 'FORA_DA_CONTA' } });
    await waitFor(() =>
      expect(h.types.update).toHaveBeenCalledWith('SQ', 'GLOBAL', [
        { typeId: '999', typeName: 'Reunião', subtaskClass: 'FORA_DA_CONTA', defaultHours: null, qaByTitleException: false },
      ]),
    );
    expect(await screen.findByText('Ajustado pela liderança')).toBeTruthy();
    expect(screen.queryByText(/sem classificação:/)).toBeNull();
  });

  it('membro vê a classe em leitura', async () => {
    render(<SubtaskTypesSection squadId="SQ" sprintKey="GLOBAL" canEdit={false} />);
    expect(await screen.findByText('Codificação')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(/Você vê em leitura/)).toBeTruthy();
  });

  it('backend sem a rota (404) mostra aviso, não erro', async () => {
    h.types.get.mockResolvedValue({ status: 'unavailable' });
    render(<SubtaskTypesSection squadId="SQ" sprintKey="GLOBAL" canEdit />);
    expect(await screen.findByText(/ainda não estão disponíveis/)).toBeTruthy();
  });
});
