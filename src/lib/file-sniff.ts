/** Confere o tipo pelo conteúdo (primeiros bytes), não pelo nome ou pelo Content-Type informado pelo cliente. */
export function isPdfBuffer(buffer: Uint8Array): boolean {
  // %PDF- pode vir depois de poucos bytes de lixo; a especificação aceita nos primeiros 1024.
  const head = Buffer.from(buffer.subarray(0, 1024)).toString('latin1');
  return head.includes('%PDF-');
}

/** DOCX é um zip: começa com "PK\x03\x04". */
export function isZipBuffer(buffer: Uint8Array): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/** Texto: sem bytes nulos nos primeiros 8 KB (binário disfarçado de .txt tem). */
export function looksLikeText(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, 8192);
  for (let i = 0; i < sample.length; i++) if (sample[i] === 0) return false;
  return true;
}
