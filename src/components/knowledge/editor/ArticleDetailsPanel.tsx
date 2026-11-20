'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { X } from 'lucide-react';
import { FIELD, FOCUS_RING, SelectField, CARD_SHADOW } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import {
  MAX_TAGS,
  STATUS_OPTIONS,
  addTags,
  type EditorStatus,
} from '@/lib/knowledge-editor';
import { ArticleVersions } from './ArticleVersions';

export interface ArticleDetailsPanelProps {
  status: EditorStatus;
  onStatusChange: (status: EditorStatus) => void;
  /** O servidor aceita "Rascunho" e "Arquivado"? Quando não, as duas opções ficam desabilitadas. */
  allowDraftArchived: boolean;
  category: string;
  categoryOptions: readonly string[];
  onCategoryChange: (category: string) => void;
  fullPath: string;
  onFullPathChange: (path: string) => void;
  folderSuggestions: readonly string[];
  tags: readonly string[];
  onTagsChange: (tags: string[]) => void;
  /** Id do artigo salvo; só então a seção "Versões" aparece. */
  documentId?: string | null;
  versionsRefreshKey?: number;
  className?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px]', CARD_SHADOW)}>
      <h2 id={headingId} className="text-[15px] font-bold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TagsField({ tags, onChange }: { tags: readonly string[]; onChange: (tags: string[]) => void }) {
  const inputId = React.useId();
  const [draft, setDraft] = React.useState('');
  const commit = () => {
    if (!draft.trim()) return;
    onChange(addTags(tags, draft));
    setDraft('');
  };
  const full = tags.length >= MAX_TAGS;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        Adicionar etiqueta
      </label>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas do artigo">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-[13px] text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
              {tag}
              <button
                type="button"
                aria-label={`Remover etiqueta ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/20', FOCUS_RING)}
              >
                <X className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        value={draft}
        disabled={full}
        onChange={(e) => {
          const value = e.target.value;
          // A vírgula fecha a etiqueta, como o Enter.
          if (value.endsWith(',')) {
            onChange(addTags(tags, value));
            setDraft('');
          } else {
            setDraft(value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={full ? 'Limite de etiquetas atingido' : 'Adicionar etiqueta e apertar Enter'}
        autoComplete="off"
        className={cn(FIELD, 'h-9 text-[13px]')}
      />
    </div>
  );
}

/**
 * Painel "Detalhes" do artigo: Publicação, Onde fica, Etiquetas e (ao editar) Versões.
 * Fica fixo à direita em telas largas e vira folha lateral nas menores (quem monta decide).
 */
export function ArticleDetailsPanel({
  status,
  onStatusChange,
  allowDraftArchived,
  category,
  categoryOptions,
  onCategoryChange,
  fullPath,
  onFullPathChange,
  folderSuggestions,
  tags,
  onTagsChange,
  documentId,
  versionsRefreshKey,
  className,
}: ArticleDetailsPanelProps) {
  const categoryId = React.useId();
  const folderId = React.useId();

  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <Section title="Publicação">
        <RadioGroupPrimitive.Root
          value={status}
          onValueChange={(value) => onStatusChange(value as EditorStatus)}
          aria-label="Situação"
          className="flex flex-col gap-2"
        >
          {STATUS_OPTIONS.map((option) => {
            const unavailable = !allowDraftArchived && option.id !== 'published';
            return (
              <RadioGroupPrimitive.Item
                key={option.id}
                value={option.id}
                disabled={unavailable}
                className={cn(
                  'group flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5 text-left transition-colors duration-fast',
                  'data-[state=checked]:border-primary/50 data-[state=checked]:bg-primary/10 dark:data-[state=checked]:bg-primary/15',
                  'enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55',
                  FOCUS_RING,
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border group-data-[state=checked]:border-primary"
                >
                  <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {unavailable ? 'Ainda não disponível: por enquanto a base só guarda artigos publicados.' : option.description}
                  </span>
                </span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </Section>

      <Section title="Onde fica">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={categoryId} className="text-xs font-semibold text-muted-foreground">
            Categoria
          </label>
          <SelectField
            id={categoryId}
            value={category}
            onChange={onCategoryChange}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            className="h-10 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={folderId} className="text-xs font-semibold text-muted-foreground">
            Pasta
          </label>
          <input
            id={folderId}
            value={fullPath}
            onChange={(e) => onFullPathChange(e.target.value)}
            placeholder="Módulo / Pasta"
            autoComplete="off"
            className={cn(FIELD, 'h-10')}
          />
        </div>
        {folderSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pastas já usadas na base">
            {folderSuggestions.map((folder) => (
              <button
                key={folder}
                type="button"
                onClick={() => onFullPathChange(folder)}
                className={cn(
                  'inline-flex h-7 items-center rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
                  folder === fullPath && 'border-primary/50 text-foreground',
                  FOCUS_RING,
                )}
              >
                {folder}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Etiquetas">
        <TagsField tags={tags} onChange={onTagsChange} />
      </Section>

      {documentId && (
        <Section title="Versões">
          <ArticleVersions documentId={documentId} refreshKey={versionsRefreshKey} />
        </Section>
      )}
    </div>
  );
}
