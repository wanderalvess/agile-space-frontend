'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, CircleCheck, GraduationCap, TriangleAlert, X } from 'lucide-react';
import { PAGE_CARD } from '@/components/page';
import { FIELD, GuideSheet, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { LIMITS, SUGGESTED_TAGS, normalizeTag } from '@/app/prompt-hub/editor-logic';
import { getTypeMeta } from '@/app/prompt-hub/constants';
import type { SimilarPrompt } from '@/app/prompt-hub/findSimilar';
import { validateSkillFrontmatter } from '@/app/prompt-hub/skillFrontmatter';
import { TUTORIAL_SECTIONS } from '@/app/prompt-hub/tutorial-sections';

const SIMILARITY_REASON_LABEL: Record<SimilarPrompt['reason'], string> = {
  'titulo-identico': 'Mesmo título',
  'conteudo-identico': 'Mesmo conteúdo',
  'titulo-parecido': 'Título parecido',
};

/** Conferência ao vivo do SKILL.md: erros impedem publicar, avisos não. */
export function SkillCheck({ content }: { content: string }) {
  const check = useMemo(() => validateSkillFrontmatter(content), [content]);
  const errors = check.errors.length;
  const warnings = check.warnings.length;

  const rows: Array<{ level: 'ok' | 'erro' | 'aviso'; text: string }> = [];
  if (check.name && !check.errors.some(e => e.includes('name'))) rows.push({ level: 'ok', text: `Nome válido: ${check.name}` });
  if (check.description && !check.errors.some(e => e.includes('description'))) {
    rows.push({ level: 'ok', text: `Descrição presente (${check.description.length} caracteres)` });
  }
  check.errors.forEach(text => rows.push({ level: 'erro', text }));
  check.warnings.forEach(text => rows.push({ level: 'aviso', text }));

  const summary = errors
    ? `${errors} ${errors === 1 ? 'erro' : 'erros'}${warnings ? ` e ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}` : ''}`
    : warnings
      ? `Válido, com ${warnings} ${warnings === 1 ? 'aviso' : 'avisos'}`
      : 'Tudo certo';

  return (
    <section aria-label="Conferência do SKILL.md" aria-live="polite" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-5')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-base font-bold text-foreground">Conferência do SKILL.md</h2>
        <StatusChip tone={errors ? 'danger' : warnings ? 'warn' : 'success'} className="h-6 px-2.5">
          {summary}
        </StatusChip>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li
            key={`${row.level}-${index}`}
            className={cn(
              'flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm leading-normal text-foreground',
              row.level === 'ok' && 'border-emerald-500/30 bg-emerald-500/10',
              row.level === 'aviso' && 'border-amber-500/35 bg-amber-500/10',
              row.level === 'erro' && 'border-red-500/30 bg-red-500/10'
            )}
          >
            {row.level === 'ok' && <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={1.8} aria-hidden="true" />}
            {row.level === 'aviso' && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.8} aria-hidden="true" />}
            {row.level === 'erro' && <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" strokeWidth={1.8} aria-hidden="true" />}
            <span>
              <strong>{row.level === 'ok' ? 'Certo' : row.level === 'aviso' ? 'Aviso' : 'Erro'}:</strong> {row.text}
            </span>
          </li>
        ))}
      </ul>
      <span className="text-[13px] text-muted-foreground">Erros impedem a publicação. Avisos não.</span>
    </section>
  );
}

/** Aviso de itens parecidos. Nunca bloqueia: variação proposital é legítima. */
export function SimilarItems({ similar }: { similar: SimilarPrompt[] }) {
  if (similar.length === 0) return null;
  return (
    <section role="status" className="flex flex-col gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-[18px]">
      <h2 className="text-base font-bold text-foreground">
        {similar.length === 1 ? 'Já existe um item parecido' : 'Já existem itens parecidos'}
      </h2>
      <ul className="flex flex-col gap-2">
        {similar.map(({ item, reason }) => (
          <li key={item.id} className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{item.title?.trim() || 'Item sem título'}</span>
              <span className="text-xs text-muted-foreground">
                {SIMILARITY_REASON_LABEL[reason]} · {item.authorName?.split(' ')[0] || 'Membro'} · {getTypeMeta(item.type).label}
              </span>
            </span>
            <Link
              href={`/prompt-hub/${encodeURIComponent(item.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md text-[13px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
            >
              Abrir
            </Link>
          </li>
        ))}
      </ul>
      <span className="text-[13px] text-muted-foreground">Vale conferir antes. Você pode publicar mesmo assim.</span>
    </section>
  );
}

/** Etiquetas do item: até 30, com sugestões. A etiqueta digitada e não confirmada entra ao publicar. */
export function TagsField({
  tags,
  draft,
  onDraft,
  onChange,
  onLimit,
}: {
  tags: string[];
  draft: string;
  onDraft: (value: string) => void;
  onChange: (tags: string[]) => void;
  onLimit: () => void;
}) {
  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !tags.includes(tag)) {
      if (tags.length >= LIMITS.maxTags) {
        onLimit();
        return;
      }
      onChange([...tags, tag]);
    }
    onDraft('');
  };
  const pending = normalizeTag(draft);
  const suggestions = SUGGESTED_TAGS.filter(tag => !tags.includes(tag)).slice(0, 5);

  return (
    <section className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Etiquetas</h2>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {tags.length} de {LIMITS.maxTags}
        </span>
      </div>
      {tags.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {tags.map(tag => (
            <li key={tag} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-[13px] text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter(t => t !== tag))}
                aria-label={`Remover etiqueta ${tag}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={draft}
        maxLength={LIMITS.tag}
        onChange={event => onDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(draft);
          }
        }}
        aria-label="Nova etiqueta"
        placeholder="Digite e tecle Enter"
        className={cn(FIELD, 'h-[38px]')}
      />
      {pending && <span className="text-[13px] text-muted-foreground">A etiqueta &quot;{pending}&quot; será incluída ao publicar.</span>}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-muted-foreground">Sugestões</span>
          {suggestions.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex min-h-6 items-center rounded-full border border-border px-3 text-[13px] text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const BEFORE_PUBLISHING = [
  'O nome usa só minúsculas e hífens',
  'A descrição diz quando usar',
  'As instruções têm passos claros',
  'Testei com um caso real',
  'Tirei dados pessoais e segredos',
];

/** Folha de ajuda do editor: os passos do tutorial e uma lista para conferir antes de publicar. */
export function SkillTutorialSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Como criar uma skill"
      description="Um resumo para ter ao lado enquanto escreve."
      icon={GraduationCap}
      manualHref="/manual#prompt-hub"
      tabs={[
        {
          id: 'passos',
          label: 'Passos',
          content: (
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-bold text-foreground">{TUTORIAL_SECTIONS.length} passos</h3>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                {TUTORIAL_SECTIONS.map(section => (
                  <li key={section.id}>
                    <Link
                      href={`/prompt-hub/tutorial#${section.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {section.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ),
        },
        {
          id: 'antes',
          label: 'Antes de publicar',
          content: (
            <ul className="flex flex-col gap-1.5">
              {BEFORE_PUBLISHING.map(label => (
                <li key={label}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm text-foreground hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={!!checked[label]}
                      onChange={event => setChecked(prev => ({ ...prev, [label]: event.target.checked }))}
                      className="h-[18px] w-[18px] accent-[hsl(var(--primary))]"
                    />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
    />
  );
}
