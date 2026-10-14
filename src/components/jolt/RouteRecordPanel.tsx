'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KeyValue, RouteForm } from '@/lib/jolt-route-record';
import { routeFormFromRecord } from '@/lib/jolt-route-record';

const inputClass = 'h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground';
const labelClass = 'flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground';

function Rows({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</legend>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2">
          <input
            aria-label={`${title}: nome ${i + 1}`}
            value={row.key}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
            className={`${inputClass} font-code text-[12.5px]`}
            placeholder="nome"
          />
          <input
            aria-label={`${title}: valor ${i + 1}`}
            value={row.value}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
            className={`${inputClass} font-code text-[12.5px]`}
            placeholder="valor"
          />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${row.key || 'linha'}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => onChange([...rows, { key: '', value: '' }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
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
    <section aria-labelledby="rota-titulo" className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="rota-titulo" className="text-[15px] font-extrabold">Rota de integração</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Campos de <code className="font-code text-xs">PCINTEGRACAOROTASERVICO</code> em volta da spec
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Carregar registro
        </Button>
      </div>

      {importing && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <label htmlFor="rota-import" className="text-xs font-bold text-muted-foreground">
            Cole o arquivo da rota (ex.: <code className="font-code">rotas/NOME.json</code> do repositório de layouts). A spec gerada substitui a que estiver nele.
          </label>
          <textarea
            id="rota-import"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full rounded-lg border border-input bg-background p-2 font-code text-xs"
          />
          {importError && <p role="alert" className="text-xs font-semibold text-destructive">{importError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setImporting(false)}>Cancelar</Button>
            <Button type="button" size="sm" disabled={!importText.trim()} onClick={doImport}>Usar este registro</Button>
          </div>
        </div>
      )}

      <label className={labelClass} htmlFor="rota-id">
        Serviço (ID)
        <input id="rota-id" value={form.id} onChange={(e) => set({ id: e.target.value })} className={inputClass} placeholder="WTA - Buscar Clientes" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass} htmlFor="rota-empresa">
          Empresa da API
          <input id="rota-empresa" value={form.empresaApi} onChange={(e) => set({ empresaApi: e.target.value })} className={inputClass} />
        </label>
        <label className={labelClass} htmlFor="rota-tipo">
          Tipo de processo
          <select id="rota-tipo" value={form.tipoProcesso} onChange={(e) => set({ tipoProcesso: e.target.value })} className={inputClass}>
            <option value="BUSCAR">BUSCAR</option>
            <option value="ENVIAR">ENVIAR</option>
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Requisição</span>
        <div className="flex gap-2">
          <select aria-label="Método" value={form.method} onChange={(e) => set({ method: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-2 text-sm font-bold">
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input aria-label="URL" value={form.url} onChange={(e) => set({ url: e.target.value })} className={`${inputClass} font-code text-[12.5px]`} />
        </div>
      </div>
      <Rows title="Cabeçalhos" rows={form.headers} onChange={(headers) => set({ headers })} />
      <Rows title="Parâmetros da URL" rows={form.query} onChange={(query) => set({ query })} />

      <div className="flex flex-wrap gap-2">
        {flags.map(([key, label]) => (
          <label key={key} className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-[13px] font-semibold">
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

      {variables.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Variáveis da rota</h3>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <code key={v} className="rounded-md bg-emerald-500/10 px-2 py-1 font-code text-[11.5px] text-emerald-800 dark:text-emerald-300">{`{{${v}}}`}</code>
            ))}
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="space-y-1 text-xs font-semibold text-orange-800 dark:text-orange-300">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
