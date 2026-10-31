'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CloudUpload, Pencil, Save, Trash2, X } from 'lucide-react';
import { ConfirmDialog, FIELD, IconButton, Modal, ModalButton } from '@/components/room-kit';
import { TEMPLATE_NAME_MAX, listTemplates, templateFromRoom, type PokerTemplate } from '@/lib/poker-templates';
import { importLocalTemplates, pokerTemplatesApi, type NewPokerTemplate } from '@/lib/poker-templates-api';
import { useToast } from '@/hooks/use-toast';
import type { DeckType, Issue, Room } from '@/lib/types';
import { cn } from '@/lib/utils';

const DECK_NAMES: Record<string, string> = { fibonacci: 'Fibonacci', hours: 'Horas reais', tshirt: 'Camisetas' };

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export interface SquadPokerTemplates {
  templates: PokerTemplate[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Templates que ficaram só neste navegador (versões antigas), prontos para levar à squad. */
  localCount: number;
  importing: boolean;
  refresh: () => Promise<void>;
  create: (t: NewPokerTemplate) => Promise<PokerTemplate>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  importLocal: () => Promise<{ imported: number; failed: number }>;
}

/**
 * Templates do Scrum Poker da squad, lidos do servidor. Sem squad (ou desligado) a lista fica vazia e nada é
 * buscado. As ações devolvem a promessa: quem chama mostra o erro (ex.: 403 de quem não salvou o template).
 */
export function useSquadPokerTemplates(squadId: string | undefined | null, enabled = true): SquadPokerTemplates {
  const [templates, setTemplates] = useState<PokerTemplate[]>([]);
  const [status, setStatus] = useState<SquadPokerTemplates['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [importing, setImporting] = useState(false);
  // Troca rápida de squad: só a resposta da última busca vale.
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    setLocalCount(listTemplates().length);
    if (!squadId) { setTemplates([]); setStatus('idle'); return; }
    const req = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const list = await pokerTemplatesApi.list(squadId);
      if (req !== requestRef.current) return;
      setTemplates(list);
      setStatus('ready');
    } catch (err) {
      if (req !== requestRef.current) return;
      setTemplates([]);
      setError(errorMessage(err, 'Não foi possível carregar os templates da squad.'));
      setStatus('error');
    }
  }, [squadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir/trocar de squad
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const create = useCallback(async (t: NewPokerTemplate) => {
    if (!squadId) throw new Error('Escolha a squad da sala antes de salvar o template.');
    const saved = await pokerTemplatesApi.create(squadId, t);
    setTemplates((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
    return saved;
  }, [squadId]);

  const rename = useCallback(async (id: string, name: string) => {
    if (!squadId) return;
    const saved = await pokerTemplatesApi.rename(squadId, id, name);
    setTemplates((prev) => prev.map((p) => (p.id === id ? saved : p)));
  }, [squadId]);

  const remove = useCallback(async (id: string) => {
    if (!squadId) return;
    await pokerTemplatesApi.remove(squadId, id);
    setTemplates((prev) => prev.filter((p) => p.id !== id));
  }, [squadId]);

  const importLocal = useCallback(async () => {
    if (!squadId) return { imported: 0, failed: 0 };
    setImporting(true);
    try {
      const result = await importLocalTemplates(squadId);
      await refresh();
      return result;
    } finally {
      setImporting(false);
    }
  }, [squadId, refresh]);

  return { templates, status, error, localCount, importing, refresh, create, rename, remove, importLocal };
}

/** Pede o nome e salva a configuração atual da sala como template. */
export function SaveTemplateDialog({ open, onOpenChange, defaultName, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  /** Resolve quando salvou; rejeitar mantém o diálogo aberto. */
  onSave: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cada abertura recomeça do nome sugerido.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reabrir recomeça do nome sugerido
    if (open) { setName(defaultName); setError(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) { setError(true); return; }
    setSaving(true);
    try {
      await onSave(name);
      onOpenChange(false);
    } catch {
      // quem salvou já avisou do erro; o diálogo fica aberto para tentar de novo
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={Save}
      title="Salvar como template"
      description="Fica disponível para toda a squad na Nova sessão."
      preventClose={saving}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={saving}>{saving ? 'Salvando…' : 'Salvar template'}</ModalButton>
        </>
      }
    >
      <form className="flex flex-col gap-1.5 pt-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label htmlFor="tpl-name" className="text-[13px] font-semibold text-foreground">Nome do template</label>
        <input
          id="tpl-name"
          autoFocus
          maxLength={TEMPLATE_NAME_MAX}
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError(false); }}
          placeholder="Ex.: Refinamento quinzenal"
          aria-invalid={error}
          aria-describedby={error ? 'tpl-name-error' : undefined}
          className={cn(FIELD, 'h-10', error && 'border-red-500/70')}
        />
        {error && <span id="tpl-name-error" className="text-xs text-red-700 dark:text-red-300">Dê um nome ao template.</span>}
      </form>
    </Modal>
  );
}

/** Aviso dos templates que ficaram só neste navegador, com o botão de levar para a squad. */
export function LocalTemplatesNotice({ store }: { store: SquadPokerTemplates }) {
  const { toast } = useToast();
  if (store.localCount === 0 || store.status === 'idle') return null;

  const run = async () => {
    const { imported, failed } = await store.importLocal();
    if (failed === 0) {
      toast({ title: imported === 1 ? 'Template levado para a squad' : `${imported} templates levados para a squad` });
    } else {
      toast({ variant: 'destructive', title: 'Alguns templates não foram enviados', description: `${imported} enviados, ${failed} continuam neste navegador. Tente de novo.` });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-muted/30 px-3.5 py-2.5">
      <CloudUpload aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
      <p className="m-0 min-w-0 flex-1 text-[13px] text-muted-foreground">
        {store.localCount === 1 ? '1 template está salvo só neste navegador.' : `${store.localCount} templates estão salvos só neste navegador.`}
      </p>
      <ModalButton onClick={run} disabled={store.importing || store.status !== 'ready'} className="h-8 text-[13px]">
        {store.importing ? 'Enviando…' : 'Levar para a squad'}
      </ModalButton>
    </div>
  );
}

/** Lista dos templates da squad: renomear e excluir (o servidor só deixa quem salvou ou a liderança). */
export function TemplateList({ templates, onRename, onDelete }: {
  templates: readonly PokerTemplate[];
  onRename: (id: string, name: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<PokerTemplate | null>(null);

  if (templates.length === 0) return <p className="m-0 text-sm text-muted-foreground">Nenhum template da squad ainda.</p>;

  const commit = async () => {
    const id = editingId;
    setEditingId(null);
    if (!id || !draft.trim()) return;
    try {
      await onRename(id, draft);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível renomear', description: errorMessage(err, 'Tente de novo.') });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await onDelete(deleting.id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível excluir', description: errorMessage(err, 'Tente de novo.') });
    }
  };

  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0">
        {templates.map((t) => {
          const editing = editingId === t.id;
          return (
            <li key={t.id} className="flex items-center gap-2 border-b border-border py-2.5 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {editing ? (
                  <input
                    autoFocus
                    aria-label="Novo nome do template"
                    maxLength={TEMPLATE_NAME_MAX}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setEditingId(null); }}
                    className={cn(FIELD, 'h-9 text-[13px]')}
                  />
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {DECK_NAMES[t.deckType] ?? t.deckType} · {t.backlog.length} {t.backlog.length === 1 ? 'tarefa' : 'tarefas'}
                  {t.createdByName ? ` · por ${t.createdByName}` : ''}
                </span>
              </div>
              {editing ? (
                <>
                  <IconButton label="Salvar nome" icon={Check} size="sm" onClick={() => void commit()} />
                  <IconButton label="Cancelar" icon={X} size="sm" onClick={() => setEditingId(null)} />
                </>
              ) : (
                <>
                  <IconButton label={`Renomear ${t.name}`} icon={Pencil} size="sm" onClick={() => { setEditingId(t.id); setDraft(t.name); }} />
                  <IconButton label={`Excluir ${t.name}`} icon={Trash2} size="sm" onClick={() => setDeleting(t)} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        tone="danger"
        icon={Trash2}
        title="Excluir template?"
        description={deleting ? <>O template <strong className="text-foreground">{deleting.name}</strong> deixa de aparecer para toda a squad.</> : undefined}
        confirmLabel="Excluir"
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

/** Estado da lista: carregando, erro com "Tentar de novo" ou a lista. */
function TemplatesBody({ store }: { store: SquadPokerTemplates }) {
  if (store.status === 'idle') return <p className="m-0 text-sm text-muted-foreground">Escolha a squad da sala para ver os templates.</p>;
  if (store.status === 'loading' && store.templates.length === 0) {
    return <div aria-hidden="true" className="h-14 rounded-xl bg-muted/40 motion-safe:animate-pulse" />;
  }
  if (store.status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 min-w-0 flex-1 text-sm text-muted-foreground">{store.error}</p>
        <ModalButton onClick={() => void store.refresh()} className="h-8 text-[13px]">Tentar de novo</ModalButton>
      </div>
    );
  }
  return <TemplateList templates={store.templates} onRename={store.rename} onDelete={store.remove} />;
}

/** Janela com a lista de templates (usada no Nova sessão). */
export function TemplateManagerDialog({ open, onOpenChange, store }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: SquadPokerTemplates;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={Save}
      title="Templates da squad"
      description="Toda a squad vê e usa. Renomear e excluir: quem salvou ou a liderança."
      footer={<ModalButton variant="primary" onClick={() => onOpenChange(false)}>Concluir</ModalButton>}
    >
      <div className="flex flex-col gap-3 pt-2">
        <LocalTemplatesNotice store={store} />
        <TemplatesBody store={store} />
      </div>
    </Modal>
  );
}

/** Aba "Sessão" das configurações da sala: salvar a configuração atual e cuidar dos templates da squad. */
export function TemplatesTab({ onSaveClick, version, squadId }: { onSaveClick?: () => void; version: number; squadId?: string }) {
  const store = useSquadPokerTemplates(squadId);
  const { refresh } = store;
  // Template salvo pelo diálogo da sala (outra instância do hook): relê a lista.
  const firstVersion = useRef(version);
  useEffect(() => {
    if (version !== firstVersion.current) void refresh();
  }, [version, refresh]);

  return (
    <div className="flex flex-col gap-4">
      {onSaveClick && (
        <ModalButton onClick={onSaveClick} className="h-10 w-full justify-center gap-2">
          <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Salvar como template
        </ModalButton>
      )}
      <LocalTemplatesNotice store={store} />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-foreground">Templates da squad</span>
        <TemplatesBody store={store} />
      </div>
    </div>
  );
}

/**
 * "Salvar como template" de uma sala em andamento: abre o diálogo do nome, grava na squad da sala e avisa.
 * Devolve o gatilho, o diálogo (para renderizar uma vez) e a versão (recarrega a lista de templates).
 */
export function useSaveRoomTemplate({ roomTitle, deck, settings, issues, squadId }: {
  roomTitle?: string;
  deck: DeckType;
  settings?: Room['settings'];
  issues: readonly Issue[];
  squadId?: string;
}): { openDialog: () => void; dialog: ReactNode; version: number } {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const save = async (name: string) => {
    if (!squadId) {
      toast({ variant: 'destructive', title: 'Sala sem squad', description: 'Só dá para salvar template de uma sala ligada a uma squad.' });
      throw new Error('sem squad');
    }
    try {
      const tpl = await pokerTemplatesApi.create(squadId, templateFromRoom({ name, deckType: deck, settings, issues }));
      setVersion((v) => v + 1);
      toast({ title: 'Template salvo para a squad', description: tpl.name });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar o template', description: errorMessage(err, 'Tente de novo.') });
      throw err;
    }
  };

  const dialog = <SaveTemplateDialog open={open} onOpenChange={setOpen} defaultName={roomTitle?.trim() || ''} onSave={save} />;
  return { openDialog: () => setOpen(true), dialog, version };
}
