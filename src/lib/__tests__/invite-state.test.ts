import { describe, expect, it } from 'vitest';
import { InviteApiError, inviteErrorFrom, type Invite } from '../invite-api';
import { expiresInLabel, invitedByText, inviteView, loginInviteNotice, otherEmailText, unavailableKind, type InviteViewInput } from '../invite-state';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const DAY = 86_400_000;

function invite(patch: Partial<Invite> = {}): Invite {
  return {
    id: 'i1',
    token: 't',
    squadId: 'DDWMISSI',
    roleName: 'Developer',
    invitedBy: 'u1',
    status: 'PENDING',
    createdAt: new Date(NOW - DAY).toISOString(),
    expiresAt: new Date(NOW + 6 * DAY).toISOString(),
    ...patch,
  };
}

const base: InviteViewInput = { authLoading: false, hasSession: true, invite: invite(), error: null, accepted: false };

describe('unavailableKind', () => {
  it('convite pendente e dentro do prazo está disponível', () => {
    expect(unavailableKind(invite(), NOW)).toBeNull();
    expect(unavailableKind(null, NOW)).toBeNull();
  });

  it('separa usado, cancelado e vencido (por status ou por data)', () => {
    expect(unavailableKind(invite({ status: 'ACCEPTED' }), NOW)).toBe('usado');
    expect(unavailableKind(invite({ status: 'REVOKED' }), NOW)).toBe('cancelado');
    expect(unavailableKind(invite({ status: 'EXPIRED' }), NOW)).toBe('expirado');
    expect(unavailableKind(invite({ expiresAt: new Date(NOW - 1000).toISOString() }), NOW)).toBe('expirado');
  });
});

describe('inviteView', () => {
  it('espera a sessão antes de qualquer coisa', () => {
    expect(inviteView({ ...base, authLoading: true }, NOW)).toBe('sessao');
    expect(inviteView({ ...base, hasSession: false }, NOW)).toBe('visitante');
    expect(inviteView({ ...base, hasSession: false, invite: null }, NOW)).toBe('verificando');
    expect(inviteView({ ...base, hasSession: false, invite: invite({ status: 'ACCEPTED' }) }, NOW)).toBe('usado');
    expect(inviteView({ ...base, hasSession: false, error: new Error('404') }, NOW)).toBe('invalido');
  });

  it('verifica enquanto o convite não chegou', () => {
    expect(inviteView({ ...base, invite: null }, NOW)).toBe('verificando');
  });

  it('mostra o convite normal, e o aceito depois de aceitar', () => {
    expect(inviteView(base, NOW)).toBe('normal');
    expect(inviteView({ ...base, accepted: true }, NOW)).toBe('aceito');
  });

  it('erro de carga ou de aceite vence o convite carregado', () => {
    expect(inviteView({ ...base, error: new Error('Convite não encontrado') }, NOW)).toBe('invalido');
  });

  it('403 INVITE_OTHER_EMAIL vira a tela de outro e-mail; outro 403 continua inválido', () => {
    expect(inviteView({ ...base, invite: null, error: new InviteApiError('x', 403, 'INVITE_OTHER_EMAIL') }, NOW)).toBe('outro-email');
    expect(inviteView({ ...base, invite: null, error: new InviteApiError('x', 403) }, NOW)).toBe('invalido');
    expect(inviteView({ ...base, invite: null, error: new InviteApiError('x', 404, 'INVITE_OTHER_EMAIL') }, NOW)).toBe('invalido');
  });

  it('convite indisponível mostra a tela do motivo', () => {
    expect(inviteView({ ...base, invite: invite({ status: 'ACCEPTED' }) }, NOW)).toBe('usado');
    expect(inviteView({ ...base, invite: invite({ status: 'REVOKED' }) }, NOW)).toBe('cancelado');
    expect(inviteView({ ...base, invite: invite({ status: 'EXPIRED' }) }, NOW)).toBe('expirado');
  });
});

