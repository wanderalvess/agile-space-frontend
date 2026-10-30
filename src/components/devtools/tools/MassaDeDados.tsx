'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, Download, FileText, FlaskConical, RefreshCw, Save, Trash2 } from 'lucide-react';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { FIELD_LABEL, OptionGroup, Segmented, ToggleChip, ToolButton, ToolPane, ToolWorkspace } from '@/components/devtools/tool-kit';
import { useToolTab } from '@/components/devtools/useToolTab';
import { ConfirmDialog, SelectField } from '@/components/room-kit';
import { FIELD, TONES } from '@/components/room-kit/tokens';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_CONFIG,
  FORMAT_EXT,
  KIND_LABEL,
  KIND_PLURAL,
  MAX_QTY,
  describeConfig,
  formatMass,
  generateMass,
  newSet,
  parseQty,
  readSets,
  validateLines,
  writeSets,
  type MassConfig,
  type MassFormat,
  type MassKind,
  type MassRow,
  type SavedSet,
} from '@/lib/devtools/mass-data';
import { formatDocument, generateBatch } from '@/lib/devtools/br-docs';
import type { CardBrand } from '@/lib/devtools/test-data-generators';
import { cn } from '@/lib/utils';

const PREVIEW_ROWS = 12;
const KIND_OPTIONS = (Object.keys(KIND_LABEL) as MassKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }));
const FORMAT_OPTIONS: { value: MassFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
];
const BRAND_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'Amex' },
];
const QUICK_QTY = ['1', '10', '50', '100', '500', '1000'];

/** Exemplo de validação: documentos válidos recém-gerados e alguns inválidos. */
function validateSample(): string {
  return [
    formatDocument(generateBatch('CPF', 1, false)[0], 'CPF'),
    '123.456.789-00',
    formatDocument(generateBatch('CNPJ_CLASSIC', 1, false)[0], 'CNPJ_CLASSIC'),
    formatDocument(generateBatch('CNPJ_ALPHANUM', 1, false)[0], 'CNPJ_ALPHANUM'),
    '111.111.111-11',
    '12345',
  ].join('\n');
}

