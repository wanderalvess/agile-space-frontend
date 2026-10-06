'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileText, Folder, Key, Loader2, Search, TestTube } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { authFetch } from '@/lib/auth-client';

interface ZephyrStep {
  step?: string;
  testData?: string;
  expectedResult?: string;
  description?: string;
}

interface ZephyrTestCase {
  key?: string;
  name?: string;
  status?: string;
  priority?: string;
  folder?: string;
  objective?: string;
  precondition?: string;
  owner?: string;
  component?: string;
  customFields?: Record<string, unknown>;
  steps?: ZephyrStep[];
  testScript?: { steps?: ZephyrStep[] };
}

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

export default function ZephyrPage() {
  const { toast } = useToast();
  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();

  const [testCaseKey, setTestCaseKey] = useState('');
  const [patToken, setPatToken] = useState(jiraSettings?.token || '');
  const [loading, setLoading] = useState(false);
  const [testCaseData, setTestCaseData] = useState<ZephyrTestCase | null>(null);
  const [copied, setCopied] = useState(false);

  const [passCount, setPassCount] = useState(12);
  const [failCount, setFailCount] = useState(2);
  const [blockedCount, setBlockedCount] = useState(1);
  const [unexecutedCount, setUnexecutedCount] = useState(5);

  // Se o token salvo só chegar depois da montagem, preenche o campo (sem sobrescrever o que o usuário digitou).
  useEffect(() => {
    if (jiraSettings?.token) setPatToken(prev => prev || jiraSettings.token);
  }, [jiraSettings?.token]);

  const fetchTestCase = async () => {
    if (!testCaseKey.trim()) {
      toast({ title: 'Atenção', description: 'Informe o código do caso de teste (ex: PROJ-T123).' });
      return;
    }
    if (!patToken.trim()) {
      toast({ title: 'Atenção', description: 'Informe o seu Personal Access Token (PAT) do Jira/Zephyr.' });
      return;
    }

    setLoading(true);
    setTestCaseData(null);

    try {
      // Salva o PAT para conveniência do usuário (mesmo comportamento da ferramenta antiga)
      saveJiraSettings({ domain: jiraSettings?.domain || '', token: patToken.trim() });

      const res = await authFetch('/api/jira/testcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseKey: testCaseKey.trim(), pat: patToken.trim(), domain: jiraSettings?.domain || '' }),
      });

      if (!res.ok) {
        // O backend repassa a resposta do Jira: pode vir {error}, {message} ou {errorMessages:[...]}
        const error = await res.json().catch(() => ({} as any));
        throw new Error(error.error || error.message || error.errorMessages?.[0] || `Erro (${res.status}) ao buscar no Zephyr.`);
      }

      const data = await res.json();
      setTestCaseData(data);
      toast({ title: 'Caso de teste carregado', description: `${data.key || testCaseKey} encontrado com sucesso.` });
    } catch (err: unknown) {
      console.error('Erro Zephyr:', err);
      toast({
        title: 'Falha na busca do Zephyr',
        description: err instanceof Error ? err.message : 'Verifique o código e o token PAT.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(testCaseData, null, 2));
      setCopied(true);
      toast({ title: 'JSON copiado' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const reportMarkdown = useMemo(() => {
    const total = passCount + failCount + blockedCount + unexecutedCount;
    const executed = passCount + failCount + blockedCount;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';
    const executionRate = total > 0 ? ((executed / total) * 100).toFixed(1) : '0';
    return `### 📊 Relatório Executivo de Testes de QA (Zephyr)
**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Total de Casos de Teste Mapeados:** ${total}

#### 📈 Métricas de Execução:
- ✅ **Aprovados (Pass):** ${passCount} (${passRate}%)
- ❌ **Falhos (Fail):** ${failCount}
- 🚫 **Bloqueados (Blocked):** ${blockedCount}
- ⏳ **Não Executados:** ${unexecutedCount}
- **Taxa de Execução da Sprint:** ${executionRate}%

---
*Gerado via DevTools (Portal Tech V&D)*`;
  }, [passCount, failCount, blockedCount, unexecutedCount]);

  const rawSteps = testCaseData?.steps || testCaseData?.testScript?.steps || [];

  const counters: { label: string; value: number; set: (n: number) => void }[] = [
    { label: 'Aprovados (Pass)', value: passCount, set: setPassCount },
    { label: 'Falhos (Fail)', value: failCount, set: setFailCount },
    { label: 'Bloqueados', value: blockedCount, set: setBlockedCount },
    { label: 'Não executados', value: unexecutedCount, set: setUnexecutedCount },
  ];

  return (
    <DevToolPage toolId="zephyr">
      <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-5 lg:gap-4">
        {/* Busca + caso de teste */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-span-3">
          <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
            <TestTube className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caso de teste (Zephyr / Jira)</h2>
          </header>

          <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 p-3 sm:flex-row">
            <div className="relative flex-1">
              <Key className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Jira Token PAT…" value={patToken} onChange={e => setPatToken(e.target.value)} className="h-9 rounded-lg pl-9 font-code text-xs" />
            </div>
            <div className="relative sm:w-48">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: PROJ-T123…"
                value={testCaseKey}
                onChange={e => setTestCaseKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchTestCase()}
                className="h-9 rounded-lg pl-9 font-code text-xs font-bold uppercase"
              />
            </div>
            <Button onClick={fetchTestCase} disabled={loading} className="h-9 gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            {!testCaseData ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <TestTube className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">Nenhum caso de teste carregado.</p>
                <p className="max-w-xs text-[11px] font-medium text-muted-foreground">Informe o seu token PAT do Jira e o código do caso (ex.: PROJ-T123) para consultar o Zephyr.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 font-code text-xs font-extrabold text-primary">{testCaseData.key || testCaseKey}</Badge>
                      {testCaseData.status && <Badge variant="secondary" className="rounded-full text-[10px] font-extrabold uppercase">{testCaseData.status}</Badge>}
                      {testCaseData.priority && <Badge variant="outline" className="rounded-full text-[10px] font-bold">Prioridade: {testCaseData.priority}</Badge>}
                    </div>
                    <h3 className="font-headline text-lg font-black leading-tight text-foreground">{testCaseData.name || 'Sem título retornado'}</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyJson} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copiar JSON
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {testCaseData.folder && (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className={`${labelClass} block`}>Pasta</span>
                        <span className="text-xs font-semibold text-foreground">{testCaseData.folder}</span>
                      </div>
                    </div>
                  )}
                  {testCaseData.owner && (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className={`${labelClass} block`}>Autor / owner</span>
                        <span className="text-xs font-semibold text-foreground">{testCaseData.owner}</span>
                      </div>
                    </div>
                  )}
                  {testCaseData.precondition && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3 sm:col-span-2">
                      <span className={`${labelClass} mb-1 block`}>Pré-condição</span>
                      <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-foreground">{testCaseData.precondition}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className={labelClass}>Passos de execução ({rawSteps.length})</h4>
                  {rawSteps.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs font-medium italic text-muted-foreground">
                      Nenhum passo estruturado retornado no payload deste caso de teste.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="w-12 p-3 text-center">#</th>
                            <th className="p-3">Ação / passo</th>
                            <th className="p-3">Massa de dados</th>
                            <th className="p-3">Resultado esperado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          {rawSteps.map((st, idx) => (
                            <tr key={idx} className="transition-colors hover:bg-muted/40">
                              <td className="p-3 text-center font-bold text-muted-foreground">{idx + 1}</td>
                              <td className="whitespace-pre-line p-3 text-foreground">{st.step || st.description || '-'}</td>
                              <td className="whitespace-pre-line p-3 font-code text-[11px] text-muted-foreground">{st.testData || '-'}</td>
                              <td className="whitespace-pre-line p-3 font-semibold text-foreground">{st.expectedResult || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Relatório executivo */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-2 lg:gap-4">
          <section className="shrink-0 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <h2 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Métricas da sprint</h2>
            <div className="grid grid-cols-2 gap-2">
              {counters.map(c => (
                <div key={c.label} className="space-y-1 rounded-xl border border-border bg-muted/40 p-2">
                  <Label className={labelClass}>{c.label}</Label>
                  <Input type="number" min={0} value={c.value} onChange={e => c.set(parseInt(e.target.value) || 0)} className="h-8 rounded-lg font-code text-xs font-bold" />
                </div>
              ))}
            </div>
          </section>
          <ToolPane className="flex-1" title="Relatório executivo (Markdown)" value={reportMarkdown} readOnly downloadName="relatorio-zephyr.md" />
        </div>
      </div>
    </DevToolPage>
  );
}
