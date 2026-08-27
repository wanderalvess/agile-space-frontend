'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileJson, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Copy, 
  Search, 
  LayoutGrid,
  Settings2,
  Info,
  Braces,
  Code2,
  FileCode,
  Box,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- Validator Logic (Recursive implementation of JSON Schema basics) ---
interface ValidationError {
  path: string;
  message: string;
}

function validateJson(schema: any, data: any, path: string = ''): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') return [];

  // 1. Type Validation
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

    if (!expectedTypes.includes(actualType)) {
      errors.push({ path, message: `Esperava tipo "${expectedTypes.join(' ou ')}", mas recebeu "${actualType}"` });
      return errors; // Stop further validation for this node
    }
  }

  // 2. Enum Validation
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      errors.push({ path, message: `Valor deve ser um de: ${JSON.stringify(schema.enum)}` });
    }
  }

  // 3. Object Validation
  if (schema.type === 'object' || schema.properties) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      // Already caught by type validation, but being safe
    } else {
      // Required properties
      if (schema.required && Array.isArray(schema.required)) {
        schema.required.forEach((req: string) => {
          if (!(req in data)) {
            errors.push({ path: path ? `${path}.${req}` : req, message: `Propriedade obrigatória ausente` });
          }
        });
      }

      // Individual properties
      if (schema.properties) {
        Object.keys(schema.properties).forEach(key => {
          if (key in data) {
            errors.push(...validateJson(schema.properties[key], data[key], path ? `${path}.${key}` : key));
          }
        });
      }
    }
  }

  // 4. Array Validation
  if (schema.type === 'array' || schema.items) {
    if (Array.isArray(data)) {
      if (schema.items) {
        data.forEach((item, index) => {
          errors.push(...validateJson(schema.items, item, `${path}[${index}]`));
        });
      }
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        errors.push({ path, message: `Deve conter no mínimo ${schema.minItems} itens` });
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        errors.push({ path, message: `Deve conter no máximo ${schema.maxItems} itens` });
      }
    }
  }

  // 5. String Validation
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `Comprimento mínimo de ${schema.minLength} caracteres` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `Comprimento máximo de ${schema.maxLength} caracteres` });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({ path, message: `Valor não condiz com o padrão regex: ${schema.pattern}` });
      }
    }
  }

  // 6. Number Validation
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `Deve ser maior ou igual a ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `Deve ser menor ou igual a ${schema.maximum}` });
    }
  }

  return errors;
}

export default function JsonSchemaValidatorPage() {
  const { toast } = useToast();
  
  const [schemaText, setSchemaText] = useState(JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Exemplo de Usuário",
    "type": "object",
    "properties": {
      "id": { "type": "number" },
      "nome": { "type": "string", "minLength": 3 },
      "email": { "type": "string", "pattern": "^[\\\\w-\\\\.]+@([\\\\w-]+\\\\.)+[\\\\w-]{2,4}$" },
      "role": { "enum": ["admin", "user", "guest"] }
    },
    "required": ["id", "nome", "email"]
  }, null, 2));

  const [jsonText, setJsonText] = useState(JSON.stringify({
    "id": 1,
    "nome": "Agile Editor",
    "email": "contato@agile.space",
    "role": "admin"
  }, null, 2));

  const [validationResult, setValidationResult] = useState<{ errors: ValidationError[], isValid: boolean, syntaxError: string | null }>({
    errors: [],
    isValid: true,
    syntaxError: null
  });

  useEffect(() => {
    try {
      const schema = JSON.parse(schemaText);
      const data = JSON.parse(jsonText);
      const errors = validateJson(schema, data);
      setValidationResult({
        errors,
        isValid: errors.length === 0,
        syntaxError: null
      });
    } catch (e: any) {
      setValidationResult({
        errors: [],
        isValid: false,
        syntaxError: e.message
      });
    }
  }, [schemaText, jsonText]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a área de transferência!" });
  };

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white/60 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              JSON <span className="text-indigo-600">Schema Validator</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Validação Estrutural e de Conteúdo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn(
            "h-6 px-3 text-[9px] font-black uppercase tracking-widest transition-colors",
            validationResult.syntaxError ? "border-red-200 text-red-600 bg-red-50" : 
            validationResult.isValid ? "border-emerald-200 text-emerald-600 bg-emerald-50" : 
            "border-amber-200 text-amber-600 bg-amber-50"
          )}>
            {validationResult.syntaxError ? "Erro de Sintaxe" : validationResult.isValid ? "Válido" : "Falha na Validação"}
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Input Editors */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 grid grid-cols-2">
            
            {/* Schema Editor */}
            <div className="flex flex-col border-r bg-slate-50/20">
               <div className="px-4 py-2 border-b flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <Braces className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">JSON Schema</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(schemaText)} className="h-7 w-7 text-slate-300 hover:text-indigo-500">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
               </div>
               <Textarea 
                 value={schemaText}
                 onChange={(e) => setSchemaText(e.target.value)}
                 className="flex-1 border-none bg-transparent font-mono text-xs p-6 resize-none focus-visible:ring-0 selection:bg-indigo-100"
                 placeholder="Cole seu Schema aqui..."
               />
            </div>

            {/* Content Editor */}
            <div className="flex flex-col bg-white">
               <div className="px-4 py-2 border-b flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">JSON Content</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(jsonText)} className="h-7 w-7 text-slate-300 hover:text-emerald-500">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
               </div>
               <Textarea 
                 value={jsonText}
                 onChange={(e) => setJsonText(e.target.value)}
                 className="flex-1 border-none bg-transparent font-mono text-xs p-6 resize-none focus-visible:ring-0 selection:bg-emerald-100"
                 placeholder="Cole seu JSON para validar aqui..."
               />
            </div>

          </div>
        </section>

        {/* Right: Validation Results Sidebar */}
        <aside className="w-[400px] border-l bg-white flex flex-col shrink-0">
           <div className="p-6 border-b">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 mb-6">
                <ShieldCheck className="h-4 w-4" /> Relatório de Validação
              </h2>

              {validationResult.syntaxError ? (
                <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                   <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                      <AlertCircle className="h-6 w-6 text-white" />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xs font-black uppercase tracking-tighter text-red-600">Erro de Sintaxe JSON</h3>
                      <p className="text-[10px] text-red-500/80 font-bold leading-relaxed">{validationResult.syntaxError}</p>
                   </div>
                </div>
              ) : validationResult.isValid ? (
                <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                   <div className="w-16 h-16 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20 outline outline-8 outline-emerald-500/10">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-emerald-600 italic">Estrutura Íntegra</h3>
                      <p className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest">O conteúdo condiz com o schema.</p>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-center gap-4">
                     <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-md">
                        <AlertCircle className="h-5 w-5 text-white" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-tighter italic">Incompatibilidade</span>
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{validationResult.errors.length} erro(s) encontrados</span>
                     </div>
                  </div>
                </div>
              )}
           </div>

           <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {validationResult.errors.map((error, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-amber-200 hover:bg-white transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                       <Box className="h-3 w-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                       <span className="text-[9px] font-mono font-black text-slate-400 group-hover:text-slate-600 transition-colors truncate">
                          {error.path || 'root'}
                       </span>
                    </div>
                    <div className="flex items-start gap-2">
                       <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                       <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase">{error.message}</p>
                    </div>
                  </div>
                ))}
                {!validationResult.errors.length && !validationResult.syntaxError && (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-200 gap-2 select-none">
                     <Settings2 className="h-8 w-8 opacity-10" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Aguardando Validação</span>
                  </div>
                )}
              </div>
           </ScrollArea>

           <div className="p-6 bg-slate-50/50 border-t space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                 <Info className="h-3.5 w-3.5" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Dica Técnica</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed tracking-tight italic">
                O Agile Schema Validator suporta restrições de tipos, strings (min/max/regex), números (min/max) e enums.
              </p>
           </div>
        </aside>
      </main>
    </div>
  );
}
