'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  TestTube, 
  Key, 
  Loader2, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle,
  Folder,
  Layers,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings } from '@/hooks/useJiraSettings';

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
  customFields?: Record<string, any>;
  steps?: ZephyrStep[];
  testScript?: {
    steps?: ZephyrStep[];
  };
}

export function ZephyrExplorer() {
  const { toast } = useToast();
  const { jiraSettings, saveJiraSettings } = useJiraSettings();

  const [testCaseKey, setTestCaseKey] = useState('');
  const [patToken, setPatToken] = useState(jiraSettings?.pat || '');
  const [loading, setLoading] = useState(false);
  const [testCaseData, setTestCaseData] = useState<ZephyrTestCase | null>(null);
  const [copied, setCopied] = useState(false);

  // Estados do Gerador de Relatório Executivo
  const [passCount, setPassCount] = useState(12);
  const [failCount, setFailCount] = useState(2);
  const [blockedCount, setBlockedCount] = useState(1);
  const [unexecutedCount, setUnexecutedCount] = useState(5);
  const [reportMarkdown, setReportMarkdown] = useState('');

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
      // Salva PAT para conveniência do usuário
      saveJiraSettings({ pat: patToken.trim() });

      const res = await fetch('/api/jira/testcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseKey: testCaseKey.trim(),
          pat: patToken.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Erro (${res.status}) ao buscar no Zephyr.`);
      }

      const data = await res.json();
      setTestCaseData(data);
      toast({ title: 'Caso de teste carregado!', description: `${data.key || testCaseKey} encontrado com sucesso.` });
    } catch (err: any) {
      console.error('Erro Zephyr:', err);
      toast({
        title: 'Falha na busca do Zephyr',
        description: err.message || 'Verifique o código e o token PAT.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast({ title: 'Copiado para a área de transferência!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const generateReport = () => {
    const total = passCount + failCount + blockedCount + unexecutedCount;
    const executed = passCount + failCount + blockedCount;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';
    const executionRate = total > 0 ? ((executed / total) * 100).toFixed(1) : '0';

    const md = `### 📊 Relatório Executivo de Testes de QA (Zephyr)
**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Total de Casos de Teste Mapeados:** ${total}

#### 📈 Métricas de Execução:
- ✅ **Aprovados (Pass):** ${passCount} (${passRate}%)
- ❌ **Falhos (Fail):** ${failCount}
- 🚫 **Bloqueados (Blocked):** ${blockedCount}
- ⏳ **Não Executados:** ${unexecutedCount}
- **Taxa de Execução da Sprint:** ${executionRate}%

---
*Gerado via Central de Qualidade (QA Hub - Espaço Ágil)*`;

    setReportMarkdown(md);
  };

  // Normalização de passos
  const rawSteps = testCaseData?.steps || testCaseData?.testScript?.steps || [];

  return (
    <div className="space-y-6 w-full">
      {/* TOOL BAR & PAT CONFIG */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <TestTube className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Zephyr Testcase Explorer & Relatórios
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consulte casos de teste diretamente do Zephyr (Jira) e gere relatórios executivos para a Sprint.
            </p>
          </div>
        </div>

        {/* INPUT DE BUSCA */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="password"
              placeholder="Jira Token PAT..."
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              className="pl-9 text-xs font-mono bg-slate-50 dark:bg-slate-950 h-9"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Ex: PROJ-T123..."
              value={testCaseKey}
              onChange={(e) => setTestCaseKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTestCase()}
              className="pl-9 text-xs font-bold uppercase bg-slate-50 dark:bg-slate-950 h-9"
            />
          </div>

          <Button 
            onClick={fetchTestCase} 
            disabled={loading}
            className="w-full sm:w-auto h-9 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>
      </div>

      {/* PAINEL DE CASO DE TESTE ENCONTRADO */}
      {testCaseData && (
        <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-300">
                  {testCaseData.key || testCaseKey}
                </Badge>
                {testCaseData.status && (
                  <Badge variant="secondary" className="text-[10px] font-extrabold uppercase">
                    {testCaseData.status}
                  </Badge>
                )}
                {testCaseData.priority && (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Prioridade: {testCaseData.priority}
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {testCaseData.name || 'Sem título retornado'}
              </h3>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => copyMarkdown(JSON.stringify(testCaseData, null, 2))}
              className="text-xs font-bold gap-1 rounded-xl"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              Copiar JSON do CT
            </Button>
          </div>

          {/* META DETALHES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testCaseData.folder && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                <Folder className="h-4 w-4 text-slate-400" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pasta</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{testCaseData.folder}</span>
                </div>
              </div>
            )}

            {testCaseData.owner && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Autor/Owner</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{testCaseData.owner}</span>
                </div>
              </div>
            )}

            {testCaseData.precondition && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 col-span-1 md:col-span-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Pré-condição</span>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {testCaseData.precondition}
                </p>
              </div>
            )}
          </div>

          {/* TABELA DE PASSOS */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Passos de Execução ({rawSteps.length})
            </h4>

            {rawSteps.length === 0 ? (
              <p className="text-xs italic text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border text-center">
                Nenhum passo estruturado retornado no payload deste caso de teste.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Ação / Passo</th>
                      <th className="p-3">Massa de Dados (Test Data)</th>
                      <th className="p-3">Resultado Esperado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {rawSteps.map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 text-slate-900 dark:text-slate-100 whitespace-pre-line">{st.step || st.description || '-'}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line">{st.testData || '-'}</td>
                        <td className="p-3 text-emerald-700 dark:text-emerald-400 whitespace-pre-line font-semibold">{st.expectedResult || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* GERADOR DE RELATÓRIO DE EXECUÇÃO ZEPHYR */}
      <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Gerador de Relatórios & Métricas de QA (Sprint)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Insira a contagem da execução do ciclo de testes e monte um resumo pronto para compartilhamento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20">
            <Label className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 mb-1 block">Aprovados (Pass)</Label>
            <Input 
              type="number" 
              value={passCount} 
              onChange={(e) => setPassCount(parseInt(e.target.value) || 0)} 
              className="font-mono font-bold bg-white dark:bg-slate-900 h-9"
            />
          </div>

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20">
            <Label className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-400 mb-1 block">Falhos (Fail)</Label>
            <Input 
              type="number" 
              value={failCount} 
              onChange={(e) => setFailCount(parseInt(e.target.value) || 0)} 
              className="font-mono font-bold bg-white dark:bg-slate-900 h-9"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20">
            <Label className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 mb-1 block">Bloqueados</Label>
            <Input 
              type="number" 
              value={blockedCount} 
              onChange={(e) => setBlockedCount(parseInt(e.target.value) || 0)} 
              className="font-mono font-bold bg-white dark:bg-slate-900 h-9"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Label className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 mb-1 block">Não Executados</Label>
            <Input 
              type="number" 
              value={unexecutedCount} 
              onChange={(e) => setUnexecutedCount(parseInt(e.target.value) || 0)} 
              className="font-mono font-bold bg-white dark:bg-slate-900 h-9"
            />
          </div>
        </div>

        <Button 
          onClick={generateReport}
          className="w-full h-10 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl gap-2"
        >
          <Sparkles className="h-4 w-4" /> Gerar Relatório Executivo
        </Button>

        {reportMarkdown && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500">Relatório Formatado (Markdown):</span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => copyMarkdown(reportMarkdown)}
                className="h-8 text-xs font-bold gap-1 rounded-xl"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copiar Relatório
              </Button>
            </div>

            <textarea
              readOnly
              value={reportMarkdown}
              rows={8}
              className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none scrollbar-thin"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
