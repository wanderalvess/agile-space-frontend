import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isLegacyLeadRole, normalizeAuthRole } from '../types';
import { scopesAllowedForRole } from '../my-api-keys-client';

describe('nível de acesso da conta', () => {
  it('só existem ADMIN e MEMBER', () => {
    expect(AUTH_ROLES).toEqual(['ADMIN', 'MEMBER']);
  });

  it('normalizeAuthRole: ADMIN fica ADMIN; LEAD, vazio e desconhecido viram MEMBER', () => {
    expect(normalizeAuthRole('ADMIN')).toBe('ADMIN');
    expect(normalizeAuthRole(' admin ')).toBe('ADMIN');
    expect(normalizeAuthRole('LEAD')).toBe('MEMBER');
    expect(normalizeAuthRole('lead')).toBe('MEMBER');
    expect(normalizeAuthRole('MEMBER')).toBe('MEMBER');
    expect(normalizeAuthRole('Tech Lead')).toBe('MEMBER');
    expect(normalizeAuthRole('')).toBe('MEMBER');
    expect(normalizeAuthRole(undefined)).toBe('MEMBER');
    expect(normalizeAuthRole(null)).toBe('MEMBER');
  });

  it('isLegacyLeadRole reconhece só o nível antigo', () => {
    expect(isLegacyLeadRole('LEAD')).toBe(true);
    expect(isLegacyLeadRole(' lead ')).toBe(true);
    expect(isLegacyLeadRole('ADMIN')).toBe(false);
    expect(isLegacyLeadRole('Tech Lead')).toBe(false);
    expect(isLegacyLeadRole(undefined)).toBe(false);
  });

  it('escopos de chave de API: só o administrador tem a visão ampla; LEAD antigo vale como membro', () => {
    expect(scopesAllowedForRole('ADMIN').length).toBeGreaterThan(2);
    expect(scopesAllowedForRole('LEAD')).toEqual(['KNOWLEDGE_READ', 'SQUAD_READ']);
    expect(scopesAllowedForRole('MEMBER')).toEqual(['KNOWLEDGE_READ', 'SQUAD_READ']);
    expect(scopesAllowedForRole(undefined)).toEqual(['KNOWLEDGE_READ', 'SQUAD_READ']);
  });
});
