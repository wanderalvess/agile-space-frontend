'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'encode' | 'decode';
// valor = encodeURIComponent (valor de parâmetro); url = encodeURI (preserva : / ? & = #)
type Scope = 'component' | 'url';

const SAMPLE = 'https://exemplo.com/busca?q=ação & reunião&tag=a/b#topo';

function run(text: string, mode: Mode, scope: Scope, plusAsSpace: boolean): string {
  if (mode === 'encode') return scope === 'component' ? encodeURIComponent(text) : encodeURI(text);
  // Formulários HTML usam "+" como espaço; só convertemos se o usuário pedir.
  const src = plusAsSpace ? text.replace(/\+/g, ' ') : text;
  return scope === 'component' ? decodeURIComponent(src) : decodeURI(src);
}

export default function UrlEncoderPage() {
  const [mode, setMode] = useState<Mode>('encode');
  const [scope, setScope] = useState<Scope>('component');
  const [plusAsSpace, setPlusAsSpace] = useState(false);
  const [input, setInput] = useState('');

  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: null as string | null };
    try {
      return { output: run(input, mode, scope, plusAsSpace), error: null };
    } catch {
      return {
        output: '',
        error: mode === 'decode'
          ? 'Sequência %XX inválida: confira se o texto está completo.'
          : 'Não foi possível codificar: há um caractere Unicode inválido (par substituto solto).',
      };
    }
  }, [input, mode, scope, plusAsSpace]);

  const tab = 'h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider';

  return (
    <DevToolPage
      toolId="url-encoder"
      actions={
        <Button variant="outline" size="sm" onClick={() => { setMode('encode'); setScope('url'); setInput(SAMPLE); }} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title={mode === 'encode' ? 'Texto / URL de entrada' : 'URL codificada'}
          value={input}
          onChange={setInput}
          placeholder="Cole aqui…"
          footer={`${input.length} caracteres`}
          toolbar={
            <div className="flex items-center gap-1.5">
              <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
                <TabsList className="h-7 rounded-lg p-0.5">
                  <TabsTrigger value="encode" className={tab}>Codificar</TabsTrigger>
                  <TabsTrigger value="decode" className={tab}>Decodificar</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs value={scope} onValueChange={v => setScope(v as Scope)}>
                <TabsList className="h-7 rounded-lg p-0.5">
                  <TabsTrigger value="component" className={tab} title="encodeURIComponent: para valores de parâmetros">Valor</TabsTrigger>
                  <TabsTrigger value="url" className={tab} title="encodeURI: preserva : / ? & = #">URL</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          }
        />
        <ToolPane
          title="Resultado"
          value={output}
          readOnly
          placeholder="O resultado aparece aqui."
          downloadName="resultado.txt"
          error={error}
          footer={
            mode === 'decode' ? (
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={plusAsSpace} onChange={e => setPlusAsSpace(e.target.checked)} className="accent-primary" />
                Tratar “+” como espaço (formulários)
              </label>
            ) : output ? `${output.length} caracteres` : undefined
          }
        />
      </div>
    </DevToolPage>
  );
}
