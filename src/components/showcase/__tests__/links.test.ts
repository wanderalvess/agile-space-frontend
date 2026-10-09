import { describe, it, expect } from 'vitest';
import {
  compareText,
  extractMediaUrl,
  getDirectImageUrl,
  getEmbedUrl,
  getEvidenceUrls,
  imageBackgroundCss,
  isImageBackground,
  isImageUrl,
  isPdfUrl,
  stripNonLatin1ForPdf,
  toSafeUrl,
} from '../utils';

describe('toSafeUrl', () => {
  it('descarta esquemas que executam código, mesmo disfarçados', () => {
    expect(toSafeUrl('javascript:alert(1)')).toBe('');
    expect(toSafeUrl('  JaVa\tScRiPt:alert(1)')).toBe('');
    expect(toSafeUrl('data:text/html;base64,AAAA')).toBe('');
    expect(toSafeUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('mantém http/https e completa link sem esquema', () => {
    expect(toSafeUrl('https://tdn.totvs.com/x')).toBe('https://tdn.totvs.com/x');
    expect(toSafeUrl('tdn.totvs.com/x')).toBe('https://tdn.totvs.com/x');
    expect(toSafeUrl('//cdn.exemplo.com/a.png')).toBe('https://cdn.exemplo.com/a.png');
    expect(toSafeUrl('')).toBe('');
    expect(toSafeUrl(null)).toBe('');
  });

  it('getEvidenceUrls não devolve link perigoso', () => {
    expect(getEvidenceUrls({ screenshot: 'javascript:alert(1)', video: 'https://www.loom.com/share/abc', evidencePreference: 'video' }))
      .toEqual(['https://www.loom.com/share/abc']);
  });
});

describe('getEmbedUrl', () => {
  it('link de compartilhamento do Loom com ?sid= vira embed do Loom, não do Drive', () => {
    expect(getEmbedUrl('https://www.loom.com/share/abc123?sid=7f3a-1111-2222')).toBe('https://www.loom.com/embed/abc123');
  });

  it('Drive só quando o host é o do Drive', () => {
    expect(getEmbedUrl('https://drive.google.com/file/d/FILE123/view?usp=sharing')).toBe('https://drive.google.com/file/d/FILE123/preview');
    expect(getEmbedUrl('https://drive.google.com/open?id=FILE456')).toBe('https://drive.google.com/file/d/FILE456/preview');
    expect(getEmbedUrl('https://exemplo.com/relatorio?id=99')).toBe('https://exemplo.com/relatorio?id=99');
    expect(getDirectImageUrl('https://exemplo.com/img?id=99')).toBe('https://exemplo.com/img?id=99');
    expect(getDirectImageUrl('https://drive.google.com/file/d/FILE123/view')).toBe('https://lh3.googleusercontent.com/d/FILE123=w1600');
  });

  it('YouTube em formatos comuns', () => {
    expect(getEmbedUrl('https://youtu.be/ID1?t=30')).toBe('https://www.youtube.com/embed/ID1');
    expect(getEmbedUrl('https://www.youtube.com/watch?feature=share&v=ID2')).toBe('https://www.youtube.com/embed/ID2');
    expect(getEmbedUrl('https://www.youtube.com/shorts/ID3')).toBe('https://www.youtube.com/embed/ID3');
  });

  it('isPdfUrl não confunde "id=" qualquer com PDF do Drive', () => {
    expect(isPdfUrl('https://exemplo.com/p?id=1')).toBe(false);
    expect(isPdfUrl('https://exemplo.com/a.pdf?x=1')).toBe(true);
  });
});

describe('extractMediaUrl / isImageUrl', () => {
  it('tira a marcação wiki colada no fim do link', () => {
    expect(extractMediaUrl('veja !https://x.com/a.png!')).toBe('https://x.com/a.png');
    expect(extractMediaUrl('[print|https://x.com/b.jpg]')).toBe('https://x.com/b.jpg');
  });

  it('extensão precisa estar no caminho, não no host', () => {
    expect(isImageUrl('https://x.com/a.png?v=2')).toBe(true);
    expect(isImageUrl('https://app.gifted.com/painel')).toBe(false);
  });
});

describe('compareText', () => {
  it('ordena chaves em ordem natural', () => {
    expect(['PROJ-10', 'PROJ-2', 'PROJ-1'].sort(compareText)).toEqual(['PROJ-1', 'PROJ-2', 'PROJ-10']);
  });
});

describe('stripNonLatin1ForPdf', () => {
  it('troca travessão e aspas curvas por ASCII em vez de apagar', () => {
    expect(stripNonLatin1ForPdf('Isso — aquilo “ok” não')).toBe('Isso - aquilo "ok" não');
  });
});

describe('fundo de imagem', () => {
  it('rejeita URL protocol-relative e protege o url() do CSS', () => {
    expect(isImageBackground('//evil.com/x.png')).toBe(false);
    expect(isImageBackground('/showcase/fundo.webp')).toBe(true);
    expect(imageBackgroundCss('https://x.com/a b).png')).toContain('url("https://x.com/a b).png")');
  });
});
