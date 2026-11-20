import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ roster: vi.fn() }));

vi.mock('../../../services/onboardingService', () => ({ onboardingService: { roster: mocks.roster } }));
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({
    id,
    value,
    onChange,
    options,
    placeholder,
  }: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import type { OnboardingCandidate } from '../../../services/onboardingService';
import type { SquadLinkRequest } from '../../../lib/squad-link-requests-api';
import { ApproveRequestDialog, pickableRows } from '../ApproveDialog';

const row = (over: Partial<OnboardingCandidate>): OnboardingCandidate => ({
  memberId: 'm1',
  displayName: 'Carlos Dev',
  roleName: 'Developer',
  roleKey: 'DEVELOPER',
  leadership: false,
  claimed: false,
  claimedByMe: false,
  claimable: true,
  ...over,
});

const ROWS = [
  row({ memberId: 'm1', displayName: 'Carlos Dev' }),
  row({ memberId: 'm2', displayName: 'Dora QA', roleName: 'QA', claimed: true }),
  row({ memberId: 'm3', displayName: 'Lia Lead', roleName: 'People Lead', leadership: true, claimable: false }),
];

// Sem linha e sem papel: o pedido antigo (V74).
const old: SquadLinkRequest = {
  id: 'r1',
  requester: { id: 'u1', name: 'Ana Paula', email: 'ana@totvs.com.br' },
  projectKey: 'DDWMISSI',
  kind: 'CONTRIBUTOR',
  emailInJira: 'ana@totvs.com.br',
  status: 'PENDING',
  createdAt: '2026-10-17T12:00:00Z',
};
const withRole: SquadLinkRequest = { ...old, requestedRoleName: 'Developer' };

const onCancel = vi.fn();
const onConfirm = vi.fn();

const renderDialog = (request: SquadLinkRequest | null, canApproveLeadership = false) =>
  render(<ApproveRequestDialog request={request} canApproveLeadership={canApproveLeadership} onCancel={onCancel} onConfirm={onConfirm} />);

beforeEach(() => {
  mocks.roster.mockReset();
  onCancel.mockReset();
  onConfirm.mockReset();
  mocks.roster.mockResolvedValue({ projectId: 'p', projectName: 'Missi', memberCount: 3, members: ROWS });
});
afterEach(cleanup);

describe('pickableRows', () => {
  it('tira linhas com conta e, sem canApproveLeadership, as de liderança', () => {
    expect(pickableRows(ROWS, false).map((m) => m.memberId)).toEqual(['m1']);
    expect(pickableRows(ROWS, true).map((m) => m.memberId)).toEqual(['m1', 'm3']);
  });
});

describe('ApproveRequestDialog', () => {
  it('pedido com papel: só confirma, sem seletor nem leitura do time', async () => {
    renderDialog(withRole);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar pedido' }));
    expect(onConfirm).toHaveBeenCalledWith(withRole, undefined);
    expect(screen.queryByLabelText('Ligar a qual pessoa do time?')).toBeNull();
    expect(mocks.roster).not.toHaveBeenCalled();
  });

  it('pedido sem linha e sem papel: seletor só com linhas livres e envia o memberId', async () => {
    renderDialog(old);
    const select = (await screen.findByLabelText('Ligar a qual pessoa do time?')) as HTMLSelectElement;
    await waitFor(() => expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'm1']));
    expect(mocks.roster).toHaveBeenCalledWith('DDWMISSI');
    const confirm = screen.getByRole('button', { name: 'Aprovar pedido' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'm1' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(old, 'm1');
  });

  it('linha de liderança só aparece para quem aprova liderança', async () => {
    renderDialog(old, true);
    const select = (await screen.findByLabelText('Ligar a qual pessoa do time?')) as HTMLSelectElement;
    await waitFor(() => expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'm1', 'm3']));
  });

  it('time sem linha livre: avisa e não deixa aprovar', async () => {
    mocks.roster.mockResolvedValue({ projectId: 'p', projectName: 'Missi', memberCount: 1, members: [ROWS[1]] });
    renderDialog(old);
    expect(await screen.findByText(/Todas as linhas do time já têm conta/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Aprovar pedido' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('falha ao ler o time: avisa e não deixa aprovar', async () => {
    mocks.roster.mockRejectedValue(new Error('x'));
    renderDialog(old);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar o time/);
    expect((screen.getByRole('button', { name: 'Aprovar pedido' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Cancelar não aprova', async () => {
    renderDialog(withRole);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
