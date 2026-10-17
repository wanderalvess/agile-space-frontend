import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrainstormingGroup, BrainstormingIdea } from '../../../lib/types';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  api: { createBoard: vi.fn(), createTask: vi.fn(), listBoards: vi.fn(), getBoardById: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'me' } }) }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: h.api }));

import { CreatePlanDialog } from '../CreatePlanDialog';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  window.localStorage.clear();
  h.push.mockClear();
  h.toast.mockClear();
  Object.values(h.api).forEach((f) => f.mockReset());
  h.api.listBoards.mockResolvedValue([]);
});
afterEach(cleanup);

const idea = (id: string, content: string, over: Partial<BrainstormingIdea> = {}): BrainstormingIdea => ({
  id, boardId: 'bs1', content, authorId: 'u1', votes: ['a', 'b'], position: { x: 0, y: 0 }, parentId: null, groupId: null, createdAt: '2026-10-13T00:00:00Z', ...over,
});
const IDEAS = [idea('i1', 'Automatizar o deploy', { groupId: 'g1' }), idea('i2', 'Pareamento semanal')];
const GROUPS = [{ id: 'g1', boardId: 'bs1', title: 'Entrega' } as BrainstormingGroup];

const serverPlan = { id: 'plano-9', creatorId: 'u', title: 'Plano de Ação: Retrospectiva de ideias', team: 'PHX', createdAt: 'x', sourceType: 'BRAINSTORMING' as const, sourceId: 'bs1', sourceTitle: 'Retrospectiva de ideias' };

function open() {
  return render(<CreatePlanDialog open onOpenChange={vi.fn()} boardId="bs1" boardTitle="Retrospectiva de ideias" team="PHX" ideas={IDEAS} groups={GROUPS} />);
}

describe('Brainstorming: criar plano de ação com origem', () => {
  it('consulta o plano desta sessão pela squad e pela origem antes de liberar a criação', async () => {
    open();
    await waitFor(() => expect(h.api.listBoards).toHaveBeenCalledWith({ squadId: 'PHX', sourceType: 'BRAINSTORMING', sourceId: 'bs1' }));
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
  });

  it('cria o plano e cada ação enviando a sessão e a ideia como origem', async () => {
    h.api.createBoard.mockResolvedValue({ id: 'novo', sourceType: 'BRAINSTORMING' });
    h.api.createTask.mockResolvedValue({});
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(create); });
    await waitFor(() => expect(h.api.createTask).toHaveBeenCalledTimes(2));
    expect(h.api.createBoard).toHaveBeenCalledWith(expect.objectContaining({
      squadId: 'PHX', team: 'PHX', sourceType: 'BRAINSTORMING', sourceId: 'bs1', sourceTitle: 'Retrospectiva de ideias',
    }));
    expect(h.api.createTask).toHaveBeenCalledWith('novo', expect.objectContaining({ what: 'Automatizar o deploy', sourceItemId: 'i1', sourceLabel: 'Entrega' }));
    expect(h.api.createTask).toHaveBeenCalledWith('novo', expect.objectContaining({ what: 'Pareamento semanal', sourceItemId: 'i2', sourceLabel: 'Pareamento semanal' }));
    expect(await screen.findByText('Plano de ação criado')).toBeTruthy();
  });

  it('sessão que o servidor já tem plano: mostra "já gerou o plano", abre o plano e NÃO oferece criar outro', async () => {
    h.api.listBoards.mockResolvedValue([serverPlan]);
    open();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Esta sessão já gerou o plano');
    expect(alert.textContent).toContain('Plano de Ação: Retrospectiva de ideias');
    expect(screen.queryByText(/Criar outro mesmo assim/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Criar plano com/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Abrir o plano/ }));
    expect(h.push).toHaveBeenCalledWith('/action-plan/plano-9');
    expect(h.api.createBoard).not.toHaveBeenCalled();
  });

  it('lista de servidor antigo (planos sem origem) não conta como plano desta sessão', async () => {
    h.api.listBoards.mockResolvedValue([{ ...serverPlan, sourceType: undefined, sourceId: undefined }]);
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('409 ao criar: leva ao plano existente (com o título) e não cria nenhuma ação', async () => {
    h.api.createBoard.mockRejectedValue(Object.assign(new Error('Já existe.'), { status: 409, existingPlanId: 'plano-7' }));
    h.api.getBoardById.mockResolvedValue({ ...serverPlan, id: 'plano-7', title: 'Plano da Carla' });
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(create); });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Plano da Carla');
    expect(h.api.createTask).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Abrir o plano/ }));
    expect(h.push).toHaveBeenCalledWith('/action-plan/plano-7');
  });

  it('409 de plano privado (sem id): explica e não oferece abrir nem criar', async () => {
    h.api.createBoard.mockRejectedValue(Object.assign(new Error('Já existe.'), { status: 409 }));
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(create); });
    expect((await screen.findByRole('alert')).textContent).toContain('ele é privado e você não tem acesso');
    expect(screen.queryByRole('button', { name: /Abrir o plano/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Criar plano com/ })).toBeNull();
  });

  it('servidor antigo: o aviso deste navegador continua pedindo confirmação para criar outro', async () => {
    window.localStorage.setItem('agile_brainstorming_plan_bs1', JSON.stringify({ planId: 'velho', title: 'Plano velho', createdAt: 'x' }));
    h.api.getBoardById.mockResolvedValue({ id: 'velho', creatorId: 'u', title: 'Plano velho', team: 'PHX', createdAt: 'x' });
    open();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Já existe um plano criado a partir desta sessão');
    const create = screen.getByRole('button', { name: /Criar plano com 2 ações/ }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.click(within(alert).getByRole('checkbox', { name: /Criar outro mesmo assim/ }));
    expect(create.disabled).toBe(false);
    fireEvent.click(within(alert).getByRole('button', { name: /Abrir o plano que já existe/ }));
    expect(h.push).toHaveBeenCalledWith('/action-plan/velho');
  });

  it('servidor novo e o plano do aviso local foi apagado: o aviso fica velho e deixa criar', async () => {
    window.localStorage.setItem('agile_brainstorming_plan_bs1', JSON.stringify({ planId: 'apagado', title: 'Plano apagado', createdAt: 'x' }));
    h.api.getBoardById.mockRejectedValue(Object.assign(new Error('Plano de ação não encontrado.'), { status: 404 }));
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('consulta que falha não impede criar quando não há aviso local', async () => {
    h.api.listBoards.mockRejectedValue(new Error('queda'));
    open();
    const create = await screen.findByRole('button', { name: /Criar plano com 2 ações/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
  });
});
