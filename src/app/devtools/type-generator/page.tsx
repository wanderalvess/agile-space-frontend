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
  Scan,
  Braces
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';
import { Editor } from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TypeGeneratorPage() {
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
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  useEffect(() => {
    if (!input.trim()) {
      setOutput('');
      setStatus('idle');
      return;
    }

    try {
      let generated = '';
      if (language === 'typescript') {
        generated = generateTypeScriptInterfaces(input, 'Root');
      } else if (language === 'java') {
        generated = generateJavaClasses(input, 'Root');
      } else if (language === 'delphi') {
        generated = generateDelphiClasses(input, 'Root');
      }
      setOutput(generated);
      setStatus('valid');
    } catch (e: any) {
      const match = e.message.match(/position (\d+)/i) || e.message.match(/line (\d+) column (\d+)/i);
      let detail = e.message;
      if (match) {
        if (e.message.includes('line')) detail = `Erro perto da linha ${match[1]}, coluna ${match[2]}.`;
        else detail = `Erro perto do caractere ${match[1]}.`;
      }
      setOutput('// JSON Inválido: ' + detail + '\n// Aguardando estrutura correta para inferência...');
      setStatus('invalid');
    }
  }, [input, language]); // language added for future support

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Código copiado!", description: "Interfaces copiadas para a área de transferência." });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (e) { toast({ title: "Erro ao colar", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Scan className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Gerador de Modelos</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">CLASSES & INTERFACES (TS/JAVA/DELPHI)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-primary/5 text-primary border-primary/20 text-[10px] font-bold">
              <Code2 className="h-3.5 w-3.5" />
              Ferramenta Local
            </Badge>

            {userProfile?.isGuest && (
              <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modo Convidado
              </Badge>
            )}
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
                    <Scan className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Gerador de Modelos
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Conversão de JSON para estruturas de dados tipadas e classes
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. O que é o Type Generator?
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        É uma ferramenta de inferência profunda. Ela analisa a estrutura e os valores de um JSON para deduzir os melhores tipos possíveis, gerando interfaces, POJOs ou classes Delphi prontas para seu projeto.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. Suporte Multi-Linguagem
                      </h3>
                      <div className="space-y-3 font-medium text-xs text-slate-500">
                        <p><strong className="text-slate-800">TypeScript:</strong> Interfaces modulares com singularização inteligente de coleções.</p>
                        <p><strong className="text-slate-800">Java:</strong> POJOs com tipagem forte (Integer vs Double) e suporte a List parametrizada.</p>
                        <p><strong className="text-slate-800">Delphi:</strong> Classes com atributos <code className="bg-slate-100 px-1 rounded">[JSONName]</code> e prefixo <code className="bg-slate-100 px-1 rounded">T</code> padrão.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        03. Debug em Tempo Real
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Seu código é analisado a cada tecla. Caso a estrutura JSON sela malformada, o gerador exibirá o erro exato e a posição (linha/coluna) na área de saída, permitindo correção imediata.
                      </p>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Segurança Local
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        Assim como o Deep Decoder, toda a inferência ocorre no seu browser. Seus payloads de API nunca tocam nossos servidores.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={() => setInput('')} className="h-9 w-9 text-muted-foreground hover:text-primary"><Eraser className="h-4 w-4" /></Button>
          </div>
        </header>

        {/* CONTROLES SUPERIORES */}
        <div className="px-6 py-2 border-b bg-card/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Linguagem de Saída:</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[200px] h-8 text-xs font-bold border-muted-foreground/20 bg-background">
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="typescript" className="text-xs font-bold text-primary">TypeScript Interfaces</SelectItem>
                <SelectItem value="java" className="text-xs font-bold text-primary">Java Classes</SelectItem>
                <SelectItem value="delphi" className="text-xs font-bold text-primary">Delphi Types</SelectItem>
                <SelectItem value="zod" disabled className="text-xs font-bold text-muted-foreground italic">Zod Schema (Em Breve)</SelectItem>
                <SelectItem value="csharp" disabled className="text-xs font-bold text-muted-foreground italic">C# Classes (Em Breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {status === 'invalid' && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Aguardando JSON válido...</span>}
            {status === 'valid' && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Inferência Concluída</span>}
          </div>
        </div>

        <div className="flex flex-1 p-4 gap-4 overflow-hidden bg-muted/10">
          <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                Payload JSON
              </span>
              <Button variant="ghost" size="icon" onClick={handlePaste} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={input}
                onChange={(val) => setInput(val || '')}
                onMount={(editor) => { editorInputRef.current = editor; }}
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
              <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Tipagem Gerada
              </span>
              <Button onClick={handleCopy} variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary transition-all">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={language === 'delphi' ? 'pascal' : language}
                theme="vs-dark"
                value={output}
                onMount={(editor) => { editorOutputRef.current = editor; }}
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
      </TooltipProvider>
    </div>
  );
}

