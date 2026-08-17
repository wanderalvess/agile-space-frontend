'use client';

import React from 'react';
import {
  Star,
  MoreVertical,
  Share2,
  GitFork,
  ArrowUpRight,
  Copy,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, openExternalUrl, toSafeExternalUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { PromptItem } from '../types';
import { getTypeMeta, getStatusMeta, getVisibilityMeta } from '../constants';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface PromptCardProps {
  prompt: PromptItem;
  isOwner: boolean;
  isReadOnly?: boolean;
  onFork: (prompt: PromptItem) => void;
  onEdit?: (prompt: PromptItem) => void;
  onView?: (prompt: PromptItem) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  /** Clique numa tag aplica o filtro correspondente no catálogo. */
  onSelectTag?: (tag: string) => void;
  /** Chamado após a cópia dar certo, para contabilizar o uso. */
  onCopy?: (id: string) => void;
  /** Abre o perfil de quem publicou. */
  onSelectAuthor?: (authorId: string) => void;
}

const VARIABLE_RE = /\{\{[^}]+\}\}/;

const MAX_VISIBLE_TAGS = 3;

function AuthorAvatar({ prompt }: { prompt: PromptItem }) {
  let config: any = null;
  try {
    config = prompt.authorAvatar ? genConfig(JSON.parse(prompt.authorAvatar)) : null;
  } catch {
    config = null;
  }

  if (!config) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {prompt.authorName?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }

  return (
    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
      <NiceAvatar className="h-full w-full" {...config} />
    </div>
  );
}

export function PromptCard({
  prompt,
  isOwner,
  isReadOnly = false,
  onFork,
  onEdit,
  onView,
  onDelete,
  onToggleFavorite,
  onSelectTag,
  onCopy,
  onSelectAuthor
}: PromptCardProps) {
  const type = getTypeMeta(prompt.type);
  const status = getStatusMeta(prompt.status);
  const visibility = getVisibilityMeta(prompt.visibility);
  const TypeIcon = type.icon;
  const VisibilityIcon = visibility.icon;

  // "Em produção" é o estado padrão da maioria dos itens; mostrar o selo em todos
  // vira ruído. Só destacamos quando o item está em outro momento do ciclo.
  const showStatus = !!prompt.status && prompt.status !== 'producao';

  const visibleTags = prompt.tags?.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const hiddenTagCount = Math.max(0, (prompt.tags?.length ?? 0) - visibleTags.length);

  // A ação principal do card muda com o que o item tem: conteúdo simples copia
  // na hora; conteúdo com {{variáveis}} precisa dos campos do detalhe, senão a
  // pessoa cola um texto com marcadores por preencher; item que é só link abre
  // a ferramenta.
  const content = prompt.content?.trim();
  const hasVariables = !!content && VARIABLE_RE.test(content);
  const safeLink = toSafeExternalUrl(prompt.gemLink);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      onCopy?.(prompt.id);
      toast.success('Conteúdo copiado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o conteúdo.');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/prompt-hub/${prompt.id}`);
      toast.success('Link copiado', { description: 'Compartilhe este item com quem precisar.' });
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o link', {
        description: 'Verifique as permissões de área de transferência do navegador.'
      });
    }
  };

  return (
    <article
      onClick={() => onView?.(prompt)}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView?.(prompt);
        }
      }}
      className={cn(
        'group relative flex h-full cursor-pointer flex-col rounded-xl border border-border bg-card p-4 text-left',
        'transition-colors hover:border-foreground/20 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
              type.chip
            )}
          >
            <TypeIcon className="h-3.5 w-3.5" />
            {type.label}
          </span>

          {showStatus && (
            <span className={cn('rounded-md px-2 py-1 text-xs font-medium', status.chip)}>
              {status.label}
            </span>
          )}

          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title={visibility.description}
          >
            <VisibilityIcon className="h-3.5 w-3.5" />
            {visibility.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            title="Copiar link"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>

          {!isReadOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite?.(prompt.id);
              }}
              title={prompt.isFavorited ? 'Remover dos favoritos' : 'Favoritar'}
              className={cn(
                'h-7 w-7',
                prompt.isFavorited
                  ? 'text-amber-500 opacity-100'
                  : 'text-muted-foreground hover:text-amber-500'
              )}
            >
              <Star className={cn('h-3.5 w-3.5', prompt.isFavorited && 'fill-current')} />
            </Button>
          )}

          {isOwner && !isReadOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Mais ações"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation();
                    onEdit?.(prompt);
                  }}
                >
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation();
                    onFork(prompt);
                  }}
                >
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={e => {
                    e.stopPropagation();
                    onDelete?.(prompt.id);
                  }}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Itens antigos podem ter sido salvos sem título. Em vez de um card mudo,
          promovemos a descrição a título para o item continuar identificável. */}
      <h3 className="mb-1.5 line-clamp-2 text-base font-semibold leading-snug text-foreground">
        {prompt.title?.trim() || prompt.description?.trim() || 'Item sem título'}
      </h3>

      {prompt.title?.trim() && (
        <p className="mb-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {prompt.description?.trim() || 'Sem descrição.'}
        </p>
      )}

      {visibleTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {visibleTags.map(tag => (
            <button
              key={tag}
              onClick={e => {
                e.stopPropagation();
                onSelectTag?.(tag);
              }}
              className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
          {hiddenTagCount > 0 && (
            <span className="px-1 py-0.5 text-xs text-muted-foreground">+{hiddenTagCount}</span>
          )}
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <AuthorAvatar prompt={prompt} />
          {onSelectAuthor && prompt.authorId ? (
            <button
              onClick={e => {
                e.stopPropagation();
                onSelectAuthor(prompt.authorId);
              }}
              title="Ver tudo desta pessoa"
              className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {isOwner ? 'Você' : prompt.authorName?.split(' ')[0] || 'Membro'}
              {prompt.authorSquad ? ` · ${prompt.authorSquad}` : ''}
            </button>
          ) : (
            <span className="truncate text-xs text-muted-foreground">
              {isOwner ? 'Você' : prompt.authorName?.split(' ')[0] || 'Membro'}
              {prompt.authorSquad ? ` · ${prompt.authorSquad}` : ''}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {(prompt.useCount ?? 0) > 0 && (
            <span title={`${prompt.useCount} cópias`} className="inline-flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {prompt.useCount}
            </span>
          )}
          {(prompt.forkCount ?? 0) > 0 && (
            <span title={`${prompt.forkCount} clones`} className="inline-flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5" />
              {prompt.forkCount}
            </span>
          )}

          {content && !hasVariables && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="ml-1 h-7 gap-1.5 px-2.5 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          )}

          {content && hasVariables && (
            <Button
              variant="outline"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                onView?.(prompt);
              }}
              title="Este item tem variáveis para preencher antes de copiar"
              className="ml-1 h-7 gap-1.5 px-2.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Preencher
            </Button>
          )}

          {!content && safeLink && (
            <Button
              variant="outline"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                openExternalUrl(safeLink);
                onCopy?.(prompt.id);
              }}
              className="ml-1 h-7 gap-1.5 px-2.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}
