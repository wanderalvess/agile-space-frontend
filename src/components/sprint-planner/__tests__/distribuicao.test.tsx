import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fixture from '../../../lib/sprint-planner/__tests__/fixtures/distribution-view.json';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import type { DistributionView } from '../../../lib/sprint-planner/api';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  api: { get: vi.fn(), claim: vi.fn(), release: vi.fn(), setDates: vi.fn() },
  socket: { handlers: null as null | { onRefresh: () => void; onConnectionChange?: (c: boolean) => void }, close: vi.fn() },
}));

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../lib/sprint-planner/plan-socket', () => ({
  connectPlanSocket: (_id: string, handlers: { onRefresh: () => void }) => {
    h.socket.handlers = handlers;
    return h.socket.close;
  },
}));
vi.mock('../../../lib/sprint-planner/api', async (orig) => {
  const actual = await orig<typeof import('../../../lib/sprint-planner/api')>();
  return { ...actual, distributionApi: h.api };
});

import { DistributionApiError } from '../../../lib/sprint-planner/api';
import { DistributionStep } from '../DistributionStep';

const clone = (): DistributionView => JSON.parse(JSON.stringify(fixture));

function setMobile(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('max-width'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const renderStep = (status: 'DISTRIBUICAO' | 'REVISAO' | 'ESCOPO' = 'DISTRIBUICAO') =>
  render(<DistributionStep squadId="SQ" planId="p1" planStatus={status} />);

beforeEach(() => {
  vi.clearAllMocks();
  h.socket.handlers = null;
  setMobile(false);
  h.api.get.mockResolvedValue(clone());
});
afterEach(cleanup);

describe('Distribuição: topo e carga', () => {
  it('mostra meu saldo, a carga de cada pessoa e o total da equipe (valores do servidor)', async () => {
    renderStep();
    expect((await screen.findByTestId('saldo')).textContent).toContain('22/30');
    expect(screen.getByTestId('saldo').textContent).toContain('h livres');
    for (const id of ['acc-carla', 'acc-ana', 'acc-fabio']) expect(screen.getByTestId(`pessoa-${id}`)).toBeTruthy();
    expect(within(screen.getByTestId('pessoa-acc-carla')).getByRole('meter').getAttribute('aria-valuenow')).toBe('27');
    expect(screen.getByTestId('total-equipe').textContent).toContain('16 h');
  });

  it('não mostra o andamento da liderança para o membro', async () => {
    renderStep();
    await screen.findByTestId('saldo');
    expect(screen.queryByTestId('andamento')).toBeNull();
  });

  it('etapa ainda não aberta: aviso vazio e nenhuma chamada', () => {
    renderStep('ESCOPO');
    expect(screen.getByText('A distribuição ainda não abriu')).toBeTruthy();
    expect(h.api.get).not.toHaveBeenCalled();
  });

  it('erro de carga oferece tentar de novo', async () => {
    h.api.get.mockRejectedValueOnce(new CeremonyApiError('falhou', 500));
    renderStep();
    const retry = await screen.findByRole('button', { name: /tentar/i });
    fireEvent.click(retry);
    expect(await screen.findByTestId('saldo')).toBeTruthy();
  });
});

describe('Distribuição: pegar e soltar', () => {
  it('Pegar chama o claim da subtarefa e aplica a resposta', async () => {
    const after = clone();
    after.tasks[1].subtasks[0].assigneeId = 'acc-carla';
    after.tasks[1].subtasks[0].assigneeName = 'Carla Mendes';
    h.api.claim.mockResolvedValue(after);
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5821');
    fireEvent.click(within(row).getByRole('button', { name: /Pegar/ }));
    await waitFor(() => expect(h.api.claim).toHaveBeenCalledWith('SQ', 'p1', 'DDWMISSI-5821', undefined));
    await waitFor(() => expect(screen.getByTestId('sub-DDWMISSI-5821').getAttribute('data-owner')).toBe('mine'));
  });

  it('Soltar chama o DELETE e devolve a subtarefa para Disponíveis', async () => {
    const after = clone();
    after.tasks[0].subtasks[0].assigneeId = null;
    after.tasks[0].subtasks[0].assigneeName = null;
    h.api.release.mockResolvedValue(after);
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5811');
    fireEvent.click(within(row).getByRole('button', { name: /Soltar/ }));
    await waitFor(() => expect(h.api.release).toHaveBeenCalledWith('SQ', 'p1', 'DDWMISSI-5811'));
    await waitFor(() => expect(screen.getByTestId('sub-DDWMISSI-5811').getAttribute('data-owner')).toBe('free'));
  });

  it('409 no claim: avisa "Outra pessoa pegou antes" e recarrega', async () => {
    h.api.claim.mockRejectedValue(new CeremonyApiError('conflito', 409));
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5821');
    fireEvent.click(within(row).getByRole('button', { name: /Pegar/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Outra pessoa pegou antes') })));
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
  });

  it('403/422 no claim mostram a mensagem do servidor', async () => {
    h.api.claim.mockRejectedValue(new CeremonyApiError('Você só pode pegar subtarefas do seu papel.', 403));
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5821');
    fireEvent.click(within(row).getByRole('button', { name: /Pegar/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Você só pode pegar subtarefas do seu papel.' })));
  });
});

describe('Distribuição: permissões e leitura', () => {
  it('colega: cartão somente leitura com cadeado e nome, sem campos nem botões', async () => {
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5812');
    expect(row.getAttribute('data-owner')).toBe('other');
    expect(row.textContent).toContain('Ana Souza');
    expect(row.textContent).toContain('somente leitura');
    expect(row.querySelector('input')).toBeNull();
    expect(within(row).queryByRole('button')).toBeNull();
    expect(within(row).getByTestId('datas-leitura-DDWMISSI-5812').textContent).toBe('26/10 a 26/10');
  });

  it('subtarefa que não posso pegar (canClaim falso) não tem botão', async () => {
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5822');
    expect(within(row).queryByRole('button', { name: /Pegar/ })).toBeNull();
  });

  it('sem classificação / fora da conta não entram na lista e são contadas', async () => {
    renderStep();
    await screen.findByTestId('saldo');
    expect(screen.queryByTestId('sub-DDWMISSI-5814')).toBeNull();
    expect(screen.getByTestId('fora-da-conta').textContent).toContain('1 subtarefa');
  });

  it('plano fora da etapa: somente leitura, sem Pegar, Soltar nem campos', async () => {
    renderStep('REVISAO');
    await screen.findByTestId('somente-leitura');
    expect(screen.queryByRole('button', { name: /Pegar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Soltar/ })).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('liderança: vê o andamento e atribui a outra pessoa pelo seletor', async () => {
    const lead = clone();
    lead.canEditPlan = true;
    lead.tasks[0].subtasks[1].startDate = null;
    lead.tasks[0].subtasks[1].endDate = null;
    h.api.get.mockResolvedValue(lead);
    h.api.claim.mockResolvedValue(lead);
    renderStep();
    const progress = await screen.findByTestId('andamento');
    expect(progress.textContent).toContain('2 de 3 pessoas marcaram datas');
    expect(progress.textContent).toContain('Falta: Ana Souza (DEV)');
    const row = screen.getByTestId('sub-DDWMISSI-5821');
    fireEvent.change(within(row).getByLabelText(/Quem fica com/), { target: { value: 'acc-ana' } });
    fireEvent.click(within(row).getByRole('button', { name: /Atribuir/ }));
    await waitFor(() => expect(h.api.claim).toHaveBeenCalledWith('SQ', 'p1', 'DDWMISSI-5821', 'acc-ana'));
  });
});

describe('Distribuição: datas e cascata', () => {
  it('editar o fim e salvar envia início e fim; a cascata vem da resposta', async () => {
    const after = clone();
    after.tasks[0].subtasks[0].endDate = '2026-10-26';
    after.tasks[0].subtasks[1].startDate = '2026-10-27';
    after.tasks[0].subtasks[1].endDate = '2026-10-27';
    after.tasks[0].subtasks[2].startDate = '2026-10-28';
    after.tasks[0].subtasks[2].endDate = '2026-10-29';
    h.api.setDates.mockResolvedValue(after);
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5811');
    fireEvent.change(within(row).getByLabelText('Fim'), { target: { value: '2026-10-26' } });
    fireEvent.click(within(row).getByRole('button', { name: /Salvar datas/ }));
    await waitFor(() => expect(h.api.setDates).toHaveBeenCalledWith('SQ', 'p1', 'DDWMISSI-5811', '2026-10-21', '2026-10-26'));
    // QA e Code Review seguem o que o servidor devolveu.
    await waitFor(() => expect(screen.getByTestId('datas-leitura-DDWMISSI-5813').textContent).toBe('28/10 a 29/10'));
    expect(screen.getByTestId('datas-leitura-DDWMISSI-5812').textContent).toBe('27/10 a 27/10');
  });

  it('pré-valida: fim antes do início e fim de semana não deixam salvar', async () => {
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5811');
    fireEvent.change(within(row).getByLabelText('Fim'), { target: { value: '2026-10-20' } });
    expect(within(row).getByRole('alert').textContent).toMatch(/antes/);
    expect((within(row).getByRole('button', { name: /Salvar datas/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(row).getByLabelText('Fim'), { target: { value: '2026-10-24' } });
    expect(within(row).getByRole('alert').textContent).toMatch(/dias úteis/);
  });

  it('422: mostra a mensagem e sugere o minStartDate; aceitar a sugestão preenche o início', async () => {
    h.api.setDates.mockRejectedValue(new DistributionApiError('O início não pode ser antes do fim do Code Review.', 422, '2026-10-22'));
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5811');
    fireEvent.change(within(row).getByLabelText('Fim'), { target: { value: '2026-10-27' } });
    fireEvent.click(within(row).getByRole('button', { name: /Salvar datas/ }));
    const erro = await screen.findByTestId('erro-DDWMISSI-5811');
    expect(erro.textContent).toContain('Code Review');
    fireEvent.click(within(erro).getByRole('button', { name: /Usar 22\/10 como início/ }));
    expect((within(row).getByLabelText('Início') as HTMLInputElement).value).toBe('2026-10-22');
  });

  it('o início do QA é travado e a nota explica a cadeia', async () => {
    const mine = clone();
    mine.myAccountId = 'acc-fabio';
    mine.tasks[0].subtasks[2].canEditDates = true;
    h.api.get.mockResolvedValue(mine);
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5813');
    expect((within(row).getByLabelText('Início') as HTMLInputElement).disabled).toBe(true);
    expect(within(row).getByTestId('cadeia-nota-DDWMISSI-5813').textContent).toContain('Começa quando o Code Review termina');
  });
});

describe('Distribuição: avisos', () => {
  it('lista os avisos do servidor, com título pelo código, e recolhe', async () => {
    renderStep();
    const aviso = await screen.findByTestId('aviso');
    expect(aviso.textContent).toContain('Sem dono');
    expect(aviso.textContent).toContain('DDWMISSI-5821 ainda não tem dono.');
    fireEvent.click(screen.getByRole('button', { name: /Avisos \(1\)/ }));
    expect(screen.queryByTestId('aviso')).toBeNull();
  });
});

describe('Distribuição: Gantt', () => {
  it('desenha uma barra por subtarefa com data, o feriado hachurado e a seta da cadeia', async () => {
    renderStep();
    await screen.findByTestId('saldo');
    expect(screen.getByTestId('barra-DDWMISSI-5811').getAttribute('data-owner')).toBe('mine');
    expect(screen.getByTestId('barra-DDWMISSI-5812').getAttribute('data-owner')).toBe('other');
    expect(screen.queryByTestId('barra-DDWMISSI-5821')).toBeNull();
    expect(screen.getAllByTestId('gantt-feriado')).toHaveLength(1);
    expect(screen.getByTestId('cadeia-DDWMISSI-5811-DDWMISSI-5812')).toBeTruthy();
    expect(screen.getByTestId('cadeia-DDWMISSI-5812-DDWMISSI-5813')).toBeTruthy();
    expect(screen.getByTestId('barra-DDWMISSI-5812').getAttribute('aria-label')).toContain('somente leitura');
  });
});

describe('Distribuição: tempo real', () => {
  it('REFRESH_PLAN recarrega sem tela de carregando, mantém a data em edição e avisa quem atualizou', async () => {
    renderStep();
    const row = await screen.findByTestId('sub-DDWMISSI-5811');
    fireEvent.change(within(row).getByLabelText('Fim'), { target: { value: '2026-10-22' } });
    const changed = clone();
    changed.tasks[0].subtasks[1].startDate = '2026-10-27';
    changed.tasks[0].subtasks[1].endDate = '2026-10-27';
    h.api.get.mockResolvedValue(changed);
    h.socket.handlers?.onRefresh();
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ana Souza atualizou datas' })));
    expect(screen.queryByText('Carregando a distribuição')).toBeNull();
    expect((screen.getByTestId('sub-DDWMISSI-5811').querySelector('input[id$="-fim"]') as HTMLInputElement).value).toBe('2026-10-22');
  });

  it('sem conexão: indica atualização manual e o botão Atualizar recarrega sem erro', async () => {
    renderStep();
    await screen.findByTestId('saldo');
    expect(screen.getByTestId('tempo-real').textContent).toContain('Atualize manualmente');
    React.act(() => h.socket.handlers?.onConnectionChange?.(true));
    expect(screen.getByTestId('tempo-real').textContent).toContain('Atualiza sozinho');
    React.act(() => h.socket.handlers?.onConnectionChange?.(false));
    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('recarga silenciosa que falha mantém a tela', async () => {
    renderStep();
    await screen.findByTestId('saldo');
    h.api.get.mockRejectedValue(new CeremonyApiError('queda', 500));
    h.socket.handlers?.onRefresh();
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('saldo')).toBeTruthy();
  });
});

describe('Distribuição: celular', () => {
  it('abas Minhas / Disponíveis / Equipe, começando pelas minhas', async () => {
    setMobile(true);
    renderStep();
    await screen.findByTestId('saldo');
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs.join('|')).toMatch(/Minhas.*Disponíveis.*Equipe/);
    expect(tabs.join('|')).not.toMatch(/Todas/);
    expect(screen.getByTestId('sub-DDWMISSI-5811')).toBeTruthy();
    expect(screen.queryByTestId('sub-DDWMISSI-5821')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Disponíveis/ }));
    expect(screen.getByTestId('sub-DDWMISSI-5821')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Equipe/ }));
    expect(screen.getByTestId('sub-DDWMISSI-5812')).toBeTruthy();
  });
});
