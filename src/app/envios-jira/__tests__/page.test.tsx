import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JiraPublishJob, JiraPublishSquadQueue } from '@/app/room/jira-publish-api';

const api = vi.hoisted(() => ({
  squadQueue: vi.fn(),
  events: vi.fn(),
  retryJob: vi.fn(),
  verify: vi.fn(),
  discard: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/app/room/jira-publish-api', async (orig) => ({ ...(await orig<typeof import('@/app/room/jira-publish-api')>()), jiraPublishApi: api }));
vi.mock('@/hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'DDWMISSI', squadName: 'DDWMISSI' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/page/PageShell', () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/page/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}));

import JiraEnviosPage from '../page';

const job = (id: string, status: JiraPublishJob['status'], extra: Partial<JiraPublishJob> = {}): JiraPublishJob => ({
  id, squadId: 'DDWMISSI', roomId: 'room-1', issueId: `i-${id}`, parentKey: `DDWMISSI-${id}`, parentSummary: `Tarefa ${id}`,
  requestedBy: 'u1', requestedByName: 'Wanderson', status, createdAt: '2026-10-31T04:17:46',
  errorMessage: status === 'ERROR' ? 'sem permissão (403)' : null,
  steps: [
    { index: 0, kind: 'RENAME_PARENT', targetKey: `DDWMISSI-${id}`, summary: 'Novo título', status: status === 'DONE' ? 'DONE' : 'ERROR', attempts: 1 },
  ],
  ...extra,
});

const queueOf = (jobs: JiraPublishJob[]): JiraPublishSquadQueue => ({ squadId: 'DDWMISSI', jiraDomain: 'jiraproducao.totvs.com.br', jobs });

beforeEach(() => {
  Object.values(api).forEach(m => m.mockReset());
  toast.mockReset();
});

describe('página Envios para o Jira', () => {
  it('abre no filtro Com erro quando há erro e deixa trocar para os outros', async () => {
    api.squadQueue.mockResolvedValue(queueOf([job('1', 'DONE'), job('2', 'ERROR')]));
    render(<JiraEnviosPage />);

    expect(await screen.findByLabelText('Envio de DDWMISSI-2')).toBeTruthy();
    expect(screen.queryByLabelText('Envio de DDWMISSI-1')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Concluídos/ }));
    expect(await screen.findByLabelText('Envio de DDWMISSI-1')).toBeTruthy();
    expect(screen.queryByLabelText('Envio de DDWMISSI-2')).toBeNull();
  });

  it('mostra o estado vazio quando a squad ainda não enviou nada', async () => {
    api.squadQueue.mockResolvedValue(queueOf([]));
    render(<JiraEnviosPage />);
    expect(await screen.findByText('Nenhum envio ainda')).toBeTruthy();
  });

  it('tentar novamente troca o envio pelo resultado e avisa quando conclui', async () => {
    api.squadQueue.mockResolvedValue(queueOf([job('2', 'ERROR')]));
    api.retryJob.mockResolvedValue(job('2', 'DONE', { requestedByName: undefined }));
    render(<JiraEnviosPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Tentar novamente/ }));

    await waitFor(() => expect(api.retryJob).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Envio concluído' })));
    // o nome de quem enviou e a sala não vêm na resposta do retry: ficam os da lista
    fireEvent.click(screen.getByRole('tab', { name: /Concluídos/ }));
    expect(await screen.findByText(/por Wanderson/)).toBeTruthy();
  });

  it('descartar pede confirmação, avisa o que já foi feito no Jira e some da fila', async () => {
    const withDone = job('2', 'ERROR', {
      steps: [
        { index: 0, kind: 'RENAME_PARENT', targetKey: 'DDWMISSI-2', status: 'DONE', attempts: 1 },
        { index: 1, kind: 'ADD_COMMENT', targetKey: 'DDWMISSI-2', status: 'ERROR', attempts: 1 },
      ],
    });
    api.squadQueue.mockResolvedValue(queueOf([withDone]));
    api.discard.mockResolvedValue(undefined);
    render(<JiraEnviosPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Descartar$/ }));
    expect(await screen.findByText(/1 passo já foi feito no Jira/)).toBeTruthy();
    expect(api.discard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar envio' }));
    await waitFor(() => expect(api.discard).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(screen.queryByLabelText('Envio de DDWMISSI-2')).toBeNull());
  });

  it('conferir no Jira mostra o resultado sem escrever nada', async () => {
    api.squadQueue.mockResolvedValue(queueOf([job('1', 'DONE')]));
    api.verify.mockResolvedValue({
      jobId: '1', checkedAt: '2026-10-31T05:00:00', allOk: true, confirmed: 1, total: 1,
      checks: [{ index: 0, kind: 'RENAME_PARENT', status: 'OK', detail: 'O título no Jira é o enviado.' }],
    });
    render(<JiraEnviosPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Conferir no Jira/ }));
    expect(await screen.findByText('Confirmado no Jira')).toBeTruthy();
    expect(api.retryJob).not.toHaveBeenCalled();
    expect(api.discard).not.toHaveBeenCalled();
  });

  it('carrega o log só quando a pessoa abre', async () => {
    api.squadQueue.mockResolvedValue(queueOf([job('2', 'ERROR')]));
    api.events.mockResolvedValue([{ id: 'e1', action: 'STEP_ERROR', stepPosition: 0, ok: false, message: 'sem permissão (403)', createdAt: '2026-10-31T04:17:47' }]);
    render(<JiraEnviosPage />);

    await screen.findByLabelText('Envio de DDWMISSI-2');
    expect(api.events).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Ver log/ }));
    await waitFor(() => expect(api.events).toHaveBeenCalledWith('2'));
    expect((await screen.findByRole('region', { name: 'Log do envio' })).textContent).toContain('Passo com erro (passo 1)');
  });

  it('mostra erro de carregamento com tentar de novo', async () => {
    api.squadQueue.mockRejectedValueOnce(new Error('Falha ao carregar os envios')).mockResolvedValue(queueOf([]));
    render(<JiraEnviosPage />);
    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText('Nenhum envio ainda')).toBeTruthy();
  });
});
