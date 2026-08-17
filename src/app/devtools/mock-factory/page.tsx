'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Play, 
  Copy, 
  Trash, 
  FileJson, 
  ChevronRight,
  Settings,
  Table as TableIcon,
  Layers,
  Sparkles,
  Download,
  FileCode as FileCodeIcon,
  RefreshCcw,
  HelpCircle,
  Code2
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { faker } from '@faker-js/faker';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FeedbackWidget } from '@/components/feedback-widget';

type FieldType = 
  | 'uuid' 
  | 'fullName' 
  | 'firstName' 
  | 'email' 
  | 'phone' 
  | 'cpf' 
  | 'datePast' 
  | 'boolean' 
  | 'paragraph' 
  | 'word' 
  | 'integer';

interface Field {
  id: string;
  name: string;
  type: FieldType;
  maxLength?: number;
}

const FIELD_TYPES: { label: string; value: FieldType }[] = [
  { label: 'UUID / ID', value: 'uuid' },
  { label: 'Nome Completo', value: 'fullName' },
  { label: 'Primeiro Nome', value: 'firstName' },
  { label: 'Email', value: 'email' },
  { label: 'Telefone', value: 'phone' },
  { label: 'CPF (Documento)', value: 'cpf' },
  { label: 'Data Passada', value: 'datePast' },
  { label: 'Booleano', value: 'boolean' },
  { label: 'Parágrafo', value: 'paragraph' },
  { label: 'Palavra Aleatória', value: 'word' },
  { label: 'Número Inteiro', value: 'integer' },
];