describe('expiresInLabel', () => {
  it('conta dias inteiros, no singular e no plural', () => {
    expect(expiresInLabel(new Date(NOW + 6.5 * DAY).toISOString(), NOW)).toBe('Expira em 6 dias');
    expect(expiresInLabel(new Date(NOW + 1.2 * DAY).toISOString(), NOW)).toBe('Expira em 1 dia');
  });

  it('abaixo de um dia usa horas; abaixo de uma hora, "menos de 1 hora"', () => {
    expect(expiresInLabel(new Date(NOW + 5.5 * 3_600_000).toISOString(), NOW)).toBe('Expira em 5 h');
    expect(expiresInLabel(new Date(NOW + 20 * 60_000).toISOString(), NOW)).toBe('Expira em menos de 1 hora');
  });

  it('já vencido ou data inválida não mostra nada', () => {
    expect(expiresInLabel(new Date(NOW - 1).toISOString(), NOW)).toBeNull();
    expect(expiresInLabel('lixo', NOW)).toBeNull();
  });
});

describe('otherEmailText', () => {
  it('cita o e-mail mascarado quando o servidor o manda', () => {
    const err = new InviteApiError('x', 403, 'INVITE_OTHER_EMAIL', 'c••••@totvs.com.br');
    expect(otherEmailText('eu@totvs.com.br', err)).toBe('Você entrou como eu@totvs.com.br, mas o convite foi enviado para c••••@totvs.com.br.');
  });

  it('sem o e-mail mascarado, fala em "outro e-mail"', () => {
    const err = new InviteApiError('x', 403, 'INVITE_OTHER_EMAIL');
    expect(otherEmailText(undefined, err)).toBe('Você entrou com outra conta, mas o convite foi enviado para outro e-mail.');
  });
});

describe('inviteErrorFrom', () => {
  const res = (status: number, body: unknown) => ({ status, json: async () => body }) as unknown as Response;

  it('guarda status, code e e-mail mascarado e usa a mensagem do servidor', async () => {
    const err = await inviteErrorFrom(res(403, { message: 'Convite de outro e-mail', code: 'INVITE_OTHER_EMAIL', invitedEmailMasked: 'c••••@x.com' }));
    expect(err).toBeInstanceOf(InviteApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('INVITE_OTHER_EMAIL');
    expect(err.invitedEmailMasked).toBe('c••••@x.com');
    expect(err.message).toBe('Convite de outro e-mail');
  });

  it('mensagem genérica do Spring vira texto em português por status', async () => {
    expect((await inviteErrorFrom(res(404, { error: 'Not Found' }))).message).toMatch(/Convite não encontrado/);
    expect((await inviteErrorFrom(res(403, { error: 'Forbidden' }))).message).toMatch(/permissão/);
    expect((await inviteErrorFrom(res(500, {}))).message).toBe('Não foi possível concluir (erro 500).');
  });

  it('corpo que não é JSON não quebra', async () => {
    const broken = {
      status: 502,
      json: async () => {
        throw new Error('html');
      },
    } as unknown as Response;
    expect((await inviteErrorFrom(broken)).status).toBe(502);
  });
});

describe('texto do convite para quem ainda não entrou', () => {
  it('quem convidou só aparece quando se sabe', () => {
    expect(invitedByText('Lia Lider')).toBe('Convite de Lia Lider');
    expect(invitedByText('  ')).toBeNull();
    expect(invitedByText(null)).toBeNull();
  });

  it('o aviso do login nomeia a squad e quem convidou; sem a prévia fica o texto genérico', () => {
    const n = loginInviteNotice({ squadId: 'SQ', squadName: 'Squad Alfa', invitedByName: 'Lia Lider' });
    expect(n.title).toBe('Você foi convidado para a squad Squad Alfa');
    expect(n.description).toContain('Convite de Lia Lider.');
    expect(loginInviteNotice({ squadId: 'SQ', squadName: null }).title).toBe('Você foi convidado para a squad SQ');
    expect(loginInviteNotice(null).title).toBe('Você recebeu um convite para uma squad');
  });
});
