import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  search: { current: '' },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  api: {
    listMine: vi.fn(),
    getReplies: vi.fn(),
    markRead: vi.fn(),
    addReply: vi.fn(),
    closeTicket: vi.fn(),
    reopenTicket: vi.fn(),
    createTicket: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(h.search.current),
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'u1', name: 'Ana Souza' }, isAuthenticated: true }) }));
vi.mock('../../../components/page', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, supportApi: h.api };
});

import SupportPage from '../page';
import { SupportApiError } from '../api';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = globalThis.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});

const ticket = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  subject: 'Cronograma não carrega a sprint atual',
  message: 'Aparece "Nenhuma sprint ativa".',
  status: 'IN_PROGRESS',
  requesterId: 'u1',
  type: 'bug',
  protocol: 'SUP-0042',
  createdAt: '2026-10-19T16:40:00Z',
  updatedAt: '2026-10-20T09:12:00Z',
  unreadReplies: 1,
  hasUnreadReply: true,
  ...over,
});

const closedTicket = ticket({ id: 't2', subject: 'Esqueci a senha', protocol: 'SUP-0038', type: 'support', status: 'CLOSED', unreadReplies: 0, hasUnreadReply: false, createdAt: '2026-10-02T08:41:00Z' });
const openTicket = ticket({ id: 't3', subject: 'Exportar o resultado em planilha', protocol: 'SUP-0041', type: 'suggestion', status: 'OPEN', unreadReplies: 0, hasUnreadReply: false, createdAt: '2026-10-14T11:05:00Z' });

const teamReply = { id: 'r1', ticketId: 't1', isAdmin: true, authorName: 'Fulano', message: 'Já corrigimos, pode tentar de novo?', createdAt: '2026-10-20T09:12:00Z' };

beforeEach(() => {
  vi.clearAllMocks();
  h.search.current = '';
  h.api.listMine.mockResolvedValue([ticket(), openTicket, closedTicket]);
  h.api.getReplies.mockResolvedValue([teamReply]);
  h.api.markRead.mockResolvedValue(ticket({ unreadReplies: 0, hasUnreadReply: false }));
});
afterEach(() => cleanup());

const list = () => screen.getByRole('region', { name: 'Meus chamados' });

