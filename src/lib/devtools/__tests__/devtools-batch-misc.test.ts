import { describe, expect, it } from 'vitest';
import { analyzeIpv4 } from '../ip';
import { formatDocument, generateBatch, validateCnpj, validateCpf, validateDocument } from '../br-docs';
import { generateJUnitSkeleton } from '../junit';

describe('ip', () => {
  it('analisa CIDR /24 privado', () => {
    const r = analyzeIpv4('192.168.1.130/24');
    if (!r.ok) throw new Error(r.error);
    expect(r.data.mask).toBe('255.255.255.0');
    expect(r.data.network).toBe('192.168.1.0');
    expect(r.data.broadcast).toBe('192.168.1.255');
    expect(r.data.usableHosts).toBe(254);
    expect(r.data.ipClass).toBe('C');
    expect(r.data.isPublic).toBe(false);
  });
  it('rejeita entradas inválidas', () => {
    expect(analyzeIpv4('300.1.1.1').ok).toBe(false);
    expect(analyzeIpv4('1.1.1.1/33').ok).toBe(false);
  });
  it('/0 e /32', () => {
    const z = analyzeIpv4('8.8.8.8/0');
    if (!z.ok) throw new Error();
    expect(z.data.mask).toBe('0.0.0.0');
    expect(z.data.totalAddresses).toBe(2 ** 32);
    const s = analyzeIpv4('8.8.8.8');
    if (!s.ok) throw new Error();
    expect(s.data.usableHosts).toBe(1);
    expect(s.data.isPublic).toBe(true);
  });
});

describe('br-docs', () => {
  it('valida CPF/CNPJ conhecidos', () => {
    expect(validateCpf('52998224725')).toBe(true);
    expect(validateCpf('52998224726')).toBe(false);
    expect(validateCpf('11111111111')).toBe(false);
    expect(validateCnpj('11222333000181')).toBe(true);
    expect(validateCnpj('11222333000182')).toBe(false);
  });
  it('gerados passam na validação', () => {
    for (const t of ['CPF', 'CNPJ_CLASSIC', 'CNPJ_ALPHANUM'] as const) {
      generateBatch(t, 50, t !== 'CPF').forEach(d => expect(validateDocument(d)?.valid).toBe(true));
    }
  });
  it('filial compartilha raiz', () => {
    const b = generateBatch('CNPJ_CLASSIC', 3, true);
    expect(new Set(b.map(x => x.slice(0, 8))).size).toBe(1);
    expect(b.map(x => x.slice(8, 12))).toEqual(['0001', '0002', '0003']);
  });
  it('formata', () => {
    expect(formatDocument('52998224725', 'CPF')).toBe('529.982.247-25');
    expect(formatDocument('11222333000181', 'CNPJ_CLASSIC')).toBe('11.222.333/0001-81');
  });
});

describe('junit', () => {
  const src = `package com.x;\npublic class UserService {\n  private final UserRepo repo;\n  public User find(String id, int n) { return null; }\n  public void remove(Long id) {}\n}`;
  it('gera mocks e testes', () => {
    const out = generateJUnitSkeleton(src)!;
    expect(out).toContain('package com.x;');
    expect(out).toContain('@Mock\n    private UserRepo repo;');
    expect(out).toContain('void shouldExecuteFindSuccessfully()');
    expect(out).toContain('User result = target.find(id, n);');
    expect(out).toContain('target.remove(id);');
    expect(out).toContain('void shouldThrowExceptionWhenRemoveFails()');
  });
  it('sem classe devolve null', () => {
    expect(generateJUnitSkeleton('int x;')).toBeNull();
  });
});
