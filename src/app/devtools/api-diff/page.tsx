'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Wand2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';

type Mode = 'diff' | 'assertions';
type Framework = 'postman' | 'cypress' | 'playwright';

const SAMPLE_EXPECTED = `{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Lead"\n  }\n}`;
const SAMPLE_ACTUAL = `{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Engineer",\n    "newField": true\n  }\n}`;
const SAMPLE_PAYLOAD = `{\n  "id": "USR-999",\n  "active": true,\n  "items": ["item1", "item2"]\n}`;

interface DiffItem {
  kind: 'missing' | 'changed' | 'added' | 'same';
  text: string;
}

const KIND_STYLE: Record<DiffItem['kind'], { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  missing: { icon: XCircle, cls: 'text-destructive' },
  changed: { icon: AlertTriangle, cls: 'text-primary' },
  added: { icon: Plus, cls: 'text-foreground' },
  same: { icon: CheckCircle2, cls: 'text-emerald-500' },
};

// Comparação de primeiro nível, igual à ferramenta antiga.
function compareJson(expected: string, actual: string): { items: DiffItem[]; error: string | null } {
  try {
    const obj1 = JSON.parse(expected);
    const obj2 = JSON.parse(actual);
    const items: DiffItem[] = [];
    Object.keys(obj1).forEach(k => {
      if (!(k in obj2)) items.push({ kind: 'missing', text: `Campo ausente na resposta atual: "${k}"` });
      else if (JSON.stringify(obj1[k]) !== JSON.stringify(obj2[k]))
        items.push({ kind: 'changed', text: `Divergência no valor da chave "${k}": esperado ${JSON.stringify(obj1[k])} vs atual ${JSON.stringify(obj2[k])}` });
    });
    Object.keys(obj2).forEach(k => {
      if (!(k in obj1)) items.push({ kind: 'added', text: `Campo novo na resposta atual: "${k}" (valor: ${JSON.stringify(obj2[k])})` });
    });
    if (items.length === 0) items.push({ kind: 'same', text: 'Os JSONs são idênticos em estrutura e valores de primeiro nível.' });
    return { items, error: null };
  } catch {
    return { items: [], error: 'JSON inválido: verifique se os dois textos estão em formato JSON válido.' };
  }
}

function generateAssertions(payload: string, framework: Framework): { text: string; error: string | null } {
  try {
    const obj = JSON.parse(payload);
    const lines: string[] = [];
    if (framework === 'postman') {
      lines.push('// Testes de Asserção - Postman / Newman');
      lines.push('pm.test("Status code é 200", function () {');
      lines.push('    pm.response.to.have.status(200);');
      lines.push('});');
      lines.push('');
      lines.push('const responseData = pm.response.json();');
      Object.entries(obj).forEach(([key, val]) => {
        if (typeof val === 'string') {
          lines.push(`pm.test("Campo ${key} é string válida", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.a('string');`);
          lines.push(`});`);
        } else if (typeof val === 'boolean') {
          lines.push(`pm.test("Campo ${key} é booleano", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.a('boolean');`);
          lines.push(`});`);
        } else if (Array.isArray(val)) {
          lines.push(`pm.test("Campo ${key} é array", function () {`);
          lines.push(`    pm.expect(responseData.${key}).to.be.an('array');`);
          lines.push(`});`);
        }
      });
    } else if (framework === 'cypress') {
      lines.push('// Asserções para Cypress API (cy.request)');
      lines.push('cy.request("GET", "/api/endpoint").then((response) => {');
      lines.push('  expect(response.status).to.eq(200);');
      Object.keys(obj).forEach(key => lines.push(`  expect(response.body).to.have.property('${key}');`));
      lines.push('});');
    } else {
      lines.push('// Asserções para Playwright API Testing (request.get)');
      lines.push('const response = await request.get("/api/endpoint");');
      lines.push('expect(response.status()).toBe(200);');
      lines.push('const body = await response.json();');
      Object.keys(obj).forEach(key => lines.push(`expect(body).toHaveProperty('${key}');`));
    }
    return { text: lines.join('\n'), error: null };
  } catch {
    return { text: '', error: 'JSON inválido: insira um payload JSON válido para gerar as asserções.' };
  }
}

export default function ApiDiffPage() {
  const [mode, setMode] = useState<Mode>('diff');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [payload, setPayload] = useState('');
  const [framework, setFramework] = useState<Framework>('postman');

  const diff = useMemo(
    () => (expected.trim() && actual.trim() ? compareJson(expected, actual) : { items: [] as DiffItem[], error: null as string | null }),
    [expected, actual],
  );
  const assertions = useMemo(
    () => (payload.trim() ? generateAssertions(payload, framework) : { text: '', error: null as string | null }),
    [payload, framework],
  );

  const loadSample = () => {
    if (mode === 'diff') {
      setExpected(SAMPLE_EXPECTED);
      setActual(SAMPLE_ACTUAL);
    } else {
      setPayload(SAMPLE_PAYLOAD);
    }
  };

  const modeTabs = (
    <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
      <TabsList className="h-8 rounded-xl p-0.5">
        <TabsTrigger value="diff" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Comparar JSON</TabsTrigger>
        <TabsTrigger value="assertions" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Gerar asserções</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <DevToolPage
      toolId="api-diff"
      actions={
        <Button variant="outline" size="sm" onClick={loadSample} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div className="shrink-0">{modeTabs}</div>

        {mode === 'diff' ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <ToolPane title="JSON esperado (referência / Swagger)" value={expected} onChange={setExpected} placeholder="Cole o JSON de referência…" />
            <ToolPane title="JSON atual (homologação)" value={actual} onChange={setActual} placeholder="Cole o JSON retornado agora…" />
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <header className="shrink-0 border-b border-border/60 px-3 py-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado da comparação</h2>
              </header>
              <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {diff.error ? (
                  <p className="text-xs font-semibold text-destructive">{diff.error}</p>
                ) : diff.items.length === 0 ? (
                  <p className="text-xs font-medium text-muted-foreground">Preencha os dois JSONs para ver as diferenças.</p>
                ) : (
                  diff.items.map((item, i) => {
                    const { icon: Icon, cls } = KIND_STYLE[item.kind];
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls)} />
                        <span className="break-words font-code text-xs font-medium text-foreground">{item.text}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <ToolPane title="Payload JSON de resposta" value={payload} onChange={setPayload} placeholder="Cole o JSON de resposta da API…" error={assertions.error} />
            <ToolPane
              title="Script gerado"
              value={assertions.text}
              readOnly
              placeholder="O script aparece aqui."
              downloadName={`asercoes-${framework}.js`}
              toolbar={
                <Tabs value={framework} onValueChange={v => setFramework(v as Framework)}>
                  <TabsList className="h-7 rounded-lg p-0.5">
                    <TabsTrigger value="postman" className="h-6 rounded-md px-2 text-[10px] font-black uppercase tracking-wider">Postman</TabsTrigger>
                    <TabsTrigger value="cypress" className="h-6 rounded-md px-2 text-[10px] font-black uppercase tracking-wider">Cypress</TabsTrigger>
                    <TabsTrigger value="playwright" className="h-6 rounded-md px-2 text-[10px] font-black uppercase tracking-wider">Playwright</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            />
          </div>
        )}
      </div>
    </DevToolPage>
  );
}
