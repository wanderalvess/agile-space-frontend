'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  GitCompare, 
  Copy, 
  Check, 
  Sparkles, 
  Code2, 
  AlertCircle, 
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ApiDiffAssistant() {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- ESTADO DO DIFF DE JSON ---
  const [jsonExpected, setJsonExpected] = useState(`{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Lead"\n  }\n}`);
  const [jsonActual, setJsonActual] = useState(`{\n  "status": "success",\n  "code": 200,\n  "data": {\n    "id": "USR-101",\n    "name": "Ana Silva",\n    "role": "QA Engineer",\n    "newField": true\n  }\n}`);
  const [diffResult, setDiffResult] = useState<string[]>([]);

  // --- ESTADO DO GERADOR DE ASSERÇÕES ---
  const [payloadForAssertion, setPayloadForAssertion] = useState(`{\n  "id": "USR-999",\n  "active": true,\n  "items": ["item1", "item2"]\n}`);
  const [framework, setFramework] = useState<'cypress' | 'postman' | 'playwright'>('postman');
  const [assertionsResult, setAssertionsResult] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Copiado para a área de transferência!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCompareJson = () => {
    try {
      const obj1 = JSON.parse(jsonExpected);
      const obj2 = JSON.parse(jsonActual);
      const diffs: string[] = [];

      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      // Chaves ausentes
      keys1.forEach(k => {
        if (!(k in obj2)) {
          diffs.push(`❌ Campo ausente na resposta atual: "${k}"`);
        } else if (JSON.stringify(obj1[k]) !== JSON.stringify(obj2[k])) {
          diffs.push(`⚠️ Divergência no valor da chave "${k}": Esperado [${JSON.stringify(obj1[k])}] vs Atual [${JSON.stringify(obj2[k])}]`);
        }
      });

      // Chaves extras
      keys2.forEach(k => {
        if (!(k in obj1)) {
          diffs.push(`➕ Campo novo adicionado na resposta atual: "${k}" (Valor: ${JSON.stringify(obj2[k])})`);
        }
      });

      if (diffs.length === 0) {
        diffs.push('✅ Os JSONs são idênticos em estrutura e valores de primeiro nível!');
      }

      setDiffResult(diffs);
    } catch (e: any) {
      toast({
        title: 'JSON Inválido',
        description: 'Verifique se os dois textos estão em formato JSON válido.',
        variant: 'destructive'
      });
    }
  };

  const handleGenerateAssertions = () => {
    try {
      const obj = JSON.parse(payloadForAssertion);
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
        Object.entries(obj).forEach(([key, val]) => {
          lines.push(`  expect(response.body).to.have.property('${key}');`);
        });
        lines.push('});');
      } else if (framework === 'playwright') {
        lines.push('// Asserções para Playwright API Testing (request.get)');
        lines.push('const response = await request.get("/api/endpoint");');
        lines.push('expect(response.status()).toBe(200);');
        lines.push('const body = await response.json();');
        Object.entries(obj).forEach(([key, val]) => {
          lines.push(`expect(body).toHaveProperty('${key}');`);
        });
      }

      setAssertionsResult(lines.join('\n'));
    } catch (e: any) {
      toast({
        title: 'JSON Inválido',
        description: 'Insira um payload JSON válido para gerar as asserções.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Tabs defaultValue="diff" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <TabsTrigger value="diff" className="rounded-lg font-bold text-xs gap-2">
            <GitCompare className="h-4 w-4 text-blue-500" /> Comparador JSON Diff
          </TabsTrigger>
          <TabsTrigger value="assertions" className="rounded-lg font-bold text-xs gap-2">
            <Code2 className="h-4 w-4 text-purple-500" /> Gerador de Asserções
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: JSON DIFF */}
        <TabsContent value="diff" className="space-y-6 mt-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <GitCompare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Comparador Diff de Respostas de API
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compare o JSON Esperado (Produção/Swagger) contra o JSON Atual (Homologação) para identificar campos ausentes ou alterados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-2 block text-blue-600">JSON Esperado (Reference)</Label>
                <textarea
                  value={jsonExpected}
                  onChange={(e) => setJsonExpected(e.target.value)}
                  rows={10}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider mb-2 block text-purple-600">JSON Atual (Actual / Staging)</Label>
                <textarea
                  value={jsonActual}
                  onChange={(e) => setJsonActual(e.target.value)}
                  rows={10}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin"
                />
              </div>
            </div>

            <Button
              onClick={handleCompareJson}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2 shadow-md"
            >
              <GitCompare className="h-4 w-4" /> Comparar JSONs
            </Button>

            {diffResult.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">Resultado da Comparação:</span>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  {diffResult.map((res, idx) => (
                    <div key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {res}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: GERADOR DE ASSERÇÕES */}
        <TabsContent value="assertions" className="space-y-6 mt-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Code2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    Gerador de Asserções de Automação de API
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Insira o payload de resposta da API e obtenha scripts de teste prontos para Postman, Cypress ou Playwright.
                  </p>
                </div>
              </div>

              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as any)}
                className="h-10 px-3 font-bold text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-xl uppercase text-slate-800 dark:text-slate-200"
              >
                <option value="postman">Postman / Newman</option>
                <option value="cypress">Cypress (cy.request)</option>
                <option value="playwright">Playwright API</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider block">Payload JSON de Resposta</Label>
              <textarea
                value={payloadForAssertion}
                onChange={(e) => setPayloadForAssertion(e.target.value)}
                rows={6}
                className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin"
              />
            </div>

            <Button
              onClick={handleGenerateAssertions}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2 shadow-md"
            >
              <Sparkles className="h-4 w-4" /> Gerar Asserções ({framework.toUpperCase()})
            </Button>

            {assertionsResult && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-500">Script Gerado:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(assertionsResult, 'assertions-copy')}
                    className="h-8 text-xs font-bold gap-1 rounded-xl"
                  >
                    {copiedKey === 'assertions-copy' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar Script
                  </Button>
                </div>

                <textarea
                  readOnly
                  value={assertionsResult}
                  rows={10}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-purple-400 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
                />
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
