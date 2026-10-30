'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Undo2, Wrench, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ModalButton } from '@/components/room-kit';
import { FIELD } from '@/components/room-kit/tokens';
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
import { FIELD_LABEL } from './LayoutCard';
import { Notice } from './JoltBits';

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
  mapped: { text: 'mapeado', className: 'text-emerald-700 dark:text-emerald-300' },
  indirect: { text: 'em outra operação', className: 'text-amber-700 dark:text-amber-300' },
  unused: { text: 'sem uso', className: 'text-muted-foreground' },
};

function formatExample(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  const s = typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
  return s.length > 28 ? s.slice(0, 27) + '…' : s;
}

/** Tecla Esc dentro da edição de uma linha só cancela a edição: não fecha a folha inteira. */
const LOCAL_ESC_ATTR = 'data-esc-local';

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
  const [pickedPath, setPickedPath] = useState<string[] | null>(null);
  const [freePath, setFreePath] = useState('');
  const [target, setTarget] = useState('');
  const [mappingFilter, setMappingFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Só desfaz se o editor ainda estiver exatamente como o painel deixou.
  const [history, setHistory] = useState<{ before: string; after: string; label: string }[]>([]);

  // O caminho livre vale mais do que o escolhido na lista (a pessoa digitou por cima).
  const fieldPath = freePath.trim() ? freePath.trim().split('.').filter(Boolean) : pickedPath;
  const fieldLabel = fieldPath ? fieldPath.join('.') : '';
  const selectedField = fields.find(f => f.path.join('\u0001') === fieldPath?.join('\u0001'));

  const preview: EditResult | null = useMemo(() => {
    if (!parts || !fieldPath || !target.trim()) return null;
    return addShiftMapping(parts.spec, fieldPath, target);
  }, [parts, fieldPath, target]);

  const commit = (res: EditResult, message: string, label: string) => {
    if (!parts || !res.ok) return;
    const before = specText;
    const after = JSON.stringify(parts.rebuild(res.spec), null, 2);
    setHistory(h => [...h.slice(-19), { before, after, label }]);
    onSpecChange(after, message);
  };

  const handleAdd = () => {
    if (!parts || !fieldPath) return;
    const res = addShiftMapping(parts.spec, fieldPath, target);
    if (res.ok) {
      commit(res, `Campo "${fieldLabel}" adicionado ao layout.`, `adicionou ${fieldLabel}`);
      setPickedPath(null);
      setFreePath('');
      setTarget('');
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

  // Ao fechar a folha, a edição e a confirmação em andamento não ficam penduradas para a próxima abertura.
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setConfirmRemoveId(null);
      setPickerOpen(false);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-[600px]"
        onEscapeKeyDown={(e) => {
          const active = document.activeElement as HTMLElement | null;
          if (active?.hasAttribute(LOCAL_ESC_ATTR)) e.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-border px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight">
            <Wrench className="h-5 w-5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            Manutenção da spec
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Mexa na spec por campo, sem editar o JSON à mão. Só a operação <strong>shift</strong> é alterada; o resto da spec fica como está.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {!layout && (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Cole ou carregue um layout no editor <strong>Spec</strong> para usar a manutenção.
            </p>
          )}
          {layout && !layout.ok && (
            <Notice tone="danger" icon={TriangleAlert} role="alert" className="text-[13px]">{layout.error}</Notice>
          )}

          {parts && (
            <>
              {/* ── Adicionar campo ── */}
              <section className="space-y-3 rounded-2xl border border-border p-4" aria-labelledby="manut-add">
                <h3 id="manut-add" className="text-[15px] font-bold text-foreground">Adicionar campo</h3>

                <div className="flex flex-col gap-1.5">
                  <span id="manut-campo-rotulo" className={FIELD_LABEL}>Campo da entrada</span>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-labelledby="manut-campo-rotulo"
                        aria-expanded={pickerOpen}
                        disabled={!parsedInput}
                        className="h-10 w-full justify-between rounded-[10px] bg-muted/40 px-3 text-[13px] font-normal"
                      >
                        <span className={cn('truncate font-code', !fieldPath && 'font-sans text-muted-foreground')}>
                          {fieldLabel || (parsedInput ? 'Escolha um campo da entrada' : 'Cole o JSON de entrada para listar os campos')}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar campo, ex.: minimumExpiration" aria-label="Buscar campo da entrada" />
                        <CommandList className="max-h-[260px]">
                          <CommandEmpty className="py-3 text-center text-[13px] text-muted-foreground">Nenhum campo com esse nome.</CommandEmpty>
                          <CommandGroup>
                            {fields.map(f => (
                              <CommandItem
                                key={f.label}
                                value={f.label}
                                onSelect={() => {
                                  setPickedPath(f.path);
                                  setFreePath('');
                                  setPickerOpen(false);
                                }}
                                className="flex items-center justify-between gap-3 text-[13px]"
                              >
                                <span className="min-w-0 flex-1 truncate font-code">{f.label}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{formatExample(f.example)}</span>
                                <span className={cn('shrink-0 text-xs font-semibold', USAGE_LABEL[f.usage].className)}>{USAGE_LABEL[f.usage].text}</span>
                                <Check className={cn('h-3.5 w-3.5 shrink-0', selectedField?.label === f.label ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="manut-livre" className={FIELD_LABEL}>Ou digite um caminho livre</label>
                  <input
                    id="manut-livre"
                    value={freePath}
                    onChange={(e) => setFreePath(e.target.value)}
                    placeholder="pedido.cliente.cidade"
                    spellCheck={false}
                    className={cn(FIELD, 'h-10 font-code text-[13px]')}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="manut-target" className={FIELD_LABEL}>Destino na saída</label>
                  <input
                    id="manut-target"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && preview?.ok) handleAdd();
                    }}
                    placeholder="Ex.: vencimentoDias"
                    spellCheck={false}
                    className={cn(FIELD, 'h-10 font-code text-[13px]')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Só o nome já basta: copiamos o padrão dos campos vizinhos (ex.: <span className="font-code">items.[&amp;1].</span>). Para um caminho diferente, digite o caminho completo.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className={FIELD_LABEL}>Vai entrar na spec</span>
                  {preview ? (
                    <pre
                      role="status"
                      className={cn(
                        'overflow-auto rounded-[10px] px-3 py-2.5 font-code text-xs leading-relaxed',
                        preview.ok ? 'bg-muted text-foreground' : 'border border-red-500/40 bg-red-500/10 font-sans text-[13px] text-red-800 dark:text-red-300',
                      )}
                    >
                      {preview.ok ? preview.summary : preview.reason}
                    </pre>
                  ) : (
                    <span className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                      Escolha o campo e o destino para ver o que entra na spec.
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <ModalButton variant="primary" onClick={handleAdd} disabled={!preview?.ok} className="h-10 gap-2">
                    <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    Adicionar à spec
                  </ModalButton>
                </div>
              </section>

              {/* ── Campos sem uso ── */}
              <section className="space-y-2.5" aria-labelledby="manut-unused">
                <h3 id="manut-unused" className="text-[15px] font-bold text-foreground">
                  Campos que a spec não usa ({parsedInput ? unused.length : '—'})
                </h3>
                {!parsedInput && <p className="text-[13px] text-muted-foreground">Cole o JSON de entrada para ver quais campos o layout ainda não usa.</p>}
                {parsedInput && unused.length === 0 && <p className="text-[13px] text-muted-foreground">A spec usa todos os campos da entrada.</p>}
                {unused.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unused.map(f => (
                      <button
                        key={f.label}
                        type="button"
                        aria-label={`Escolher ${f.label} para adicionar`}
                        onClick={() => {
                          setPickedPath(f.path);
                          setFreePath('');
                        }}
                        className={cn(
                          'h-8 rounded-full border border-border px-3 font-code text-xs text-foreground transition-colors duration-fast hover:bg-accent',
                          selectedField?.label === f.label && 'border-primary/60 bg-primary/10',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
                {parsedInput && unused.length > 0 && (
                  <p className="text-xs text-muted-foreground">Nem todo campo precisa entrar no layout: esta lista só mostra o que ele ainda ignora.</p>
                )}
              </section>

              {/* ── Mapeamentos existentes ── */}
              <section className="space-y-2.5" aria-labelledby="manut-list">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="manut-list" className="text-[15px] font-bold text-foreground">Mapeamentos ({mappings.length})</h3>
                  {mappings.length > 0 && (
                    <input
                      aria-label="Filtrar mapeamentos"
                      value={mappingFilter}
                      onChange={e => setMappingFilter(e.target.value)}
                      placeholder="Filtrar"
                      className={cn(FIELD, 'h-9 w-[180px] text-[13px]')}
                    />
                  )}
                </div>
                {mappings.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Esta spec ainda não tem nenhum mapeamento em uma operação shift.</p>
                ) : (
                  <ul className="overflow-hidden rounded-xl border border-border">
                    {visibleMappings.map(m => (
                      <MappingRow
                        key={m.id}
                        mapping={m}
                        editing={editingId === m.id}
                        confirming={confirmRemoveId === m.id}
                        onEdit={flag => {
                          setEditingId(flag ? m.id : null);
                          setConfirmRemoveId(null);
                        }}
                        onAskRemove={flag => {
                          setConfirmRemoveId(flag ? m.id : null);
                          setEditingId(null);
                        }}
                        onChangeTarget={targets => {
                          const res = updateMappingTargets(parts.spec, m, targets);
                          if (res.ok) {
                            commit(res, `Destino de "${m.source}" atualizado.`, `mudou o destino de ${m.source}`);
                            setEditingId(null);
                          }
                          return res;
                        }}
                        onRemove={() => {
                          const res = removeMapping(parts.spec, m);
                          if (res.ok) {
                            commit(res, `Mapeamento de "${m.source}" removido.`, `removeu ${m.source}`);
                            setConfirmRemoveId(null);
                          }
                        }}
                      />
                    ))}
                    {visibleMappings.length === 0 && <li className="px-3 py-3.5 text-[13px] text-muted-foreground">Nenhum mapeamento com esse filtro.</li>}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5">
          <span className="text-[13px] leading-snug text-muted-foreground">
            {lastChange && canUndo ? `Última alteração: ${lastChange.label}.` : 'Nenhuma alteração ainda nesta sessão.'}
          </span>
          <span className="inline-flex gap-2">
            <ModalButton onClick={handleUndo} disabled={!canUndo} className="h-10 gap-2">
              <Undo2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Desfazer a última
            </ModalButton>
            <ModalButton variant="primary" onClick={() => onOpenChange(false)} className="h-10">Fechar</ModalButton>
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MappingRowProps {
  mapping: ShiftMapping;
  editing: boolean;
  confirming: boolean;
  onEdit: (flag: boolean) => void;
  onAskRemove: (flag: boolean) => void;
  onChangeTarget: (targets: string[]) => EditResult;
  onRemove: () => void;
}

function MappingRow({ mapping, editing, confirming, onEdit, onAskRemove, onChangeTarget, onRemove }: MappingRowProps) {
  const original = mapping.targets.join(', ');
  const [draft, setDraft] = useState(original);
  const [error, setError] = useState<string | null>(null);

  // Quando a spec muda por fora (ou depois de salvar), o campo volta a refletir o que está nela.
  useEffect(() => {
    setDraft(original);
    setError(null);
  }, [original, editing]);

  const save = () => {
    if (draft.trim() === original) {
      onEdit(false);
      return;
    }
    const res = onChangeTarget(draft.split(',').map(t => t.trim()).filter(Boolean));
    setError(res.ok ? null : res.reason);
  };

  return (
    <li className={cn('flex flex-col gap-2 border-t border-border px-3 py-2.5 first:border-t-0', confirming && 'bg-red-500/5')}>
      <div className="flex items-center gap-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 font-code text-[13px]">
          <span className="truncate text-muted-foreground" title={mapping.source}>{mapping.source}</span>
          <span aria-hidden="true" className="text-primary [.theme-totvs:not(.dark)_&]:text-foreground">→</span>
          <strong className="truncate font-semibold text-foreground" title={original}>{original}</strong>
          {mapping.conditional && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground">condicional</span>}
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onEdit(!editing)}
          aria-label={`Editar destino de ${mapping.source}`}
          aria-expanded={editing}
          className="h-8 rounded-lg px-2.5 text-xs font-semibold"
        >
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onAskRemove(!confirming)}
          aria-label={`Remover ${mapping.source}`}
          className="h-8 rounded-lg px-2.5 text-xs font-semibold text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
        >
          Remover
        </Button>
      </div>
      {editing && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              {...{ [LOCAL_ESC_ATTR]: 'true' }}
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') {
                  setDraft(original);
                  setError(null);
                  onEdit(false);
                }
              }}
              aria-label={`Novo destino de ${mapping.source}`}
              spellCheck={false}
              className={cn(FIELD, 'h-9 flex-1 font-code text-[13px]')}
            />
            <ModalButton variant="primary" onClick={save} className="h-9 text-[13px]">Salvar</ModalButton>
            <ModalButton onClick={() => onEdit(false)} className="h-9 text-[13px]">Cancelar</ModalButton>
          </div>
          <p className="text-xs text-muted-foreground">Separe vários destinos com vírgula. Esc cancela a edição.</p>
          {error && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
        </div>
      )}
      {confirming && (
        <div role="alert" className="flex items-center gap-2 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] text-foreground">
          <span className="flex-1">Remover este mapeamento da spec?</span>
          <ModalButton variant="danger" onClick={onRemove} className="h-8 text-[13px]">Remover</ModalButton>
          <ModalButton onClick={() => onAskRemove(false)} className="h-8 text-[13px]">Manter</ModalButton>
        </div>
      )}
    </li>
  );
}
