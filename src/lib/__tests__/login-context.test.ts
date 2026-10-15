import { describe, expect, it } from 'vitest';
import { loginContextFrom, signUpToastDescription } from '../login-context';

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
