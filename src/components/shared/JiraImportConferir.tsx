'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { FOCUS_RING, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jiraService';
import {
  FIELD_LABEL, PROVENANCE_FIELDS, applyChoices, summarize,
  type FieldProvenance, type ImportChoices, type ProvenanceField,
} from '@/services/jiraProvenance';

interface Props {
  /** Issues marcadas para importar (já sem as que viraram card). */
  issues: JiraIssue[];
  choices: ImportChoices;
  onChoose: (key: string, field: ProvenanceField, sourceId: string | null) => void;
}

type IssueState = { label: string; tone: Tone };

/** Estado da issue com as escolhas já aplicadas: algum campo em dúvida = Revisar; nenhum texto = Sem texto; senão Certa. */
function issueState(issue: JiraIssue): IssueState {
  const s = issue.sources;
  if (!s) return { label: 'Certa', tone: 'success' };
  const all = PROVENANCE_FIELDS.map((f) => s[f]);
  if (all.some((p) => p.confidence === 'revisar' && !p.sourceId)) return { label: 'Revisar', tone: 'warn' };
  if (all.every((p) => !p.sourceId)) return { label: 'Sem texto', tone: 'neutral' };
  return { label: 'Certa', tone: 'success' };
}

function fieldChip(p: FieldProvenance): { label: string; tone: Tone } {
  if (p.confidence === 'certa') return p.chosenByUser ? { label: 'Escolhida por você', tone: 'brand' } : { label: 'Certa', tone: 'success' };
  if (p.confidence === 'revisar') {
    const explicit = p.candidates.filter((c) => c.explicit).length;
    return { label: explicit > 1 ? `Revisar · ${explicit} fontes possíveis` : 'Revisar · só palpite', tone: 'warn' };
  }
  return p.chosenByUser ? { label: 'Deixado vazio', tone: 'neutral' } : { label: 'Vazio', tone: 'neutral' };
}

/**
 * Etapa "Conferir" da importação: mostra, issue por issue, de onde vem cada texto de Problema, Solução e Critérios.
 * Texto de título explícito entra sozinho; palpite e conflito ficam vazios até a pessoa escolher a fonte ou deixar vazio.
 */
export function JiraImportConferir({ issues, choices, onChoose }: Props) {
  const resolved = useMemo(() => applyChoices(issues, choices), [issues, choices]);
  const totals = useMemo(() => summarize(issues, choices), [issues, choices]);
  const firstPending = resolved.find((i) => issueState(i).label === 'Revisar') ?? resolved[0];
  const [activeKey, setActiveKey] = useState<string | undefined>(firstPending?.key);
  const [switching, setSwitching] = useState<Set<string>>(new Set());
  const active = resolved.find((i) => i.key === activeKey) ?? resolved[0];

  if (!active) return null;

  const toggleSwitch = (id: string) =>
    setSwitching((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="grid min-h-0 gap-5 md:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
          <StatusChip tone="success">{totals.certas} certas</StatusChip>
          {totals.revisar > 0 && <StatusChip tone="warn">{totals.revisar} para revisar</StatusChip>}
          {totals.semTexto > 0 && <StatusChip tone="neutral">{totals.semTexto} sem texto</StatusChip>}
        </div>
        <ul className="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0" aria-label="Issues a importar">
          {resolved.map((issue) => {
            const st = issueState(issue);
            const on = issue.key === active.key;
            return (
              <li key={issue.key}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => setActiveKey(issue.key)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors', FOCUS_RING,
                    on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{issue.key}</span>
                    <StatusChip tone="neutral">{issue.type || 'Issue'}</StatusChip>
                    <StatusChip tone={st.tone} className="ml-auto">{st.label}</StatusChip>
                  </span>
                  <span className="line-clamp-2 text-sm leading-snug">{issue.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{active.key}</span>
          <StatusChip tone="neutral">{active.type || 'Issue'}</StatusChip>
          {active.url && (
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Abrir no Jira
            </a>
          )}
        </div>
        <h3 className="m-0 text-lg font-semibold leading-snug">{active.title}</h3>

        {active.sources ? PROVENANCE_FIELDS.map((field) => {
          const p = active.sources![field];
          const chip = fieldChip(p);
          const chosen = p.candidates.find((c) => c.id === p.sourceId);
          const switchId = `${active.key}:${field}`;
          const listOpen = p.confidence === 'revisar' || switching.has(switchId) || (p.confidence === 'vazio' && p.candidates.length > 0);
          const canSwitch = p.confidence === 'certa' && p.candidates.length > 1;
          return (
            <section
              key={field}
              aria-label={FIELD_LABEL[field]}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-4',
                p.confidence === 'revisar' ? 'border-amber-500/40 bg-amber-500/5' : p.confidence === 'vazio' && p.candidates.length === 0 ? 'border-dashed border-border' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="m-0 text-[15px] font-semibold">{FIELD_LABEL[field]}</h4>
                <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                {canSwitch && (
                  <ModalButton className="ml-auto h-9" onClick={() => toggleSwitch(switchId)} aria-expanded={switching.has(switchId)}>
                    Trocar fonte
                  </ModalButton>
                )}
              </div>

              {chosen ? (
                <>
                  <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed">{chosen.text}</p>
                  <p className="m-0 text-sm text-muted-foreground">Fonte: <strong className="text-foreground">{chosen.label}</strong></p>
                </>
              ) : p.candidates.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">Nada confiável foi encontrado no Jira. Preencha depois, no card.</p>
              ) : p.confidence === 'revisar' ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {p.candidates.some((c) => c.explicit)
                    ? 'Há mais de um texto possível. Escolha de onde vem; até lá o campo fica vazio.'
                    : 'A issue não tem um título para este campo. Aceite a sugestão ou deixe o campo vazio.'}
                </p>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Campo deixado vazio. Você pode preencher depois, no card.</p>
              )}

              {listOpen && p.candidates.length > 0 && (
                <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-1 p-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.candidates.length > 1 ? 'Fontes encontradas' : 'Fonte encontrada'}
                  </legend>
                  {p.candidates.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors',
                        p.sourceId === c.id ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border bg-card hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${active.key}-${field}`}
                        checked={p.sourceId === c.id}
                        onChange={() => onChoose(active.key, field, c.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {c.label}
                          <StatusChip tone={c.explicit ? 'success' : 'warn'}>{c.explicit ? 'Título explícito' : 'Sugerida'}</StatusChip>
                        </span>
                        <span className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{c.text}</span>
                      </span>
                    </label>
                  ))}
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 text-sm font-semibold transition-colors',
                      p.confidence === 'vazio' ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${active.key}-${field}`}
                      checked={p.confidence === 'vazio'}
                      onChange={() => onChoose(active.key, field, null)}
                      className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    />
                    Deixar vazio
                  </label>
                </fieldset>
              )}
            </section>
          );
        }) : (
          <p className="m-0 rounded-xl border border-border p-4 text-sm text-muted-foreground">
            Esta issue veio de um arquivo XML, que não traz comentários com autor. Os textos entram como estão no arquivo.
          </p>
        )}
      </div>
    </div>
  );
}
