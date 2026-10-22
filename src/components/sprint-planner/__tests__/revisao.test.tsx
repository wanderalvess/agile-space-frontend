import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fixture from '../../../lib/sprint-planner/__tests__/fixtures/review-view.json';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import type { ReviewView } from '../../../lib/sprint-planner/api';

const h = vi.hoisted(() => ({ toast: vi.fn(), api: { get: vi.fn(), sendToJira: vi.fn() } }));

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../lib/sprint-planner/plan-socket', () => ({ connectPlanSocket: () => vi.fn() }));
vi.mock('../../../lib/sprint-planner/api', async (orig) => {
  const actual = await orig<typeof import('../../../lib/sprint-planner/api')>();
  return { ...actual, reviewApi: h.api };
});

import { ReviewStep } from '../ReviewStep';

const clone = (): ReviewView => JSON.parse(JSON.stringify(fixture));

function setMobile(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('max-width'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const onJump = vi.fn();
const onBack = vi.fn();
const renderStep = () => render(<ReviewStep squadId="SQ" planId="p1" onJump={onJump} onBack={onBack} />);
const withView = (fn: (v: ReviewView) => void) => { const v = clone(); fn(v); h.api.get.mockResolvedValue(v); };
const clear = (v: ReviewView) => { v.pendings = []; v.blockingCount = 0; v.warningCount = 0; };

beforeEach(() => {
  vi.clearAllMocks();
  setMobile(false);
  h.api.get.mockResolvedValue(clone());
});
afterEach(cleanup);

describe('Revisão: contadores e pendências', () => {
  it('mostra "1 pendência impede o envio · 2 avisos" e o contador da seção', async () => {
    renderStep();
    expect((await screen.findByTestId('resumo-contagem')).textContent).toBe('1 pendência impede o envio · 2 avisos');
    expect(screen.getByTestId('contador-pendencias').textContent).toBe('3 · 1 impede enviar');
  });

  it('separa vermelhas (impedem) e amarelas (avisos)', async () => {
    renderStep();
    await screen.findByTestId('contadores');
    expect(within(screen.getByTestId('pendencias-bloqueio')).getAllByTestId('pendencia')).toHaveLength(1);
    expect(within(screen.getByTestId('pendencias-aviso')).getAllByTestId('pendencia')).toHaveLength(2);
  });

  it('sem pendências: tudo certo', async () => {
    withView(clear);
    renderStep();
    expect((await screen.findByTestId('resumo-contagem')).textContent).toBe('Tudo certo, sem pendências');
    expect(screen.getByTestId('sem-pendencias')).toBeTruthy();
  });

  it('atalhos "Ir para" levam à Distribuição, Capacidade e Escopo', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para DDWMISSI-5812' }));
    expect(onJump).toHaveBeenLastCalledWith('distribuicao', 'DDWMISSI-5812');
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a capacidade' }));
    expect(onJump).toHaveBeenLastCalledWith('capacidade', 'acc-ana');
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o escopo' }));
    expect(onJump).toHaveBeenLastCalledWith('escopo', 'i9');
  });
});

describe('Revisão: resumo', () => {
  it('por pessoa: saldo, termômetro e subtarefas datadas x total', async () => {
    renderStep();
    await screen.findByTestId('contadores');
    expect(within(screen.getByTestId('rev-pessoa-acc-carla')).getByRole('meter').getAttribute('aria-valuenow')).toBe('27');
    expect(screen.getByTestId('datas-acc-carla').textContent).toBe('1 de 2 com datas');
    expect(screen.getByTestId('rev-pessoa-acc-carla').textContent).toContain('sobram 22 h');
  });

  it('por tarefa: expande e mostra responsável e datas; sem dono fica explícito', async () => {
    renderStep();
    const card = await screen.findByTestId('rev-tarefa-DDWMISSI-5810');
    expect(screen.queryByTestId('rev-sub-DDWMISSI-5811')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /DDWMISSI-5810/ }));
    expect(screen.getByTestId('rev-sub-DDWMISSI-5811').textContent).toContain('Carla');
    expect(screen.getByTestId('rev-sub-DDWMISSI-5811').textContent).toContain('21/10 a 23/10');
    expect(screen.getByTestId('rev-sub-DDWMISSI-5812').textContent).toContain('Sem responsável');
    expect(screen.getByTestId('rev-sub-DDWMISSI-5812').textContent).toContain('Sem datas');
    fireEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }));
    expect(screen.queryByTestId('rev-sub-DDWMISSI-5811')).toBeNull();
  });
});

