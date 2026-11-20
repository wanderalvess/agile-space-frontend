import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));

vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { id: 'me', name: 'Ana' } }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix' }) }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../app/brainstorming/api', () => ({ brainstormingApi: { saveOrUpdateBoard: (...a: unknown[]) => h.save(...a) } }));
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { CreateBrainstormDialog } from '../CreateBrainstormDialog';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  h.save.mockReset();
  h.toast.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

function setup(props: { ceremonySupported?: boolean } = {}) {
  const onCreated = vi.fn();
  render(<CreateBrainstormDialog open onOpenChange={vi.fn()} onCreated={onCreated} {...props} />);
  fireEvent.change(screen.getByLabelText('Título da sessão'), { target: { value: 'Deploy mais rápido' } });
  return { onCreated };
}
const create = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Criar sessão/ })); }); };

describe('Nova sessão: votos por pessoa e edição restrita', () => {
  it('sem ligar nada o corpo é o de sempre (sem os campos novos)', async () => {
    h.save.mockResolvedValue({ id: 'b1' });
    setup();
    await create();
    const body = h.save.mock.calls[0][0];
    expect(body).not.toHaveProperty('votesPerParticipant');
    expect(body.settings).toEqual({ isAnonymous: false });
  });

  it('liga o limite (sugere 3), muda o número e envia com a edição restrita', async () => {
    h.save.mockResolvedValue({ id: 'b1', status: 'OPEN', facilitatorId: 'me' });
    setup();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('switch', { name: /Limitar os votos por pessoa/ }));
    const count = within(dialog).getByLabelText('Votos por pessoa') as HTMLInputElement;
    expect(count.value).toBe('3');
    fireEvent.change(count, { target: { value: '7' } });
    fireEvent.blur(count);
    fireEvent.click(within(dialog).getByRole('switch', { name: /Só o autor e a facilitação editam/ }));
    await create();
    const body = h.save.mock.calls[0][0];
    expect(body.votesPerParticipant).toBe(7);
    expect(body.settings).toEqual({ isAnonymous: false, restrictEdits: true });
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('número inválido não vira limite: volta ao valor anterior e avisa', async () => {
    h.save.mockResolvedValue({ id: 'b1', status: 'OPEN' });
    setup();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('switch', { name: /Limitar os votos por pessoa/ }));
    const count = within(dialog).getByLabelText('Votos por pessoa') as HTMLInputElement;
    fireEvent.change(count, { target: { value: '500' } });
    fireEvent.blur(count);
    expect(within(dialog).getByText('Use um número de 1 a 100.')).toBeTruthy();
    await create();
    expect(h.save.mock.calls[0][0].votesPerParticipant).toBe(3);
  });

  it('servidor antigo que ignora os campos: avisa em vez de fingir que o limite vale', async () => {
    h.save.mockResolvedValue({ id: 'b1' }); // sem status nem facilitatorId
    const { onCreated } = setup();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: /Limitar os votos por pessoa/ }));
    await create();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'O servidor ainda não aplica esses ajustes' }));
    expect(onCreated).toHaveBeenCalled();
  });

  it('com o servidor sabidamente antigo (ceremonySupported=false) os ajustes nem aparecem', async () => {
    h.save.mockResolvedValue({ id: 'b1' });
    setup({ ceremonySupported: false });
    expect(screen.queryByText('Limitar os votos por pessoa')).toBeNull();
    expect(screen.queryByText(/Só o autor e a facilitação editam/)).toBeNull();
    await create();
    expect(h.save.mock.calls[0][0]).not.toHaveProperty('votesPerParticipant');
  });
});