describe('Suporte: tela do usuário', () => {
  it('lista os chamados com protocolo, selo de resposta nova e contagem nos filtros', async () => {
    render(<SupportPage />);
    expect(await within(list()).findByText('SUP-0042')).toBeTruthy();
    expect(within(list()).getByText('SUP-0041')).toBeTruthy();
    expect(within(list()).getByText('Nova resposta')).toBeTruthy();
    // Todos 3, Abertos 2 (aberto + em andamento), Fechados 1
    expect(screen.getByRole('button', { name: /Todos\s*3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Abertos\s*2/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fechados\s*1/ })).toBeTruthy();
    // rótulos de status iguais aos do admin
    expect(within(list()).getByText('Em andamento')).toBeTruthy();
    expect(within(list()).getByText('Resolvido')).toBeTruthy();
    expect(screen.getByText('Escolha um chamado')).toBeTruthy();
  });

  it('abrir o chamado mostra a conversa, marca como lido e tira o selo', async () => {
    render(<SupportPage />);
    fireEvent.click(await within(list()).findByRole('button', { name: /SUP-0042/ }));
    expect(await screen.findByText('Já corrigimos, pode tentar de novo?')).toBeTruthy();
    expect(h.api.markRead).toHaveBeenCalledWith('t1');
    expect(h.api.getReplies).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(within(list()).queryByText('Nova resposta')).toBeNull());
    // o time responde como "Suporte", não com o nome de quem respondeu
    expect(screen.getByRole('log', { name: 'Conversa' }).textContent).toContain('Suporte');
    expect(screen.getByRole('log', { name: 'Conversa' }).textContent).not.toContain('Fulano');
  });

  it('link do sino (?ticket=) abre o chamado direto', async () => {
    h.search.current = 'ticket=t3';
    render(<SupportPage />);
    expect(await screen.findByRole('heading', { name: 'Exportar o resultado em planilha', level: 2 })).toBeTruthy();
  });

  it('o usuário responde no chamado', async () => {
    h.api.addReply.mockResolvedValue({ id: 'r9', ticketId: 't1', isAdmin: false, message: 'Funcionou, obrigada!', createdAt: '2026-10-20T10:00:00Z' });
    render(<SupportPage />);
    fireEvent.click(await within(list()).findByRole('button', { name: /SUP-0042/ }));
    const box = await screen.findByLabelText('Responder ao time');
    fireEvent.change(box, { target: { value: 'Funcionou, obrigada!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() => expect(h.api.addReply).toHaveBeenCalledWith('t1', { message: 'Funcionou, obrigada!', authorName: 'Ana Souza' }));
    expect(await screen.findByText('Funcionou, obrigada!')).toBeTruthy();
    expect((screen.getByLabelText('Responder ao time') as HTMLTextAreaElement).value).toBe('');
  });

  it('resposta em chamado que fechou no meio recebe 409: avisa, mantém o texto e relê a lista', async () => {
    h.api.addReply.mockRejectedValue(new SupportApiError(409));
    render(<SupportPage />);
    fireEvent.click(await within(list()).findByRole('button', { name: /SUP-0042/ }));
    fireEvent.change(await screen.findByLabelText('Responder ao time'), { target: { value: 'ainda com erro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Chamado fechado', expect.objectContaining({ description: expect.stringContaining('Reabra') })));
    expect((screen.getByLabelText('Responder ao time') as HTMLTextAreaElement).value).toBe('ainda com erro');
    await waitFor(() => expect(h.api.listMine).toHaveBeenCalledTimes(2));
  });

  it('fecha o chamado só depois de confirmar', async () => {
    h.api.closeTicket.mockResolvedValue(ticket({ status: 'CLOSED', unreadReplies: 0, hasUnreadReply: false }));
    render(<SupportPage />);
    fireEvent.click(await within(list()).findByRole('button', { name: /SUP-0042/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar chamado' }));
    expect(h.api.closeTicket).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Fechar o chamado SUP-0042?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar chamado' }));
    await waitFor(() => expect(h.api.closeTicket).toHaveBeenCalledWith('t1'));
    // fechado: sem caixa de resposta, com aviso e botão de reabrir
    expect(await screen.findByText('Este chamado está fechado. Reabra para enviar uma nova mensagem.')).toBeTruthy();
    expect(screen.queryByLabelText('Responder ao time')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reabrir chamado' })).toBeTruthy();
  });

  it('reabre o chamado fechado depois de confirmar', async () => {
    h.api.getReplies.mockResolvedValue([]);
    h.api.reopenTicket.mockResolvedValue({ ...closedTicket, status: 'OPEN' });
    render(<SupportPage />);
    fireEvent.click(await within(list()).findByRole('button', { name: /SUP-0038/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir chamado' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Reabrir o chamado SUP-0038?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reabrir chamado' }));
    await waitFor(() => expect(h.api.reopenTicket).toHaveBeenCalledWith('t2'));
    expect(await screen.findByLabelText('Responder ao time')).toBeTruthy();
  });

  it('nova solicitação: tipo é campo próprio (assunto sem prefixo), mostra o protocolo criado', async () => {
    h.api.listMine.mockResolvedValue([]);
    h.api.createTicket.mockResolvedValue(ticket({ id: 't9', protocol: 'SUP-0043', type: 'bug', subject: 'Fila parou', status: 'OPEN', unreadReplies: 0, hasUnreadReply: false }));
    h.api.getReplies.mockResolvedValue([]);
    render(<SupportPage />);
    expect(await screen.findByText('Você ainda não abriu chamados')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Nova solicitação' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Nova solicitação' });
    const send = within(dialog).getByRole('button', { name: 'Enviar solicitação' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Bug/Erro' }));
    fireEvent.change(within(dialog).getByLabelText(/Assunto/), { target: { value: ' Fila parou ' } });
    fireEvent.change(within(dialog).getByLabelText(/Descrição/), { target: { value: 'Depois que todos votam, nada acontece.' } });
    fireEvent.click(send);
    await waitFor(() =>
      expect(h.api.createTicket).toHaveBeenCalledWith({ type: 'bug', subject: 'Fila parou', message: 'Depois que todos votam, nada acontece.', requesterName: 'Ana Souza' }),
    );
    expect(await screen.findByText('Chamado SUP-0043 criado.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Nova solicitação' })).toBeNull();
  });

  it('erro na lista mostra "Tentar de novo" e recarrega', async () => {
    h.api.listMine.mockRejectedValueOnce(new Error('rede'));
    render(<SupportPage />);
    expect(await screen.findByText('Não foi possível carregar seus chamados')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await within(list()).findByText('SUP-0042')).toBeTruthy();
  });

  it('servidor antigo: sem protocolo nem tipo, deriva o protocolo do id e lê o tipo do assunto', async () => {
    h.api.listMine.mockResolvedValue([
      { id: '8f3a1c2d-0000-0000-0000-000000000000', subject: '[Sugestão] Exportar CSV', message: 'm', status: 'OPEN', requesterId: 'u1', createdAt: '2026-10-01T10:00:00Z' },
    ]);
    render(<SupportPage />);
    expect(await within(list()).findByText('SUP-8F3A1C2D')).toBeTruthy();
    expect(within(list()).getByText('Exportar CSV')).toBeTruthy();
    expect(within(list()).queryByText('Nova resposta')).toBeNull();
  });

  it('filtro Fechados e busca por protocolo', async () => {
    render(<SupportPage />);
    await within(list()).findByText('SUP-0042');
    fireEvent.click(screen.getByRole('button', { name: /Fechados/ }));
    expect(within(list()).queryByText('SUP-0042')).toBeNull();
    expect(within(list()).getByText('SUP-0038')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
    fireEvent.change(screen.getByLabelText('Buscar chamado'), { target: { value: 'sup-0041' } });
    expect(within(list()).queryByText('SUP-0042')).toBeNull();
    expect(within(list()).getByText('SUP-0041')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar chamado'), { target: { value: 'nada' } });
    expect(screen.getByText('Nenhum chamado encontrado')).toBeTruthy();
  });
});
