'use client';

import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'format' | 'minify' | 'to-json' | 'from-json';

const SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><projeto id="1"><nome>DDWMISSI</nome><itens><item>A</item><item>B</item></itens><vazio/></projeto>';
const PARSER_OPTS = { ignoreAttributes: false, attributeNamePrefix: '@_' };

// Formatação por tokens (tags vs. texto): simples e tolerante, como no legado.
// A validação com linha/coluna acontece antes, em processXml.
function formatXml(xml: string): string {
  const compact = xml.replace(/>\s+</g, '><').trim();
  let out = '';
  let indent = '';
  const tab = '  ';
  for (const node of compact.split(/(?=<)|(?<=>)/)) {
    if (!node.trim()) continue;
    if (node.startsWith('</')) {
      indent = indent.slice(tab.length);
      out += indent + node + '\n';
    } else if (node.startsWith('<') && !node.endsWith('/>') && !node.startsWith('<?') && !node.startsWith('<!')) {
      out += indent + node + '\n';
      indent += tab;
    } else {
      out += indent + node + '\n';
    }
  }
  return out.trim();
}

function processXml(text: string, mode: Mode): { output: string; error: string | null } {
  if (!text.trim()) return { output: '', error: null };
  try {
    if (mode === 'from-json') {
      const xml = new XMLBuilder({ ...PARSER_OPTS, format: true, indentBy: '  ' }).build(JSON.parse(text));
      return { output: String(xml).trim(), error: null };
    }
    const valid = XMLValidator.validate(text);
    if (valid !== true) {
      return { output: '', error: `XML inválido na linha ${valid.err.line}, coluna ${valid.err.col}: ${valid.err.msg}` };
    }
    if (mode === 'minify') return { output: text.replace(/>\s+</g, '><').trim(), error: null };
    if (mode === 'to-json') return { output: JSON.stringify(new XMLParser(PARSER_OPTS).parse(text), null, 2), error: null };
    return { output: formatXml(text), error: null };
  } catch (e) {
    return { output: '', error: `Falha ao processar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const LABELS: Record<Mode, { inTitle: string; outTitle: string; file: string }> = {
  format: { inTitle: 'XML de entrada', outTitle: 'XML formatado', file: 'formatted.xml' },
  minify: { inTitle: 'XML de entrada', outTitle: 'XML minificado', file: 'minified.xml' },
  'to-json': { inTitle: 'XML de entrada', outTitle: 'JSON', file: 'converted.json' },
  'from-json': { inTitle: 'JSON de entrada', outTitle: 'XML', file: 'converted.xml' },
};

const tabCls = 'h-7 rounded-md px-3 text-[10px] font-black uppercase tracking-wider';

export default function XmlPage() {
  const [mode, setMode] = useState<Mode>('format');
  const [input, setInput] = useState('');
  const { output, error } = useMemo(() => processXml(input, mode), [input, mode]);
  const l = LABELS[mode];

  return (
    <DevToolPage
      toolId="xml"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (mode === 'from-json') setMode('format');
            setInput(SAMPLE);
          }}
          className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
        >
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-3">
        <Tabs value={mode} onValueChange={v => setMode(v as Mode)} className="shrink-0">
          <TabsList className="h-8 rounded-lg p-0.5">
            <TabsTrigger value="format" className={tabCls}>Formatar</TabsTrigger>
            <TabsTrigger value="minify" className={tabCls}>Minificar</TabsTrigger>
            <TabsTrigger value="to-json" className={tabCls}>XML → JSON</TabsTrigger>
            <TabsTrigger value="from-json" className={tabCls}>JSON → XML</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <ToolPane title={l.inTitle} value={input} onChange={setInput} placeholder="Cole o conteúdo aqui…" footer={`${input.length} caracteres`} />
          <ToolPane
            title={l.outTitle}
            value={output}
            readOnly
            placeholder="O resultado aparece aqui."
            downloadName={l.file}
            error={error}
            footer={output ? `${output.length} caracteres` : undefined}
          />
        </div>
      </div>
    </DevToolPage>
  );
}
