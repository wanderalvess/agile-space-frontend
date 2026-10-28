import { describe, expect, it } from 'vitest';
import { resolveCargo, SEM_CARGO } from '../cargo';

describe('resolveCargo: o cargo é o da administração, sem fallback', () => {
  it('devolve o jobTitle aparado', () => {
    expect(resolveCargo('  Tech Lead ')).toBe('Tech Lead');
  });

  it('sem cargo definido devolve vazio (as telas mostram "Sem cargo")', () => {
    expect(resolveCargo()).toBe('');
    expect(resolveCargo(null)).toBe('');
    expect(resolveCargo('   ')).toBe('');
    expect(SEM_CARGO).toBe('Sem cargo');
  });

  it('nível de acesso não é cargo', () => {
    expect(resolveCargo('admin')).toBe('');
    expect(resolveCargo('User')).toBe('');
  });
});
