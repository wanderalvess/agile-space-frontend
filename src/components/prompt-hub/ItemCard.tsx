'use client';

import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Link2, MoreHorizontal, Star, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { StatusChip } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page';
import { cn } from '@/lib/utils';
import { canEditItem, isAdminOverride, safeHttpUrl } from '@/app/prompt-hub/catalog-logic';
import { extractVariables } from '@/app/prompt-hub/variables';
import type { PromptItem } from '@/app/prompt-hub/types';
import { AdminSeal, SituationChip, TagButton, TypeChip, VisibilityChip } from './Chips';
import { Highlight } from './Highlight';

export interface ItemCardHandlers {
  onOpen: (item: PromptItem) => void;
  /** Copiar sem campos: o cartão mostra "Copiado" por dois segundos quando devolve verdadeiro. */
  onCopy: (item: PromptItem) => Promise<boolean>;
  onOpenTool: (item: PromptItem, safeLink: string) => void;
  onToggleFavorite: (item: PromptItem) => void;
  onCopyLink: (item: PromptItem) => void;
  onEdit: (item: PromptItem) => void;
  onDuplicate: (item: PromptItem) => void;
  onDelete: (item: PromptItem) => void;
  onSelectTag?: (tag: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

const MAX_TAGS = 3;
const MAX_FIELDS = 2;

/** Primeiras linhas úteis do conteúdo, sem o cabeçalho de skill nem títulos de Markdown. */
export function contentSnippet(content?: string): string {
  if (!content) return '';
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('---') && !line.startsWith('#'))
    .slice(0, 3)
    .join(' · ');
}

export function ItemCard({
  item,
  query,
  sessionId,
  handlers,
}: {
  item: PromptItem;
  query?: string;
  sessionId?: string | null;
  handlers: ItemCardHandlers;
}) {
  const [justCopied, setJustCopied] = useState(false);

  const fields = useMemo(() => extractVariables(item.content), [item.content]);
  const hasFields = fields.length > 0;
  const hasContent = !!item.content?.trim();
  const safeLink = safeHttpUrl(item.gemLink);
  const snippet = useMemo(() => contentSnippet(item.content) || item.description?.trim() || '', [item.content, item.description]);

  const isMine = !!sessionId && item.authorId === sessionId;
  const canManage = canEditItem(item, sessionId);
  const adminSeal = isAdminOverride(item, sessionId);
  const favorite = !!item.favorite;
  const tags = item.tags ?? [];
  const showStatus = !!item.status && item.status !== 'producao';
  const authorName = isMine ? 'Você' : item.authorName?.trim() || 'Membro';

  const copy = async () => {
    const ok = await handlers.onCopy(item);
    if (!ok) return;
    setJustCopied(true);
    window.setTimeout(() => setJustCopied(false), 2000);
  };

  let main: { label: string; run: () => void } | null = null;
  if (hasFields) main = { label: 'Preencher', run: () => handlers.onOpen(item) };
  else if (hasContent) main = { label: justCopied ? 'Copiado' : 'Copiar', run: copy };
  else if (safeLink) main = { label: 'Abrir', run: () => handlers.onOpenTool(item, safeLink) };

  return (
    <article className={cn(PAGE_CARD, 'group relative flex h-full flex-col gap-3 p-[18px] transition-colors duration-base hover:border-primary/40')}>
      <div className="flex flex-wrap items-center gap-1.5 pr-10">
        <TypeChip type={item.type} />
        {hasFields && <StatusChip tone="neutral" className="h-6 px-2.5">{fields.length} {fields.length === 1 ? 'campo' : 'campos'}</StatusChip>}
        {showStatus && <SituationChip status={item.status} />}
        <VisibilityChip visibility={item.visibility} />
      </div>

      <button
        type="button"
        onClick={() => handlers.onToggleFavorite(item)}
        aria-pressed={favorite}
        aria-label={favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        title={sessionId ? (favorite ? 'Salvo na sua conta' : 'Salvar nos favoritos') : 'Entre para favoritar'}
        className={cn(
          'absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-fast hover:bg-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          favorite ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
        )}
      >
        <Star className={cn('h-[18px] w-[18px]', favorite && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <h3 className="text-[17px] font-bold leading-snug text-foreground">
        <button
          type="button"
          onClick={() => handlers.onOpen(item)}
          className="rounded-md text-left transition-colors duration-fast hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:hover:text-foreground"
        >
          <Highlight text={item.title?.trim() || 'Item sem título'} query={query} />
        </button>
      </h3>

      {item.description?.trim() && (
        <p className="line-clamp-2 text-sm leading-normal text-muted-foreground">
          <Highlight text={item.description.trim()} query={query} />
        </p>
      )}

      <div className="min-h-14 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5 text-[13px] leading-normal">
        {hasFields ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {fields.slice(0, MAX_FIELDS).map(field => (
              <span key={field} className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 font-mono text-xs text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                {`{{${field}}}`}
              </span>
            ))}
            {fields.length > MAX_FIELDS && <span className="text-xs text-muted-foreground">+{fields.length - MAX_FIELDS}</span>}
          </div>
        ) : (
          <span className="line-clamp-2 font-mono text-muted-foreground">{snippet || 'Sem texto para copiar.'}</span>
        )}
      </div>

      <div className="flex min-h-6 flex-wrap gap-1.5">
        {tags.slice(0, MAX_TAGS).map(tag => (
          <TagButton key={tag} tag={tag} onClick={handlers.onSelectTag ? () => handlers.onSelectTag?.(tag) : undefined} />
        ))}
        {tags.length > MAX_TAGS && <span className="self-center text-xs text-muted-foreground">+{tags.length - MAX_TAGS}</span>}
      </div>

      <div className="mt-auto flex items-center gap-3 text-[13px] text-muted-foreground">
        <InitialsAvatar name={item.authorName} className="h-6 w-6 text-xs" />
        {handlers.onSelectAuthor && item.authorId ? (
          <button
            type="button"
            onClick={() => handlers.onSelectAuthor?.(item.authorId)}
            title="Ver tudo desta pessoa"
            className="min-w-0 truncate rounded-md font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {authorName}
          </button>
        ) : (
          <span className="min-w-0 truncate font-semibold text-foreground">{authorName}</span>
        )}
        <span className="flex-1" />
        <span title="Cópias" aria-label={`${item.useCount ?? 0} cópias`} className="inline-flex items-center gap-1 tabular-nums">
          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {item.useCount ?? 0}
        </span>
        <span title="Duplicações" aria-label={`${item.forkCount ?? 0} duplicações`} className="inline-flex items-center gap-1 tabular-nums">
          <Workflow className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {item.forkCount ?? 0}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {main && (
          <Button type="button" onClick={main.run} className="h-10 flex-1 gap-2 rounded-[10px] font-semibold">
            {main.label === 'Abrir' && <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            {main.label}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {adminSeal && <AdminSeal />}
          <button
            type="button"
            onClick={() => handlers.onCopyLink(item)}
            aria-label="Copiar link do item"
            title="Copiar link"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
          {sessionId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mais ações de ${item.title?.trim() || 'item'}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {canManage && <DropdownMenuItem onSelect={() => handlers.onEdit(item)}>Editar</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => handlers.onDuplicate(item)}>Duplicar</DropdownMenuItem>
                {canManage && (
                  <DropdownMenuItem
                    className="text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
                    onSelect={() => handlers.onDelete(item)}
                  >
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </article>
  );
}
