'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

interface Layer { kind: string; note?: string }
interface DeepResult { layers: Layer[]; output: string }

const B64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;
// Texto "legível": ASCII imprimível, whitespace e Latin-1 acentuado (mesmo critério do legado).
const READABLE_RE = /^[\x20-\x7E\sÀ-ÿĀ-￿]+$/;

// Base64 (padrão ou URL-safe) -> texto UTF-8, ou null se não for Base64 legível.
function tryBase64(s: string): string | null {
  const t = s.trim();
  if (t.length < 8 || !B64_RE.test(t)) return null;
  try {
    const std = t.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.codePointAt(0)!));
    // evita falso positivo: palavra comum que "calha" de ser Base64 válido e gera lixo
    return text.length > 0 && READABLE_RE.test(text) && !/[\u0000-\u0008\u000E-\u001F]/.test(text) ? text : null;
  } catch {
    return null;
  }
}

// Percorre um JSON e decodifica strings Base64 aninhadas (>20 chars, como no legado), recursivamente.
function decodeNested(node: unknown, counter: { n: number }): unknown {
  if (Array.isArray(node)) return node.map(v => decodeNested(v, counter));
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, decodeNested(v, counter)]));
  }
  if (typeof node === 'string' && node.length > 20) {
    const dec = tryBase64(node);
    if (dec !== null) {
      counter.n++;
      const trimmed = dec.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { return decodeNested(JSON.parse(trimmed), counter); } catch { /* segue como texto */ }
      }
      return trimmed;
    }
  }
  return node;
}

// Aplica decodificações em cadeia (URL, Base64, string JSON) até nada mais mudar; JSON encerra a cadeia.
function deepDecode(input: string): DeepResult {
  const layers: Layer[] = [];
  let cur = input.trim();

  for (let i = 0; i < 12; i++) {
    // 1) URL-encoding
    if (/%[0-9A-Fa-f]{2}/.test(cur)) {
      try {
        const dec = decodeURIComponent(cur);
        if (dec !== cur) { layers.push({ kind: 'URL' }); cur = dec.trim(); continue; }
      } catch { /* não era URL-encoding válido */ }
    }
    // 2) JSON
    if (/^[[{"]/.test(cur)) {
      try {
        const parsed = JSON.parse(cur);
        if (typeof parsed === 'string') { layers.push({ kind: 'String JSON' }); cur = parsed.trim(); continue; }
        const counter = { n: 0 };
        const result = decodeNested(parsed, counter);
        layers.push({ kind: 'JSON', note: counter.n ? `${counter.n} campo(s) Base64 decodificado(s)` : undefined });
        return { layers, output: JSON.stringify(result, null, 2) };
      } catch { /* não é JSON */ }
    }
    // 3) Base64
    const b64 = tryBase64(cur);
    if (b64 !== null && b64.trim() !== cur) { layers.push({ kind: 'Base64' }); cur = b64.trim(); continue; }
    break;
  }
  return { layers, output: cur };
}

function makeSample(): string {
  const enc = (s: string) => btoa(Array.from(new TextEncoder().encode(s), b => String.fromCodePoint(b)).join(''));
  const inner = enc(JSON.stringify({ usuario: 'maria', perfil: 'PO', observação: 'conteúdo em camada interna' }));
  const xml = enc('<pedido><id>42</id><status>aprovado</status></pedido>');
  return JSON.stringify({ id: 1, payload: inner, xml });
}

export default function DeepDecoderPage() {
  const [input, setInput] = useState('');

  const { result, error } = useMemo(() => {
    if (!input.trim()) return { result: null as DeepResult | null, error: null as string | null };
    try { return { result: deepDecode(input), error: null }; }
    catch { return { result: null, error: 'Não foi possível processar o conteúdo.' }; }
  }, [input]);

  return (
    <DevToolPage
      toolId="deep-decoder"
      actions={
        <Button variant="outline" size="sm" onClick={() => setInput(makeSample())} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title="Conteúdo de entrada"
          value={input}
          onChange={setInput}
          placeholder="Cole Base64, texto URL-encoded ou um JSON com campos em Base64…"
          footer={`${input.length} caracteres`}
        />
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <h2 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Camadas encontradas</h2>
            {result ? (
              result.layers.length ? (
                <ol className="flex flex-wrap items-center gap-1.5">
                  {result.layers.map((l, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
                      <Badge variant="secondary" className="font-code text-[11px]" title={l.note}>
                        {l.kind}{l.note ? ` · ${l.note}` : ''}
                      </Badge>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma camada de codificação detectada: o conteúdo já está legível.</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">As camadas aplicadas aparecem aqui, em ordem.</p>
            )}
          </section>
          <ToolPane
            title="Conteúdo decodificado"
            value={result?.output ?? ''}
            readOnly
            placeholder="O resultado aparece aqui."
            downloadName="decodificado.txt"
            error={error}
          />
        </div>
      </div>
    </DevToolPage>
  );
}
