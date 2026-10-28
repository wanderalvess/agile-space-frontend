import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const saveOrUpdateRoom = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({ usePathname: () => '/poker', useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'u1' } }) }));
vi.mock('@/hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'squad-1' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/shared/SquadChoiceField', () => ({ SquadChoiceField: () => <div>squad</div> }));
vi.mock('@/app/room/api', () => ({ pokerApi: { saveOrUpdateRoom: (...a: unknown[]) => saveOrUpdateRoom(...a) } }));
vi.mock('@/lib/poker-templates', async (orig) => ({ ...(await orig<typeof import('@/lib/poker-templates')>()), listTemplates: () => [] }));

import { CreateSessionModal } from '../CreateSessionModal';
import { DEFAULT_VOTING_CARGOS } from '@/lib/poker-utils';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
beforeEach(() => {
  saveOrUpdateRoom.mockReset();
  saveOrUpdateRoom.mockResolvedValue({ id: 'sala-1' });
});
afterEach(cleanup);

const open = () => render(<CreateSessionModal open onOpenChange={vi.fn()} />);

describe('CreateSessionModal: "Quem vota"', () => {
  it('não tem mais o interruptor "Gestão pode votar" e mostra "Quem vota" com o padrão marcado', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar' }));
    expect(screen.queryByText('Gestão pode votar')).toBeNull();
    expect(screen.getByText('Quem vota')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Developer' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Analista de QA' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Tech Lead' }) as HTMLInputElement).checked).toBe(false);
  });

  it('a sala nasce com o padrão em settings.votingCargos e sem o campo antigo', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Nome da sala'), { target: { value: 'Refino' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await waitFor(() => expect(saveOrUpdateRoom).toHaveBeenCalledTimes(1));
    const room = saveOrUpdateRoom.mock.calls[0][0];
    expect(room.settings.votingCargos).toEqual([...DEFAULT_VOTING_CARGOS]);
    expect('allowManagementToVote' in room.settings).toBe(false);
  });

  it('os cargos escolhidos vão para a sala', async () => {
    open();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tech Lead' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Developer' }));
    fireEvent.change(screen.getByLabelText('Nome da sala'), { target: { value: 'Refino' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await waitFor(() => expect(saveOrUpdateRoom).toHaveBeenCalledTimes(1));
    const { votingCargos } = saveOrUpdateRoom.mock.calls[0][0].settings;
    expect(votingCargos).toContain('Tech Lead');
    expect(votingCargos).not.toContain('Developer');
    expect(votingCargos).toContain('Desenvolvedor(a)');
  });
});
