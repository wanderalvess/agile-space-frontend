import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createLinkRequest: vi.fn(), toast: vi.fn() }));

vi.mock('../../../lib/link-requests-api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/link-requests-api')>()),
  createLinkRequest: mocks.createLinkRequest,
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { CONTRIBUTOR_ROLES } from '../../../lib/types';
import { RequestLinkStep } from '../RequestLinkStep';

const onSent = vi.fn();

beforeEach(() => {
  mocks.createLinkRequest.mockReset();
  mocks.toast.mockReset();
  onSent.mockReset();
  mocks.createLinkRequest.mockResolvedValue({ id: 'r1', status: 'PENDING' });
});
afterEach(cleanup);

const submit = () => fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }));

describe('RequestLinkStep: pessoa que não aparece na lista', () => {
  const renderStep = () => render(<RequestLinkStep target={{ projectKey: 'DDWMISSI' }} defaultEmail="ana@totvs.com.br" onBack={() => {}} onSent={onSent} />);

  it('oferece só os papéis de contribuidor da lista permitida, nunca liderança', () => {
    renderStep();
    const options = screen.getAllByRole('radio').map((r) => r.textContent);
    expect(options).toEqual([...CONTRIBUTOR_ROLES]);
    for (const leadership of ['Agile Master', 'Product Owner', 'Tech Lead', 'People Lead', 'Tribe Lead', 'Scrum Master']) {
      expect(options).not.toContain(leadership);
    }
  });

  it('exige escolher o papel antes de enviar', () => {
    renderStep();
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Escolha o seu papel');
    expect(mocks.createLinkRequest).not.toHaveBeenCalled();
  });

  it('envia kind=CONTRIBUTOR e requestedRoleName', async () => {
    renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Analista de QA' }));
    expect(screen.getByRole('radio', { name: 'Analista de QA' }).getAttribute('aria-checked')).toBe('true');
    submit();
    await waitFor(() => expect(mocks.createLinkRequest).toHaveBeenCalledTimes(1));
    expect(mocks.createLinkRequest).toHaveBeenCalledWith({
      projectKey: 'DDWMISSI',
      memberId: undefined,
      emailInJira: 'ana@totvs.com.br',
      message: '',
      kind: 'CONTRIBUTOR',
      requestedRoleName: 'Analista de QA',
    });
    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ id: 'r1', status: 'PENDING' }));
    expect(screen.getByText('Pedido enviado')).toBeTruthy();
  });

  it('erro do servidor (ex.: 422/409) aparece no aviso e mantém o formulário', async () => {
    mocks.createLinkRequest.mockRejectedValue(new Error('Você já tem essa função na squad'));
    renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'QA' }));
    submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({ description: 'Você já tem essa função na squad', variant: 'destructive' });
    expect(onSent).not.toHaveBeenCalled();
  });
});

describe('RequestLinkStep: linha da lista (fluxo de antes)', () => {
  const member = { memberId: 'm1', displayName: 'Bruno Lima', roleName: 'Agile Master' };

  it('não pede papel e envia a linha, sem kind nem requestedRoleName', async () => {
    render(<RequestLinkStep target={{ projectKey: 'DDWMISSI', member }} defaultEmail="bruno@totvs.com.br" onBack={() => {}} onSent={onSent} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    submit();
    await waitFor(() => expect(mocks.createLinkRequest).toHaveBeenCalledTimes(1));
    expect(mocks.createLinkRequest.mock.calls[0][0]).toEqual({ projectKey: 'DDWMISSI', memberId: 'm1', emailInJira: 'bruno@totvs.com.br', message: '' });
  });
});
