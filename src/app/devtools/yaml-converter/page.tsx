'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import * as yaml from 'js-yaml';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'yaml-to-json' | 'json-to-yaml';

const SAMPLE_YAML = 'projeto: DDWMISSI\nstatus: em andamento\npontos: 8\ntags:\n  - api\n  - qa\ndono:\n  nome: Ana\n  ativo: true\n';
const SAMPLE_JSON = '{"projeto":"DDWMISSI","pontos":8,"tags":["api","qa"],"dono":{"nome":"Ana","ativo":true}}';

// NOTA: o legado era um mock (js-yaml não estava ligado); aqui a conversão é real.
function convertYaml(text: string, mode: Mode): { output: string; error: string | null } {
  if (!text.trim()) return { output: '', error: null };
  try {
    if (mode === 'yaml-to-json') {
      return { output: JSON.stringify(yaml.load(text), null, 2), error: null };
    }
    return { output: yaml.dump(JSON.parse(text), { indent: 2, lineWidth: -1 }), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const mark = (e as { mark?: { line: number; column: number } }).mark;
    const where = mark ? ` (linha ${mark.line + 1}, coluna ${mark.column + 1})` : '';
    return { output: '', error: `${mode === 'yaml-to-json' ? 'YAML' : 'JSON'} inválido${where}: ${msg.split('\n')[0]}` };
  }
}

export default function YamlConverterPage() {
  const [mode, setMode] = useState<Mode>('yaml-to-json');
  const [input, setInput] = useState('');
  const { output, error } = useMemo(() => convertYaml(input, mode), [input, mode]);
  const toJson = mode === 'yaml-to-json';

  return (
    <DevToolPage
      toolId="yaml-converter"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInput(toJson ? SAMPLE_YAML : SAMPLE_JSON)}
          className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
        >
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane
          title={toJson ? 'YAML de entrada' : 'JSON de entrada'}
          value={input}
          onChange={setInput}
          placeholder={toJson ? 'Cole o YAML aqui…' : 'Cole o JSON aqui…'}
          footer={`${input.length} caracteres`}
          toolbar={
            <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="yaml-to-json" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">YAML → JSON</TabsTrigger>
                <TabsTrigger value="json-to-yaml" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">JSON → YAML</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        <ToolPane
          title={toJson ? 'JSON' : 'YAML'}
          value={output}
          readOnly
          placeholder="O resultado aparece aqui."
          downloadName={toJson ? 'resultado.json' : 'resultado.yaml'}
          error={error}
          footer={output ? `${output.length} caracteres` : undefined}
        />
      </div>
    </DevToolPage>
  );
}
