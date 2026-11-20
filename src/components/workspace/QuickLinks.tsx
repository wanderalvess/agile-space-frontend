'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  Book,
  Briefcase,
  Code2,
  ExternalLink,
  Figma,
  Github,
  Globe,
  Layout,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Trello,
  type LucideIcon,
} from 'lucide-react';
import { IconButton, Modal, ModalButton } from '@/components/room-kit';
import { EmptyState, ErrorState } from '@/components/page';
import { PAGE_CARD } from '@/components/page/styles';
import { normalizeHttpUrl, safeHref } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import { Field, TEXT_INPUT, WorkspaceSectionHeader } from './workspace-ui';

export interface QuickLinkData {
  id: string;
  name: string;
  url: string;
  iconType: string;
  color: string;
  createdAt?: string;
}

export interface QuickLinkInput {
  id?: string;
  name: string;
  url: string;
  iconType: string;
  color: string;
  createdAt?: string;
}

interface QuickLinksProps {
  links: QuickLinkData[];
  loadError?: boolean;
  onRetry?: () => void;
  /** Devolve true quando salvou; em falha o diálogo continua aberto com o que foi digitado. */
  onSaveLink: (link: QuickLinkInput) => Promise<boolean | void> | boolean | void;
  onDeleteLink: (id: string) => void;
  /** Pedido de abrir "Novo atalho" (vindo da paleta de comandos). */
  openNew?: boolean;
  onOpenNewHandled?: () => void;
}

const ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'globe', label: 'Globo', Icon: Globe },
  { key: 'github', label: 'GitHub', Icon: Github },
  { key: 'figma', label: 'Figma', Icon: Figma },
  { key: 'trello', label: 'Trello', Icon: Trello },
  { key: 'layout', label: 'Layout', Icon: Layout },
  { key: 'book', label: 'Livro', Icon: Book },
  { key: 'code', label: 'Código', Icon: Code2 },
  { key: 'briefcase', label: 'Pasta', Icon: Briefcase },
  { key: 'link', label: 'Link', Icon: Link2 },
];

/**
 * As 5 cores. `value` é o que fica gravado (atalhos antigos continuam casando); `tile` é como aparece, com par
 * claro/escuro para valer nos dois modos.
 */
const COLORS = [
  { name: 'Azul', value: 'text-blue-500 bg-blue-50', tile: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', swatch: 'bg-blue-500' },
  { name: 'Verde', value: 'text-emerald-500 bg-emerald-50', tile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', swatch: 'bg-emerald-500' },
  { name: 'Roxo', value: 'text-purple-500 bg-purple-50', tile: 'bg-purple-500/15 text-purple-700 dark:text-purple-300', swatch: 'bg-purple-500' },
  { name: 'Laranja', value: 'text-orange-500 bg-orange-50', tile: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', swatch: 'bg-orange-500' },
  { name: 'Cinza', value: 'text-slate-900 bg-slate-100', tile: 'bg-muted text-foreground', swatch: 'bg-muted-foreground' },
];

function colorFor(stored: string) {
  return COLORS.find((c) => c.value === stored) ?? COLORS[0];
}

const EMPTY_FORM = { name: '', url: '', iconType: 'globe', color: COLORS[0].value };

export function QuickLinks({ links, loadError, onRetry, onSaveLink, onDeleteLink, openNew, onOpenNewHandled }: QuickLinksProps) {
  const uid = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickLinkData | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [urlError, setUrlError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openDialog = (link?: QuickLinkData) => {
    setEditing(link ?? null);
    setForm(link ? { name: link.name, url: link.url, iconType: link.iconType || 'globe', color: colorFor(link.color).value } : EMPTY_FORM);
    setUrlError('');
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!openNew) return;
    openDialog();
    onOpenNewHandled?.();
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = form.name.trim().length > 0 && form.url.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const url = normalizeHttpUrl(form.url);
    if (!url) {
      setUrlError('Informe um endereço válido, como jira.suaempresa.com/board.');
      return;
    }
    setUrlError('');
    setIsSubmitting(true);
    try {
      const ok = await onSaveLink({
        ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
        name: form.name.trim(),
        url,
        iconType: form.iconType,
        color: form.color,
      });
      if (ok === false) return;
      setDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Meus atalhos"
        subtitle="Seus links rápidos"
        action={
          <ModalButton variant="primary" onClick={() => openDialog()}>
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo link
          </ModalButton>
        }
      />

      {loadError ? (
        <ErrorState title="Não foi possível carregar os atalhos" description="Verifique a conexão e tente de novo." onRetry={onRetry} />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Nenhum atalho configurado"
          description="Guarde aqui o Jira, o board de métricas, a wiki: um clique e abre."
          actions={
            <ModalButton variant="primary" onClick={() => openDialog()}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo link
            </ModalButton>
          }
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 p-0">
          {links.map((link) => {
            const Icon = ICONS.find((i) => i.key === link.iconType)?.Icon ?? Link2;
            return (
              <li key={link.id} className={cn(PAGE_CARD, 'group relative rounded-2xl transition-[border-color,box-shadow] duration-fast hover:border-primary/40 hover:shadow-md')}>
                <a
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 rounded-2xl p-4 pr-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', colorFor(link.color).tile)}>
                    <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{link.name}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                      Acessar <ExternalLink className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </span>
                </a>
                <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 flex-col gap-1">
                  <IconButton size="sm" icon={Pencil} label={`Editar atalho ${link.name}`} onClick={() => openDialog(link)} />
                  <IconButton size="sm" icon={Trash2} label={`Excluir atalho ${link.name}`} onClick={() => onDeleteLink(link.id)} className="hover:text-red-700 dark:hover:text-red-300" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="md"
        icon={Link2}
        title={editing ? 'Editar atalho' : 'Adicionar atalho'}
        preventClose={isSubmitting}
        footer={
          <>
            <ModalButton onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </ModalButton>
            <ModalButton variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
              Salvar atalho
            </ModalButton>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4 pt-2"
        >
          <Field label="Nome do atalho" htmlFor={`${uid}-name`}>
            <input
              id={`${uid}-name`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={255}
              autoComplete="off"
              placeholder="Ex: Jira Board da Squad"
              className={TEXT_INPUT}
            />
          </Field>
          <Field label="URL (endereço)" htmlFor={`${uid}-url`} error={urlError}>
            <input
              id={`${uid}-url`}
              value={form.url}
              onChange={(e) => {
                setForm({ ...form, url: e.target.value });
                setUrlError('');
              }}
              autoComplete="off"
              inputMode="url"
              placeholder="Ex: jira.suaempresa.com/board"
              aria-invalid={!!urlError}
              className={cn(TEXT_INPUT, urlError && 'border-red-500/70')}
            />
          </Field>

          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ícone</legend>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-muted/30 p-3">
              {ICONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Ícone ${label}`}
                  title={label}
                  aria-pressed={form.iconType === key}
                  onClick={() => setForm({ ...form, iconType: key })}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    form.iconType === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Cor de destaque</legend>
            <div className="flex gap-3 rounded-2xl border border-border bg-muted/30 p-3">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={`Cor ${c.name}`}
                  title={c.name}
                  aria-pressed={form.color === c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    c.swatch,
                    form.color === c.value ? 'scale-110 border-foreground' : 'border-transparent',
                  )}
                />
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
