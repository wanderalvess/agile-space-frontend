/** CSV da planilha do time: aspas, vírgula ou ponto e vírgula (o Excel em português salva com ";"). */

export type CsvDelimiter = ',' | ';';

/** Primeira linha (fora das aspas) decide: mais ";" do que "," = planilha do Excel em português. */
export function detectDelimiter(text: string): CsvDelimiter {
  const clean = text.replace(/^﻿/, '');
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') {
        if (commas + semis > 0) break;
      } else if (ch === ',') commas++;
      else if (ch === ';') semis++;
    }
  }
  return semis > commas ? ';' : ',';
}

/**
 * Lê o texto inteiro em linhas de colunas. "Silva, Ana" entre aspas é uma coluna só, "" vira aspas dentro do campo
 * e quebra de linha entre aspas fica no campo. Linhas totalmente vazias são descartadas.
 */
export function parseCsv(text: string, delimiter?: CsvDelimiter): { delimiter: CsvDelimiter; rows: string[][] } {
  const clean = text.replace(/^﻿/, '');
  const sep = delimiter ?? detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  const endField = () => {
    row.push(cur.trim());
    cur = '';
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) endField();
    else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (clean[i + 1] === '\n') i++;
      endRow();
    } else cur += ch;
  }
  if (cur.length > 0 || row.length > 0) endRow();
  return { delimiter: sep, rows };
}

/** Campo seguro para CSV: aspas quando tem separador, aspas ou quebra de linha. */
export function csvField(value: string | number | null | undefined, delimiter: CsvDelimiter = ','): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values: Array<string | number | null | undefined>, delimiter: CsvDelimiter = ','): string {
  return values.map((v) => csvField(v, delimiter)).join(delimiter);
}

/** Texto do arquivo com BOM, para o Excel reconhecer os acentos. */
export function csvDocument(lines: string[]): string {
  return '﻿' + lines.join('\r\n');
}

/**
 * Decodifica os bytes de um CSV: UTF-8 quando for válido; senão Windows-1252, que é o que o Excel em português
 * grava ao "Salvar como CSV" (sem isso, "João" chegava como "JoÃ£o" ou "Jo�o").
 */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Baixa um texto como arquivo no navegador. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
