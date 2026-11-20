import { describe, expect, it } from 'vitest';
import { inviteView, unavailableKind, vacanciesLabel } from '../invite-state';
import { InviteApiError } from '../invite-api';
import { isTeamInviteFull, teamUsageLabel, validateTeamInvite } from '../roster/invites';

const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const past = new Date(Date.now() - 3_600_000).toISOString();
const base = { authLoading: false, hasSession: true, error: null, accepted: false };

describe('convite de equipe: estados da página', () => {
  it('vagas restantes, singular e sem limite', () => {
    expect(vacanciesLabel({ multiUse: true, remainingUses: 7 })).toBe('7 vagas restantes');
    expect(vacanciesLabel({ multiUse: true, remainingUses: 1 })).toBe('1 vaga restante');
    expect(vacanciesLabel({ multiUse: true, remainingUses: null })).toBe('sem limite de pessoas');
    expect(vacanciesLabel({ multiUse: false, remainingUses: 1 })).toBeNull();
  });

  it('visitante e logado veem o convite pendente', () => {
    const invite = { status: 'PENDING' as const, expiresAt: future };
    expect(inviteView({ ...base, hasSession: false, invite })).toBe('visitante');
    expect(inviteView({ ...base, invite })).toBe('normal');
  });

  it('esgotado, expirado e revogado', () => {
    expect(inviteView({ ...base, invite: { status: 'EXHAUSTED', expiresAt: future } })).toBe('esgotado');
    expect(inviteView({ ...base, hasSession: false, invite: { status: 'EXHAUSTED', expiresAt: future } })).toBe('esgotado');
    expect(inviteView({ ...base, invite: { status: 'EXPIRED', expiresAt: past } })).toBe('expirado');
    expect(inviteView({ ...base, invite: { status: 'REVOKED', expiresAt: future } })).toBe('cancelado');
    expect(unavailableKind({ status: 'EXHAUSTED', expiresAt: future })).toBe('esgotado');
  });

  it('409 no aceite (último lugar tomado por outra pessoa) vira esgotado', () => {
    const err = new InviteApiError('Este convite atingiu o limite de pessoas. Peça um novo link a quem convidou.', 409);
    expect(inviteView({ ...base, invite: { status: 'PENDING', expiresAt: future }, error: err })).toBe('esgotado');
  });

  it('quem já faz parte da squad vê "já faz parte" mesmo com o link esgotado; revogado segue revogado', () => {
    expect(inviteView({ ...base, invite: { status: 'PENDING', expiresAt: future, alreadyMember: true } })).toBe('ja-membro');
    expect(inviteView({ ...base, invite: { status: 'EXHAUSTED', expiresAt: future, alreadyMember: true } })).toBe('ja-membro');
    expect(inviteView({ ...base, invite: { status: 'REVOKED', expiresAt: future, alreadyMember: true } })).toBe('cancelado');
    expect(inviteView({ ...base, hasSession: false, invite: { status: 'PENDING', expiresAt: future, alreadyMember: true } })).toBe('visitante');
  });
});

describe('convite de equipe: criação na tela', () => {
  it('padrão 25 pessoas e 7 dias é aceito', () => {
    expect(validateTeamInvite('25', '7', false)).toEqual({ ok: true, maxUses: 25, days: 7 });
  });

  it('limite fora de 1..200 e validade fora de 1..30 são recusados', () => {
    for (const max of ['0', '201', '-3', '2.5', 'abc']) expect(validateTeamInvite(max, '7', true).ok).toBe(false);
    for (const days of ['0', '31', '1.5', '']) expect(validateTeamInvite('10', days, true).ok).toBe(false);
    expect(validateTeamInvite('200', '30', false)).toEqual({ ok: true, maxUses: 200, days: 30 });
  });

  it('limite vazio (sem limite) só vale para ADMIN', () => {
    expect(validateTeamInvite('', '7', true)).toEqual({ ok: true, maxUses: null, days: 7 });
    expect(validateTeamInvite('  ', '7', false).ok).toBe(false);
  });

  it('rótulo de usos e convite cheio', () => {
    expect(teamUsageLabel({ maxUses: 25, usesCount: 7 })).toBe('usos 7/25');
    expect(teamUsageLabel({ maxUses: null, usesCount: 7 })).toBe('usos 7, sem limite');
    expect(isTeamInviteFull({ multiUse: true, maxUses: 2, usesCount: 2 })).toBe(true);
    expect(isTeamInviteFull({ multiUse: true, maxUses: null, usesCount: 99 })).toBe(false);
    expect(isTeamInviteFull({ multiUse: false, maxUses: 1, usesCount: 1 })).toBe(false);
  });
});
