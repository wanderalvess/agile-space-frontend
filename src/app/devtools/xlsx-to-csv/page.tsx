'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from 'lucide-react';
import { XMLParser } from 'fast-xml-parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';

// ───────────────────────────── Leitor de .xlsx sem dependências ─────────────────────────────
// O legado carregava o ExcelJS de um CDN em tempo de execução. Aqui lemos o ZIP direto
// (DecompressionStream nativo) e interpretamos o XML com fast-xml-parser, então nada sai do navegador.

interface SheetData { name: string; rows: string[][] }

/** Lê as entradas de um ZIP (método 0 = armazenado, 8 = deflate) usando o diretório central. */
async function readZip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);
  // localiza o End Of Central Directory (assinatura 0x06054b50) varrendo do fim
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido (ZIP não encontrado).');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    // só decodificamos o que o parser usa
    if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    const dataStart = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compSize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) {
      const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return out;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // mantém "00123" e "1E5" como texto
  parseAttributeValue: false,
  isArray: name => ['sheet', 'Relationship', 'si', 'r', 'row', 'c', 'xf', 'numFmt'].includes(name),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
// <t> pode vir como string ou como { '#text', '@_xml:space' }.
const textOf = (t: any): string => (t == null ? '' : typeof t === 'object' ? String(t['#text'] ?? '') : String(t));

function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Serial do Excel (base 1899-12-30) → "AAAA-MM-DD" ou "AAAA-MM-DD HH:mm:ss".
function excelDate(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400) * 1000);
  const iso = d.toISOString();
  return Number.isInteger(serial) ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
}

// Formatos de data embutidos do Excel + heurística para formatos customizados.
const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateStyleSet(styles: string | undefined): Set<number> {
  const set = new Set<number>();
  if (!styles) return set;
  const doc = xml.parse(styles).styleSheet ?? {};
  const customDate = new Set<number>();
  for (const f of doc.numFmts?.numFmt ?? []) {
    // remove trechos entre aspas/colchetes antes de procurar y/d/h/s (m é ambíguo com minutos)
    const code = String(f['@_formatCode']).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    if (/[ydhs]/i.test(code)) customDate.add(Number(f['@_numFmtId']));
  }
  (doc.cellXfs?.xf ?? []).forEach((xf: any, i: number) => {
    const id = Number(xf['@_numFmtId']);
    if (BUILTIN_DATE_IDS.has(id) || customDate.has(id)) set.add(i);
  });
  return set;
}

async function parseXlsx(buf: ArrayBuffer): Promise<SheetData[]> {
  const files = await readZip(buf);
  const dec = new TextDecoder();
  const get = (name: string) => (files.has(name) ? dec.decode(files.get(name)!) : undefined);

  const workbook = get('xl/workbook.xml');
  if (!workbook) throw new Error('Arquivo não é um .xlsx válido (workbook.xml ausente).');

  const rels: Record<string, string> = {};
  for (const r of xml.parse(get('xl/_rels/workbook.xml.rels') ?? '').Relationships?.Relationship ?? []) {
    rels[r['@_Id']] = String(r['@_Target']).replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/');
  }

  const shared: string[] = (xml.parse(get('xl/sharedStrings.xml') ?? '').sst?.si ?? []).map((si: any) =>
    // string simples (<t>) ou rich text (<r><t>…</t></r>...)
    si.r ? si.r.map((r: any) => textOf(r.t)).join('') : textOf(si.t),
  );
  const dateStyles = dateStyleSet(get('xl/styles.xml'));

  const sheets: SheetData[] = [];
  for (const sh of xml.parse(workbook).workbook?.sheets?.sheet ?? []) {
    const target = rels[sh['@_r:id']];
    const content = target && get(target);
    if (!content) continue;
    const rows: string[][] = [];
    for (const row of xml.parse(content).worksheet?.sheetData?.row ?? []) {
      const cells: string[] = [];
      for (const c of row.c ?? []) {
        const idx = colIndex(String(c['@_r']));
        const type = c['@_t'];
        let val = '';
        if (type === 's') val = shared[Number(c.v)] ?? '';
        else if (type === 'inlineStr') val = c.is?.r ? c.is.r.map((r: any) => textOf(r.t)).join('') : textOf(c.is?.t);
        else if (type === 'b') val = c.v === '1' ? 'TRUE' : 'FALSE';
        else {
          val = c.v == null ? '' : String(c.v);
          if (!type && val !== '' && dateStyles.has(Number(c['@_s'])) && !isNaN(Number(val))) val = excelDate(Number(val));
        }
        cells[idx] = val;
      }
      // preenche buracos (células vazias sem <c>) para manter as colunas alinhadas
      rows[Number(row['@_r']) - 1 || rows.length] = Array.from(cells, v => v ?? '');
    }
    sheets.push({ name: String(sh['@_name']), rows: Array.from(rows, r => r ?? []) });
  }
  if (sheets.length === 0) throw new Error('Nenhuma aba encontrada na planilha.');
  return sheets;
}

