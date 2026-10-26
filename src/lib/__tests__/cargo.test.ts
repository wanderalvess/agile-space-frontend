import { describe, expect, it } from 'vitest';
import { resolveCargo } from '../cargo';

describe('resolveCargo', () => {
  it('prefere o cargo da administração ao papel na squad', () => {
    expect(resolveCargo('Tech Lead', 'Developer')).toBe('Tech Lead');
  });

  it('sem cargo, usa o papel na squad ativa', () => {
    expect(resolveCargo(undefined, 'Analista de QA')).toBe('Analista de QA');
    expect(resolveCargo('  ', 'QA')).toBe('QA');
  });

  it('nível de acesso não é cargo', () => {
    expect(resolveCargo('admin', 'user')).toBe('');
    expect(resolveCargo(null, 'Admin')).toBe('');
  });

  it('cargo de verdade vence mesmo com nível de acesso no outro campo', () => {
    expect(resolveCargo('admin', 'Product Owner')).toBe('Product Owner');
  });

  it('sem nada, vazio', () => {
    expect(resolveCargo()).toBe('');
  });
});
