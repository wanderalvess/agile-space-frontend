import { describe, it, expect } from 'vitest';
import { isPdfBuffer, isZipBuffer, looksLikeText } from '../file-sniff';

describe('file-sniff', () => {
  it('reconhece PDF pelo cabeçalho', () => {
    expect(isPdfBuffer(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdfBuffer(Buffer.from('<html>não sou pdf</html>'))).toBe(false);
  });
  it('reconhece zip (docx) pelo cabeçalho PK', () => {
    expect(isZipBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(isZipBuffer(Buffer.from('%PDF-1.7'))).toBe(false);
  });
  it('texto não tem byte nulo', () => {
    expect(looksLikeText(Buffer.from('olá mundo'))).toBe(true);
    expect(looksLikeText(Buffer.from([0x50, 0x00, 0x41]))).toBe(false);
  });
});
