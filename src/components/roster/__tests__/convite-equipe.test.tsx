import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const listRedemptions = vi.fn();
vi.mock('../../../lib/invite-api', async (orig) => {
  const mod = await orig<typeof import('../../../lib/invite-api')>();
  return {
    ...mod,
    inviteApi: {
      ...mod.inviteApi,
      listRedemptions: (...a: unknown[]) => listRedemptions(...a),
      buildInviteLink: (t: string) => `https://x/invite/${t}`,
    },
  };
});

import { InviteDialog } from '../InviteDialog';
import { PendingInvites } from '../PendingInvites';

function dialog(extra: Partial<React.ComponentProps<typeof InviteDialog>> = {}) {
  const createTeam = vi.fn().mockResolvedValue('https://x/invite/abc');
  const create = vi.fn();
  render(
    <InviteDialog open onOpenChange={vi.fn()} squadId="SQ" create={create} createTeam={createTeam} copyLink={vi.fn()} onCreated={vi.fn()} {...extra} />
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Equipe' }));
  return { createTeam, create };
}

describe('criar convite de equipe na tela', () => {
  it('gera o link com os padrões (Developer, 25 pessoas, 7 dias)', async () => {
    const { createTeam, create } = dialog();
    expect(screen.getByText('Convite para a equipe (link para várias pessoas)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Gerar link/ }));
    await waitFor(() => expect(createTeam).toHaveBeenCalledWith('Developer', 25, 7));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText(/expira em 7 dias/)).toBeTruthy();
  });

  it('usa o limite e a validade digitados', async () => {
    const { createTeam } = dialog();
    fireEvent.change(screen.getByLabelText('Limite de pessoas'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Validade (dias)'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar link/ }));
    await waitFor(() => expect(createTeam).toHaveBeenCalledWith('Developer', 40, 14));
  });

  it('quem não é admin não gera sem limite', () => {
    const { createTeam } = dialog();
    fireEvent.change(screen.getByLabelText('Limite de pessoas'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toMatch(/Só administradores/);
    expect((screen.getByRole('button', { name: /Gerar link/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(createTeam).not.toHaveBeenCalled();
  });

  it('admin: limite vazio vira sem limite', async () => {
    const { createTeam } = dialog({ canUnlimited: true });
    fireEvent.change(screen.getByLabelText('Limite de pessoas'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar link/ }));
    await waitFor(() => expect(createTeam).toHaveBeenCalledWith('Developer', null, 7));
  });
});

describe('lista de convites ativos com usos', () => {
  const invite = {
    id: 'i1', token: 'tok', squadId: 'SQ', roleName: 'QA', invitedBy: 'x', status: 'PENDING' as const,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    multiUse: true, maxUses: 25, usesCount: 7,
  };
  const props = { squadId: 'SQ', state: 'ready' as const, error: '', onCopy: vi.fn(), onRevoke: vi.fn(), onRetry: vi.fn() };

  it('mostra "usos 7/25", copia e revoga', () => {
    const onRevoke = vi.fn();
    const onCopy = vi.fn();
    render(<PendingInvites {...props} invites={[invite]} onCopy={onCopy} onRevoke={onRevoke} />);
    expect(screen.getByText(/usos 7\/25/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Copiar link'));
    expect(onCopy).toHaveBeenCalledWith('https://x/invite/tok');
    fireEvent.click(screen.getByLabelText('Revogar convite'));
    expect(onRevoke).toHaveBeenCalledWith('i1');
  });

  it('lista quem entrou (nome e data)', async () => {
    listRedemptions.mockResolvedValue([{ userId: 'u1', name: 'Ana Souza', joinedAt: '2026-10-20T12:00:00' }]);
    render(<PendingInvites {...props} invites={[invite]} />);
    fireEvent.click(screen.getByLabelText('Ver quem entrou'));
    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect(listRedemptions).toHaveBeenCalledWith('SQ', 'i1');
  });

  it('convite cheio aparece como esgotado e o copiar fica desligado', () => {
    render(<PendingInvites {...props} invites={[{ ...invite, usesCount: 25 }]} />);
    expect(screen.getByText('Esgotado')).toBeTruthy();
    expect((screen.getByLabelText(/Convite esgotado/) as HTMLButtonElement).disabled).toBe(true);
  });
});
