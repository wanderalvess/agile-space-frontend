'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileCode2, 
  Bug, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileText,
  AlertOctagon,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function BddBugStudio() {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- ESTADO DO ESTÚDIO BDD ---
  const [feature, setFeature] = useState('Autenticação de Usuários no Sistema');
  const [scenario, setScenario] = useState('Login com credenciais válidas');
  const [givenSteps, setGivenSteps] = useState(['que o usuário está na tela de login', 'possui um cadastro ativo']);
  const [whenSteps, setWhenSteps] = useState(['preenche o email e a senha válidos', 'clica no botão "Entrar"']);
  const [thenSteps, setThenSteps] = useState(['é redirecionado para o dashboard principal', 'visualiza a mensagem de boas-vindas']);

  // --- ESTADO DO BUG REPORT ---
  const [bugTitle, setBugTitle] = useState('[BUG] Erro 500 ao confirmar pagamento via Pix');
  const [bugEnv, setBugEnv] = useState('Homologação (Staging v2.4.1) | Chrome 124 | Windows 11');
  const [bugSteps, setBugSteps] = useState('1. Acesse o carrinho de compras\n2. Adicione qualquer produto\n3. Selecione a opção de pagamento Pix\n4. Clique em "Finalizar Pedido"');
  const [bugExpected, setBugExpected] = useState('Gerar o QR Code do Pix e exibir a chave Copia e Cola.');
  const [bugActual, setBugActual] = useState('A tela congela e dispara erro HTTP 500 Internal Server Error no console.');
  const [bugLogs, setBugLogs] = useState('POST https://api.exemplo.com.br/v1/payments/pix -> 500 Internal Server Error\n{"code": "PIX_GATEWAY_TIMEOUT"}');
  const [bugSeverity, setBugSeverity] = useState('High');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Copiado para a área de transferência!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Gerador de texto Gherkin
  const generateGherkinText = () => {
    let text = `# language: pt\nFuncionalidade: ${feature}\n\n  Cenário: ${scenario}\n`;
    givenSteps.forEach((s, idx) => {
      text += `    ${idx === 0 ? 'Dado' : 'E'} ${s}\n`;
    });
    whenSteps.forEach((s, idx) => {
      text += `    ${idx === 0 ? 'Quando' : 'E'} ${s}\n`;
    });
    thenSteps.forEach((s, idx) => {
      text += `    ${idx === 0 ? 'Então' : 'E'} ${s}\n`;
    });
    return text;
  };

  // Gerador de Bug Report Markdown
  const generateBugMarkdown = () => {
    return `## 🐛 ${bugTitle}

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
*Relatório padronizado via Central de Qualidade (Espaço Ágil)*`;
  };

  return (
    <div className="space-y-6 w-full">
      <Tabs defaultValue="bdd" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <TabsTrigger value="bdd" className="rounded-lg font-bold text-xs gap-2">
            <FileCode2 className="h-4 w-4 text-emerald-500" /> Estúdio BDD Gherkin
          </TabsTrigger>
          <TabsTrigger value="bug" className="rounded-lg font-bold text-xs gap-2">
            <Bug className="h-4 w-4 text-rose-500" /> Gerador de Bug Reports
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BDD STUDIO */}
        <TabsContent value="bdd" className="space-y-6 mt-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <FileCode2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    Criador de Cenários BDD Gherkin (Dado / Quando / Então)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Padronize os cenários de aceite em linguagem Gherkin pronta para automação ou documentação.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => copyToClipboard(generateGherkinText(), 'gherkin-copy')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl gap-2"
              >
                {copiedKey === 'gherkin-copy' ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                Copiar Gherkin
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FORMULÁRIO BDD */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Funcionalidade (Feature)</Label>
                  <Input 
                    value={feature} 
                    onChange={(e) => setFeature(e.target.value)} 
                    className="font-semibold text-xs bg-slate-50 dark:bg-slate-950" 
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Cenário (Scenario)</Label>
                  <Input 
                    value={scenario} 
                    onChange={(e) => setScenario(e.target.value)} 
                    className="font-semibold text-xs bg-slate-50 dark:bg-slate-950" 
                  />
                </div>

                {/* DADO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">Dado (Given)</Label>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setGivenSteps([...givenSteps, ''])}
                      className="h-6 text-[10px] font-bold text-slate-500 hover:text-emerald-600"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Passo
                    </Button>
                  </div>
                  {givenSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={(e) => {
                          const next = [...givenSteps];
                          next[idx] = e.target.value;
                          setGivenSteps(next);
                        }}
                        placeholder={`Passo Dado ${idx + 1}`}
                        className="text-xs font-medium bg-slate-50 dark:bg-slate-950"
                      />
                      {givenSteps.length > 1 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setGivenSteps(givenSteps.filter((_, i) => i !== idx))}
                          className="h-8 w-8 text-rose-500 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* QUANDO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black uppercase text-blue-600 dark:text-blue-400">Quando (When)</Label>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setWhenSteps([...whenSteps, ''])}
                      className="h-6 text-[10px] font-bold text-slate-500 hover:text-blue-600"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Passo
                    </Button>
                  </div>
                  {whenSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={(e) => {
                          const next = [...whenSteps];
                          next[idx] = e.target.value;
                          setWhenSteps(next);
                        }}
                        placeholder={`Passo Quando ${idx + 1}`}
                        className="text-xs font-medium bg-slate-50 dark:bg-slate-950"
                      />
                      {whenSteps.length > 1 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setWhenSteps(whenSteps.filter((_, i) => i !== idx))}
                          className="h-8 w-8 text-rose-500 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* ENTÃO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-black uppercase text-purple-600 dark:text-purple-400">Então (Then)</Label>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setThenSteps([...thenSteps, ''])}
                      className="h-6 text-[10px] font-bold text-slate-500 hover:text-purple-600"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Passo
                    </Button>
                  </div>
                  {thenSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={(e) => {
                          const next = [...thenSteps];
                          next[idx] = e.target.value;
                          setThenSteps(next);
                        }}
                        placeholder={`Passo Então ${idx + 1}`}
                        className="text-xs font-medium bg-slate-50 dark:bg-slate-950"
                      />
                      {thenSteps.length > 1 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setThenSteps(thenSteps.filter((_, i) => i !== idx))}
                          className="h-8 w-8 text-rose-500 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PREVIEW EM TEMPO REAL */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">Preview Gherkin Formatado:</span>
                <textarea
                  readOnly
                  value={generateGherkinText()}
                  rows={16}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: BUG REPORT GENERATOR */}
        <TabsContent value="bug" className="space-y-6 mt-6">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                  <Bug className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                    Gerador de Bug Reports Padronizados (Jira Markdown)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Preencha as informações do defeito e copie a formatação pronta para colagem direta no Jira.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => copyToClipboard(generateBugMarkdown(), 'bug-copy')}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase rounded-xl gap-2"
              >
                {copiedKey === 'bug-copy' ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                Copiar Markdown do Bug
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FORMULÁRIO BUG */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Título do Bug</Label>
                  <Input 
                    value={bugTitle} 
                    onChange={(e) => setBugTitle(e.target.value)} 
                    className="font-bold text-xs bg-slate-50 dark:bg-slate-950" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Ambiente / Build</Label>
                    <Input 
                      value={bugEnv} 
                      onChange={(e) => setBugEnv(e.target.value)} 
                      className="font-medium text-xs bg-slate-50 dark:bg-slate-950" 
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Severidade</Label>
                    <select
                      value={bugSeverity}
                      onChange={(e) => setBugSeverity(e.target.value)}
                      className="w-full h-10 px-3 font-bold text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                    >
                      <option value="Critical">Crítica (Blocker)</option>
                      <option value="High">Alta (High)</option>
                      <option value="Medium">Média (Medium)</option>
                      <option value="Low">Baixa (Low)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Passos para Reproduzir</Label>
                  <Textarea
                    value={bugSteps}
                    onChange={(e) => setBugSteps(e.target.value)}
                    rows={4}
                    className="font-medium text-xs bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block text-emerald-600">Comportamento Esperado</Label>
                  <Input 
                    value={bugExpected} 
                    onChange={(e) => setBugExpected(e.target.value)} 
                    className="font-medium text-xs bg-slate-50 dark:bg-slate-950" 
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block text-rose-600">Comportamento Observado (Atual)</Label>
                  <Input 
                    value={bugActual} 
                    onChange={(e) => setBugActual(e.target.value)} 
                    className="font-medium text-xs bg-slate-50 dark:bg-slate-950" 
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider mb-1 block">Logs / Stack Trace / Erros de Console</Label>
                  <Textarea
                    value={bugLogs}
                    onChange={(e) => setBugLogs(e.target.value)}
                    rows={3}
                    className="font-mono text-xs bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* PREVIEW MARKDOWN DO BUG */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">Preview do Markdown do Jira:</span>
                <textarea
                  readOnly
                  value={generateBugMarkdown()}
                  rows={20}
                  className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin leading-relaxed"
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
