'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'encode' | 'decode';

const SAMPLE_DECODED = '{"projeto":"DDWMISSI","status":"em andamento","pontos":8}';

// UTF-8 seguro: btoa/atob sozinhos quebram acentos.
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(Array.from(bytes, b => String.fromCodePoint(b)).join(''));
}

function decodeBase64(text: string): string {
  // aceita Base64 URL-safe e quebras de linha
  const normalized = text.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(normalized);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.codePointAt(0)!));
}

// Se o resultado for JSON, devolve formatado; senão, o texto cru.
function prettify(text: string): { text: string; kind: 'json' | 'xml' | 'texto' } {
  try {
    return { text: JSON.stringify(JSON.parse(text), null, 2), kind: 'json' };
  } catch {
    return { text, kind: text.trim().startsWith('<') ? 'xml' : 'texto' };
  }
}

export default function Base64Page() {
  const [mode, setMode] = useState<Mode>('decode');
  const [input, setInput] = useState('');

  const { output, error, kind } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null as string | null, kind: 'texto' as const };
    try {
      if (mode === 'encode') return { output: encodeBase64(input), error: null, kind: 'texto' as const };
      const pretty = prettify(decodeBase64(input));
      return { output: pretty.text, error: null, kind: pretty.kind };
    } catch {
      return { output: '', error: 'Base64 inválido: confira se o texto está completo e sem caracteres estranhos.', kind: 'texto' as const };
    }
  }, [input, mode]);

  const loadSample = () => {
    setMode('decode');
    setInput(encodeBase64(SAMPLE_DECODED));
  };

  return (
    <DevToolPage
      toolId="base64"
      actions={
        <Button variant="outline" size="sm" onClick={loadSample} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title={mode === 'decode' ? 'Base64 de entrada' : 'Texto de entrada'}
          value={input}
          onChange={setInput}
          placeholder={mode === 'decode' ? 'Cole o Base64 aqui…' : 'Digite ou cole o texto a codificar…'}
          footer={`${input.length} caracteres`}
          toolbar={
            <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="decode" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Decodificar</TabsTrigger>
                <TabsTrigger value="encode" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Codificar</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        <ToolPane
          title={mode === 'decode' ? `Resultado (${kind})` : 'Base64'}
          value={output}
          readOnly
          placeholder="O resultado aparece aqui."
          downloadName={mode === 'decode' ? (kind === 'json' ? 'resultado.json' : 'resultado.txt') : 'resultado.b64'}
          error={error}
          footer={output ? `${output.length} caracteres` : undefined}
        />
      </div>
    </DevToolPage>
  );
}
