import { describe, it, expect } from 'vitest';
import { sprintWindowNotice } from '../helpers.js';

describe('sprintWindowNotice', () => {
  it('avisa quando a consulta não tem janela de sprint', () => {
    expect(sprintWindowNotice(null)).toContain('histórico inteiro');
    expect(sprintWindowNotice(undefined)).toContain('Sprint = <número>');
  });

  it('não avisa quando há janela', () => {
    expect(sprintWindowNotice(new Date('2026-10-01T08:00:00-03:00'))).toBeNull();
  });
});
