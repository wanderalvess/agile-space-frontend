import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteApiError, RATE_LIMIT_MESSAGE } from '../../../lib/invite-api';

const getPreview = vi.fn();
const clearPendingInvite = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ token: 'abc' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: null, isLoading: false, acceptInvite: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../lib/invite-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/invite-api')>();
  return { ...actual, inviteApi: { ...actual.inviteApi, getPreview: (...a: unknown[]) => getPreview(...a), getInvite: vi.fn() } };
});
vi.mock('../../../lib/pending-invite', () => ({ clearPendingInvite: () => clearPendingInvite(), savePendingInvite: vi.fn() }));
vi.mock('../../page', () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import InviteAcceptPage from '../../../app/invite/[token]/page';

const preview = { squadId: 'SQ', squadName: 'Squad Alfa', roleName: 'Developer', status: 'PENDING', expiresAt: new Date(Date.now() + 86_400_000).toISOString(), emailMasked: null };

describe('página do convite com limite de requisições (429)', () => {
  beforeEach(() => {
    getPreview.mockReset();
    clearPendingInvite.mockReset();
  });

  it('mostra "Tentar de novo", não apaga o convite pendente e busca de novo ao clicar', async () => {
    getPreview.mockRejectedValueOnce(new InviteApiError(RATE_LIMIT_MESSAGE, 429)).mockResolvedValueOnce(preview);
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
    expect(screen.queryByText('Convite inválido')).toBeNull();
    expect(clearPendingInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getByText('Squad: Squad Alfa')).toBeTruthy());
    expect(getPreview).toHaveBeenCalledTimes(2);
  });

  it('um 404 continua sendo convite inválido e apaga o pendente', async () => {
    getPreview.mockRejectedValueOnce(new InviteApiError('Convite não encontrado.', 404));
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Convite inválido')).toBeTruthy();
    expect(clearPendingInvite).toHaveBeenCalled();
  });
});
