'use client';

import { useMemo } from 'react';
import { ArrowRight, Check, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraImportResult } from '@/components/jira/JiraProfieldsImport';
import { buildIssues, plural, summarizeImport, type ImportIssue, type SquadStatus } from '@/lib/import-result';
import { TONES, type Tone } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { Caption, InlineNotice, SmallButton, StepCard, WIDE_CTA } from './ui';

const STATUS_LABEL: Record<SquadStatus, string> = { active: 'Ativa', imported: 'Importada' };

function Stat({ value, label, tone }: { value: number; label: string; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
      <div className={cn('text-[28px] font-bold leading-none tabular-nums', tone && TONES[tone].text)}>{value}</div>
      <div className="mt-1.5 text-[13px] text-muted-foreground">{label}</div>
    </div>
  );
}

interface Props {
  result: JiraImportResult;
  onGoToPanel: () => void;
  onIssueAction: (issue: ImportIssue) => void;
}

/**
 * Passo 9: resultado da importação. Só mostra contagens que o servidor devolveu ao gravar
 * (pessoas, quem já tem conta, quem não tem e-mail); o que não tem fonte fica de fora.
 */
export function ImportResultStep({ result, onGoToPanel, onIssueAction }: Props) {
  const summary = useMemo(() => summarizeImport(result.importedProjects, result.notImportedKeys), [result.importedProjects, result.notImportedKeys]);
  const issues = useMemo(() => buildIssues(summary), [summary]);
  const count = result.importedProjects.length;
  const first = result.project;

  return (
    <StepCard>
      <div className="flex flex-col items-start gap-2.5">
        <span aria-hidden="true" className={cn('flex h-[52px] w-[52px] items-center justify-center rounded-2xl', TONES.success.tile)}>
          <Check className="h-[26px] w-[26px]" strokeWidth={1.5} />
        </span>
        <h1 tabIndex={-1} className="text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[28px]">
          {count === 1 ? `${first.id} importada` : `${count} squads importadas`}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat value={summary.people} label={summary.people === 1 ? 'pessoa importada' : 'pessoas importadas'} />
        <Stat value={summary.withAccount} label="com conta" tone="success" />
        <Stat value={summary.withoutAccount} label="ainda sem conta" />
        <Stat value={summary.attention} label={summary.attention === 1 ? 'precisa de atenção' : 'precisam de atenção'} tone={summary.attention > 0 ? 'warn' : undefined} />
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border" aria-label="Squads desta importação">
        {summary.squads.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold">
                {s.id}
                {s.name !== s.id ? ` · ${s.name}` : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {plural(s.people, 'pessoa', 'pessoas')} · {s.withAccount} com conta · {s.withoutAccount} sem conta
                {s.attention > 0 ? ` · ${s.attention} com atenção` : ''}
              </span>
            </span>
            <span className={cn('inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-bold', s.status === 'active' ? TONES.brand.chip : TONES.success.chip)}>
              {STATUS_LABEL[s.status]}
            </span>
          </li>
        ))}
        {summary.skippedKeys.map((key) => (
          <li key={key} className="flex items-center gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold">{key}</span>
              <span className="text-xs text-muted-foreground">Não importada</span>
            </span>
            <span className={cn('inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-bold', TONES.warn.chip)}>Sem importar</span>
          </li>
        ))}
      </ul>

      {issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <Caption>Precisam de atenção</Caption>
          {issues.map((issue) => (
            <div key={issue.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-3.5 py-3">
              <span
                aria-hidden="true"
                className={cn('h-2 w-2 shrink-0 rounded-full', issue.tone === 'warn' ? 'bg-amber-500' : issue.tone === 'danger' ? 'bg-red-500' : 'bg-muted-foreground')}
              />
              <span className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="text-sm font-semibold">{issue.title}</span>
                <span className="text-xs text-muted-foreground">{issue.detail}</span>
              </span>
              <SmallButton onClick={() => onIssueAction(issue)}>{issue.action.label}</SmallButton>
            </div>
          ))}
        </div>
      )}

      {result.tokenSaved ? (
        <InlineNotice tone="success" icon={CheckCircle2} className="py-2.5 text-[13px]">
          Token guardado na sua conta
        </InlineNotice>
      ) : (
        <InlineNotice tone="warn" icon={TriangleAlert} className="py-2.5 text-[13px]">
          O token não ficou guardado na sua conta: vale só neste navegador.
        </InlineNotice>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[13px] text-muted-foreground">
          {count === 1 ? `Você está em ${first.id}.` : `Você começa em ${first.id} e troca de squad pelo seletor.`}
        </span>
        <Button type="button" onClick={onGoToPanel} className={cn(WIDE_CTA, 'sm:w-auto sm:px-6')}>
          Ir para o painel <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>
    </StepCard>
  );
}
