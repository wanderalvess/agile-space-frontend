'use client';

import React, { useState } from 'react';
import { Plus, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/room-kit';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import type { KeyValue, RouteForm } from '@/lib/jolt-route-record';
import { routeFormFromRecord } from '@/lib/jolt-route-record';
import { FIELD_LABEL } from './LayoutCard';
import { Notice } from './JoltBits';

const inputClass = cn(FIELD, 'h-10');
const monoInput = cn(inputClass, 'font-code text-[13px]');

const TIPO_OPTIONS = [
  { value: 'BUSCAR', label: 'BUSCAR' },
  { value: 'ENVIAR', label: 'ENVIAR' },
];
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }));

function Rows({
  title,
  rows,
  emptyText,
  onChange,
}: {
  title: string;
  rows: KeyValue[];
  emptyText: string;
  onChange: (rows: KeyValue[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn(FIELD_LABEL, 'mb-2')}>{title}</legend>
      {rows.length === 0 && <span className="text-[13px] text-muted-foreground">{emptyText}</span>}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2">
          <input
            aria-label={`${title}: nome ${i + 1}`}
            value={row.key}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
            className={cn(monoInput, 'h-9 text-xs')}
            placeholder="nome"
          />
          <input
            aria-label={`${title}: valor ${i + 1}`}
            value={row.value}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
            className={cn(monoInput, 'h-9 text-xs')}
            placeholder="valor"
          />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Remover ${row.key || 'linha'}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-fit gap-1.5 px-2 text-[13px] text-primary [.theme-totvs:not(.dark)_&]:text-foreground"
        onClick={() => onChange([...rows, { key: '', value: '' }])}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Adicionar
      </Button>
    </fieldset>
  );
}

/** Formulário do envelope PCINTEGRACAOROTASERVICO; o registro completo é montado pela página com a spec gerada. */
export function RouteRecordPanel({
  form,
  onChange,
  variables,
  problems,
  onLoadedSpec,
}: {
  form: RouteForm;
  onChange: (form: RouteForm) => void;
  variables: string[];
  problems: string[];
  onLoadedSpec?: (spec: unknown) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const set = (patch: Partial<RouteForm>) => onChange({ ...form, ...patch });

  const doImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError('JSON inválido.');
      return;
    }
    const r = routeFormFromRecord(parsed);
    if (!r.ok) {
      setImportError(r.error);
      return;
    }
    onChange(r.form);
    onLoadedSpec?.(r.spec);
    setImporting(false);
    setImportText('');
    setImportError(null);
  };

  const flags: [keyof RouteForm, string][] = [
    ['ativo', 'Ativo'],
    ['disponivelUrlWta', 'Disponível na URL da rota WTA'],
    ['autenticador', 'Autenticador'],
    ['somenteAtualizarCore', 'Só atualizar integração core'],
  ];

  return (
    <section aria-labelledby="rota-titulo" className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="rota-titulo" className="text-[15px] font-bold text-foreground">Rota de integração</h2>
          <p className="text-xs text-muted-foreground">
            Campos de <code className="font-code">PCINTEGRACAOROTASERVICO</code> em volta da spec
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setImporting((v) => !v)} aria-expanded={importing} className="h-9 gap-1.5 rounded-lg px-3 text-[13px] font-semibold">
          <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Carregar registro
        </Button>
      </div>

      {importing && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <label htmlFor="rota-import" className="text-xs font-semibold leading-relaxed text-muted-foreground">
            Cole o arquivo da rota (por exemplo, <code className="font-code">rotas/NOME.json</code> do repositório de layouts). A spec gerada substitui a que estiver nele.
          </label>
          <textarea
            id="rota-import"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            spellCheck={false}
            className={cn(FIELD, 'p-2 font-code text-xs')}
          />
          {importError && <p role="alert" className="text-[13px] font-semibold text-red-700 dark:text-red-300">{importError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-[13px]" onClick={() => setImporting(false)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-9 rounded-lg text-[13px] font-bold" disabled={!importText.trim()} onClick={doImport}>Usar este registro</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className={FIELD_LABEL} htmlFor="rota-id">Serviço (ID)</label>
        <input id="rota-id" value={form.id} onChange={(e) => set({ id: e.target.value })} className={inputClass} placeholder="WTA - Buscar Clientes" />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={FIELD_LABEL} htmlFor="rota-empresa">Empresa da API</label>
          <input id="rota-empresa" value={form.empresaApi} onChange={(e) => set({ empresaApi: e.target.value })} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={FIELD_LABEL} htmlFor="rota-tipo">Tipo de processo</label>
          <SelectField id="rota-tipo" aria-label="Tipo de processo" value={form.tipoProcesso} onChange={(v) => set({ tipoProcesso: v })} options={TIPO_OPTIONS} className="h-10" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Requisição</span>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <SelectField aria-label="Método" value={form.method} onChange={(v) => set({ method: v })} options={METHOD_OPTIONS} className="h-10" />
          <input aria-label="URL" value={form.url} onChange={(e) => set({ url: e.target.value })} className={monoInput} />
        </div>
      </div>
      <Rows title="Cabeçalhos" rows={form.headers} emptyText="Nenhum cabeçalho." onChange={(headers) => set({ headers })} />
      <Rows title="Parâmetros da URL" rows={form.query} emptyText="Nenhum parâmetro." onChange={(query) => set({ query })} />

      <div role="group" aria-label="Opções da rota" className="flex flex-wrap gap-2">
        {flags.map(([key, label]) => (
          <label
            key={key}
            className={cn(
              'inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold text-foreground transition-colors duration-fast',
              form[key] ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border',
              'focus-within:ring-2 focus-within:ring-ring',
            )}
          >
            <input
              type="checkbox"
              checked={form[key] as boolean}
              onChange={(e) => set({ [key]: e.target.checked } as Partial<RouteForm>)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={FIELD_LABEL}>Variáveis da rota</h3>
        {variables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <code key={v} className="rounded-lg bg-emerald-500/10 px-2 py-1 font-code text-xs text-emerald-800 dark:text-emerald-300">{`{{${v}}}`}</code>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-muted-foreground">A spec e a rota não usam variáveis.</span>
        )}
      </div>

      {problems.length > 0 && (
        <Notice tone="warn" icon={TriangleAlert} role="alert" className="text-[13px]">
          <strong>Para conferir antes de usar</strong>
          <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        </Notice>
      )}
    </section>
  );
}