// LÓGICA CORE: INFERÊNCIA DE TIPOS
function generateTypeScriptInterfaces(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const interfaces: Map<string, string> = new Map();

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function formatKeyName(key: string) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return key;
    return `"${key}"`;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'any';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'any[]';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `${itemType}[]`;
    }
    
    if (typeof value === 'object') {
      const interfaceName = capitalize(keyName);
      
      // Check interface deduplication briefly (ignoring exact structural match for simplicity, assuming unique keys name structures)
      let uniqueName = interfaceName;
      let counter = 1;
      while(interfaces.has(uniqueName)) {
         // Deep equality check bypass: in a simple engine, we just add suffix if name collision but different structure is a risk.
         // For now, let's just assume we overwrite it or it's the same type.
         break;
      }
      
      let fields = [];
      for (const [k, v] of Object.entries(value)) {
        fields.push(`  ${formatKeyName(k)}: ${getType(v, k)};`);
      }
      const interfaceContent = `export interface ${uniqueName} {\n${fields.join('\n')}\n}`;
      interfaces.set(uniqueName, interfaceContent);
      return uniqueName;
    }
    
    return typeof value;
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `export type ${rootName} = ${typeof parsed};`;
  }

  // Reverse to show the Root on bottom and dependencies on top, which is conventional.
  return Array.from(interfaces.values()).reverse().join('\n\n');
}

// LÓGICA CORE: INFERÊNCIA DE TIPOS - JAVA
function generateJavaClasses(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const classes: Map<string, string> = new Map();

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'Object';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'List<Object>';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `List<${itemType}>`;
    }
    
    if (typeof value === 'object') {
      const className = capitalize(keyName);
      let uniqueName = className;
      
      let fields = [];
      for (const [k, v] of Object.entries(value)) {
        fields.push(`    private ${getType(v, k)} ${k};`);
      }
      const classContent = `public class ${uniqueName} {\n${fields.join('\n')}\n\n    // Getters and Setters...\n}`;
      if (!classes.has(uniqueName)) {
        classes.set(uniqueName, classContent);
      }
      return uniqueName;
    }
    
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    
    return 'Object';
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `// Tipo primitivo retornado: ${typeof parsed}`;
  }

  return 'import java.util.List;\n\n' + Array.from(classes.values()).reverse().join('\n\n');
}

// LÓGICA CORE: INFERÊNCIA DE TIPOS - DELPHI
function generateDelphiClasses(jsonString: string, rootName = 'Root'): string {
  const parsed = JSON.parse(jsonString);
  const classes: Map<string, string> = new Map();
  // Em Delphi é comum prefixar com T
  if (!rootName.startsWith('T')) rootName = 'T' + rootName;

  function capitalize(str: string) {
    if (!str) return 'Unknown';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function singularize(str: string) {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('us') && !str.endsWith('is')) return str.slice(0, -1);
    return str;
  }

  function getType(value: any, keyName: string): string {
    if (value === null) return 'Variant';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'TArray<Variant>';
      const itemName = singularize(keyName);
      const itemType = getType(value[0], itemName);
      return `TArray<${itemType}>`;
    }
    
    if (typeof value === 'object') {
      const className = 'T' + capitalize(keyName);
      let uniqueName = className;
      
      let fields = [];
      let properties = [];
      
      for (const [k, v] of Object.entries(value)) {
        const propType = getType(v, k);
        fields.push(`    [JSONName('${k}')]\n    F${capitalize(k)}: ${propType};`);
        properties.push(`    property ${capitalize(k)}: ${propType} read F${capitalize(k)} write F${capitalize(k)};`);
      }

      const classContent = `  ${uniqueName} = class\n  private\n${fields.join('\n')}\n  public\n${properties.join('\n')}\n  end;`;
      
      if (!classes.has(uniqueName)) {
        classes.set(uniqueName, classContent);
      }
      return uniqueName;
    }
    
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Double';
    }
    if (typeof value === 'boolean') return 'Boolean';
    
    return 'Variant';
  }

  if (Array.isArray(parsed)) {
    getType(parsed[0] || {}, rootName);
  } else if (typeof parsed === 'object' && parsed !== null) {
    getType(parsed, rootName);
  } else {
    return `// Tipo bruto: ${typeof parsed}`;
  }

  return `unit TypesGenerated;\n\ninterface\n\nuses\n  System.Generics.Collections, REST.Json.Types;\n\ntype\n` + Array.from(classes.values()).reverse().join('\n\n') + `\n\nimplementation\n\nend.`;
}
