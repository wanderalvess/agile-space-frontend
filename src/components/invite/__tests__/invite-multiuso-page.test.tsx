import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteApiError } from '../../../lib/invite-api';

const getPreview = vi.fn();
const savePendingInvite = vi.fn();
const clearPendingInvite = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ token: 'equipe1234567890' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: null, isLoading: false, acceptInvite: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../lib/invite-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/invite-api')>();
  return { ...actual, inviteApi: { ...actual.inviteApi, getPreview: (...a: unknown[]) => getPreview(...a), getInvite: vi.fn() } };
});
vi.mock('../../../lib/pending-invite', () => ({
  clearPendingInvite: () => clearPendingInvite(),
  savePendingInvite: (...a: unknown[]) => savePendingInvite(...a),
}));
vi.mock('../../page', () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import InviteAcceptPage from '../../../app/invite/[token]/page';

const team = {
  squadId: 'SQ',
  squadName: 'Squad Alfa',
  roleName: 'Developer',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  emailMasked: null,
  multiUse: true,
  remainingUses: 7,
};

describe('página do convite de equipe sem login: convite pendente do navegador', () => {
  beforeEach(() => {
    getPreview.mockReset();
    savePendingInvite.mockReset();
    clearPendingInvite.mockReset();
  });

  it('com vagas: mostra a squad e as vagas e reserva o token para o login voltar ao convite', async () => {
    getPreview.mockResolvedValueOnce(team);
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Convite para a squad Squad Alfa')).toBeTruthy();
    expect(screen.getAllByText(/7 vagas restantes/).length).toBeGreaterThan(0);
    expect(savePendingInvite).toHaveBeenCalledWith('equipe1234567890');
    expect(clearPendingInvite).not.toHaveBeenCalled();
  });

  it('esgotado: mostra a mensagem e apaga a reserva do token', async () => {
    getPreview.mockResolvedValueOnce({ ...team, status: 'EXHAUSTED', remainingUses: 0 });
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Convite esgotado')).toBeTruthy();
    expect(screen.getByText('Este convite atingiu o limite de pessoas. Peça um novo link a quem convidou.')).toBeTruthy();
    expect(savePendingInvite).not.toHaveBeenCalled();
    expect(clearPendingInvite).toHaveBeenCalled();
  });

  it('expirado e revogado apagam a reserva', async () => {
    getPreview.mockResolvedValueOnce({ ...team, status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000).toISOString() });
    const first = render(<InviteAcceptPage />);
    expect(await screen.findByText('Convite indisponível')).toBeTruthy();
    expect(savePendingInvite).not.toHaveBeenCalled();
    first.unmount();
    getPreview.mockResolvedValueOnce({ ...team, status: 'REVOKED' });
    render(<InviteAcceptPage />);
    expect(await screen.findByText(/cancelado por quem o enviou/)).toBeTruthy();
    expect(clearPendingInvite).toHaveBeenCalledTimes(2);
  });

  it('429 não apaga a reserva do convite de equipe', async () => {
    getPreview.mockRejectedValueOnce(new InviteApiError('Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.', 429));
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
    expect(clearPendingInvite).not.toHaveBeenCalled();
  });
});
