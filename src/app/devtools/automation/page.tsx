'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Action = 'visit' | 'type' | 'click' | 'assert' | 'intercept';
type SelectorStrategy = 'data-cy' | 'data-testid' | 'id' | 'role';
type Language = 'ts' | 'js';
type Framework = 'cypress' | 'playwright';

interface TestStep {
  action: Action;
  target: string;
  value?: string;
  expected?: string;
}

const selectClass = 'h-9 rounded-lg border border-input bg-background px-2 text-xs font-bold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const INITIAL_STEPS: TestStep[] = [
  { action: 'visit', target: '/login' },
  { action: 'type', target: 'email-input', value: 'ana.silva@teste.com.br' },
  { action: 'type', target: 'password-input', value: 'Senha@123' },
  { action: 'click', target: 'submit-button' },
  { action: 'assert', target: '/dashboard', expected: 'URL deve conter /dashboard' },
];

export default function AutomationPage() {
  const [testTitle, setTestTitle] = useState('Fluxo de Autenticação do Usuário');
  const [selectorStrategy, setSelectorStrategy] = useState<SelectorStrategy>('data-testid');
  const [language, setLanguage] = useState<Language>('ts');
  const [baseUrl, setBaseUrl] = useState('https://app.exemplo.com.br');
  const [framework, setFramework] = useState<Framework>('cypress');
  const [steps, setSteps] = useState<TestStep[]>(INITIAL_STEPS);

  const addStep = () => setSteps(prev => [...prev, { action: 'click', target: 'new-element' }]);
  const removeStep = (index: number) => setSteps(prev => prev.filter((_, i) => i !== index));
  const updateStep = (index: number, field: keyof TestStep, value: string) =>
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));

  const code = useMemo(() => {
    const getSelector = (name: string) => {
      if (name.startsWith('/') || name.startsWith('http')) return name;
      if (selectorStrategy === 'data-cy') return `[data-cy="${name}"]`;
      if (selectorStrategy === 'data-testid') return `[data-testid="${name}"]`;
      if (selectorStrategy === 'id') return `#${name}`;
      return name;
    };

    const lines: string[] = [];
    if (framework === 'cypress') {
      lines.push(`// Automação Cypress - ${testTitle}`);
      lines.push(`// Linguagem: ${language.toUpperCase()} | Estratégia de Seletor: ${selectorStrategy}`);
      lines.push(``);
      lines.push(`describe('${testTitle}', () => {`);
      lines.push(`  beforeEach(() => {`);
      lines.push(`    cy.visit('${baseUrl}');`);
      lines.push(`  });`);
      lines.push(``);
      lines.push(`  it('deve executar o fluxo completo com sucesso', () => {`);
      steps.forEach(st => {
        if (st.action === 'visit') lines.push(`    cy.visit('${st.target}');`);
        else if (st.action === 'type') lines.push(`    cy.get('${getSelector(st.target)}').clear().type('${st.value || ''}');`);
        else if (st.action === 'click') lines.push(`    cy.get('${getSelector(st.target)}').click();`);
        else if (st.action === 'assert') lines.push(`    cy.url().should('include', '${st.target}');`);
        else if (st.action === 'intercept') lines.push(`    cy.intercept('POST', '${st.target}', { statusCode: 200, body: ${st.value || '{}'} }).as('apiMock');`);
      });
      lines.push(`  });`);
      lines.push(`});`);
    } else {
      lines.push(`// Automação Playwright - ${testTitle}`);
      lines.push(`// Linguagem: ${language.toUpperCase()} | Estratégia de Seletor: ${selectorStrategy}`);
      lines.push(``);
      lines.push(`import { test, expect } from '@playwright/test';`);
      lines.push(``);
      lines.push(`test.describe('${testTitle}', () => {`);
      lines.push(`  test('deve executar o fluxo completo com sucesso', async ({ page }) => {`);
      steps.forEach(st => {
        if (st.action === 'visit') {
          lines.push(`    await page.goto('${baseUrl}${st.target}');`);
        } else if (st.action === 'type') {
          if (selectorStrategy === 'role') lines.push(`    await page.getByRole('textbox', { name: '${st.target}' }).fill('${st.value || ''}');`);
          else lines.push(`    await page.locator('${getSelector(st.target)}').fill('${st.value || ''}');`);
        } else if (st.action === 'click') {
          if (selectorStrategy === 'role') lines.push(`    await page.getByRole('button', { name: '${st.target}' }).click();`);
          else lines.push(`    await page.locator('${getSelector(st.target)}').click();`);
        } else if (st.action === 'assert') {
          lines.push(`    await expect(page).toHaveURL(new RegExp('${st.target}'));`);
        } else if (st.action === 'intercept') {
          lines.push(`    await page.route('**${st.target}*', route => route.fulfill({ status: 200, body: JSON.stringify(${st.value || '{}'}) }));`);
        }
      });
      lines.push(`  });`);
      lines.push(`});`);
    }
    return lines.join('\n');
  }, [framework, testTitle, language, selectorStrategy, baseUrl, steps]);

  return (
    <DevToolPage toolId="automation">
      <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
        {/* Editor de passos */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-5">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cenário</h2>
            <Tabs value={language} onValueChange={v => setLanguage(v as Language)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="ts" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">TypeScript</TabsTrigger>
                <TabsTrigger value="js" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">JavaScript</TabsTrigger>
              </TabsList>
            </Tabs>
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome do teste / suíte</Label>
                <Input value={testTitle} onChange={e => setTestTitle(e.target.value)} className="h-9 rounded-lg text-xs font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base URL da aplicação</Label>
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="h-9 rounded-lg font-code text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estratégia de seletor</Label>
              <select value={selectorStrategy} onChange={e => setSelectorStrategy(e.target.value as SelectorStrategy)} className={`${selectClass} w-full`}>
                <option value="data-testid">data-testid</option>
                <option value="data-cy">data-cy</option>
                <option value="id">ID (#id)</option>
                <option value="role">getByRole</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Passos ({steps.length})</span>
                <Button size="sm" variant="ghost" onClick={addStep} className="h-7 gap-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-primary">
                  <Plus className="h-3.5 w-3.5" /> Adicionar passo
                </Button>
              </div>

              {steps.map((st, idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-code text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                      <select value={st.action} onChange={e => updateStep(idx, 'action', e.target.value)} className={`${selectClass} h-7 text-primary`}>
                        <option value="visit">Navegar (goto)</option>
                        <option value="type">Preencher (type/fill)</option>
                        <option value="click">Clicar (click)</option>
                        <option value="assert">Asserção (URL)</option>
                        <option value="intercept">Mock de API (intercept)</option>
                      </select>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeStep(idx)} className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" aria-label="Remover passo">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      placeholder={st.action === 'visit' ? '/rota' : 'Elemento / alvo'}
                      value={st.target}
                      onChange={e => updateStep(idx, 'target', e.target.value)}
                      className="h-9 rounded-lg font-code text-xs"
                    />
                    {(st.action === 'type' || st.action === 'intercept') && (
                      <Input
                        placeholder="Valor / texto…"
                        value={st.value || ''}
                        onChange={e => updateStep(idx, 'value', e.target.value)}
                        className="h-9 rounded-lg text-xs font-medium"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Código gerado */}
        <ToolPane
          className="lg:col-span-7"
          title={`Código gerado (${language.toUpperCase()})`}
          value={code}
          readOnly
          downloadName={`${framework}.${language === 'ts' ? 'ts' : 'js'}`}
          toolbar={
            <Tabs value={framework} onValueChange={v => setFramework(v as Framework)}>
              <TabsList className="h-7 rounded-lg p-0.5">
                <TabsTrigger value="cypress" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Cypress</TabsTrigger>
                <TabsTrigger value="playwright" className="h-6 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider">Playwright</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
      </div>
    </DevToolPage>
  );
}
