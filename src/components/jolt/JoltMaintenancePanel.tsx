'use client';

import React, { useMemo, useState } from 'react';
import { ChevronsUpDown, Check, Plus, Trash2, Undo2, Wrench, AlertCircle, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  parseLayoutText,
  classifyInputFields,
  listShiftMappings,
  addShiftMapping,
  updateMappingTargets,
  removeMapping,
  type ClassifiedField,
  type ShiftMapping,
  type EditResult,
} from '@/lib/jolt-maintenance';

interface JoltMaintenancePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conteúdo atual do editor de spec (lista de operações ou layout completo). */
  specText: string;
  /** Conteúdo atual do editor de entrada. */
  inputText: string;
  /** Devolve o novo texto da spec; a página atualiza o editor e roda de novo, se já havia resultado. */
  onSpecChange: (newSpecText: string, message: string) => void;
}

const USAGE_LABEL: Record<ClassifiedField['usage'], { text: string; className: string }> = {
  mapped: { text: 'mapeado', className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  indirect: { text: 'em outra operação', className: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  unused: { text: 'sem uso', className: 'border-sky-500/40 text-sky-600 dark:text-sky-400' },
};

function formatExample(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  const s = typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
  return s.length > 28 ? s.slice(0, 27) + '…' : s;
}

export function JoltMaintenancePanel({ open, onOpenChange, specText, inputText, onSpecChange }: JoltMaintenancePanelProps) {
  const layout = useMemo(() => (specText.trim() ? parseLayoutText(specText) : null), [specText]);
  const parts = layout?.ok ? layout.parts : null;

  const parsedInput = useMemo(() => {
    try {
      return inputText.trim() ? JSON.parse(inputText) : null;
    } catch {
      return null;
    }
  }, [inputText]);

  const fields = useMemo(() => (parts && parsedInput ? classifyInputFields(parsedInput, parts.spec) : []), [parts, parsedInput]);
  const unused = useMemo(() => fields.filter(f => f.usage === 'unused'), [fields]);
  const mappings = useMemo(() => (parts ? listShiftMappings(parts.spec) : []), [parts]);

  // Formulário "adicionar campo"
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fieldPath, setFieldPath] = useState<string[] | null>(null);
  const [target, setTarget] = useState('');
  const [mappingFilter, setMappingFilter] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Só desfaz se o editor ainda estiver exatamente como o painel deixou.
  const [history, setHistory] = useState<{ before: string; after: string }[]>([]);

  const selectedField = fields.find(f => f.path.join('\u0001') === fieldPath?.join('\u0001'));
  const fieldLabel = fieldPath ? fieldPath.join('.') : '';

  const preview: EditResult | null = useMemo(() => {
    if (!parts || !fieldPath || !target.trim()) return null;
    return addShiftMapping(parts.spec, fieldPath, target);
  }, [parts, fieldPath, target]);

  const commit = (res: EditResult, message: string) => {
    if (!parts || !res.ok) return;
    const before = specText;
    const after = JSON.stringify(parts.rebuild(res.spec), null, 2);
    setHistory(h => [...h.slice(-19), { before, after }]);
    onSpecChange(after, message);
  };

  const handleAdd = () => {
    if (!parts || !fieldPath) return;
    const res = addShiftMapping(parts.spec, fieldPath, target);
    if (res.ok) {
      commit(res, `Campo "${fieldLabel}" adicionado ao layout.`);
      setFieldPath(null);
      setTarget('');
      setSearch('');
    }
  };

  const lastChange = history[history.length - 1];
  const canUndo = !!lastChange && lastChange.after === specText;
  const handleUndo = () => {
    if (!lastChange || !canUndo) return;
    setHistory(h => h.slice(0, -1));
    onSpecChange(lastChange.before, 'Última alteração desfeita.');
  };

  const visibleMappings = useMemo(() => {
    const q = mappingFilter.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter(m => m.source.toLowerCase().includes(q) || m.targets.some(t => t.toLowerCase().includes(q)));
  }, [mappings, mappingFilter]);

  const typedPath = search.trim();
  const typedMatchesExisting = fields.some(f => f.label === typedPath);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <SheetHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <Wrench className="h-4 w-4 text-primary" /> Manutenção do layout
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            Mexa em um layout que já existe sem refazer: acrescente campos, troque destinos ou remova. Só a operação <strong>shift</strong> é alterada; o resto da spec fica como está.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {!layout && (
            <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Cole ou carregue um layout no editor <strong>Jolt Spec</strong> para usar a manutenção.
            </p>
          )}
          {layout && !layout.ok && (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {layout.error}
            </p>
          )}

          {parts && (
            <>
              {/* ── Adicionar campo ── */}
              <section className="space-y-3" aria-labelledby="manut-add">
                <h3 id="manut-add" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Adicionar campo</h3>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground">Campo da entrada</label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={pickerOpen} className="h-9 w-full justify-between rounded-xl px-3 text-xs font-bold">
                        <span className={cn('truncate font-code', !fieldPath && 'font-sans text-muted-foreground')}>
                          {fieldLabel || (parsedInput ? 'Escolha um campo da entrada' : 'Digite o caminho do campo')}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(470px,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar campo, ex.: minimumExpiration" value={search} onValueChange={setSearch} />
                        <CommandList className="max-h-[260px]">
                          <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                            {parsedInput ? 'Nenhum campo com esse nome.' : 'Sem JSON de entrada: digite o caminho (ex.: items.*.campo) e escolha a opção abaixo.'}
                          </CommandEmpty>
                          <CommandGroup>
                            {fields.map(f => (
                              <CommandItem
                                key={f.label}
                                value={f.label}
                                onSelect={() => {
                                  setFieldPath(f.path);
                                  setPickerOpen(false);
                                }}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="min-w-0 flex-1 truncate font-code">{f.label}</span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">{formatExample(f.example)}</span>
                                <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[9px] font-bold', USAGE_LABEL[f.usage].className)}>
                                  {USAGE_LABEL[f.usage].text}
                                </Badge>
                                <Check className={cn('h-3.5 w-3.5 shrink-0', selectedField?.label === f.label ? 'opacity-100' : 'opacity-0')} />
                              </CommandItem>
                            ))}
                            {typedPath && !typedMatchesExisting && (
                              <CommandItem
                                forceMount
                                value={`__custom__${typedPath}`}
                                onSelect={() => {
                                  setFieldPath(typedPath.split('.').filter(Boolean));
                                  setPickerOpen(false);
                                }}
                                className="text-xs"
                              >
                                Usar o caminho “<span className="font-code">{typedPath}</span>”
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="manut-target" className="text-[11px] font-bold text-foreground">Nome na saída</label>
                  <Input
                    id="manut-target"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && preview?.ok) handleAdd();
                    }}
                    placeholder="Ex.: vencimentoDias"
                    className="h-9 rounded-xl text-xs font-code"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Só o nome já basta: o painel copia o padrão dos campos vizinhos (ex.: <span className="font-code">items.[&amp;1].</span>). Para um caminho diferente, digite o caminho completo.
                  </p>
                </div>

                {preview && (
                  <div
                    className={cn(
                      'rounded-xl border p-3 text-xs',
                      preview.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5 text-destructive'
                    )}
                    role="status"
                  >
                    {preview.ok ? (
                      <>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Vai entrar na spec</p>
                        <code className="block break-all font-code text-[11px] text-foreground">{preview.summary}</code>
                      </>
                    ) : (
                      <p className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {preview.reason}</p>
                    )}
                  </div>
                )}

                <Button onClick={handleAdd} disabled={!preview?.ok} className="h-9 w-full gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider">
                  <Plus className="h-3.5 w-3.5" /> Adicionar ao layout
                </Button>
                {canUndo && (
                  <Button variant="ghost" onClick={handleUndo} className="h-8 w-full gap-1.5 rounded-xl text-[11px] font-bold">
                    <Undo2 className="h-3.5 w-3.5" /> Desfazer a última alteração
                  </Button>
                )}
              </section>

              {/* ── Campos sem uso ── */}
              <section className="space-y-2" aria-labelledby="manut-unused">
                <h3 id="manut-unused" className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Campos da entrada que a spec não usa
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{parsedInput ? unused.length : '—'}</Badge>
                </h3>
                {!parsedInput && <p className="text-xs text-muted-foreground">Cole o JSON de entrada para ver quais campos o layout ainda não usa.</p>}
                {parsedInput && unused.length === 0 && <p className="text-xs text-muted-foreground">Todos os campos da entrada já são usados pelo layout.</p>}
                {unused.length > 0 && (
                  <ul className="max-h-[220px] space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
                    {unused.map(f => (
                      <li key={f.label}>
                        <button
                          type="button"
                          onClick={() => setFieldPath(f.path)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                            selectedField?.label === f.label && 'bg-muted'
                          )}
                          title="Usar este campo no formulário acima"
                        >
                          <span className="min-w-0 flex-1 truncate font-code">{f.label}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatExample(f.example)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {parsedInput && unused.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">Nem todo campo precisa entrar no layout: esta lista só mostra o que ele ainda ignora.</p>
                )}
              </section>

              {/* ── Mapeamentos existentes ── */}
              <section className="space-y-2" aria-labelledby="manut-list">
                <h3 id="manut-list" className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Mapeamentos do layout
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{mappings.length}</Badge>
                </h3>
                {mappings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Este layout ainda não tem nenhum mapeamento em uma operação shift.</p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={mappingFilter}
                        onChange={e => setMappingFilter(e.target.value)}
                        placeholder="Filtrar por campo ou destino"
                        aria-label="Filtrar mapeamentos"
                        className="h-8 rounded-xl pl-8 text-xs"
                      />
                    </div>
                    <ul className="space-y-1.5">
                      {visibleMappings.map(m => (
                        <MappingRow
                          key={m.id}
                          mapping={m}
                          confirming={confirmRemoveId === m.id}
                          onConfirmChange={flag => setConfirmRemoveId(flag ? m.id : null)}
                          onChangeTarget={targets => {
                            const res = updateMappingTargets(parts.spec, m, targets);
                            if (res.ok) commit(res, `Destino de "${m.source}" atualizado.`);
                            return res;
                          }}
                          onRemove={() => {
                            const res = removeMapping(parts.spec, m);
                            if (res.ok) {
                              commit(res, `Mapeamento de "${m.source}" removido.`);
                              setConfirmRemoveId(null);
                            }
                          }}
                        />
                      ))}
                      {visibleMappings.length === 0 && <li className="text-xs text-muted-foreground">Nenhum mapeamento com esse filtro.</li>}
                    </ul>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MappingRowProps {
  mapping: ShiftMapping;
  confirming: boolean;
  onConfirmChange: (flag: boolean) => void;
  onChangeTarget: (targets: string[]) => EditResult;
  onRemove: () => void;
}

function MappingRow({ mapping, confirming, onConfirmChange, onChangeTarget, onRemove }: MappingRowProps) {
  const original = mapping.targets.join(', ');
  const [draft, setDraft] = useState(original);
  const [error, setError] = useState<string | null>(null);

  // Quando a spec muda por fora (ou depois de salvar), o campo volta a refletir o que está nela.
  React.useEffect(() => {
    setDraft(original);
    setError(null);
  }, [original]);

  const save = () => {
    if (draft.trim() === original) return;
    const res = onChangeTarget(draft.split(',').map(t => t.trim()).filter(Boolean));
    if (!res.ok) setError(res.reason);
    else setError(null);
  };

  return (
    <li className="rounded-xl border border-border p-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-code text-[11px] font-bold text-foreground" title={mapping.source}>{mapping.source}</span>
        {mapping.conditional && <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px] font-bold">condicional</Badge>}
        {confirming ? (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onRemove} className="text-[10px] font-bold text-destructive hover:underline">Remover</button>
            <button type="button" onClick={() => onConfirmChange(false)} className="text-[10px] font-bold text-muted-foreground hover:underline">Manter</button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConfirmChange(true)}
            aria-label={`Remover o mapeamento de ${mapping.source}`}
            title="Remover do layout"
            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(original);
            setError(null);
          }
        }}
        aria-label={`Destino de ${mapping.source}`}
        className="h-7 rounded-lg px-2 font-code text-[11px]"
      />
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </li>
  );
}
