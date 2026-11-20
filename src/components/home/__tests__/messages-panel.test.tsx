import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchContacts: vi.fn(),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
  openConversation: vi.fn(),
}));

vi.mock('../../../hooks/home/sources', () => ({
  fetchContacts: mocks.fetchContacts,
  fetchMessages: mocks.fetchMessages,
  sendMessage: mocks.sendMessage,
  markConversationRead: mocks.markConversationRead,
  openConversation: mocks.openConversation,
  fetchConversations: vi.fn(),
}));

import { MessagesPanel } from '../MessagesPanel';
import type { Conversation } from '../../../hooks/home/types';

const NOW = new Date('2026-10-14T15:00:00Z');
const conv: Conversation = {
  id: 'c1',
  other: { id: 'u2', name: 'Diego Alves' },
  lastMessage: { id: 'm1', conversationId: 'c1', senderId: 'u2', body: 'Consegue revisar o PR?', createdAt: '2026-10-14T14:00:00Z' },
  unreadCount: 1,
  updatedAt: '2026-10-14T14:00:00Z',
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.fetchMessages.mockResolvedValue([conv.lastMessage]);
  mocks.markConversationRead.mockResolvedValue(undefined);
  mocks.fetchContacts.mockResolvedValue([{ id: 'u3', name: 'Ana Ribeiro' }]);
});

const renderPanel = (props: Partial<React.ComponentProps<typeof MessagesPanel>> = {}) =>
  render(<MessagesPanel conversations={[conv]} available myId="u1" tick={0} now={NOW} refresh={() => {}} {...props} />);

describe('MessagesPanel', () => {
  it('servidor sem mensagens diretas: só o estado vazio, sem botão de nova mensagem', () => {
    renderPanel({ conversations: [], available: false });
    expect(screen.getByText('Nenhuma mensagem')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nova mensagem/ })).toBeNull();
  });

  it('lista a conversa com prévia e marca as não lidas', () => {
    renderPanel();
    expect(screen.getByText('Diego Alves')).toBeTruthy();
    expect(screen.getByText('Consegue revisar o PR?')).toBeTruthy();
    expect(screen.getByRole('img', { name: '1 não lidas' })).toBeTruthy();
  });

  it('abre a conversa, marca como lida, envia e limpa o campo', async () => {
    mocks.sendMessage.mockResolvedValue({ id: 'm2', conversationId: 'c1', senderId: 'u1', body: 'Fechado', createdAt: '2026-10-14T15:00:00Z' });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Diego Alves/ }));
    await waitFor(() => expect(screen.getByLabelText('Nova mensagem')).toBeTruthy());
    expect(mocks.markConversationRead).toHaveBeenCalledWith('c1');

    const input = screen.getByLabelText('Nova mensagem') as HTMLInputElement;
    const send = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Fechado' } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith('c1', 'Fechado'));
    await waitFor(() => expect(input.value).toBe(''));
    expect(await screen.findByText('Fechado')).toBeTruthy();
  });

  it('nova mensagem: escolhe o contato, abre a conversa e mostra o campo de escrita', async () => {
    mocks.openConversation.mockResolvedValue({ ...conv, id: 'c9', other: { id: 'u3', name: 'Ana Ribeiro' }, lastMessage: null, unreadCount: 0 });
    mocks.fetchMessages.mockResolvedValue([]);
    renderPanel({ conversations: [] });
    fireEvent.click(screen.getByRole('button', { name: /Nova mensagem/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Ribeiro/ }));
    await waitFor(() => expect(mocks.openConversation).toHaveBeenCalledWith('u3'));
    expect(await screen.findByPlaceholderText('Escrever para Ana…')).toBeTruthy();
  });

  it('erro ao abrir a conversa aparece na tela de contatos', async () => {
    mocks.openConversation.mockRejectedValue(new Error('Só é possível conversar com pessoas das suas squads.'));
    renderPanel({ conversations: [] });
    fireEvent.click(screen.getByRole('button', { name: /Nova mensagem/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Ribeiro/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('suas squads');
  });
});