// ───────────────────────────── CSV ─────────────────────────────
const SEPARATORS: Record<string, { label: string; ch: string }> = {
  comma: { label: 'Vírgula ( , )', ch: ',' },
  semicolon: { label: 'Ponto e vírgula ( ; )', ch: ';' },
  tab: { label: 'Tabulação', ch: '\t' },
  pipe: { label: 'Barra vertical ( | )', ch: '|' },
};

function toCsv(rows: string[][], sep: string): string {
  const width = Math.max(0, ...rows.map(r => r.length));
  const esc = (v: string) => (/[",\r\n]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map(r => Array.from({ length: width }, (_, i) => esc(r[i] ?? '')).join(sep)).join('\n') + (rows.length ? '\n' : '');
}

const PREVIEW_ROWS = 200;
const btn = 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider';

export default function XlsxToCsvPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [active, setActive] = useState(0);
  const [sep, setSep] = useState('comma');
  const [bom, setBom] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const sheet = sheets[active];
  const csv = useMemo(() => (sheet ? toCsv(sheet.rows, SEPARATORS[sep].ch) : ''), [sheet, sep]);

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseXlsx(await file.arrayBuffer());
      setSheets(parsed);
      setActive(0);
      setFileName(file.name);
      setSearch('');
    } catch (e) {
      setSheets([]);
      setFileName(null);
      setError(e instanceof Error ? e.message : 'Não foi possível ler a planilha.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSheets([]);
    setFileName(null);
    setError(null);
    setSearch('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const download = () => {
    if (!sheet) return;
    const url = URL.createObjectURL(new Blob([(bom ? '﻿' : '') + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(fileName ?? 'export').replace(/\.[^/.]+$/, '')} - ${sheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Preview: cabeçalho + até PREVIEW_ROWS linhas que contenham o termo buscado.
  const preview = useMemo(() => {
    if (!sheet) return { header: [] as string[], rows: [] as string[][], total: 0 };
    const [header = [], ...data] = sheet.rows;
    const q = search.trim().toLowerCase();
    const filtered = q ? data.filter(r => r.some(c => c?.toLowerCase().includes(q))) : data;
    const width = Math.max(header.length, ...data.map(r => r.length));
    return { header: Array.from({ length: width }, (_, i) => header[i] ?? ''), rows: filtered.slice(0, PREVIEW_ROWS), total: filtered.length };
  }, [sheet, search]);

  return (
    <DevToolPage
      toolId="xlsx-to-csv"
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void processFile(f); }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className={btn}>
            <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abrir .xlsx</span>
          </Button>
          {sheet && (
            <>
              <Button variant="outline" size="sm" onClick={download} className={btn}>
                <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Baixar CSV</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} className={btn}>
                <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reiniciar</span>
              </Button>
            </>
          )}
        </>
      }
    >
      {!sheet ? (
        // Zona de soltar arquivo
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void processFile(f); }}
          className={cn(
            'flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
          )}
        >
          {loading ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />}
          <p className="font-headline text-lg font-black uppercase tracking-tight text-foreground">{loading ? 'Lendo planilha…' : 'Arraste um arquivo .xlsx aqui'}</p>
          <p className="max-w-sm text-xs font-medium text-muted-foreground">O arquivo é lido no navegador e não é enviado a nenhum servidor.</p>
          {!loading && (
            <Button onClick={() => fileRef.current?.click()} className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider">
              Escolher arquivo
            </Button>
          )}
          {error && <p className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex h-full flex-col gap-3">
          {/* Opções */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aba</Label>
              <Select value={String(active)} onValueChange={v => setActive(Number(v))}>
                <SelectTrigger className="h-8 w-48 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name} ({Math.max(s.rows.length - 1, 0)} linhas)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Separador</Label>
              <Select value={sep} onValueChange={setSep}>
                <SelectTrigger className="h-8 w-48 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEPARATORS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="bom" checked={bom} onCheckedChange={setBom} />
              <Label htmlFor="bom" className="text-xs font-medium text-muted-foreground" title="Faz o Excel abrir acentos corretamente">BOM UTF-8 no download</Label>
            </div>
            <span className="ml-auto truncate text-xs font-medium text-muted-foreground">{fileName}</span>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {/* Prévia em tabela */}
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prévia</h2>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar linhas…" className="h-7 w-44 rounded-lg text-xs" />
              </header>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {preview.header.map((h, i) => (
                        <th key={i} className="whitespace-nowrap border-b border-border px-2 py-1.5 text-left font-black text-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-border/50 hover:bg-muted/50">
                        {preview.header.map((_, ci) => (
                          <td key={ci} className="max-w-64 truncate px-2 py-1 font-code text-foreground" title={r[ci]}>{r[ci]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                {preview.total > PREVIEW_ROWS ? `Mostrando ${PREVIEW_ROWS} de ${preview.total} linhas` : `${preview.total} linhas`} (o CSV contém todas)
              </footer>
            </section>

            <ToolPane title="CSV" value={csv} readOnly placeholder="O CSV aparece aqui." footer={`${csv.length} caracteres`} />
          </div>
        </div>
      )}
    </DevToolPage>
  );
}
