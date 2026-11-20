/** Limites de entrada das ferramentas que leem arquivos. */

/** Tamanho máximo de planilha aceito na conversão para CSV (a leitura acontece inteira na memória do navegador). */
export const XLSX_MAX_BYTES = 20 * 1024 * 1024;

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');

/** Mensagem de erro se o arquivo passa do limite; `null` se cabe. */
export function xlsxSizeError(bytes: number): string | null {
  if (bytes <= XLSX_MAX_BYTES) return null;
  return `O arquivo tem ${mb(bytes)} MB e o limite é ${XLSX_MAX_BYTES / (1024 * 1024)} MB. Divida a planilha em partes menores ou exporte só as abas que você precisa.`;
}
