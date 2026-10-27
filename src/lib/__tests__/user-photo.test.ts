import { describe, expect, it, vi } from 'vitest';
import { centerSquare, prepareProfilePhoto, PhotoPrepareError } from '../photo-resize';
import { resolvePhotoUrl } from '../user-photo-api';

describe('photo-resize', () => {
  it('recorta o quadrado central', () => {
    expect(centerSquare(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(centerSquare(100, 300)).toEqual({ sx: 0, sy: 100, side: 100 });
  });

  it('recusa arquivo que não é imagem', async () => {
    await expect(prepareProfilePhoto(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(/não é uma imagem/);
  });

  it('desenha 256x256 e exporta JPEG 0.85', async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['j'], { type: 'image/jpeg' })));
    const ctx = { fillRect: vi.fn(), drawImage, fillStyle: '' };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob };
    const spy = vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 600, height: 400, close }));
    const blob = await prepareProfilePhoto(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(blob.type).toBe('image/jpeg');
    expect(canvas.width).toBe(256);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 100, 0, 400, 400, 0, 0, 256, 256);
    expect((toBlob.mock.calls[0] as unknown[])[1]).toBe('image/jpeg');
    expect((toBlob.mock.calls[0] as unknown[])[2]).toBe(0.85);
    expect(close).toHaveBeenCalled();
    spy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('falha de leitura vira mensagem em PT-BR', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('x')));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    class BadImage {
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BadImage);
    await expect(prepareProfilePhoto(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toBeInstanceOf(PhotoPrepareError);
    vi.unstubAllGlobals();
  });
});

describe('resolvePhotoUrl', () => {
  it('junta só a origem da API (sem duplicar /api)', () => {
    expect(resolvePhotoUrl('/api/users/u1/photo?v=5')).toBe('http://localhost:8002/api/users/u1/photo?v=5');
  });
  it('mantém URL absoluta', () => {
    expect(resolvePhotoUrl('https://x.test/a.jpg')).toBe('https://x.test/a.jpg');
  });
});
