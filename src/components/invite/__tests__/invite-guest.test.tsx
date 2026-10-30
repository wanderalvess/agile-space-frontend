import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptView } from '../InviteAcceptView';
import { inviteApi, type InvitePreview } from '../../../lib/invite-api';

const preview: InvitePreview = {
  squadId: 'SQ',
  squadName: 'Squad Alfa',
  roleName: 'Developer',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  emailMasked: null,
};

const common = { error: null, accepting: false, onAccept: vi.fn(), onSwitchAccount: vi.fn(), onSkip: vi.fn() };

describe('página do convite sem login', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra a squad, o papel, sem nome de quem convidou, com os dois caminhos para entrar', () => {
    const onSignIn = vi.fn();
    const onSignUp = vi.fn();
    render(<InviteAcceptView {...common} view="visitante" invite={preview} onSignIn={onSignIn} onSignUp={onSignUp} />);
    expect(screen.getByText('Squad: Squad Alfa')).toBeTruthy();
    expect(screen.queryByText(/Convite de/)).toBeNull();
    expect(screen.queryByText('Aceitar Convite')).toBeNull();
    fireEvent.click(screen.getByText('Criar conta e aceitar'));
    fireEvent.click(screen.getByText(/Já tenho conta/));
    expect(onSignUp).toHaveBeenCalledOnce();
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('convite endereçado diz com qual e-mail entrar, sem expor o e-mail inteiro', () => {
    render(<InviteAcceptView {...common} view="visitante" invite={{ ...preview, emailMasked: 'a••••@totvs.com.br' }} onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(screen.getByText(/a••••@totvs.com.br/)).toBeTruthy();
  });

  it('link vencido ou já usado mostra mensagem clara em vez do convite', () => {
    render(<InviteAcceptView {...common} view="expirado" invite={{ ...preview, status: 'EXPIRED' }} />);
    expect(screen.getByText('Convite indisponível')).toBeTruthy();
    expect(screen.getByText(/expirou/)).toBeTruthy();
  });

  it('logado continua vendo Aceitar Convite', () => {
    render(<InviteAcceptView {...common} view="normal" invite={preview} email="ana@totvs.com.br" />);
    expect(screen.getByText('Aceitar Convite')).toBeTruthy();
    expect(screen.getByText(/Entrando como ana@totvs.com.br/)).toBeTruthy();
  });
});

describe('inviteApi.getPreview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('chama a rota pública sem cabeçalho de sessão', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => preview });
    vi.stubGlobal('fetch', fetchMock);
    expect((await inviteApi.getPreview('tok 1')).squadName).toBe('Squad Alfa');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/public\/invites\/tok%201$/);
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('token inexistente vira erro com mensagem em português', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) }));
    await expect(inviteApi.getPreview('x')).rejects.toThrow(/Convite não encontrado/);
    vi.unstubAllGlobals();
  });
});
