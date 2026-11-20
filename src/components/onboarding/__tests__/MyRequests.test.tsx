import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkRequest } from '../../../lib/link-requests-api';

const { cancelLinkRequest, toast } = vi.hoisted(() => ({ cancelLinkRequest: vi.fn(), toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('../../../lib/link-requests-api', () => ({ cancelLinkRequest: (...a: unknown[]) => cancelLinkRequest(...a) }));
vi.mock('sonner', () => ({ toast }));

import { MyRequests } from '../MyRequests';

const pending: LinkRequest = { id: 'r1', projectKey: 'DDWMISSI', memberName: 'Ana P.', emailInJira: 'ana@x.com', status: 'PENDING', createdAt: '2026-10-17T12:00:00Z' };
const cancelled: LinkRequest = { ...pending, id: 'r2', status: 'CANCELLED', createdAt: '2026-10-16T12:00:00Z' };
const approved: LinkRequest = { ...pending, id: 'r3', status: 'APPROVED', createdAt: '2026-10-15T12:00:00Z' };

beforeEach(() => {
  cancelLinkRequest.mockReset();
  toast.mockReset();
  toast.error.mockReset();
});
afterEach(cleanup);

describe('MyRequests: cancelar o próprio pedido', () => {
  it('botão só para PENDING; cancelado mostra "Cancelado" sem botão', () => {
    render(<MyRequests requests={[pending, cancelled, approved]} />);
    expect(screen.getAllByRole('button', { name: /Cancelar pedido/ })).toHaveLength(1);
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Aprovado')).toBeTruthy();
  });

  it('sem pedido pendente a seção nem aparece', () => {
    const { container } = render(<MyRequests requests={[cancelled, approved]} />);
    expect(container.firstChild).toBeNull();
  });

  it('pede confirmação e só cancela ao confirmar; depois relê a lista', async () => {
    cancelLinkRequest.mockResolvedValue({ ...pending, status: 'CANCELLED' });
    const onChanged = vi.fn();
    render(<MyRequests requests={[pending]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar pedido/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('O pedido deixa de aguardar aprovação. Você pode pedir de novo depois.')).toBeTruthy();
    expect(cancelLinkRequest).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar pedido' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(cancelLinkRequest).toHaveBeenCalledWith('r1');
    expect(toast).toHaveBeenCalledWith('Pedido cancelado', expect.anything());
  });

  it('"Manter pedido" fecha sem cancelar', async () => {
    render(<MyRequests requests={[pending]} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar pedido/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Manter pedido' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(cancelLinkRequest).not.toHaveBeenCalled();
  });

  it('falha (ex.: 409 já decidido) mostra o aviso e relê mesmo assim', async () => {
    cancelLinkRequest.mockRejectedValue(new Error('Esse pedido já foi decidido.'));
    const onChanged = vi.fn();
    render(<MyRequests requests={[pending]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar pedido/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar pedido' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith('Não foi possível cancelar o pedido', { description: 'Esse pedido já foi decidido.' });
  });
});
