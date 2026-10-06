'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';

type Mode = 'bdd' | 'bug';

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';
const selectClass = 'h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-bold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface StepListProps {
  label: string;
  placeholder: string;
  steps: string[];
  onChange: (steps: string[]) => void;
}

function StepList({ label, placeholder, steps, onChange }: StepListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-black uppercase tracking-wider text-primary">{label}</Label>
        <Button size="sm" variant="ghost" onClick={() => onChange([...steps, ''])} className="h-6 gap-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary">
          <Plus className="h-3 w-3" /> Passo
        </Button>
      </div>
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={step}
            onChange={e => onChange(steps.map((s, i) => (i === idx ? e.target.value : s)))}
            placeholder={`${placeholder} ${idx + 1}`}
            className="h-9 rounded-lg text-xs font-medium"
          />
          {steps.length > 1 && (
            <Button size="icon" variant="ghost" onClick={() => onChange(steps.filter((_, i) => i !== idx))} className="h-8 w-8 shrink-0 rounded-lg text-destructive hover:text-destructive" aria-label="Remover passo">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={labelClass}>{label}</Label>
      {children}
    </div>
  );
}

export default function BddBugsPage() {
  const [mode, setMode] = useState<Mode>('bdd');

  // BDD
  const [feature, setFeature] = useState('Autenticação de Usuários no Sistema');
  const [scenario, setScenario] = useState('Login com credenciais válidas');
  const [givenSteps, setGivenSteps] = useState(['que o usuário está na tela de login', 'possui um cadastro ativo']);
  const [whenSteps, setWhenSteps] = useState(['preenche o email e a senha válidos', 'clica no botão "Entrar"']);
  const [thenSteps, setThenSteps] = useState(['é redirecionado para o dashboard principal', 'visualiza a mensagem de boas-vindas']);

  // Bug
  const [bugTitle, setBugTitle] = useState('[BUG] Erro 500 ao confirmar pagamento via Pix');
  const [bugEnv, setBugEnv] = useState('Homologação (Staging v2.4.1) | Chrome 124 | Windows 11');
  const [bugSteps, setBugSteps] = useState('1. Acesse o carrinho de compras\n2. Adicione qualquer produto\n3. Selecione a opção de pagamento Pix\n4. Clique em "Finalizar Pedido"');
  const [bugExpected, setBugExpected] = useState('Gerar o QR Code do Pix e exibir a chave Copia e Cola.');
  const [bugActual, setBugActual] = useState('A tela congela e dispara erro HTTP 500 Internal Server Error no console.');
  const [bugLogs, setBugLogs] = useState('POST https://api.exemplo.com.br/v1/payments/pix -> 500 Internal Server Error\n{"code": "PIX_GATEWAY_TIMEOUT"}');
  const [bugSeverity, setBugSeverity] = useState('High');

  const gherkin = useMemo(() => {
    let text = `# language: pt\nFuncionalidade: ${feature}\n\n  Cenário: ${scenario}\n`;
    givenSteps.forEach((s, idx) => { text += `    ${idx === 0 ? 'Dado' : 'E'} ${s}\n`; });
    whenSteps.forEach((s, idx) => { text += `    ${idx === 0 ? 'Quando' : 'E'} ${s}\n`; });
    thenSteps.forEach((s, idx) => { text += `    ${idx === 0 ? 'Então' : 'E'} ${s}\n`; });
    return text;
  }, [feature, scenario, givenSteps, whenSteps, thenSteps]);

  const bugMarkdown = useMemo(() => `## 🐛 ${bugTitle}

**Ambiente / Build:** ${bugEnv}
**Severidade:** ${bugSeverity}
**Data da Ocorrência:** ${new Date().toLocaleDateString('pt-BR')}

---

### 📋 Passos para Reproduzir:
${bugSteps}

---

### ✅ Comportamento Esperado:
${bugExpected}

---

### ❌ Comportamento Observado:
${bugActual}

---

### 🔍 Logs & Evidências:
\`\`\`text
${bugLogs || 'Nenhum log retornado'}
\`\`\`

---
*Relatório padronizado via DevTools (Portal Tech V&D)*`, [bugTitle, bugEnv, bugSeverity, bugSteps, bugExpected, bugActual, bugLogs]);

  const modeTabs = (
    <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
      <TabsList className="h-8 rounded-xl p-0.5">
        <TabsTrigger value="bdd" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Cenário BDD (Gherkin)</TabsTrigger>
        <TabsTrigger value="bug" className="h-7 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider">Relato de bug</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <DevToolPage toolId="bdd-bugs">
      <div className="flex h-full flex-col gap-3">
        <div className="shrink-0">{modeTabs}</div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <header className="shrink-0 border-b border-border/60 px-3 py-2">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{mode === 'bdd' ? 'Cenário' : 'Dados do defeito'}</h2>
            </header>
            <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              {mode === 'bdd' ? (
                <>
                  <Field label="Funcionalidade (Feature)">
                    <Input value={feature} onChange={e => setFeature(e.target.value)} className="h-9 rounded-lg text-xs font-semibold" />
                  </Field>
                  <Field label="Cenário (Scenario)">
                    <Input value={scenario} onChange={e => setScenario(e.target.value)} className="h-9 rounded-lg text-xs font-semibold" />
                  </Field>
                  <StepList label="Dado (Given)" placeholder="Passo Dado" steps={givenSteps} onChange={setGivenSteps} />
                  <StepList label="Quando (When)" placeholder="Passo Quando" steps={whenSteps} onChange={setWhenSteps} />
                  <StepList label="Então (Then)" placeholder="Passo Então" steps={thenSteps} onChange={setThenSteps} />
                </>
              ) : (
                <>
                  <Field label="Título do bug">
                    <Input value={bugTitle} onChange={e => setBugTitle(e.target.value)} className="h-9 rounded-lg text-xs font-bold" />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Ambiente / build">
                      <Input value={bugEnv} onChange={e => setBugEnv(e.target.value)} className="h-9 rounded-lg text-xs font-medium" />
                    </Field>
                    <Field label="Severidade">
                      <select value={bugSeverity} onChange={e => setBugSeverity(e.target.value)} className={selectClass}>
                        <option value="Critical">Crítica (Blocker)</option>
                        <option value="High">Alta (High)</option>
                        <option value="Medium">Média (Medium)</option>
                        <option value="Low">Baixa (Low)</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Passos para reproduzir">
                    <Textarea value={bugSteps} onChange={e => setBugSteps(e.target.value)} rows={4} className="rounded-lg text-xs font-medium" />
                  </Field>
                  <Field label="Comportamento esperado">
                    <Input value={bugExpected} onChange={e => setBugExpected(e.target.value)} className="h-9 rounded-lg text-xs font-medium" />
                  </Field>
                  <Field label="Comportamento observado (atual)">
                    <Input value={bugActual} onChange={e => setBugActual(e.target.value)} className="h-9 rounded-lg text-xs font-medium" />
                  </Field>
                  <Field label="Logs / stack trace / erros de console">
                    <Textarea value={bugLogs} onChange={e => setBugLogs(e.target.value)} rows={3} spellCheck={false} className="rounded-lg font-code text-xs" />
                  </Field>
                </>
              )}
            </div>
          </section>

          <ToolPane
            title={mode === 'bdd' ? 'Gherkin formatado' : 'Markdown para o Jira'}
            value={mode === 'bdd' ? gherkin : bugMarkdown}
            readOnly
            downloadName={mode === 'bdd' ? 'cenario.feature' : 'bug-report.md'}
          />
        </div>
      </div>
    </DevToolPage>
  );
}
