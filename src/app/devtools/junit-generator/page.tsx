'use client';

import { useEffect, useState } from 'react';
import { Code2, Key, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { NO_CLASS_MESSAGE, generateJUnitSkeleton } from '@/lib/devtools/junit';

// Mesma chave do legado, para quem já tinha configurado.
const KEY_STORAGE = 'agilespace_gemini_key';
const MODEL_STORAGE = 'agilespace_gemini_model';
const DEFAULT_MODEL = 'gemini-2.5-flash';

const SAMPLE = `package com.empresa.pedidos;

public class PedidoService {

    private final PedidoRepository repository;
    private final NotificacaoClient notificacao;

    public PedidoService(PedidoRepository repository, NotificacaoClient notificacao) {
        this.repository = repository;
        this.notificacao = notificacao;
    }

    public Pedido criar(String cliente, double valor) {
        if (valor <= 0) throw new IllegalArgumentException("Valor inválido");
        Pedido p = repository.save(new Pedido(cliente, valor));
        notificacao.enviar(p);
        return p;
    }

    public void cancelar(Long id) {
        repository.deleteById(id);
    }
}
`;

// localStorage pode lançar (modo privado / bloqueado): sempre com try/catch.
const readStore = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const writeStore = (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sem persistência */ } };

export default function JUnitGeneratorPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'local' | 'ia' | null>(null);

  // Motor avançado (Gemini): roda direto do navegador com a chave do próprio usuário.
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [tempModel, setTempModel] = useState(DEFAULT_MODEL);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const k = readStore(KEY_STORAGE);
    const m = readStore(MODEL_STORAGE) || DEFAULT_MODEL;
    setApiKey(k); setTempKey(k); setModel(m); setTempModel(m);
  }, []);

  const saveSettings = () => {
    const k = tempKey.trim();
    const m = tempModel.trim() || DEFAULT_MODEL;
    writeStore(KEY_STORAGE, k);
    writeStore(MODEL_STORAGE, m === DEFAULT_MODEL ? '' : m);
    setApiKey(k); setModel(m);
    setSettingsOpen(false);
  };

  const generateLocal = () => {
    setError(null);
    if (!input.trim()) { setOutput(''); setMode(null); setError('Cole uma classe Java no painel de entrada.'); return; }
    const out = generateJUnitSkeleton(input);
    if (out === null) { setOutput(''); setMode(null); setError(NO_CLASS_MESSAGE.replace('// ', '').replace('...', '.')); return; }
    setOutput(out);
    setMode('local');
  };

  const generateAI = async () => {
    setError(null);
    if (!input.trim()) { setError('Cole uma classe Java no painel de entrada.'); return; }
    if (!apiKey) { setSettingsOpen(true); return; }
    setGenerating(true);
    setOutput('');
    try {
      // Import dinâmico: a SDK só é baixada quando o usuário realmente usa o motor avançado.
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const gen = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model });
      const prompt = `Você é um Especialista Java Sênior. Gere testes unitários completos usando JUnit 5 e Mockito para a classe abaixo. Retorne APENAS o código Java válido. Cubra caminhos lógicos principais (ifs, exceptions). Configure mocks e faça asserts corretos. Não escreva nada além de código Java, em hipótese alguma. Não envolva em blocos \`\`\`java. Código Java:\n${input}`;
      const res = await gen.generateContent(prompt);
      // remove cercas de markdown caso o modelo as inclua mesmo assim
      const text = res.response.text().replace(/^```(?:java)?\s*/i, '').replace(/```\s*$/, '').trim();
      if (!text) throw new Error('Resposta vazia do modelo.');
      setOutput(text);
      setMode('ia');
    } catch (e) {
      setMode(null);
      setError(`Falha no motor avançado: ${(e as Error).message || 'erro desconhecido'}. Verifique a chave e o nome do modelo, ou use o esqueleto local.`);
    } finally {
      setGenerating(false);
    }
  };

  const btn = 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider';

  return (
    <DevToolPage
      toolId="junit-generator"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => { setInput(SAMPLE); setError(null); }} className={btn}>
            <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className={btn} title="Chave do Gemini (motor avançado)">
            <Key className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{apiKey ? 'IA ativa' : 'Config. IA'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={generateAI} disabled={generating} className={btn}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Gerar com IA</span>
          </Button>
          <Button size="sm" onClick={generateLocal} disabled={generating} className={btn}>
            <Code2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Gerar esqueleto</span>
          </Button>
        </>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <ToolPane title="Classe Java" value={input} onChange={setInput} placeholder="Cole aqui a classe Java a testar…" footer={`${input.length} caracteres`} />
        <ToolPane
          title={mode === 'ia' ? 'JUnit 5 + Mockito (IA)' : 'JUnit 5 + Mockito'}
          value={generating ? '// Gerando testes com o motor avançado…' : output}
          readOnly
          placeholder="O teste gerado aparece aqui."
          downloadName="Test.java"
          error={error}
          footer={mode === 'local' ? 'Esqueleto local: preencha os TODOs.' : mode === 'ia' ? `Gerado por ${model}. Revise antes de usar.` : undefined}
        />
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline font-black uppercase tracking-tight">Motor avançado (Gemini)</DialogTitle>
            <DialogDescription>
              Opcional. Com uma chave do Google AI Studio, o teste é gerado lendo a lógica da classe. A chave fica só neste navegador (localStorage) e a chamada vai direto do navegador ao Google; o código colado é enviado a esse serviço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gk" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chave de API</Label>
              <Input id="gk" type="password" autoComplete="off" value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="AIza…" className="rounded-xl font-code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gm" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Modelo</Label>
              <Input id="gm" value={tempModel} onChange={e => setTempModel(e.target.value)} placeholder={DEFAULT_MODEL} className="rounded-xl font-code" />
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Obter chave no Google AI Studio</a>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-wider">Cancelar</Button>
            <Button onClick={saveSettings} className="rounded-xl text-[10px] font-black uppercase tracking-wider">{tempKey.trim() ? 'Salvar' : 'Remover chave'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DevToolPage>
  );
}
