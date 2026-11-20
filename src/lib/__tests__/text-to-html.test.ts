import { describe, it, expect } from 'vitest';
import { plainTextToHtml } from '../text-to-html';

describe('plainTextToHtml', () => {
  it('separa parágrafos e preserva quebras simples', () => {
    expect(plainTextToHtml('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });
  it('escapa HTML do texto', () => {
    expect(plainTextToHtml('<img src=x onerror=alert(1)> & ok')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; &amp; ok</p>');
  });
  it('vazio vira vazio', () => {
    expect(plainTextToHtml('  \n ')).toBe('');
  });
});