/** `?tipo=` das rotas antigas: cpf, cnpj, cnpj-alfa, pessoa, cartao. */
function configFromParams(tipo: string | null): MassConfig {
  switch (tipo) {
    case 'cnpj': return { ...DEFAULT_CONFIG, kind: 'cnpj' };
    case 'cnpj-alfa': return { ...DEFAULT_CONFIG, kind: 'cnpj', cnpjAlfa: true };
    case 'pessoa': return { ...DEFAULT_CONFIG, kind: 'pessoa' };
    case 'cartao': return { ...DEFAULT_CONFIG, kind: 'cartao' };
    default: return DEFAULT_CONFIG;
  }
}

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Massa de Dados: gerar (CPF, CNPJ, pessoa completa, cartão) e validar documentos, com conjuntos salvos no navegador.
// Junta as antigas telas Massa de Dados e CPF e CNPJ. Os dados são fictícios.
export default function MassaDeDados() {
  const [tab, setTab, params] = useToolTab('test-data');
  const { session } = useAuth();
  const userId = session?.id ?? '';
  const { toast } = useToast();

  const [cfg, setCfg] = useState<MassConfig>(() => configFromParams(params.get('tipo')));
  const [qtyText, setQtyText] = useState(String(DEFAULT_CONFIG.qty));
  const [rows, setRows] = useState<MassRow[]>([]);
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [toDelete, setToDelete] = useState<SavedSet | null>(null);
  const [valText, setValText] = useState('');

  const qty = parseQty(qtyText);
  const qtyError = qty === null;
  const patch = (p: Partial<MassConfig>) => setCfg((c) => ({ ...c, ...p }));

  const generate = useCallback(
    (c: MassConfig) => {
      setRows(generateMass(c));
    },
    [],
  );

  // Valores aleatórios só depois da montagem (evita divergência de hidratação); os conjuntos salvos vêm do storage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- geração inicial e leitura do storage depois de montar
    generate({ ...cfg, qty: parseQty(qtyText) ?? DEFAULT_CONFIG.qty });
    setSets(readSets(userId));
    // só na montagem e quando o usuário muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const regenerate = () => {
    if (qty === null) return;
    const next = { ...cfg, qty };
    setCfg(next);
    generate(next);
  };

  const output = useMemo(() => formatMass(rows, cfg.format, cfg.kind), [rows, cfg.format, cfg.kind]);
  const head = rows.length ? Object.keys(rows[0]) : [];

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado para a área de transferência' });
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const persistSets = (next: SavedSet[]) => {
    setSets(next);
    if (!writeSets(userId, next)) toast({ title: 'Não foi possível salvar neste navegador', description: 'O armazenamento está bloqueado ou cheio. O conjunto vale só nesta visita.', variant: 'destructive' });
  };

  const saveSet = () => {
    const c = { ...cfg, qty: qty ?? cfg.qty };
    persistSets([...sets, newSet(sets, c)]);
    toast({ title: 'Conjunto salvo', description: describeConfig(c) });
  };

  const applySet = (s: SavedSet) => {
    setCfg(s.config);
    setQtyText(String(s.config.qty));
    generate(s.config);
  };

  const validation = useMemo(() => validateLines(valText), [valText]);
  const nOk = validation.filter((v) => v.result.valid).length;
  const validationCsv = validation.map((v) => `${v.line};${v.result.kind ?? 'Desconhecido'};${v.result.valid ? 'válido' : 'inválido'};${v.result.message}`).join('\n');

  const isCnpj = cfg.kind === 'cnpj';
  const isDoc = cfg.kind === 'cpf' || cfg.kind === 'cnpj';

  return (
    <DevToolPage toolId="test-data">
      <ToolWorkspace
        tabs={[{ id: 'gerar', label: 'Gerar' }, { id: 'validar', label: 'Validar' }]}
        tab={tab as 'gerar' | 'validar'}
        onTab={setTab}
      >
        {tab === 'gerar' && (
          <>
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Opções do lote">
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <h2 className="text-[15px] font-bold text-foreground">Opções</h2>
                <span className="flex-1" />
                <ToolButton primary onClick={regenerate} disabled={qtyError} className="h-8 text-[13px]">
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Gerar de novo
                </ToolButton>
                <ToolButton onClick={saveSet} disabled={qtyError} className="h-8 text-[13px]" title="Salvar estas opções neste navegador">
                  <Save className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Salvar conjunto
                </ToolButton>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <OptionGroup label="O que gerar">
                  <Segmented label="O que gerar" options={KIND_OPTIONS} value={cfg.kind} onChange={(kind) => patch({ kind })} />
                </OptionGroup>

                {isCnpj && (
                  <OptionGroup label="Formato do CNPJ">
                    <Segmented
                      label="Formato do CNPJ"
                      options={[{ value: 'num', label: 'Numérico' }, { value: 'alfa', label: 'Alfanumérico' }]}
                      value={cfg.cnpjAlfa ? 'alfa' : 'num'}
                      onChange={(v) => patch({ cnpjAlfa: v === 'alfa' })}
                    />
                    <ToggleChip on={cfg.filiais} onChange={(filiais) => patch({ filiais })} title="Todos os CNPJs com a mesma raiz e filiais 0001, 0002…">
                      Mesma raiz, filiais 0001, 0002…
                    </ToggleChip>
                    {cfg.cnpjAlfa && <span className="basis-full text-xs text-muted-foreground">Letras e números nos 12 primeiros caracteres, como no novo CNPJ.</span>}
                  </OptionGroup>
                )}

                {cfg.kind === 'cartao' && (
                  <OptionGroup label="Bandeira">
                    <SelectField value={cfg.brand} onChange={(v) => patch({ brand: v as CardBrand })} options={BRAND_OPTIONS} aria-label="Bandeira" className="w-[180px]" />
                  </OptionGroup>
                )}

                {(isDoc || cfg.kind === 'pessoa') && (
                  <OptionGroup label="Máscara">
                    <ToggleChip on={cfg.mask} onChange={(mask) => patch({ mask })}>Com pontos, barra e traço</ToggleChip>
                  </OptionGroup>
                )}

                <OptionGroup label={`Quantidade (de 1 a ${MAX_QTY.toLocaleString('pt-BR')})`}>
                  <input
                    value={qtyText}
                    onChange={(e) => setQtyText(e.target.value)}
                    inputMode="numeric"
                    aria-label="Quantidade de registros"
                    aria-invalid={qtyError}
                    placeholder="1 a 1.000"
                    className={cn(FIELD, 'h-[42px] w-24 font-code', qtyError && 'border-red-500')}
                  />
                  {QUICK_QTY.map((q) => (
                    <ToggleChip key={q} on={qtyText === q} onChange={() => setQtyText(q)}>{Number(q).toLocaleString('pt-BR')}</ToggleChip>
                  ))}
                  {qtyError && <span className={cn('basis-full text-xs', TONES.danger.text)}>O lote aceita de 1 a {MAX_QTY.toLocaleString('pt-BR')} registros.</span>}
                </OptionGroup>

                <OptionGroup label="Exportar como">
                  <Segmented label="Exportar como" options={FORMAT_OPTIONS} value={cfg.format} onChange={(format) => patch({ format })} />
                </OptionGroup>

                <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                  <span className={FIELD_LABEL}>Conjuntos salvos neste navegador</span>
                  {sets.length === 0 && <span className="text-[13px] text-muted-foreground">Nenhum conjunto salvo ainda.</span>}
                  {sets.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5 rounded-[10px] border border-border px-2.5 py-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.desc}</span>
                      </span>
                      <ToolButton onClick={() => applySet(s)} aria-label={`Usar o conjunto ${s.name}`} className="h-8 text-[13px]">Usar</ToolButton>
                      <ToolButton onClick={() => setToDelete(s)} aria-label={`Excluir o conjunto ${s.name}`} className={cn('h-8 text-[13px]', TONES.danger.text)}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Excluir
                      </ToolButton>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Lote gerado">
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <h2 className="text-[15px] font-bold text-foreground">Lote gerado</h2>
                {rows.length > 0 && <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>}
                <span className="flex-1" />
                <ToolButton onClick={() => copy(output)} disabled={!output} className="h-8 text-[13px]" aria-label={`Copiar em ${cfg.format.toUpperCase()}`}>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Copiar
                </ToolButton>
                <ToolButton onClick={() => saveFile(`massa-de-dados-${cfg.kind}.${FORMAT_EXT[cfg.format]}`, output)} disabled={!output} className="h-8 text-[13px]" aria-label={`Baixar ${cfg.format.toUpperCase()}`}>
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Baixar {cfg.format.toUpperCase()}
                </ToolButton>
              </header>
              {rows.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 bg-background p-8 text-center">
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FlaskConical className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" /></span>
                  <h3 className="text-[17px] font-bold text-foreground">Nada gerado ainda</h3>
                  <p className="max-w-[380px] text-sm leading-relaxed text-muted-foreground">Escolha o que gerar e clique em Gerar de novo.</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-max border-collapse text-left text-[13px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border">
                        <th scope="col" className="px-4 py-2.5 text-xs font-bold text-muted-foreground">#</th>
                        {head.map((h) => <th key={h} scope="col" className="px-3 py-2.5 text-xs font-bold text-muted-foreground">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                        <tr key={i} className={cn('border-b border-border', i % 2 && 'bg-muted/40')}>
                          <td className="px-4 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                          {head.map((h) => <td key={h} className="max-w-[260px] truncate px-3 py-2 font-code text-foreground">{r[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > PREVIEW_ROWS && (
                    <p className="px-4 py-3 text-[13px] text-muted-foreground">
                      Mostrando {PREVIEW_ROWS} de {rows.length}. Copiar e baixar levam todos os registros.
                    </p>
                  )}
                </div>
              )}
              <footer className="shrink-0 border-t border-border px-4 py-2 text-[13px] text-muted-foreground">
                {rows.length > 0
                  ? `${rows.length} ${KIND_PLURAL[cfg.kind]} gerados${isDoc ? ' · todos com dígitos verificadores válidos' : ''} · dados fictícios, só para teste`
                  : 'Aguardando a geração.'}
              </footer>
            </section>
          </>
        )}

        {tab === 'validar' && (
          <>
            <ToolPane
              title="Documentos"
              sub="um por linha"
              value={valText}
              onChange={setValText}
              onExample={() => setValText(validateSample())}
              placeholder="Cole CPFs e CNPJs, um por linha"
              footer={`${validation.length} ${validation.length === 1 ? 'documento' : 'documentos'}`}
            />
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Resultado da validação">
              <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <h2 className="text-[15px] font-bold text-foreground">Resultado</h2>
                {validation.length > 0 && <span className="text-xs text-muted-foreground">{nOk} válidos, {validation.length - nOk} inválidos</span>}
                <span className="flex-1" />
                <ToolButton onClick={() => copy(validationCsv)} disabled={!validation.length} className="h-8 text-[13px]"><Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Copiar</ToolButton>
                <ToolButton onClick={() => saveFile('validacao.csv', validationCsv)} disabled={!validation.length} className="h-8 text-[13px]"><Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Baixar CSV</ToolButton>
              </header>
              {validation.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 bg-background p-8 text-center">
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FileText className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" /></span>
                  <h3 className="text-[17px] font-bold text-foreground">Cole documentos à esquerda</h3>
                  <p className="max-w-[380px] text-sm leading-relaxed text-muted-foreground">Cada linha é conferida: tipo, dígitos verificadores e motivo.</p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 overflow-auto" aria-live="polite">
                  {validation.map((v, i) => (
                    <li key={i} className="flex flex-col gap-1.5 border-b border-border px-4 py-3">
                      <div className="flex items-center justify-between gap-2.5">
                        <strong className="break-all font-code text-sm font-semibold text-foreground">{v.line}</strong>
                        <span className={cn('inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', v.result.valid ? TONES.success.chip : TONES.danger.chip)}>
                          {v.result.valid ? <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          {v.result.valid ? 'Válido' : 'Inválido'}
                        </span>
                      </div>
                      <span className="text-[13px] text-muted-foreground">{v.result.kind ? `${v.result.kind} · ` : ''}{v.result.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              <footer className="shrink-0 border-t border-border px-4 py-2 text-[13px] text-muted-foreground">
                {validation.length === 0
                  ? 'Aguardando documentos.'
                  : nOk === validation.length
                    ? `Todos os ${validation.length} documentos são válidos`
                    : `${validation.length - nOk} de ${validation.length} documentos inválidos`}
              </footer>
            </section>
          </>
        )}
      </ToolWorkspace>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        tone="danger"
        title={`Excluir o conjunto "${toDelete?.name ?? ''}"?`}
        description="Ele some deste navegador e não dá para recuperar."
        confirmLabel="Excluir"
        onConfirm={() => { if (toDelete) persistSets(sets.filter((s) => s.id !== toDelete.id)); }}
      />
    </DevToolPage>
  );
}
