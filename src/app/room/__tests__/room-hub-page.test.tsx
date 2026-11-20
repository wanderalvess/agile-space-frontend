import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  profile: { current: null as null | { name: string; role: string } },
  api: { listRooms: vi.fn(), getRoom: vi.fn(), deleteRoom: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'me' } }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ requestIdentity: vi.fn(), userProfile: h.profile.current }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'S1' }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../components/page', () => ({
  PageShell: ({ children }: any) => <div>{children}</div>,
  PageHeader: () => null,
}));
vi.mock('../../../components/poker/PokerGuide', () => ({ PokerGuide: () => null }));
vi.mock('../../../components/shared/ModuleIntegrationDialog', () => ({ ModuleIntegrationButton: () => null }));
vi.mock('../../../components/poker/CreateSessionModal', () => ({
  CreateSessionModal: ({ open }: { open: boolean }) => (open ? <div data-testid="criar" /> : null),
}));
vi.mock('../api', () => ({ pokerApi: h.api }));

import PokerHubPage from '../page';

const META = 'agileSpace_rooms_meta';

beforeEach(() => {
  h.profile.current = { name: 'Ana', role: 'Developer' };
  h.api.listRooms.mockResolvedValue([]);
  h.api.getRoom.mockReset();
  localStorage.clear();
  window.history.replaceState(null, '', '/room');
});
afterEach(cleanup);

describe('hub do Poker', () => {
  it('?nova=1 abre a criação quando o perfil está pronto e limpa a URL', async () => {
    window.history.replaceState(null, '', '/room?nova=1');
    await act(async () => { render(<PokerHubPage />); });
    await waitFor(() => expect(screen.getByTestId('criar')).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('?nova=1 espera o perfil carregar em vez de se perder', async () => {
    h.profile.current = null;
    window.history.replaceState(null, '', '/room?nova=1');
    const { rerender } = render(<PokerHubPage />);
    await act(async () => {});
    expect(screen.queryByTestId('criar')).toBeNull();
    h.profile.current = { name: 'Ana', role: 'Developer' };
    await act(async () => { rerender(<PokerHubPage />); });
    await waitFor(() => expect(screen.getByTestId('criar')).toBeTruthy());
  });

  it('atalho local cuja sala deu 404 some da lista e do navegador; os demais ficam', async () => {
    localStorage.setItem(META, JSON.stringify([
      { roomId: 'GONE', type: 'poker', title: 'Sala apagada', team: 'X', createdAt: '2026-10-01T10:00:00Z' },
      { roomId: 'OK', type: 'poker', title: 'Sala viva', team: 'X', createdAt: '2026-10-02T10:00:00Z' },
    ]));
    h.api.getRoom.mockImplementation(async (id: string) => {
      if (id === 'GONE') throw Object.assign(new Error('x'), { status: 404 });
      return { id };
    });
    await act(async () => { render(<PokerHubPage />); });
    await waitFor(() => expect(screen.queryByText('Sala apagada')).toBeNull());
    expect(screen.getByText('Sala viva')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(META)!).map((r: any) => r.roomId)).toEqual(['OK']);
  });
});
