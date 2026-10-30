/**
 * Prepara a foto antes de enviar: recorte quadrado central, 256x256, JPEG ~0.85 (bem abaixo de 1 MB).
 * Roda no navegador (canvas). Os erros trazem texto pronto em PT-BR para a tela.
 */

export const PHOTO_SIZE = 256;
export const PHOTO_QUALITY = 0.85;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class PhotoPrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoPrepareError';
  }
}

/** Retângulo de origem do recorte quadrado central. */
export function centerSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

const READ_ERROR = 'Não foi possível ler essa imagem. Tente outro arquivo.';

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
    } catch {
      /* cai no <img> abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoPrepareError(READ_ERROR);
  }
}

export async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new PhotoPrepareError('Esse arquivo não é uma imagem. Escolha uma foto JPG, PNG ou WebP.');
  }
  if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new PhotoPrepareError('Formato não aceito. Use uma foto JPG, PNG ou WebP.');
  }
  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new PhotoPrepareError(READ_ERROR);
    const { sx, sy, side } = centerSquare(decoded.width, decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoPrepareError('Seu navegador não conseguiu preparar a imagem.');
    // Fundo branco: PNG/WebP transparentes não viram fundo preto no JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.drawImage(decoded.source, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
    if (!blob) throw new PhotoPrepareError('Não foi possível preparar a imagem. Tente outro arquivo.');
    return blob;
  } finally {
    decoded.release();
  }
}
