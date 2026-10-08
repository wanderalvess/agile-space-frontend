import { describe, it, expect } from 'vitest';
import { isTaskContentComplete, formatFileSize, isImageBackground } from '../utils';
import { validateTaskFile } from '../TaskCardAttachments';
import { TASK_FILE_MAX_BYTES, TASK_FILE_MAX_COUNT, DEFAULT_SHOWCASE_IMAGE } from '../types';

const file = (name: string, type: string, size = 1024) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('Anexos dos cards (PNG, JPEG, PDF)', () => {
  it('limites combinados com o backend', () => {
    expect(TASK_FILE_MAX_COUNT).toBe(5);
    expect(TASK_FILE_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  describe('validateTaskFile', () => {
    it('aceita PNG, JPEG e PDF', () => {
      expect(validateTaskFile(file('print.png', 'image/png'))).toBeNull();
      expect(validateTaskFile(file('foto.jpg', 'image/jpeg'))).toBeNull();
      expect(validateTaskFile(file('foto.JPEG', 'image/jpeg'))).toBeNull();
      expect(validateTaskFile(file('laudo.pdf', 'application/pdf'))).toBeNull();
    });

    it('aceita arquivo sem tipo declarado quando a extensão é válida', () => {
      expect(validateTaskFile(file('print.png', ''))).toBeNull();
    });

    it('recusa formatos fora da lista', () => {
      expect(validateTaskFile(file('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toMatch(/formato não aceito/);
      expect(validateTaskFile(file('vetor.svg', 'image/svg+xml'))).toMatch(/formato não aceito/);
      expect(validateTaskFile(file('anim.gif', 'image/gif'))).toMatch(/formato não aceito/);
      expect(validateTaskFile(file('script.png.html', 'text/html'))).toMatch(/formato não aceito/);
    });

    it('recusa arquivo vazio e arquivo acima de 10 MB', () => {
      expect(validateTaskFile(file('a.png', 'image/png', 0))).toMatch(/vazio/);
      expect(validateTaskFile(file('a.png', 'image/png', TASK_FILE_MAX_BYTES))).toBeNull();
      expect(validateTaskFile(file('grande.pdf', 'application/pdf', TASK_FILE_MAX_BYTES + 1))).toMatch(/10 MB/);
    });
  });

  describe('isTaskContentComplete', () => {
    const base = {
      cardKind: 'story' as const,
      metrics: [],
      evidence: { problem: 'p', solution: 's', dev: '', qa: '', screenshot: '', video: '' },
    };

    it('card sem print, vídeo nem anexo não está pronto', () => {
      expect(isTaskContentComplete(base)).toBe(false);
    });

    it('arquivo anexado vale como evidência', () => {
      const withFile = { ...base, attachments: [{ id: 'f1', taskId: 't', name: 'a.png', contentType: 'image/png', size: 10 }] };
      expect(isTaskContentComplete(withFile)).toBe(true);
    });

    it('anexo sozinho não basta sem problema e solução', () => {
      const incomplete = {
        ...base,
        evidence: { ...base.evidence, problem: '' },
        attachments: [{ id: 'f1', taskId: 't', name: 'a.png', contentType: 'image/png', size: 10 }],
      };
      expect(isTaskContentComplete(incomplete)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formata em B, KB e MB', () => {
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(2048)).toBe('2 KB');
      expect(formatFileSize(5 * 1024 * 1024 + 512 * 1024)).toBe('5,5 MB');
    });
  });

  describe('imagem padrão da empresa', () => {
    it('é um arquivo local do app e vale como fundo de imagem', () => {
      expect(DEFAULT_SHOWCASE_IMAGE.startsWith('/')).toBe(true);
      expect(isImageBackground(DEFAULT_SHOWCASE_IMAGE)).toBe(true);
    });
  });
});
