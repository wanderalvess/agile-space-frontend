'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'format' | 'minify';

const SAMPLE = '{"projeto":"DDWMISSI","status":"em andamento","pontos":8,"tags":["api","qa"],"dono":{"nome":"Ana","ativo":true}}';

// Converte posição absoluta em linha/coluna (1-based).
function lineColumn(text: string, position: number) {
  const lines = text.slice(0, position).split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

// Mensagens do JSON.parse variam entre engines: "at position N" (V8 antigo),
// "(line L column C)" (V8 novo) ou "line L column C" (Firefox). Extraímos o que der.
function describeError(text: string, message: string): string {
  const lc = message.match(/line (\d+) column (\d+)/i);
  if (lc) return `JSON inválido na linha ${lc[1]}, coluna ${lc[2]}.`;
  const pos = message.match(/position (\d+)/i);
  if (pos) {
    const { line, column } = lineColumn(text, parseInt(pos[1], 10));
    return `JSON inválido na linha ${line}, coluna ${column}.`;
  }
  return `JSON inválido: ${message}`;
}

function processJson(text: string, mode: Mode, indent: number): { output: string; error: string | null } {
  if (!text.trim()) return { output: '', error: null };
  try {
    const parsed = JSON.parse(text);
    return { output: mode === 'format' ? JSON.stringify(parsed, null, indent) : JSON.stringify(parsed), error: null };
  } catch (e) {
    return { output: '', error: describeError(text, e instanceof Error ? e.message : String(e)) };
  }
}

export default function JsonPage() {
  const [mode, setMode] = useState<Mode>('format');
  const [indent, setIndent] = useState(2);
  const [input, setInput] = useState('');

  const { output, error } = useMemo(() => processJson(input, mode, indent), [input, mode, indent]);
  const sizeInfo = output ? `${output.length} caracteres` : undefined;

  return (
    <DevToolPage
      toolId="json"
      actions={
        <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title="JSON de entrada"
          value={input}
          onChange={setInput}
          placeholder="Cole o JSON aqui…"
          footer={`${input.length} caracteres`}
          toolbar={
            <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="format" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Formatar</TabsTrigger>
                <TabsTrigger value="minify" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Minificar</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        <ToolPane
          title={mode === 'format' ? 'JSON formatado' : 'JSON minificado'}
          value={output}
          readOnly
          placeholder="O resultado aparece aqui."
          downloadName="data.json"
          error={error}
          footer={sizeInfo}
          toolbar={
            mode === 'format' ? (
              <Tabs value={String(indent)} onValueChange={v => setIndent(Number(v))}>
                <TabsList className="h-7 rounded-lg p-0.5">
                  <TabsTrigger value="2" className="h-6 rounded-md px-2 text-[10px] font-black">2</TabsTrigger>
                  <TabsTrigger value="4" className="h-6 rounded-md px-2 text-[10px] font-black">4</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : undefined
          }
        />
      </div>
    </DevToolPage>
  );
}
