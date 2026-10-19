import { describe, expect, it } from 'vitest';
import { inviteTokenFrom, loginContextFrom, loginModeFrom, loginUrlForInvite, signUpToastDescription } from '../login-context';

describe('loginContextFrom', () => {
  it('reconhece convite e salas pelo returnUrl', () => {
    expect(loginContextFrom('/invite/abc123')?.kind).toBe('invite');
    expect(loginContextFrom('/room/room-1?x=1')?.kind).toBe('room');
    expect(loginContextFrom('/retro/r1')?.kind).toBe('room');
    expect(loginContextFrom('/brainstorming/b1')?.kind).toBe('room');
  });

  it('ignora destinos comuns e endereços externos', () => {
    expect(loginContextFrom(null)).toBeNull();
    expect(loginContextFrom('/painel')).toBeNull();
    expect(loginContextFrom('//evil.example/invite/x')).toBeNull();
    expect(loginContextFrom('https://evil.example/invite/x')).toBeNull();
  });
});

describe('signUpToastDescription', () => {
  it('não promete vínculo que ainda não existe', () => {
    expect(signUpToastDescription(null, loginContextFrom('/invite/x'))).toBe('Agora é só aceitar o convite.');
    expect(signUpToastDescription(null, null)).toBe('Agora conecte você ao seu time.');
    expect(signUpToastDescription('Time da Ana', null)).toBe('Você já está no time Time da Ana.');
  });
});

describe('convite no login', () => {
  it('extrai o token do returnUrl e ignora o que não é convite', () => {
    expect(inviteTokenFrom('/invite/abc123')).toBe('abc123');
    expect(inviteTokenFrom('/invite/abc123?x=1#y')).toBe('abc123');
    expect(inviteTokenFrom('/room/abc')).toBeNull();
    expect(inviteTokenFrom('//evil.example/invite/x')).toBeNull();
    expect(inviteTokenFrom(null)).toBeNull();
    expect(loginContextFrom('/invite/abc123')?.inviteToken).toBe('abc123');
  });

  it('o link do login preserva o convite e abre a aba certa', () => {
    expect(loginUrlForInvite('tok1', 'login')).toBe('/login?returnUrl=%2Finvite%2Ftok1');
    expect(loginUrlForInvite('tok1', 'register')).toBe('/login?returnUrl=%2Finvite%2Ftok1&mode=register');
    expect(loginModeFrom('register')).toBe('register');
    expect(loginModeFrom('qualquer')).toBe('login');
    expect(loginModeFrom(null)).toBe('login');
  });
});
