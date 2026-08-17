'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Copy,
  ClipboardPaste,
  Eraser,
  HelpCircle,
  AlertTriangle,
  Code2,
  TestTube,
  FileCode2,
  Wand2,
  Key,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';
import { Editor } from '@monaco-editor/react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function JUnitGeneratorPage() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const editorInputRef = React.useRef<any>(null);
  const editorOutputRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (editorInputRef.current) editorInputRef.current.dispose();
      if (editorOutputRef.current) editorOutputRef.current.dispose();
    };
  }, []);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('// Cole sua classe Java no painel ao lado e clique em um dos botões de geração...');
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  // Gemini State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('agilespace_gemini_key');
    if (savedKey) {
      setGeminiApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

  const saveApiKey = () => {
    const keyToSave = tempApiKey.trim();
    if (keyToSave) {
      localStorage.setItem('agilespace_gemini_key', keyToSave);
      setGeminiApiKey(keyToSave);
      setIsSettingsOpen(false);
      toast({ title: "Chave salva!", description: "Gerador Avançado desbloqueado." });
    } else {
      localStorage.removeItem('agilespace_gemini_key');
      setGeminiApiKey('');
      setIsSettingsOpen(false);
      toast({ title: "Configuração removida", description: "O uso do motor avançado foi desativado localmente." });
    }
  };

  const handleGenerateLocal = () => {
    if (!input.trim()) {
      setOutput('// Cole sua classe Java no painel ao lado...');
      setStatus('idle');
      return;
    }

    try {
      const generated = generateJUnitBoilerplate(input);
      setOutput(generated);
      if (generated.includes('// Classe Java não detectada')) {
        setStatus('invalid');
      } else {
        setStatus('valid');
        toast({ title: "Gerado Localmente", description: "Esqueleto estático montado usando regex nativo da ferramenta." });
      }
    } catch (e) {
      setOutput('// Erro ao gerar testes...\n// ' + (e as Error).message);
      setStatus('invalid');
    }
  };

  const handleGenerateAI = async () => {
    if (!input.trim()) {
      toast({ title: "Onde está a classe?", description: "Cole uma classe Java válida no painel de entrada.", variant: "destructive" });
      return;
    }

    if (!geminiApiKey) {
      toast({ 
        title: "API Key Ausente", 
        description: "Para gerar testes com lógica completa (ifs, mocks, exceptions), insira uma chave do Gemini. Ou feche este aviso e use o botão (Local) para gerar apenas o esqueleto.",
        variant: "destructive" 
      });
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    setStatus('idle');
    setOutput('// ⏳ Conectando ao motor avançado...\n// Avaliando caminhos lógicos, exceptions e criando cenários de teste reais...\n// Por favor, aguarde alguns segundos.');

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Você é um Especialista Java Sênior. Gere testes unitários completos usando JUnit 5 e Mockito para a classe abaixo. Retorne APENAS o código Java válido. Cubra caminhos lógicos principais (ifs, exceptions). Configure mocks e faça asserts corretos. Não escreva nada além de código Java, em hipótese alguma. Não envolva em blocos \`\`\`java. Código Java:\n${input}`;
      
      const result = await model.generateContent(prompt);
      let textLine = result.response.text();
      
      // Cleanup markdown block hints if Gemini still injects them
      textLine = textLine.replace(/^```(java)?\s*/gi, '').replace(/```\s*$/g, '').trim();
      
      if (textLine && !textLine.startsWith('```')) {
        setOutput(textLine);
        setStatus('valid');
        toast({ title: "Processamento Concluído!", description: "Cenários de teste dinâmicos criados." });
      } else {
        throw new Error("Resposta do motor fragmentada ou vazia.");
      }
    } catch (e: any) {
      console.error(e);
      let errorMsg = e.message || 'Erro desconhecido na requisição.';
      setOutput(`// Ocorreu um erro no motor avançado:\n// ${errorMsg}\n//\n// Sugestão: Tente gerar usando o botão 'Gerar Esqueleto (Local)' ou verifique se sua chave da Google permite o uso do modelo.`);
      setStatus('invalid');
      toast({ title: "Falha na Invocação", description: errorMsg.slice(0, 50) + '...', variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!output || output.startsWith('// Cole') || output.startsWith('// Classe') || output.startsWith('// Erro') || output.startsWith('// ⏳')) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Código copiado!", description: "Testes copiados para a área de transferência." });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (e) { toast({ title: "Erro ao colar", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
      
      {/* Mesh Gradient Local */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-100/30 blur-[120px] pointer-events-none -z-10" />

      {/* DIALOG DA CHAVE GEMINI */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-8 bg-white/95 backdrop-blur-xl">
          <DialogHeader className="gap-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-2">
              <Key className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic text-slate-800">
              Motor Avançado <span className="text-indigo-600">Core</span>
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-relaxed">
              Desbloqueie testes dinâmicos com sua Google API Key
            </DialogDescription>
          </DialogHeader>
          <div className="py-8">
            <div className="flex flex-col gap-3">
              <Label htmlFor="apikey" className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] ml-1">Chave de API (Módulo Flash 1.5)</Label>
              <div className="relative group">
                <Input
                  id="apikey"
                  type="password"
                  placeholder="AIzaSyA_****************"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl px-6 font-mono text-sm focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                  autoComplete="off"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold leading-relaxed mt-2 px-1 italic">
                Sua chave fica segura no localStorage do seu navegador. 
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1">Obter chave gratuita →</a>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl font-black text-[10px] uppercase tracking-widest h-12 px-6">Cancelar</Button>
            <Button onClick={saveApiKey} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest h-12 px-8 shadow-xl shadow-indigo-500/20">Ativar Motor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <TooltipProvider>
        <header className="flex items-center justify-between px-8 py-5 border-b bg-white/60 backdrop-blur-xl shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <TestTube className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Gerador de Testes Unitários</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">JUNIT & MOCKITO TECHNICAL ENGINE</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 bg-slate-100/50 p-1 rounded-2xl">
              <Badge className="bg-white text-slate-600 border-none shadow-sm h-10 px-4 rounded-xl text-[9px] font-black tracking-widest gap-2">
                <Code2 className="h-4 w-4 text-blue-500" />
                BASE LOCAL
              </Badge>

              {geminiApiKey && (
                <Badge className="bg-indigo-600 text-white border-none shadow-md h-10 px-4 rounded-xl text-[9px] font-black tracking-widest gap-2 animate-in zoom-in-95">
                  <Wand2 className="h-4 w-4" />
                  MOTOR AVANÇADO
                </Badge>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)} className="h-10 px-4 gap-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-xl font-black text-[9px] uppercase tracking-widest">
              <Key className="h-4 w-4" />
              CONFIG
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                  <HelpCircle className="h-4 w-4" />
                  GUIA
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <SheetHeader className="shrink-0 border-b p-8 bg-white">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                    <TestTube className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Gerador de Testes
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Crie testes unitários modernos em Java instantaneamente
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. Local vs Avançado
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        O gerador <strong>Local</strong> cria rapidamente o esqueleto (boilerplate) dos seus testes, mapeando atributos para mocks e métodos para cenários de teste básicos de forma offline. O gerador <strong>Avançado</strong> utiliza o motor para ler sua lógica de negócio e prever cenários complexos, exceptions e asserts realistas.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. O Padrão AAA
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Nossos testes seguem rigorosamente o padrão **Arrange, Act, Assert**:
                      </p>
                      <ul className="text-xs font-bold text-slate-500 space-y-2 list-disc list-inside">
                        <li><strong>Arrange:</strong> Prepare o cenário e os mocks.</li>
                        <li><strong>Act:</strong> Chame o método real.</li>
                        <li><strong>Assert:</strong> Valide se o resultado foi o esperado.</li>
                      </ul>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Segurança da Chave de API
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        Sua chave de API do Google AI Studio é salva apenas localmente no seu browser. Nós nunca temos acesso a ela em nossos servidores.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={() => setInput('')} className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"><Eraser className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden bg-muted/10">
          <div className="flex-1 flex gap-4 overflow-hidden">
            <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  Classe Java
                </span>
                <Button variant="ghost" size="icon" onClick={handlePaste} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language="java"
                  theme="vs-dark"
                  value={input}
                  onChange={(val) => setInput(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </Card>

            <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
                <h3 className="text-[9px] font-black uppercase text-indigo-700/70 tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  JUnit 5 + Mockito
                </h3>
                <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7 text-indigo-600 hover:text-indigo-700 transition-all">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language="java"
                  theme="vs-dark"
                  value={output}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    wordWrap: 'on',
                    automaticLayout: true,
                    readOnly: true,
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </Card>
          </div>

          <div className="flex items-center justify-center p-3 grow-0 bg-white shadow-xl shadow-slate-900/5 rounded-2xl border border-slate-100 gap-4">
            <Button variant="outline" onClick={handleGenerateLocal} disabled={isGenerating} className="h-10 px-8 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-slate-50 border-none group">
              <Code2 className="h-4 w-4 mr-2 text-blue-500 group-hover:scale-110 transition-all" />
              Gerar Esqueleto (Local)
            </Button>
            {status === 'invalid' && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse italic">Ajustes necessários no Painel...</span>}
            {status === 'valid' && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Processamento Concluído</span>}
          </div>
        </div>

        <div className="flex flex-1 p-8 gap-8 overflow-hidden bg-slate-50/50">
          <Card className="flex-1 flex flex-col border-none shadow-2xl shadow-slate-900/5 rounded-[2rem] overflow-hidden bg-white relative group">
            <div className="py-4 px-8 border-b border-slate-50 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-300 group-focus-within:bg-blue-600 transition-colors" />
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Entrada: Classe Java</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={handlePaste} className="h-8 w-8 text-slate-300 hover:text-blue-600 transition-all"><ClipboardPaste className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 relative p-2">
              <Editor
                height="100%"
                language="java"
                theme="vs-dark"
                value={input}
                onChange={(val) => setInput(val || '')}
                onMount={(editor) => { editorInputRef.current = editor; }}
                options={{ 
                  minimap: { enabled: false }, 
                  fontSize: 14, 
                  wordWrap: 'on', 
                  automaticLayout: true,
                  padding: { top: 20 },
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>

          <Card className="flex-1 flex flex-col border-none shadow-2xl shadow-slate-900/5 rounded-[2rem] overflow-hidden bg-white relative group">
            <div className="py-4 px-8 border-b border-slate-50 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-300 group-focus-within:bg-indigo-600 transition-colors" />
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Saída: Mockito Test</h3>
              </div>
              <Button onClick={handleCopy} variant="ghost" className="h-8 px-4 text-[9px] font-black uppercase tracking-widest gap-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-xl" disabled={status !== 'valid'}><Copy className="h-4 w-4" /> Copiar</Button>
            </div>
            <div className="flex-1 relative p-2">
              <Editor
                height="100%"
                language="java"
                theme="vs-dark"
                value={output}
                onMount={(editor) => { editorOutputRef.current = editor; }}
                options={{ 
                  minimap: { enabled: false }, 
                  fontSize: 14, 
                  wordWrap: 'on', 
                  automaticLayout: true, 
                  readOnly: true,
                  padding: { top: 20 },
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}

// LÓGICA CORE: REGEX PARSER / BOILERPLATE GENERATOR
function generateJUnitBoilerplate(javaCode: string): string {
  if (!javaCode.trim()) return '// Cole sua classe Java no painel ao lado para gerar os testes...';

  // Extract Package
  const pkgMatch = javaCode.match(/package\s+([\w\.]+);/);
  const pkg = pkgMatch ? pkgMatch[1] : '';

  // Extract Class Name
  const classMatch = javaCode.match(/(?:public|protected|private)?\s*(?:abstract|final)?\s*class\s+(\w+)/);
  if (!classMatch) return '// Classe Java não detectada ou inválida...';

  const className = classMatch[1];

  // Extract private fields (dependencies for mocks)
  const fieldRegex = /private\s+(?:final\s+)?([\w<>, ?]+)\s+(\w+)\s*;/g;
  let match;
  const fields: Array<{ type: string, name: string }> = [];
  while ((match = fieldRegex.exec(javaCode)) !== null) {
    fields.push({ type: match[1].trim(), name: match[2].trim() });
  }

  // Extract public methods (for tests)
  // Capture 1: Return Type, Capture 2: Name, Capture 3: Parameters
  const methodRegex = /public\s+(?:(?:<[^>]+>\s+)?)([\w<>\[\]?]+)\s+(\w+)\s*\(([^)]*)\)/g;
  const methods: Array<{ returnType: string; name: string; params: string }> = [];
  while ((match = methodRegex.exec(javaCode)) !== null) {
    const returnType = match[1];
    const mName = match[2];
    const params = match[3];
    if (mName !== className) {
      methods.push({ returnType, name: mName, params });
    }
  }

  const getDefaultValueForType = (type: string) => {
    const t = type.trim();
    if (['int', 'long', 'double', 'float', 'short', 'byte'].includes(t)) return '0';
    if (t === 'boolean') return 'false';
    if (t === 'String') return '""';
    if (t === 'char') return "'\\u0000'";
    return `null`;
  };

  // Generate Output
  let output = '';

  if (pkg) {
    output += `package ${pkg};\n\n`;
  }

  output += `import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ${className}Test {

`;

  if (fields.length > 0) {
    fields.forEach(f => {
      output += `    @Mock\n    private ${f.type} ${f.name};\n\n`;
    });
  }

  output += `    @InjectMocks\n    private ${className} target;\n\n`;

  if (methods.length > 0) {
    const uniqueMethodsMap = new Map();
    methods.forEach(m => {
      if (!uniqueMethodsMap.has(m.name)) {
        uniqueMethodsMap.set(m.name, m);
      }
    });

    Array.from(uniqueMethodsMap.values()).forEach(m => {
      const capitalizedM = m.name.charAt(0).toUpperCase() + m.name.slice(1);

      let arrangeBlock = '';
      let actArgs = '';

      const paramList = m.params.split(',').map((p: string) => p.trim()).filter(Boolean);
      if (paramList.length > 0) {
        actArgs = paramList.map((p: string) => {
          const parts = p.split(/\s+/);
          const pName = parts[parts.length - 1];
          const pType = parts.slice(0, -1).join(' ');

          arrangeBlock += `        ${pType} ${pName} = ${getDefaultValueForType(pType)}; // TODO: Inicialize os valores corretamente\n`;
          return pName;
        }).join(', ');
      }

      let mockBehaviors = '';
      if (fields.length > 0) {
         mockBehaviors = `        // TODO: Simule comportamentos dos mocks (se necessário)\n        // when(${fields[0].name}.algumMetodo(any())).thenReturn(resultadoEsperado);\n\n`;
      }

      let actBlock = '';
      let assertBlock = '';

      if (m.returnType === 'void') {
        actBlock = `        target.${m.name}(${actArgs});`;
        assertBlock = `        // TODO: Valide os side-effects (ex: interações com o repositório)\n        // verify(${fields.length > 0 ? fields[0].name : 'mockA'}, times(1)).algumMetodo();`;
      } else {
        actBlock = `        ${m.returnType} result = target.${m.name}(${actArgs});`;
        assertBlock = `        // TODO: Substitua pelo assert correspondente\n        assertNotNull(result);\n        // assertEquals(esperado, result);`;
      }

      // CENÁRIO 1: Caminho Feliz
      output += `    @Test\n    @DisplayName("Deve executar ${m.name} com sucesso")\n    void shouldExecute${capitalizedM}Successfully() {\n        // Arrange\n${arrangeBlock ? arrangeBlock + '\n' : ''}${mockBehaviors}        // Act\n${actBlock}\n\n        // Assert\n${assertBlock}\n    }\n\n`;

      // CENÁRIO 2: Caminho de Exceção Clássico
      let exceptionMockBehaviors = '';
      if (fields.length > 0) {
         exceptionMockBehaviors = `        // TODO: Force um erro em uma dependência (ex: Repositório lançar banco fora)\n        // doThrow(new RuntimeException("Database error")).when(${fields[0].name}).algumMetodo();\n\n`;
      }

      let exceptionActBlock = `        // Act & Assert\n        RuntimeException exception = assertThrows(RuntimeException.class, () -> {\n            target.${m.name}(${actArgs});\n        });\n\n        // Validação da mensagem de erro e do fluxo interrompido\n        // assertEquals("Mensagem esperada", exception.getMessage());\n`;
      
      output += `    @Test\n    @DisplayName("Deve lançar exceção e interromper o fluxo quando ${m.name} falhar")\n    void shouldThrowExceptionWhen${capitalizedM}Fails() {\n        // Arrange\n${arrangeBlock ? arrangeBlock + '\n' : ''}${exceptionMockBehaviors}${exceptionActBlock}    }\n\n`;
    });
  } else {
    output += `    @Test\n    @DisplayName("Teste de inicialização do contexto")\n    void contextLoads() {\n        // Arrange\n\n        // Act\n\n        // Assert\n    }\n\n`;
  }

  output += `}\n`;

  return output;
}