export default function MockFactoryPage() {
  const { toast } = useToast();
  const [tableName, setTableName] = useState('usuarios');
  const [rowCount, setRowCount] = useState(10);
  const [format, setFormat] = useState<'json' | 'sql'>('json');
  const [schema, setSchema] = useState<Field[]>([
    { id: crypto.randomUUID(), name: 'id', type: 'uuid' },
    { id: crypto.randomUUID(), name: 'nome', type: 'fullName' },
    { id: crypto.randomUUID(), name: 'email', type: 'email' },
    { id: crypto.randomUUID(), name: 'ativo', type: 'boolean' },
  ]);
  const [output, setOutput] = useState('');
  
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [ddlInput, setDdlInput] = useState('');

  const parseDDL = () => {
    try {
      if (!ddlInput.trim()) return;

      // 1. Extrair Nome da Tabela (Suporte a Schema: "LOCAL"."TABELA" ou TABELA)
      const tableMatch = ddlInput.match(/CREATE TABLE (?:\w+ \. )?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?/i);
      if (tableMatch) {
        setTableName(tableMatch[1]);
      }

      // 2. Extrair Bloco de Colunas (dentro do primeiro (...))
      const firstParen = ddlInput.indexOf('(');
      const lastParen = ddlInput.lastIndexOf(')');
      if (firstParen === -1 || lastParen === -1) {
        toast({ title: "Erro no SQL", description: "Não foi possível encontrar a definição das colunas.", variant: "destructive" });
        return;
      }

      const columnsPart = ddlInput.substring(firstParen + 1, lastParen);
      
      // Split inteligente por vírgulas (ignorando vírgulas dentro de parênteses como VARCHAR(255))
      const lines: string[] = [];
      let currentLine = "";
      let parenCount = 0;

      for (let char of columnsPart) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === ',' && parenCount === 0) {
          lines.push(currentLine.trim());
          currentLine = "";
        } else {
          currentLine += char;
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());

      const newSchema: Field[] = [];

      lines.forEach(line => {
        // Ignorar constraints como PRIMARY KEY, UNIQUE, CONSTRAINT...
        const upperLine = line.toUpperCase().trim();
        if (upperLine.startsWith('PRIMARY KEY') || 
            upperLine.startsWith('UNIQUE') || 
            upperLine.startsWith('CONSTRAINT') ||
            upperLine.startsWith('FOREIGN KEY') ||
            upperLine === ')') return;

        const parts = line.split(/\s+/).filter(p => p.length > 0);
        if (parts.length < 2) return;

        const colName = parts[0].replace(/["`]/g, '');
        const colTypeRaw = parts[1].toUpperCase();
        const colType = colTypeRaw.split('(')[0];
        
        // Extrair tamanho (ex: VARCHAR(255) -> 255)
        const sizeMatch = colTypeRaw.match(/\((\d+)(?:,\d+)?\)/);
        const maxLength = sizeMatch ? parseInt(sizeMatch[1]) : undefined;

        let fakerType: FieldType = 'word';

        // Mapeamento Inteligente (Suporte a Oracle: NUMBER, VARCHAR2)
        if (colType.includes('UUID')) {
          fakerType = 'uuid';
        } else if (colType.includes('INT') || colType.includes('SERIAL') || colType.includes('NUMERIC') || colType.includes('DECIMAL') || colType.includes('NUMBER')) {
          fakerType = 'integer';
        } else if (colType.includes('DATE') || colType.includes('TIME') || colType.includes('TIMESTAMP')) {
          fakerType = 'datePast';
        } else if (colType.includes('BOOL') || colType.includes('TINYINT')) {
          fakerType = 'boolean';
        } else if (colType.includes('CHAR') || colType.includes('TEXT') || colType.includes('STRING') || colType.includes('VARCHAR')) {
          const lowerCol = colName.toLowerCase();
          if (lowerCol.includes('email')) fakerType = 'email';
          else if (lowerCol.includes('nome') || lowerCol.includes('name')) fakerType = 'fullName';
          else if (lowerCol.includes('cpf') || lowerCol.includes('doc')) fakerType = 'cpf';
          else if (lowerCol.includes('fone') || lowerCol.includes('phone') || lowerCol.includes('tel')) fakerType = 'phone';
          else fakerType = 'word';
        }

        newSchema.push({
          id: crypto.randomUUID(),
          name: colName,
          type: fakerType,
          maxLength
        });
      });

      if (newSchema.length > 0) {
        setSchema(newSchema);
        setIsImportOpen(false);
        setDdlInput('');
        toast({ title: "Importação Mágica ✨", description: `${newSchema.length} colunas mapeadas com sucesso.` });
      } else {
        toast({ title: "Aviso", description: "Nenhuma coluna válida foi encontrada para mapear.", variant: "destructive" });
      }

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao Processar", description: "Verifique a sintaxe DDL informada.", variant: "destructive" });
    }
  };

  const addField = () => {
    setSchema([...schema, { id: crypto.randomUUID(), name: 'novo_campo', type: 'word' }]);
  };

  const removeField = (id: string) => {
    if (schema.length > 1) {
      setSchema(schema.filter(f => f.id !== id));
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const editorRef = React.useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  const updateField = (id: string, updates: Partial<Field>) => {
    setSchema(schema.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const generateData = useCallback(() => {
    if (schema.some(f => !f.name.trim())) {
      toast({ title: 'Erro de Validação', description: 'Todos os campos devem ter um nome.', variant: 'destructive' });
      return;
    }

    const totalCount = Math.min(Math.max(1, rowCount), 1000);
    const chunkSize = 100;
    const allRecords: any[] = [];
    let processedCount = 0;

    setIsGenerating(true);
    console.time('GenerateMockData');

    const processChunk = () => {
      const remaining = totalCount - processedCount;
      const currentChunkSize = Math.min(chunkSize, remaining);

      for (let i = 0; i < currentChunkSize; i++) {
        const record: any = {};
        schema.forEach(field => {
          let val: any;
          switch (field.type) {
            case 'uuid': val = faker.string.uuid(); break;
            case 'fullName': val = faker.person.fullName(); break;
            case 'firstName': val = faker.person.firstName(); break;
            case 'email': val = faker.internet.email(); break;
            case 'phone': val = faker.phone.number(); break;
            case 'cpf': val = faker.string.numeric(11); break;
            case 'datePast': val = faker.date.past().toISOString(); break;
            case 'boolean': val = faker.datatype.boolean(); break;
            case 'paragraph': val = faker.lorem.paragraph(); break;
            case 'word': val = faker.lorem.word(); break;
            case 'integer': 
              if (field.maxLength) {
                const max = Math.pow(10, field.maxLength) - 1;
                val = faker.number.int({ max });
              } else {
                val = faker.number.int({ max: 1000 });
              }
              break;
          }

          if (field.maxLength && typeof val === 'string' && field.type !== 'datePast' && field.type !== 'uuid') {
            val = val.substring(0, field.maxLength);
          }
          record[field.name] = val;
        });
        allRecords.push(record);
        processedCount++;
      }

      if (processedCount < totalCount) {
        // Permitir que a Main Thread respire
        setTimeout(processChunk, 0);
      } else {
        // Finalizar
        console.timeEnd('GenerateMockData');
        setIsGenerating(false);
        
        if (format === 'json') {
          setOutput(JSON.stringify(allRecords, null, 2));
        } else {
          const columns = schema.map(f => f.name).join(', ');
          const values = allRecords.map(record => {
            const rowValues = schema.map(field => {
              const val = record[field.name];
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            }).join(', ');
            return `(${rowValues})`;
          }).join(',\n  ');

          setOutput(`INSERT INTO ${tableName} (${columns}) \nVALUES \n  ${values};`);
        }
        toast({ title: 'Sucesso!', description: `${totalCount} registros gerados com processamento assíncrono.` });
      }
    };

    processChunk();
  }, [schema, rowCount, format, tableName, toast]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    toast({ title: 'Copiado!', description: 'Dados copiados para a área de transferência.' });
  };

  const clearOutput = () => setOutput('');

  return (
    <div className="flex-1 flex flex-col bg-background h-dvh overflow-hidden">
      <header className="px-6 py-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600 rounded-lg shadow-lg shadow-orange-600/20 translate-y-[-1px]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">Fábrica de Dados</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">GERADOR DE MASSA DE TESTE (MOCK)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all rounded-xl">
                <HelpCircle className="h-4 w-4" />
                GUIA
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
              <SheetHeader className="shrink-0 border-b p-8 bg-white">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                  Fábrica de Dados
                </SheetTitle>
                <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                  Geração em massa de dados fake (Mock) para testes e demos
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 text-slate-600">
                <div className="p-8 space-y-10">
                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2 italic">
                      01. Por que gerar Mocks?
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Desenvolver interfaces e APIs sem dados reais é difícil. A Fábrica de Dados permite criar centenas de registros realistas (nomes, emails, CPFs) em segundos, garantindo que seu front-end suporte paginação e layouts complexos.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2 italic">
                       02. Mapeamento de Colunas (DDL)
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                       Não perca tempo configurando campo por campo. Cole o seu script <strong>CREATE TABLE</strong> de produção e o mapeamento automático irá configurar os nomes das colunas e os tipos de dados correspondentes.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2 italic">
                      03. Formatos de Saída
                    </h3>
                    <div className="space-y-3">
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col gap-1">
                        <p className="font-black text-[10px] uppercase tracking-widest text-slate-800">JSON Array</p>
                        <p className="text-xs text-slate-400 font-bold">Ideal para mocar APIs REST ou popular bancos NoSQL.</p>
                      </div>
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col gap-1">
                        <p className="font-black text-[10px] uppercase tracking-widest text-slate-800">SQL Inserts</p>
                        <p className="text-xs text-slate-400 font-bold">Gera scripts INSERT prontos para rodar no Oracle, Postgres ou MySQL.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-6 bg-orange-50/50 rounded-[2rem] border border-orange-100">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2 italic">
                      Dica de Performance
                    </h3>
                    <p className="text-[11px] text-orange-800/80 font-bold leading-relaxed">
                      Você pode gerar até 1000 registros por vez. O processamento é assíncrono para garantir que sua aba não trave durante a criação de grandes massas.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button 
            onClick={generateData}
            disabled={isGenerating}
            className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-orange-600/20 rounded-xl"
          >
            {isGenerating ? (
              <>
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Dados ✨
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Painel de Configuração */}
        <aside className="w-1/3 border-r bg-muted/5 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8">
              {/* Configurações Básicas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Configurações Gerais</span>
                  </div>
                  
                  <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[9px] font-black uppercase tracking-widest gap-2 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-all rounded-lg"
                      >
                        <Download className="h-3 w-3" />
                        📥 Importar DDL (SQL)
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] rounded-3xl border-white/10 bg-card/90 backdrop-blur-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                           <FileCodeIcon className="h-5 w-5 text-primary" />
                           Importação Mágica de DDL
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                          Cole seu script <span className="text-primary font-bold">CREATE TABLE</span> abaixo. Nós iremos analisar o nome da tabela, os campos e os tipos para configurar sua fábrica automaticamente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Textarea 
                          placeholder="CREATE TABLE IF NOT EXISTS usuarios (&#10;  id UUID PRIMARY KEY,&#10;  nome_completo VARCHAR(255) NOT NULL,&#10;  email VARCHAR(100) UNIQUE,&#10;  data_cadastro TIMESTAMP DEFAULT NOW()&#10;);" 
                          className="min-h-[250px] font-mono text-[11px] bg-muted/10 border-white/5 focus-visible:ring-1 focus-visible:ring-primary/20 leading-relaxed scrollbar-thin rounded-2xl"
                          value={ddlInput}
                          onChange={(e) => setDdlInput(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" className="font-bold text-[10px] uppercase rounded-xl" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
                        <Button 
                          onClick={parseDDL}
                          disabled={!ddlInput.trim()}
                          className="font-black text-[10px] uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 px-8 rounded-xl shadow-lg shadow-primary/20"
                        >
                          Analisar e Importar ✨
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Nome da Tabela</Label>
                    <Input 
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="h-9 font-bold bg-white text-xs border-muted-foreground/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Qtd. Registros</Label>
                    <Input 
                      type="number"
                      value={rowCount}
                      onChange={(e) => setRowCount(Number(e.target.value))}
                      className="h-9 font-bold bg-white text-xs border-muted-foreground/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Formato de Saída</Label>
                  <Tabs value={format} onValueChange={(v: any) => setFormat(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
                      <TabsTrigger value="json" className="font-bold text-[10px] uppercase">JSON</TabsTrigger>
                      <TabsTrigger value="sql" className="font-bold text-[10px] uppercase">SQL Insert</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {/* Construtor de Schema */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-orange-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Schema Builder</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addField}
                    className="h-7 text-[9px] font-black uppercase tracking-widest border-orange-600/20 text-orange-600 hover:bg-orange-600 hover:text-white transition-all rounded-lg"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {schema.map((field, idx) => (
                    <Card key={field.id} className="p-3 bg-white border-muted-foreground/10 shadow-sm relative group overflow-hidden">
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-col gap-1.5 flex-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[8px] font-black text-muted-foreground/40 uppercase">Coluna</Label>
                            {field.maxLength && (
                              <span className="text-[7px] font-black bg-orange-600/10 text-orange-600 px-1 rounded uppercase tracking-tighter">
                                MAX: {field.maxLength}
                              </span>
                            )}
                          </div>
                          <Input 
                            value={field.name}
                            onChange={(e) => updateField(field.id, { name: e.target.value })}
                            className="h-8 text-[11px] font-bold border-none bg-muted/20 focus-visible:ring-1 focus-visible:ring-orange-600/20"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-[1.2]">
                          <Label className="text-[8px] font-black text-muted-foreground/40 uppercase">Tipo Faker</Label>
                          <Select 
                            value={field.type} 
                            onValueChange={(v: any) => updateField(field.id, { type: v })}
                          >
                            <SelectTrigger className="h-8 text-[10px] font-bold border-none bg-muted/20 focus:ring-1 focus:ring-orange-600/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value} className="text-[10px] font-medium">
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeField(field.id)}
                          className="h-8 w-8 mt-4 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          disabled={schema.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Editor de Saída */}
        <section className="flex-1 flex flex-col bg-muted/10 relative p-4 overflow-hidden">
          <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                Preview Gerado
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={copyToClipboard} disabled={!output} className="h-7 w-7 text-muted-foreground hover:text-primary"><Copy className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={clearOutput} disabled={!output} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={format === 'json' ? 'json' : 'sql'}
                value={output}
                theme="vs-dark"
                onMount={handleEditorDidMount}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 11,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  wordWrap: 'on'
                }}
              />
            </div>
          </Card>
        </section>
      </main>

      <FeedbackWidget toolName="Fábrica de Mocks" />
    </div>
  );
}
