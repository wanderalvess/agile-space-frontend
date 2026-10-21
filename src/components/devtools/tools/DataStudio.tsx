'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, CircleAlert, CircleCheck, ChevronRight, Sparkles } from 'lucide-react';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { OptionGroup, Segmented, ToggleChip, ToolButton, ToolPane, ToolWorkspace } from '@/components/devtools/tool-kit';
import { useToolTab } from '@/components/devtools/useToolTab';
import {
  FORMAT_LABEL,
  SAMPLE_JSON,
  SAMPLE_XML,
  SAMPLE_YAML,
  convertData,
  describeJsonError,
  processJson,
  processXml,
  processYaml,
  type ConvertFormat,
  type DataFormat,
} from '@/lib/devtools/format-data';
import { SQL_SAMPLE, formatSql } from '@/lib/devtools/sql-format';
import { inferSchema, validate, type Json, type ValidationError } from '@/lib/devtools/json-schema';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

type Action = 'format' | 'minify';
type Indent = '2' | '4' | 'tab';
type SchemaMode = 'gerar' | 'validar';

const SAMPLES: Record<DataFormat, string> = { json: SAMPLE_JSON, xml: SAMPLE_XML, yaml: SAMPLE_YAML, sql: SQL_SAMPLE };
const CONVERT_SAMPLES: Record<ConvertFormat, string> = { json: SAMPLE_JSON, xml: SAMPLE_XML, yaml: SAMPLE_YAML };
const EXT: Record<DataFormat, string> = { json: 'json', xml: 'xml', yaml: 'yaml', sql: 'sql' };

const SCHEMA_PAYLOAD_SAMPLE = JSON.stringify({ id: 1, nome: 'Agile Editor', email: 'contato@agile.space', role: 'admin', tags: ['qa', 'api'] }, null, 2);
const SCHEMA_SAMPLE = JSON.stringify({
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

const FORMAT_OPTIONS = (['json', 'xml', 'yaml', 'sql'] as DataFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }));
const CONVERT_OPTIONS = (['json', 'xml', 'yaml'] as ConvertFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }));

const asFormat = (v: string | null): DataFormat => (v === 'xml' || v === 'yaml' || v === 'sql' ? v : 'json');
const asConvert = (v: string | null, fallback: ConvertFormat): ConvertFormat => (v === 'xml' || v === 'yaml' || v === 'json' ? v : fallback);

function parseJsonText(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: describeJsonError(text, e instanceof Error ? e.message : String(e)) };
  }
}

const sizeInfo = (s: string) => (s ? `${s.length} caracteres` : undefined);