describe('Revisão: prévia do Jira', () => {
  it('lista SET/CHANGE/UNCHANGED, "campo a definir" e contadores', async () => {
    renderStep();
    await screen.findByTestId('previa-tabela');
    const linhas = screen.getAllByTestId('previa-linha');
    expect(linhas).toHaveLength(3);
    expect(linhas[0].textContent).toContain('SET');
    expect(linhas[0].textContent).toContain('Assignee');
    expect(linhas[0].textContent).toContain('vazio');
    expect(linhas[1].textContent).toContain('CHANGE');
    expect(linhas[1].textContent).toContain('campo a definir');
    expect(linhas[1].textContent).toContain('20/10/2026');
    expect(linhas[2].textContent).toContain('UNCHANGED');
    expect(screen.getByTestId('contadores-previa').textContent).toContain('1 issue · 1 a definir · 1 a alterar · 1 iguais');
    expect(screen.getByTestId('previa-meta').textContent).toContain('será gravada no Sprint goal');
    const prev = screen.getByTestId('previa-jira').textContent ?? '';
    expect(prev).toContain('Regras de escrita no Jira em definição');
    expect(prev).toContain('Mudanças depois do envio: regra em definição');
  });

  it('sem mudanças: mensagem em vez de tabela vazia', async () => {
    withView((v) => { v.jiraPreview.changes = []; v.jiraPreview.sprintGoal = null; });
    renderStep();
    expect(await screen.findByTestId('previa-vazia')).toBeTruthy();
  });
});

describe('Revisão: envio', () => {
  it('fica travado com pendência, com o motivo ligado por aria-describedby', async () => {
    renderStep();
    const btn = (await screen.findByRole('button', { name: /Enviar ao Jira/ })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-describedby')).toBe('rev-motivo');
    expect(screen.getByTestId('motivo-envio').textContent).toBe('Resolva a pendência vermelha para enviar.');
  });

  it('sem pendências mas com regras em definição continua travado', async () => {
    withView((v) => { clear(v); v.canSend = true; v.writeRulesDefined = false; });
    renderStep();
    const btn = (await screen.findByRole('button', { name: /Enviar ao Jira/ })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('motivo-envio').textContent).toContain('em definição');
  });

  it('liberado: envia; 501 mostra a mensagem clara', async () => {
    withView((v) => { clear(v); v.canSend = true; v.writeRulesDefined = true; });
    h.api.sendToJira.mockRejectedValue(new CeremonyApiError('O envio ao Jira ainda não está liberado: regras de escrita em definição.', 501));
    renderStep();
    const btn = (await screen.findByRole('button', { name: /Enviar ao Jira/ })) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect((await screen.findByTestId('erro-envio')).textContent).toBe('O envio ao Jira ainda não está liberado: regras de escrita em definição.');
  });

  it('link "Iniciar a sprint no Jira" abre em nova aba e some sem URL', async () => {
    const { unmount } = renderStep();
    const a = (await screen.findByRole('link', { name: /Iniciar a sprint no Jira/ })) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://jira.exemplo.com.br/sprints/42');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
    unmount();
    withView((v) => { v.jiraSprintUrl = null; });
    renderStep();
    await screen.findByTestId('contadores');
    expect(screen.queryByRole('link', { name: /Iniciar a sprint/ })).toBeNull();
  });

  it('"Voltar para a Distribuição" aparece para a liderança', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: /Voltar para a Distribuição/ }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('Revisão: somente leitura, estados e celular', () => {
  it('quem não é liderança só consulta: sem voltar, envio travado com o motivo', async () => {
    withView((v) => { v.canEditPlan = false; });
    renderStep();
    expect(await screen.findByTestId('somente-leitura')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Voltar para a Distribuição/ })).toBeNull();
    expect((screen.getByRole('button', { name: /Enviar ao Jira/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('motivo-envio').textContent).toBe('Só a liderança envia ao Jira.');
  });

  it('já enviado: aviso e sem voltar', async () => {
    withView((v) => { v.status = 'ENVIADO'; });
    renderStep();
    expect(await screen.findByTestId('enviado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Voltar para a Distribuição/ })).toBeNull();
  });

  it('erro de carga mostra tentar de novo', async () => {
    h.api.get.mockRejectedValueOnce(new CeremonyApiError('Falhou', 500));
    renderStep();
    const retry = await screen.findByRole('button', { name: /tentar/i });
    fireEvent.click(retry);
    await waitFor(() => expect(h.api.get).toHaveBeenCalledTimes(2));
  });

  it('plano vazio: estado vazio', async () => {
    withView((v) => { clear(v); v.tasks = []; v.people = []; });
    renderStep();
    expect(await screen.findByText('Nada para revisar ainda')).toBeTruthy();
  });

  it('celular: pendências recolhidas por padrão, prévia em cartões', async () => {
    setMobile(true);
    renderStep();
    await screen.findByTestId('contadores');
    expect(screen.queryByTestId('pendencia')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pendências/ }));
    expect(screen.getAllByTestId('pendencia').length).toBe(3);
    expect(screen.getByTestId('previa-cartoes')).toBeTruthy();
    expect(screen.queryByTestId('previa-tabela')).toBeNull();
  });
});
