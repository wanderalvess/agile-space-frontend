'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Code2, 
  Copy, 
  Check, 
  Sparkles, 
  FileCode, 
  Plus, 
  Trash2,
  Terminal,
  Settings2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TestStep {
  action: 'visit' | 'type' | 'click' | 'assert' | 'intercept';
  target: string;
  value?: string;
  expected?: string;
}

export function AutomationCodeGenerator() {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Configurações da Suíte
  const [testTitle, setTestTitle] = useState('Fluxo de Autenticação do Usuário');
  const [selectorStrategy, setSelectorStrategy] = useState<'data-cy' | 'data-testid' | 'id' | 'role'>('data-testid');
  const [language, setLanguage] = useState<'ts' | 'js'>('ts');
  const [baseUrl, setBaseUrl] = useState('https://app.exemplo.com.br');

  // Passos de Execução
  const [steps, setSteps] = useState<TestStep[]>([
    { action: 'visit', target: '/login' },
    { action: 'type', target: 'email-input', value: 'ana.silva@teste.com.br' },
    { action: 'type', target: 'password-input', value: 'Senha@123' },
    { action: 'click', target: 'submit-button' },
    { action: 'assert', target: '/dashboard', expected: 'URL deve conter /dashboard' },
  ]);

  const addStep = () => {
    setSteps([...steps, { action: 'click', target: 'new-element' }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof TestStep, value: string) => {
    const next = [...steps];
    next[index] = { ...next[index], [field]: value };
    setSteps(next);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Código de automação copiado!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getSelector = (name: string) => {
    if (name.startsWith('/') || name.startsWith('http')) return name;
    if (selectorStrategy === 'data-cy') return `[data-cy="${name}"]`;
    if (selectorStrategy === 'data-testid') return `[data-testid="${name}"]`;
    if (selectorStrategy === 'id') return `#${name}`;
    return name;
  };

  // GERADOR CYPRESS
  const generateCypressCode = () => {
    const lines: string[] = [];
    lines.push(`// Automação Cypress - ${testTitle}`);
    lines.push(`// Linguagem: ${language.toUpperCase()} | Estratégia de Seletor: ${selectorStrategy}`);
    lines.push(``);
    lines.push(`describe('${testTitle}', () => {`);
    lines.push(`  beforeEach(() => {`);
    lines.push(`    cy.visit('${baseUrl}');`);
    lines.push(`  });`);
    lines.push(``);
    lines.push(`  it('deve executar o fluxo completo com sucesso', () => {`);

    steps.forEach((st) => {
      if (st.action === 'visit') {
        lines.push(`    cy.visit('${st.target}');`);
      } else if (st.action === 'type') {
        lines.push(`    cy.get('${getSelector(st.target)}').clear().type('${st.value || ''}');`);
      } else if (st.action === 'click') {
        lines.push(`    cy.get('${getSelector(st.target)}').click();`);
      } else if (st.action === 'assert') {
        lines.push(`    cy.url().should('include', '${st.target}');`);
      } else if (st.action === 'intercept') {
        lines.push(`    cy.intercept('POST', '${st.target}', { statusCode: 200, body: ${st.value || '{}'} }).as('apiMock');`);
      }
    });

    lines.push(`  });`);
    lines.push(`});`);
    return lines.join('\n');
  };

  // GERADOR PLAYWRIGHT
  const generatePlaywrightCode = () => {
    const lines: string[] = [];
    lines.push(`// Automação Playwright - ${testTitle}`);
    lines.push(`// Linguagem: ${language.toUpperCase()} | Estratégia de Seletor: ${selectorStrategy}`);
    lines.push(``);
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push(``);
    lines.push(`test.describe('${testTitle}', () => {`);
    lines.push(`  test('deve executar o fluxo completo com sucesso', async ({ page }) => {`);

    steps.forEach((st) => {
      if (st.action === 'visit') {
        lines.push(`    await page.goto('${baseUrl}${st.target}');`);
      } else if (st.action === 'type') {
        if (selectorStrategy === 'role') {
          lines.push(`    await page.getByRole('textbox', { name: '${st.target}' }).fill('${st.value || ''}');`);
        } else {
          lines.push(`    await page.locator('${getSelector(st.target)}').fill('${st.value || ''}');`);
        }
      } else if (st.action === 'click') {
        if (selectorStrategy === 'role') {
          lines.push(`    await page.getByRole('button', { name: '${st.target}' }).click();`);
        } else {
          lines.push(`    await page.locator('${getSelector(st.target)}').click();`);
        }
      } else if (st.action === 'assert') {
        lines.push(`    await expect(page).toHaveURL(new RegExp('${st.target}'));`);
      } else if (st.action === 'intercept') {
        lines.push(`    await page.route('**${st.target}*', route => route.fulfill({ status: 200, body: JSON.stringify(${st.value || '{}'}) }));`);
      }
    });

    lines.push(`  });`);
    lines.push(`});`);
    return lines.join('\n');
  };

  return (
    <div className="space-y-6 w-full">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Gerador de Código de Automação QA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monte os passos do teste e obtenha scripts prontos em Cypress e Playwright (TypeScript/JavaScript).
            </p>
          </div>
        </div>

        {/* CONTROLES DE LINGUAGEM E SELETOR */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button 
              onClick={() => setLanguage('ts')} 
              className={`px-3 py-1 rounded-lg transition-all ${language === 'ts' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              TypeScript
            </button>
            <button 
              onClick={() => setLanguage('js')} 
              className={`px-3 py-1 rounded-lg transition-all ${language === 'js' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              JavaScript
            </button>
          </div>

          <select
            value={selectorStrategy}
            onChange={(e) => setSelectorStrategy(e.target.value as any)}
            className="h-9 px-3 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
          >
            <option value="data-testid">Seletor: data-testid</option>
            <option value="data-cy">Seletor: data-cy</option>
            <option value="id">Seletor: ID (#id)</option>
            <option value="role">Seletor: getByRole</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: EDITOR DE PASSOS */}
        <Card className="lg:col-span-5 p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Nome do Teste / Suíte</Label>
              <Input 
                value={testTitle} 
                onChange={(e) => setTestTitle(e.target.value)} 
                className="font-bold text-xs bg-slate-50 dark:bg-slate-950" 
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Base URL da Aplicação</Label>
              <Input 
                value={baseUrl} 
                onChange={(e) => setBaseUrl(e.target.value)} 
                className="font-mono text-xs bg-slate-50 dark:bg-slate-950" 
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Passos da Automação ({steps.length}):</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={addStep}
                className="h-7 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Passo
              </Button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
              {steps.map((st, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                      <select
                        value={st.action}
                        onChange={(e) => updateStep(idx, 'action', e.target.value)}
                        className="h-7 px-2 text-[11px] font-extrabold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-primary"
                      >
                        <option value="visit">Navegar (goto)</option>
                        <option value="type">Preencher (type/fill)</option>
                        <option value="click">Clicar (click)</option>
                        <option value="assert">Asserção (url)</option>
                        <option value="intercept">Mock API (intercept)</option>
                      </select>
                    </div>

                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => removeStep(idx)}
                      className="h-6 w-6 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder={st.action === 'visit' ? '/rota' : 'Elemento/Target'}
                      value={st.target}
                      onChange={(e) => updateStep(idx, 'target', e.target.value)}
                      className="text-xs font-mono bg-white dark:bg-slate-900"
                    />

                    {(st.action === 'type' || st.action === 'intercept') && (
                      <Input
                        placeholder="Valor/Texto..."
                        value={st.value || ''}
                        onChange={(e) => updateStep(idx, 'value', e.target.value)}
                        className="text-xs font-medium bg-white dark:bg-slate-900"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* COLUNA DIREITA: PREVIEW DO CÓDIGO GERADO */}
        <div className="lg:col-span-7">
          <Tabs defaultValue="cypress" className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <TabsTrigger value="cypress" className="rounded-lg font-bold text-xs gap-2">
                <FileCode className="h-4 w-4 text-emerald-500" /> Cypress Script ({language.toUpperCase()})
              </TabsTrigger>
              <TabsTrigger value="playwright" className="rounded-lg font-bold text-xs gap-2">
                <Code2 className="h-4 w-4 text-blue-500" /> Playwright Script ({language.toUpperCase()})
              </TabsTrigger>
            </TabsList>

            {/* TAB CYPRESS */}
            <TabsContent value="cypress" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Cypress Code Preview:</span>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(generateCypressCode(), 'cypress-copy')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl gap-2"
                >
                  {copiedKey === 'cypress-copy' ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                  Copiar Cypress
                </Button>
              </div>

              <textarea
                readOnly
                value={generateCypressCode()}
                rows={22}
                className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-400 rounded-2xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
              />
            </TabsContent>

            {/* TAB PLAYWRIGHT */}
            <TabsContent value="playwright" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Playwright Code Preview:</span>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(generatePlaywrightCode(), 'playwright-copy')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase rounded-xl gap-2"
                >
                  {copiedKey === 'playwright-copy' ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                  Copiar Playwright
                </Button>
              </div>

              <textarea
                readOnly
                value={generatePlaywrightCode()}
                rows={22}
                className="w-full p-4 font-mono text-xs bg-slate-950 text-blue-400 rounded-2xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
