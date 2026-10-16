'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Pencil, Save, Trash2, X } from 'lucide-react';
import { ConfirmDialog, FIELD, IconButton, Modal, ModalButton } from '@/components/room-kit';
import { TEMPLATE_NAME_MAX, deleteTemplate, listTemplates, renameTemplate, saveTemplate, templateFromRoom, type PokerTemplate } from '@/lib/poker-templates';
import { useToast } from '@/hooks/use-toast';
import type { DeckType, Issue, Room } from '@/lib/types';
import { cn } from '@/lib/utils';

const DECK_NAMES: Record<string, string> = { fibonacci: 'Fibonacci', hours: 'Horas reais', tshirt: 'Camisetas' };

/** Pede o nome e salva a configuração atual da sala como template. */
export function SaveTemplateDialog({ open, onOpenChange, defaultName, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState(false);

  // Cada abertura recomeça do nome sugerido.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reabrir recomeça do nome sugerido
    if (open) { setName(defaultName); setError(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    if (!name.trim()) { setError(true); return; }
    onSave(name);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={Save}
      title="Salvar como template"
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={submit}>Salvar template</ModalButton>
        </>
      }
    >
      <form className="flex flex-col gap-1.5 pt-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
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

/** Lista dos templates salvos neste navegador: renomear e excluir. */
export function TemplateList({ templates, onRename, onDelete }: {
  templates: readonly PokerTemplate[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<PokerTemplate | null>(null);

  if (templates.length === 0) return <p className="m-0 text-sm text-muted-foreground">Nenhum template salvo.</p>;

  const commit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft);
    setEditingId(null);
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
                    onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditingId(null); }}
                    className={cn(FIELD, 'h-9 text-[13px]')}
                  />
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {DECK_NAMES[t.deckType] ?? t.deckType} · {t.backlog.length} {t.backlog.length === 1 ? 'tarefa' : 'tarefas'}
                </span>
              </div>
              {editing ? (
                <>
                  <IconButton label="Salvar nome" icon={Check} size="sm" onClick={commit} />
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
        description={deleting ? <>O template <strong className="text-foreground">{deleting.name}</strong> some deste navegador.</> : undefined}
        confirmLabel="Excluir"
        onConfirm={() => { if (deleting) onDelete(deleting.id); }}
      />
    </>
  );
}

/** Janela com a lista de templates (usada no Nova sessão). */
export function TemplateManagerDialog({ open, onOpenChange, templates, onRename, onDelete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: readonly PokerTemplate[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={Save}
      title="Templates salvos"
      footer={<ModalButton variant="primary" onClick={() => onOpenChange(false)}>Concluir</ModalButton>}
    >
      <div className="pt-2"><TemplateList templates={templates} onRename={onRename} onDelete={onDelete} /></div>
    </Modal>
  );
}

/** Aba "Sessão" das configurações da sala: salvar a configuração atual e cuidar dos templates salvos. */
export function TemplatesTab({ onSaveClick, version }: { onSaveClick?: () => void; version: number }) {
  // A lista vem do localStorage: relê a cada template salvo (version) e a cada renomear/excluir (tick).
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const templates = useMemo(() => listTemplates(), [version, tick]);

  return (
    <div className="flex flex-col gap-4">
      {onSaveClick && (
        <ModalButton onClick={onSaveClick} className="h-10 w-full justify-center gap-2">
          <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Salvar como template
        </ModalButton>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-foreground">Templates salvos</span>
        <TemplateList
          templates={templates}
          onRename={(id, name) => { renameTemplate(id, name); refresh(); }}
          onDelete={(id) => { deleteTemplate(id); refresh(); }}
        />
      </div>
    </div>
  );
}

/**
 * "Salvar como template" de uma sala em andamento: abre o diálogo do nome, grava e avisa.
 * Devolve o gatilho, o diálogo (para renderizar uma vez) e a versão (recarrega a lista de templates).
 */
export function useSaveRoomTemplate({ roomTitle, deck, settings, issues }: {
  roomTitle?: string;
  deck: DeckType;
  settings?: Room['settings'];
  issues: readonly Issue[];
}): { openDialog: () => void; dialog: ReactNode; version: number } {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const save = (name: string) => {
    const tpl = saveTemplate(templateFromRoom({ name, deckType: deck, settings, issues }));
    setVersion((v) => v + 1);
    toast({ title: 'Template salvo', description: tpl.name });
  };

  const dialog = <SaveTemplateDialog open={open} onOpenChange={setOpen} defaultName={roomTitle?.trim() || ''} onSave={save} />;
  return { openDialog: () => setOpen(true), dialog, version };
}
