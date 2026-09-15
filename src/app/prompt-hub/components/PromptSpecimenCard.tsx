'use client';

import React, { useMemo } from 'react';
import {
  Star,
  MoreVertical,
  Share2,
  GitFork,
  ArrowUpRight,
  Copy,
  SlidersHorizontal,
  ExternalLink,
  Check,
  Terminal
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

interface PromptSpecimenCardProps {
  prompt: PromptItem;
  isOwner: boolean;
  isReadOnly?: boolean;
  featured?: boolean;
  onFork: (prompt: PromptItem) => void;
  onEdit?: (prompt: PromptItem) => void;
  onView?: (prompt: PromptItem) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onSelectTag?: (tag: string) => void;
  onCopy?: (id: string) => void;
  onSelectAuthor?: (authorId: string) => void;
}

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
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
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {prompt.authorName?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }

  return (
    <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
      <NiceAvatar className="h-full w-full" {...config} />
    </div>
  );
}

export function PromptSpecimenCard({
  prompt,
  isOwner,
  isReadOnly = false,
  featured = false,
  onFork,
  onEdit,
  onView,
  onDelete,
  onToggleFavorite,
  onSelectTag,
  onCopy,
  onSelectAuthor
}: PromptSpecimenCardProps) {
  const [justCopied, setJustCopied] = React.useState(false);

  const type = getTypeMeta(prompt.type);
  const status = getStatusMeta(prompt.status);
  const visibility = getVisibilityMeta(prompt.visibility);
  const TypeIcon = type.icon;
  const VisibilityIcon = visibility.icon;

  const showStatus = !!prompt.status && prompt.status !== 'producao';
  const visibleTags = prompt.tags?.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const hiddenTagCount = Math.max(0, (prompt.tags?.length ?? 0) - visibleTags.length);

  const content = prompt.content?.trim();
  const safeLink = toSafeExternalUrl(prompt.gemLink);

  // Extração de variáveis {{var}} para exibição de contrato de entrada
  const variables = useMemo(() => {
    if (!content) return [];
    const matches = new Set<string>();
    let match;
    const regex = new RegExp(VARIABLE_REGEX);
    while ((match = regex.exec(content)) !== null) {
      matches.add(match[1].trim());
    }
    return Array.from(matches);
  }, [content]);

  const hasVariables = variables.length > 0;

  // Trecho limpo para preview técnico (sem frontmatter excessivo se for skill)
  const snippet = useMemo(() => {
    if (!content) return null;
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('---') && !l.startsWith('#'));
    return lines.slice(0, 2).join(' · ');
  }, [content]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      onCopy?.(prompt.id);
      setJustCopied(true);
      toast.success('Conteúdo copiado para a área de transferência');
      setTimeout(() => setJustCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o conteúdo.');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/prompt-hub/${prompt.id}`);
      toast.success('Link do ativo copiado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o link');
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
        'group relative flex h-full cursor-pointer flex-col rounded-xl border bg-card p-4 text-left transition-all duration-150',
        'border-border/80 hover:border-foreground/30 hover:shadow-sm dark:hover:border-foreground/20',
        featured && 'border-primary/40 bg-gradient-to-br from-card via-card to-primary/[0.03] shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
      )}
    >
      {/* 1. Header do Espécime: Tag técnica estruturada + Ações rápidas */}
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          {/* Spec Badge: Ficha técnica minimalista */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/50 px-2 py-0.5 font-medium tracking-tight',
              type.accent
            )}
          >
            <TypeIcon className="h-3 w-3" />
            <span className="uppercase">{type.label}</span>
          </span>

          {hasVariables && (
            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              &#123;&#123;{variables.length}&#125;&#125;
            </span>
          )}

          {showStatus && (
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', status.chip)}>
              {status.label}
            </span>
          )}

          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80"
            title={visibility.description}
          >
            <VisibilityIcon className="h-3 w-3" />
            {visibility.label}
          </span>
        </div>

        {/* Ações de cabeçalho: Favorito / Share / Menu */}
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

      {/* 2. Título & Hipótese de uso */}
      <h3 className="mb-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">
        {prompt.title?.trim() || prompt.description?.trim() || 'Item sem título'}
      </h3>

      {prompt.description?.trim() && (
        <p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {prompt.description.trim()}
        </p>
      )}

      {/* 3. Live Variable Peek: Se tem variáveis, mostra o contrato de entrada */}
      {hasVariables && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Entradas:
          </span>
          {variables.slice(0, 2).map(v => (
            <span
              key={v}
              className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-primary"
            >
              &#123;&#123;{v}&#125;&#125;
            </span>
          ))}
          {variables.length > 2 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              +{variables.length - 2}
            </span>
          )}
        </div>
      )}

      {/* 4. Specimen Code Snippet: Prévia visual estruturada */}
      {snippet && !hasVariables && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/40 px-2 py-1.5 text-[11px] font-mono text-muted-foreground/80 dark:bg-muted/20">
          <Terminal className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <span className="line-clamp-1 truncate font-code">{snippet}</span>
        </div>
      )}

      {/* 5. Tags */}
      {visibleTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {visibleTags.map(tag => (
            <button
              key={tag}
              onClick={e => {
                e.stopPropagation();
                onSelectTag?.(tag);
              }}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
          {hiddenTagCount > 0 && (
            <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{hiddenTagCount}</span>
          )}
        </div>
      )}

      {/* 6. Rodapé Tátil com Autoria, Uso e Ação Primária */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <AuthorAvatar prompt={prompt} />
          {onSelectAuthor && prompt.authorId ? (
            <button
              onClick={e => {
                e.stopPropagation();
                onSelectAuthor(prompt.authorId);
              }}
              title="Ver tudo desta pessoa"
              className="truncate text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {isOwner ? 'Você' : prompt.authorName?.split(' ')[0] || 'Membro'}
              {prompt.authorSquad ? ` · ${prompt.authorSquad}` : ''}
            </button>
          ) : (
            <span className="truncate text-[11px] text-muted-foreground">
              {isOwner ? 'Você' : prompt.authorName?.split(' ')[0] || 'Membro'}
              {prompt.authorSquad ? ` · ${prompt.authorSquad}` : ''}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {(prompt.useCount ?? 0) > 0 && (
            <span title={`${prompt.useCount} execuções/cópias`} className="inline-flex items-center gap-0.5 font-mono">
              <ArrowUpRight className="h-3 w-3" />
              {prompt.useCount}
            </span>
          )}

          {(prompt.forkCount ?? 0) > 0 && (
            <span title={`${prompt.forkCount} clones`} className="inline-flex items-center gap-0.5 font-mono">
              <GitFork className="h-3 w-3" />
              {prompt.forkCount}
            </span>
          )}

          {/* Ação Primária com Estado */}
          {content && !hasVariables && (
            <Button
              variant={justCopied ? 'default' : 'outline'}
              size="sm"
              onClick={handleCopy}
              className="ml-1 h-7 gap-1 px-2.5 text-xs transition-all"
            >
              {justCopied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copiar
                </>
              )}
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
              title="Preencha as variáveis antes de copiar"
              className="ml-1 h-7 gap-1 px-2.5 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <SlidersHorizontal className="h-3 w-3" />
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
              className="ml-1 h-7 gap-1 px-2.5 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}
