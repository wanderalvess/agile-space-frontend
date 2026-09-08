import { describe, it, expect } from 'vitest';
import { resolvePostLoginRedirect } from '../AuthGuard';
import { isCollaborativeRoute, ONBOARDING_EXEMPT_ROUTES } from '../IdentityGatekeeper';

describe('Auth Routing - Proteção de Rotas, Redirecionamentos e Isenções Colaborativas', () => {

  describe('Sanitização e Resolução de returnUrl pós-login (resolvePostLoginRedirect)', () => {
    it('deve preservar rotas internas válidas', () => {
      expect(resolvePostLoginRedirect('/dashboard')).toBe('/dashboard');
      expect(resolvePostLoginRedirect('/room/room-123')).toBe('/room/room-123');
      expect(resolvePostLoginRedirect('/showcase/sess-456')).toBe('/showcase/sess-456');
    });

    it('deve preservar rotas com parâmetros de query legítimos', () => {
      expect(resolvePostLoginRedirect('/room/room-123?tab=history&user=dev1')).toBe('/room/room-123?tab=history&user=dev1');
    });

    it('deve impedir loop de login quando returnUrl apontar para /login', () => {
      expect(resolvePostLoginRedirect('/login')).toBe('/');
      expect(resolvePostLoginRedirect('/login?returnUrl=/dashboard')).toBe('/');
    });

    it('deve impedir ataques de redirecionamento aberto (Open Redirect)', () => {
      expect(resolvePostLoginRedirect('https://evil-phishing.com')).toBe('/');
      expect(resolvePostLoginRedirect('http://malicious.org/steal')).toBe('/');
      expect(resolvePostLoginRedirect('javascript:alert(1)')).toBe('/');
    });

    it('deve retornar rota raiz quando returnUrl for nulo, indefinido ou vazio', () => {
      expect(resolvePostLoginRedirect(null)).toBe('/');
      expect(resolvePostLoginRedirect('')).toBe('/');
    });
  });

  describe('Identificação de Rotas Colaborativas (isCollaborativeRoute)', () => {
    it('deve identificar salas e cerimônias ágeis como colaborativas', () => {
      expect(isCollaborativeRoute('/room/planning-poker-1')).toBe(true);
      expect(isCollaborativeRoute('/showcase/entrega-sprint-45')).toBe(true);
      expect(isCollaborativeRoute('/retro/retro-board-12')).toBe(true);
      expect(isCollaborativeRoute('/brainstorming/ideacao-2026')).toBe(true);
      expect(isCollaborativeRoute('/health-check/squad-hc-1')).toBe(true);
      expect(isCollaborativeRoute('/action-plan/5w2h-plano')).toBe(true);
      expect(isCollaborativeRoute('/jiradash')).toBe(true);
    });

    it('deve retornar falso para rotas individuais e administrativas', () => {
      expect(isCollaborativeRoute('/workspace')).toBe(false);
      expect(isCollaborativeRoute('/admin')).toBe(false);
      expect(isCollaborativeRoute('/profile')).toBe(false);
      expect(isCollaborativeRoute('/settings')).toBe(false);
    });
  });

  describe('Rotas isentas de Onboarding (ONBOARDING_EXEMPT_ROUTES)', () => {
    it('deve conter as rotas essenciais de login e onboarding', () => {
      expect(ONBOARDING_EXEMPT_ROUTES).toContain('/login');
      expect(ONBOARDING_EXEMPT_ROUTES).toContain('/onboarding');
    });
  });
});