// Estúdio de Dados: JSON, XML, YAML e SQL em três abas (Formatar, Converter e Schema).
// Junta as antigas telas JSON, XML, YAML ⇄ JSON, SQL Formatter e JSON Schema.
export default function DataStudio() {
  const [tab, setTab, params] = useToolTab('data-studio');

  // Formatar
  const [fmt, setFmt] = useState<DataFormat>(() => asFormat(params.get('formato')));
  const [action, setAction] = useState<Action>('format');
  const [indent, setIndent] = useState<Indent>('2');
  const [upper, setUpper] = useState(true);
  const [fmtText, setFmtText] = useState('');

  // Converter
  const [from, setFrom] = useState<ConvertFormat>(() => asConvert(params.get('de'), 'json'));
  const [to, setTo] = useState<ConvertFormat>(() => {
    const de = asConvert(params.get('de'), 'json');
    const para = asConvert(params.get('para'), de === 'xml' ? 'json' : 'xml');
    return para === de ? (de === 'json' ? 'xml' : 'json') : para;
  });
  const [convText, setConvText] = useState('');

  // Schema
  const [schemaMode, setSchemaMode] = useState<SchemaMode>('gerar');
  const [genText, setGenText] = useState('');
  const [schemaText, setSchemaText] = useState('');
  const [payloadText, setPayloadText] = useState('');

  const indentValue = indent === 'tab' ? '\t' : Number(indent);

  const formatted = useMemo(() => {
    if (!fmtText.trim()) return { output: '', error: null as string | null };
    if (fmt === 'json') return processJson(fmtText, action, indentValue);
    if (fmt === 'xml') return processXml(fmtText, action);
    if (fmt === 'yaml') return processYaml(fmtText, indent === '4' ? 4 : 2);
    return { output: formatSql(fmtText, upper), error: null };
  }, [fmt, fmtText, action, indentValue, indent, upper]);

  const converted = useMemo(() => convertData(convText, from, to), [convText, from, to]);

  const generated = useMemo(() => {
    if (!genText.trim()) return { output: '', error: null as string | null };
    const r = parseJsonText(genText);
    if (!r.ok) return { output: '', error: r.error };
    return { output: JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', ...inferSchema(r.value) }, null, 2), error: null };
  }, [genText]);

  const report = useMemo<{ state: 'idle' | 'valid' | 'invalid' | 'syntax'; errors: ValidationError[]; syntax: string | null }>(() => {
    if (!schemaText.trim() || !payloadText.trim()) return { state: 'idle', errors: [], syntax: null };
    const s = parseJsonText(schemaText);
    if (!s.ok) return { state: 'syntax', errors: [], syntax: `Schema: ${s.error}` };
    const d = parseJsonText(payloadText);
    if (!d.ok) return { state: 'syntax', errors: [], syntax: `Payload: ${d.error}` };
    const errors = validate(s.value, d.value);
    return { state: errors.length ? 'invalid' : 'valid', errors, syntax: null };
  }, [schemaText, payloadText]);

  const payloadOk = useMemo(() => {
    const r = parseJsonText(payloadText);
    return r.ok && payloadText.trim().length > 0;
  }, [payloadText]);

  const fillFromPayload = () => {
    const r = parseJsonText(payloadText);
    if (r.ok) setSchemaText(JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', ...inferSchema(r.value) }, null, 2));
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setConvText(converted.output && !converted.error ? converted.output : '');
  };
  const pickFrom = (v: ConvertFormat) => {
    setFrom(v);
    if (v === to) setTo((['json', 'xml', 'yaml'] as ConvertFormat[]).find((x) => x !== v)!);
  };
  const pickTo = (v: ConvertFormat) => {
    setTo(v);
    if (v === from) setFrom((['json', 'xml', 'yaml'] as ConvertFormat[]).find((x) => x !== v)!);
  };

  const canMinify = fmt === 'json' || fmt === 'xml';

  return (
    <DevToolPage toolId="data-studio">
      <ToolWorkspace
        tabs={[{ id: 'formatar', label: 'Formatar' }, { id: 'converter', label: 'Converter' }, { id: 'schema', label: 'Schema' }]}
        tab={tab as 'formatar' | 'converter' | 'schema'}
        onTab={setTab}
        columns={tab === 'schema' && schemaMode === 'validar' ? 3 : 2}
        bar={
          tab === 'formatar' ? (
            <>
              <OptionGroup label="Formato">
                <Segmented label="Formato" options={FORMAT_OPTIONS} value={fmt} onChange={(v) => { setFmt(v); if (v !== 'json' && v !== 'xml') setAction('format'); }} />
              </OptionGroup>
              {(fmt === 'json' || fmt === 'yaml') && (
                <OptionGroup label="Recuo">
                  <Segmented
                    label="Recuo"
                    options={[{ value: '2' as Indent, label: '2 espaços' }, { value: '4' as Indent, label: '4 espaços' }, ...(fmt === 'json' ? [{ value: 'tab' as Indent, label: 'Tabulação' }] : [])]}
                    value={fmt === 'yaml' && indent === 'tab' ? '2' : indent}
                    onChange={setIndent}
                  />
                </OptionGroup>
              )}
              {fmt === 'sql' && (
                <OptionGroup label="Palavras-chave">
                  <ToggleChip on={upper} onChange={setUpper}>Em maiúsculas</ToggleChip>
                </OptionGroup>
              )}
              <OptionGroup label="Ação">
                <ToolButton primary onClick={() => setAction('format')} aria-pressed={action === 'format'}>Formatar</ToolButton>
                <ToolButton
                  onClick={() => setAction('minify')}
                  aria-pressed={action === 'minify'}
                  disabled={!canMinify}
                  title={canMinify ? 'Remove espaços e quebras de linha' : `Não disponível para ${FORMAT_LABEL[fmt]}`}
                  className={cn(action === 'minify' && canMinify && 'border-primary/50 bg-primary/10')}
                >
                  Minificar
                </ToolButton>
              </OptionGroup>
            </>
          ) : tab === 'converter' ? (
            <>
              <OptionGroup label="De"><Segmented label="De" options={CONVERT_OPTIONS} value={from} onChange={pickFrom} /></OptionGroup>
              <OptionGroup><ToolButton onClick={swap}><ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Inverter</ToolButton></OptionGroup>
              <OptionGroup label="Para"><Segmented label="Para" options={CONVERT_OPTIONS} value={to} onChange={pickTo} /></OptionGroup>
            </>
          ) : (
            <OptionGroup label="Modo"><Segmented label="Modo" options={[{ value: 'gerar' as SchemaMode, label: 'Gerar' }, { value: 'validar' as SchemaMode, label: 'Validar' }]} value={schemaMode} onChange={setSchemaMode} /></OptionGroup>
          )
        }
      >
        {tab === 'formatar' && (
          <>
            <ToolPane
              title="Entrada"
              sub={FORMAT_LABEL[fmt]}
              value={fmtText}
              onChange={setFmtText}
              onExample={() => setFmtText(SAMPLES[fmt])}
              placeholder="Cole aqui o conteúdo"
              footer={`${fmtText.length} caracteres`}
            />
            <ToolPane
              title="Saída"
              sub={action === 'minify' && canMinify ? 'Minificado' : fmt === 'json' ? (indent === 'tab' ? 'Tabulação' : `${indent} espaços`) : undefined}
              value={formatted.output}
              readOnly
              placeholder="O resultado aparece aqui, já formatado."
              downloadName={`resultado.${EXT[fmt]}`}
              error={formatted.error}
              footer={formatted.output ? `${FORMAT_LABEL[fmt]} válido · ${formatted.output.length} caracteres` : undefined}
            />
          </>
        )}

        {tab === 'converter' && (
          <>
            <ToolPane
              title="Entrada"
              sub={FORMAT_LABEL[from]}
              value={convText}
              onChange={setConvText}
              onExample={() => setConvText(CONVERT_SAMPLES[from])}
              placeholder="Cole aqui o conteúdo"
              footer={`${convText.length} caracteres`}
            />
            <ToolPane
              title={`Saída em ${FORMAT_LABEL[to]}`}
              value={converted.output}
              readOnly
              placeholder="O resultado aparece aqui."
              downloadName={`resultado.${EXT[to]}`}
              error={converted.error}
              footer={converted.output ? `Convertido de ${FORMAT_LABEL[from]} para ${FORMAT_LABEL[to]} · ${converted.output.length} caracteres` : undefined}
            />
          </>
        )}

        {tab === 'schema' && schemaMode === 'gerar' && (
          <>
            <ToolPane
              title="JSON de exemplo"
              sub="JSON"
              value={genText}
              onChange={setGenText}
              onExample={() => setGenText(SCHEMA_PAYLOAD_SAMPLE)}
              placeholder="Cole um JSON para gerar o schema"
              footer={`${genText.length} caracteres`}
            />
            <ToolPane
              title="Schema gerado"
              value={generated.output}
              readOnly
              placeholder="O schema aparece aqui."
              downloadName="schema.json"
              error={generated.error}
              footer={sizeInfo(generated.output)}
            />
          </>
        )}

        {tab === 'schema' && schemaMode === 'validar' && (
          <>
            <ToolPane
              title="Schema"
              sub="JSON Schema"
              value={schemaText}
              onChange={setSchemaText}
              onExample={() => { setSchemaText(SCHEMA_SAMPLE); setPayloadText(SCHEMA_PAYLOAD_SAMPLE); }}
              placeholder="Cole um schema ou gere a partir do payload"
              downloadName="schema.json"
              toolbar={
                <ToolButton onClick={fillFromPayload} disabled={!payloadOk} className="h-8 text-[13px]">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Gerar do payload
                </ToolButton>
              }
            />
            <ToolPane title="Payload" sub="JSON" value={payloadText} onChange={setPayloadText} placeholder="Cole o JSON a validar" footer={`${payloadText.length} caracteres`} />
            <ValidationReport report={report} />
          </>
        )}
      </ToolWorkspace>
    </DevToolPage>
  );
}

function ValidationReport({ report }: { report: { state: 'idle' | 'valid' | 'invalid' | 'syntax'; errors: ValidationError[]; syntax: string | null } }) {
  const badge = {
    idle: { label: 'Aguardando', cls: 'bg-muted text-muted-foreground' },
    syntax: { label: 'Erro de sintaxe', cls: TONES.danger.chip },
    valid: { label: 'Válido', cls: TONES.success.chip },
    invalid: { label: 'Falha na validação', cls: TONES.danger.chip },
  }[report.state];
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:col-span-1">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-[15px] font-bold text-foreground">Relatório de validação</h2>
        <span className="flex-1" />
        <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold', badge.cls)}>{badge.label}</span>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {report.state === 'idle' && <p className="py-8 text-center text-sm text-muted-foreground">Preencha o schema e o payload para validar.</p>}
        {report.state === 'syntax' && (
          <div className={cn('flex items-start gap-2 rounded-xl border border-red-500/30 p-3 text-sm', TONES.danger.chip)}>
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" /> {report.syntax}
          </div>
        )}
        {report.state === 'valid' && (
          <div className={cn('flex items-center gap-2 rounded-xl border border-emerald-500/30 p-3 text-sm font-semibold', TONES.success.chip)}>
            <CircleCheck className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" /> O conteúdo condiz com o schema.
          </div>
        )}
        {report.errors.map((err, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-3">
            <p className="truncate font-code text-xs font-semibold text-muted-foreground">{err.path || 'raiz'}</p>
            <p className="mt-1 flex items-start gap-1 text-sm text-foreground">
              <ChevronRight className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', TONES.danger.text)} strokeWidth={1.5} aria-hidden="true" /> {err.message}
            </p>
          </div>
        ))}
      </div>
      <footer className="shrink-0 border-t border-border px-4 py-2 text-[13px] text-muted-foreground">
        {report.state === 'invalid' ? `${report.errors.length} ${report.errors.length === 1 ? 'problema' : 'problemas'}` : 'Suporta type, enum, const, required, properties, items, min/max, pattern, anyOf e oneOf.'}
      </footer>
    </section>
  );
}
