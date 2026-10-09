import { describe, it, expect } from 'vitest';
import { normalizeHttpUrl, safeHref } from '../safe-url';

describe('normalizeHttpUrl', () => {
  it('completa com https quando falta o esquema', () => {
    expect(normalizeHttpUrl('jira.empresa.com/board')).toBe('https://jira.empresa.com/board');
    expect(normalizeHttpUrl('  http://a.com/x ')).toBe('http://a.com/x');
  });
  it('recusa javascript:, data:, ftp: e texto solto', () => {
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeHttpUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(normalizeHttpUrl('data:text/html,<b>x</b>')).toBeNull();
    expect(normalizeHttpUrl('ftp://x.com')).toBeNull();
    expect(normalizeHttpUrl('semponto')).toBeNull();
    expect(normalizeHttpUrl('')).toBeNull();
  });
  it('não trata "httpfoo.com" como esquema nem deixa passar link relativo', () => {
    expect(normalizeHttpUrl('httpfoo.com')).toBe('https://httpfoo.com');
  });
});

describe('safeHref', () => {
  it('aceita caminho interno e http(s), descarta o resto', () => {
    expect(safeHref('/retro/abc')).toBe('/retro/abc');
    expect(safeHref('https://a.com')).toBe('https://a.com');
    expect(safeHref('//evil.com')).toBeUndefined();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
