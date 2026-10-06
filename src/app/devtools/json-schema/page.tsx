'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { cn } from '@/lib/utils';

type Json = unknown;
interface ValidationError { path: string; message: string }

const SAMPLE_JSON = JSON.stringify({ id: 1, nome: 'Agile Editor', email: 'contato@agile.space', role: 'admin', tags: ['qa', 'api'] }, null, 2);
const SAMPLE_SCHEMA = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Exemplo de Usuário',
  type: 'object',
  properties: {
    id: { type: 'integer' },
    nome: { type: 'string', minLength: 3 },
    email: { type: 'string', pattern: '^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,}$' },
    role: { enum: ['admin', 'user', 'guest'] },
    tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  required: ['id', 'nome', 'email'],
}, null, 2);

// ---- Geração de schema a partir de um exemplo ---------------------------
// Todas as propriedades vistas viram "required"; arrays heterogêneos usam anyOf.
function typeOf(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function inferSchema(v: Json): Record<string, unknown> {
  const t = typeOf(v);
  if (t === 'object') {
    const obj = v as Record<string, Json>;
    return { type: 'object', properties: Object.fromEntries(Object.entries(obj).map(([k, val]) => [k, inferSchema(val)])), required: Object.keys(obj) };
  }
  if (t === 'array') {
    const arr = v as Json[];
    if (arr.length === 0) return { type: 'array' };
    const distinct = new Set(arr.map(x => JSON.stringify(inferSchema(x))));
    const list = [...distinct].map(s => JSON.parse(s));
    return { type: 'array', items: list.length === 1 ? list[0] : { anyOf: list } };
  }
  return { type: t };
}

// ---- Validador (subset do draft-07) -------------------------------------
// O legado cobria type/enum/required/properties/items/min/max/pattern. Acrescentei:
// integer (o legado rejeitava), const, additionalProperties:false, anyOf/oneOf,
// uniqueItems, exclusiveMin/Max e multipleOf.
function matchesType(expected: string, data: Json): boolean {
  const actual = typeOf(data);
  return expected === actual || (expected === 'number' && actual === 'integer');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function validate(schema: Json, data: Json, path = ''): ValidationError[] {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, any>;
  const errors: ValidationError[] = [];
  const at = (msg: string, p = path) => errors.push({ path: p, message: msg });

  if (s.type) {
    const expected: string[] = Array.isArray(s.type) ? s.type : [s.type];
    if (!expected.some(t => matchesType(t, data))) {
      at(`Esperava tipo "${expected.join(' ou ')}", mas recebeu "${typeOf(data)}"`);
      return errors; // sem o tipo certo, o resto não faz sentido
    }
  }
  if (Array.isArray(s.enum) && !s.enum.some((e: Json) => JSON.stringify(e) === JSON.stringify(data))) {
    at(`Valor deve ser um de: ${JSON.stringify(s.enum)}`);
  }
  if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(data)) at(`Valor deve ser igual a ${JSON.stringify(s.const)}`);

  if (Array.isArray(s.anyOf) && !s.anyOf.some((sub: Json) => validate(sub, data, path).length === 0)) at('Não atende a nenhuma das opções (anyOf)');
  if (Array.isArray(s.oneOf)) {
    const n = s.oneOf.filter((sub: Json) => validate(sub, data, path).length === 0).length;
    if (n !== 1) at(`Deve atender exatamente uma das opções (oneOf); atendeu ${n}`);
  }

  if (typeOf(data) === 'object') {
    const obj = data as Record<string, Json>;
    for (const req of Array.isArray(s.required) ? s.required : []) {
      if (!(req in obj)) at('Propriedade obrigatória ausente', path ? `${path}.${req}` : req);
    }
    const props = s.properties ?? {};
    for (const key of Object.keys(props)) {
      if (key in obj) errors.push(...validate(props[key], obj[key], path ? `${path}.${key}` : key));
    }
    if (s.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!(key in props)) at('Propriedade não permitida', path ? `${path}.${key}` : key);
    }
  }

  if (Array.isArray(data)) {
    if (s.items && !Array.isArray(s.items)) data.forEach((item, i) => errors.push(...validate(s.items, item, `${path}[${i}]`)));
    if (s.minItems !== undefined && data.length < s.minItems) at(`Deve conter no mínimo ${s.minItems} itens`);
    if (s.maxItems !== undefined && data.length > s.maxItems) at(`Deve conter no máximo ${s.maxItems} itens`);
    if (s.uniqueItems && new Set(data.map(d => JSON.stringify(d))).size !== data.length) at('Os itens devem ser únicos');
  }

  if (typeof data === 'string') {
    if (s.minLength !== undefined && data.length < s.minLength) at(`Comprimento mínimo de ${s.minLength} caracteres`);
    if (s.maxLength !== undefined && data.length > s.maxLength) at(`Comprimento máximo de ${s.maxLength} caracteres`);
    if (s.pattern) {
      try {
        if (!new RegExp(s.pattern).test(data)) at(`Valor não condiz com o padrão: ${s.pattern}`);
      } catch {
        at(`Padrão regex inválido no schema: ${s.pattern}`);
      }
    }
  }

  if (typeof data === 'number') {
    if (s.minimum !== undefined && data < s.minimum) at(`Deve ser maior ou igual a ${s.minimum}`);
    if (s.maximum !== undefined && data > s.maximum) at(`Deve ser menor ou igual a ${s.maximum}`);
    if (typeof s.exclusiveMinimum === 'number' && data <= s.exclusiveMinimum) at(`Deve ser maior que ${s.exclusiveMinimum}`);
    if (typeof s.exclusiveMaximum === 'number' && data >= s.exclusiveMaximum) at(`Deve ser menor que ${s.exclusiveMaximum}`);
    if (s.multipleOf && data % s.multipleOf !== 0) at(`Deve ser múltiplo de ${s.multipleOf}`);
  }
  return errors;
}

