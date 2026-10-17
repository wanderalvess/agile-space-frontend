import mammoth from 'mammoth';

/** Limite de caracteres do documento importado (o servidor aceita até 2 milhões). */
export const MAX_IMPORT_TEXT_CHARS = 1_500_000;

export type ImportResult =
  | { ok: true; text: string; html?: string }
  | { ok: false; status: 413 | 422; error: string };

/** Colapsa linhas em branco repetidas e apara o texto extraído. */
export function cleanImportedText(text: string): string {
  return text.replace(/\n\s*\n/g, '\n\n').trim();
}

/**
 * Limpa o HTML gerado pelo mammoth: remove imagens (o editor não guarda base64 de
 * Word) e parágrafos que ficaram vazios por causa delas.
 */
export function cleanDocxHtml(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<p>(?:\s|&nbsp;)*<\/p>/gi, '')
    .trim();
}

/**
 * Monta a resposta da importação a partir do texto extraído (e, no caso de Word, do HTML
 * com a estrutura: títulos, listas, negrito, links, tabelas). Aplica as validações de
 * vazio e de tamanho. O `text` continua sendo texto puro para quem já o consome.
 */
export function buildImportResult(rawText: string, rawHtml?: string): ImportResult {
  const text = cleanImportedText(rawText);
  if (!text) {
    return { ok: false, status: 422, error: 'Não encontramos texto neste arquivo (PDF escaneado precisa de OCR).' };
  }
  if (text.length > MAX_IMPORT_TEXT_CHARS) {
    return {
      ok: false,
      status: 413,
      error: `O texto extraído passa de ${MAX_IMPORT_TEXT_CHARS.toLocaleString('pt-BR')} caracteres. Divida o arquivo.`,
    };
  }
  if (rawHtml === undefined) return { ok: true, text };
  const html = cleanDocxHtml(rawHtml);
  if (html.length > MAX_IMPORT_TEXT_CHARS * 2) {
    return {
      ok: false,
      status: 413,
      error: `O texto extraído passa de ${MAX_IMPORT_TEXT_CHARS.toLocaleString('pt-BR')} caracteres. Divida o arquivo.`,
    };
  }
  return { ok: true, text, html };
}

/** Lê um .docx preservando a estrutura (HTML) e também o texto puro. Imagens são descartadas. */
export async function extractDocx(buffer: Buffer): Promise<{ text: string; html: string }> {
  const [raw, converted] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml(
      { buffer },
      // Não lê os bytes da imagem (nada de base64); o <img> vazio é removido em cleanDocxHtml.
      { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }
    ),
  ]);
  return { text: raw.value, html: converted.value };
}
