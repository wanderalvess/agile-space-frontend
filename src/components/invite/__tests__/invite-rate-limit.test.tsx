import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptView } from '../InviteAcceptView';
import { InviteApiError, RATE_LIMIT_MESSAGE, inviteApi, inviteErrorFrom, isRateLimitError } from '../../../lib/invite-api';
import { inviteView } from '../../../lib/invite-state';

const common = { invite: null, accepting: false, onAccept: vi.fn(), onSwitchAccount: vi.fn(), onSkip: vi.fn() };

describe('429 na página do convite', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a resposta 429 vira erro de limite, com mensagem de esperar (não "convite não encontrado")', async () => {
    const res = new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 });
    const err = await inviteErrorFrom(res);
    expect(isRateLimitError(err)).toBe(true);
    expect(err.status).toBe(429);
    expect(err.message).toBe(RATE_LIMIT_MESSAGE);
    expect(isRateLimitError(new InviteApiError('x', 404))).toBe(false);
    expect(isRateLimitError(new Error('x'))).toBe(false);
  });

  it('mesmo se o servidor mandar "Muitas requisições" no corpo, a tela fala em tentar de novo', async () => {
    const res = new Response(JSON.stringify({ message: 'Muitas requisições. Tente novamente em instantes.' }), { status: 429 });
    const err = await inviteErrorFrom(res);
    expect(isRateLimitError(err)).toBe(true);
  });

  it('getPreview em 429 lança o erro de limite', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(inviteApi.getPreview('tok')).rejects.toSatisfy(isRateLimitError);
    vi.unstubAllGlobals();
  });

  it('a tela é "muitas-tentativas", não "invalido"; os outros erros seguem como antes', () => {
    const base = { authLoading: false, hasSession: false, invite: null, accepted: false };
    expect(inviteView({ ...base, error: new InviteApiError(RATE_LIMIT_MESSAGE, 429) })).toBe('muitas-tentativas');
    expect(inviteView({ ...base, error: new InviteApiError('Convite não encontrado.', 404) })).toBe('invalido');
    expect(inviteView({ ...base, error: new Error('falhou') })).toBe('invalido');
  });

  it('mostra "Tentar de novo" e não "Convite inválido"; o botão refaz a busca', () => {
    const onRetry = vi.fn();
    render(<InviteAcceptView {...common} view="muitas-tentativas" error={new InviteApiError(RATE_LIMIT_MESSAGE, 429)} onRetry={onRetry} />);
    expect(screen.queryByText('Convite inválido')).toBeNull();
    expect(screen.getByText('Muitas tentativas')).toBeTruthy();
    expect(screen.getByText(/Aguarde um instante e tente de novo/)).toBeTruthy();
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('"Ir para o início" continua disponível', () => {
    const onSkip = vi.fn();
    render(<InviteAcceptView {...common} view="muitas-tentativas" error={new InviteApiError(RATE_LIMIT_MESSAGE, 429)} onSkip={onSkip} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByText('Ir para o início'));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