type Result =
  | { state: 'idle' | 'valid'; errors: ValidationError[]; syntax: null }
  | { state: 'syntax'; errors: ValidationError[]; syntax: string }
  | { state: 'invalid'; errors: ValidationError[]; syntax: null };

export default function JsonSchemaPage() {
  const [schemaText, setSchemaText] = useState('');
  const [jsonText, setJsonText] = useState('');

  const result = useMemo<Result>(() => {
    if (!schemaText.trim() || !jsonText.trim()) return { state: 'idle', errors: [], syntax: null };
    let schema: Json;
    let data: Json;
    try { schema = JSON.parse(schemaText); } catch (e) { return { state: 'syntax', errors: [], syntax: `Schema: ${(e as Error).message}` }; }
    try { data = JSON.parse(jsonText); } catch (e) { return { state: 'syntax', errors: [], syntax: `JSON: ${(e as Error).message}` }; }
    const errors = validate(schema, data);
    return { state: errors.length ? 'invalid' : 'valid', errors, syntax: null };
  }, [schemaText, jsonText]);

  // Gera o schema do JSON atual e o coloca no painel do meio.
  const generate = () => {
    try {
      setSchemaText(JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', ...inferSchema(JSON.parse(jsonText)) }, null, 2));
    } catch {
      /* botão fica desabilitado quando o JSON é inválido */
    }
  };
  const jsonOk = useMemo(() => {
    try { JSON.parse(jsonText); return jsonText.trim().length > 0; } catch { return false; }
  }, [jsonText]);

  const badge = {
    idle: { label: 'Aguardando', cls: 'border-border text-muted-foreground' },
    syntax: { label: 'Erro de sintaxe', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
    valid: { label: 'Válido', cls: 'border-primary/40 bg-primary/10 text-primary' },
    invalid: { label: 'Falha na validação', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
  }[result.state];

  return (
    <DevToolPage
      toolId="json-schema"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setJsonText(SAMPLE_JSON); setSchemaText(SAMPLE_SCHEMA); }}
          className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
        >
          <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
        </Button>
      }
    >
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <ToolPane title="JSON" value={jsonText} onChange={setJsonText} placeholder="Cole o JSON a validar (ou usar como exemplo)…" footer={`${jsonText.length} caracteres`} />
        <ToolPane
          title="JSON Schema"
          value={schemaText}
          onChange={setSchemaText}
          placeholder="Cole um schema ou gere a partir do JSON…"
          downloadName="schema.json"
          toolbar={
            <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={!jsonOk} className="h-7 gap-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Gerar do JSON
            </Button>
          }
        />
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:col-span-2 xl:col-span-1">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Relatório de validação
            </h2>
            <Badge variant="outline" className={cn('text-[10px] font-black uppercase tracking-wider', badge.cls)}>{badge.label}</Badge>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {result.state === 'idle' && <p className="py-8 text-center text-xs font-medium text-muted-foreground">Preencha o JSON e o schema para validar.</p>}
            {result.state === 'syntax' && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-medium text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {result.syntax}
              </div>
            )}
            {result.state === 'valid' && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-bold text-primary">
                <CheckCircle2 className="h-5 w-5" /> O conteúdo condiz com o schema.
              </div>
            )}
            {result.errors.map((err, i) => (
              <div key={i} className="rounded-xl border border-border bg-background p-3">
                <p className="truncate font-code text-[11px] font-bold text-muted-foreground">{err.path || 'raiz'}</p>
                <p className="mt-1 flex items-start gap-1 text-xs font-medium text-foreground">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> {err.message}
                </p>
              </div>
            ))}
          </div>
          <footer className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            {result.state === 'invalid' ? `${result.errors.length} erro(s)` : 'Suporta type, enum, const, required, properties, items, min/max, pattern, anyOf/oneOf.'}
          </footer>
        </section>
      </div>
    </DevToolPage>
  );
}
