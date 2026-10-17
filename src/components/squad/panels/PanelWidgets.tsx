'use client';

// Peças dos painéis por papel: cartão, medidor, barras, rosca, número grande e linhas de issue.
// Só tokens semânticos (vale nos 7 temas x claro/escuro), cor chapada (sem degradê) e texto de 12 px para cima.
// As séries dos gráficos usam `currentColor`: a cor vem de uma classe de texto (`INK`), então o TOTVS claro troca
// o azul-claro da marca pelo texto padrão, como no resto do portal.
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { IconTile, StatusChip, BRAND_TEXT, type Tone } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import { cn } from '@/lib/utils';
import { statusLabelPt } from '@/lib/jira-status';
import { isDoneIssue, isInProgressIssue } from '@/lib/squad-metrics';
import {
  DONUT_RADIUS,
  barWidths,
  donutArcs,
  gaugeArcPath,
  type LabelValue,
  type Segment,
  type SegmentTone,
} from './panel-model';

/** Cor de cada série (classes literais, o Tailwind só gera o que encontra escrito por inteiro). */
export const INK: Record<SegmentTone, string> = {
  brand: BRAND_TEXT,
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-red-600 dark:text-red-400',
  muted: 'text-muted-foreground',
};

/** Paleta categórica das fatias de pizza das consultas (contraste mínimo de 3:1 contra o cartão). */
export const CATEGORY_INK = [
  BRAND_TEXT,
  'text-emerald-600 dark:text-emerald-400',
  'text-blue-600 dark:text-blue-400',
  'text-violet-600 dark:text-violet-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-cyan-700 dark:text-cyan-400',
] as const;

/** Cartão de um painel: título, algo à direita (etiqueta, ícone) e o conteúdo. */
export function PanelCard({
  title,
  aside,
  children,
  className,
  titleId,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn(PAGE_CARD, 'flex min-w-0 flex-col gap-3 p-5', className)}>
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h3 id={titleId} className="text-[15px] font-bold text-foreground">
            {title}
          </h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Cartão no lugar de um gráfico quando não há dado: diz que não há, em vez de desenhar zero. */
export function NoDataCard({ title, message = 'Sem dados desta squad ainda.', className }: { title: string; message?: string; className?: string }) {
  return (
    <PanelCard title={title} className={className}>
      <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
    </PanelCard>
  );
}

/** Medidor em meia-lua com a porcentagem no meio. */
export function GaugeCard({
  title,
  pct,
  description,
  tone = 'brand',
  className,
}: {
  title: string;
  pct: number;
  description?: string;
  tone?: SegmentTone;
  className?: string;
}) {
  const safe = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <PanelCard title={title} className={className}>
      <div className="flex justify-center">
        <svg viewBox="0 0 220 128" className="h-auto w-full max-w-[260px]" role="img" aria-label={`${title}: ${safe}%`}>
          <path d="M20 112 A90 90 0 0 1 200 112" fill="none" strokeWidth="16" strokeLinecap="round" className="stroke-border" />
          {safe > 0 && (
            <path d={gaugeArcPath(safe)} fill="none" strokeWidth="16" strokeLinecap="round" className={cn('stroke-current', INK[tone])} />
          )}
          <text x="110" y="108" textAnchor="middle" fontSize="36" fontWeight="700" className="fill-foreground tabular-nums">
            {safe}%
          </text>
        </svg>
      </div>
      {description && <p className="border-t border-border pt-2.5 text-center text-[13px] text-muted-foreground">{description}</p>}
    </PanelCard>
  );
}

/** Uma barra horizontal por linha: rótulo, trilho e valor. */
export function BarRows({
  items,
  tone = 'brand',
  format = (v: number) => String(v),
  labelWidth = 'w-[110px] sm:w-[150px]',
  className,
}: {
  items: LabelValue[];
  tone?: SegmentTone;
  format?: (value: number) => string;
  labelWidth?: string;
  className?: string;
}) {
  const widths = barWidths(items);
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {items.map((item, i) => (
        <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
          <span className={cn('shrink-0 truncate font-semibold text-foreground', labelWidth)} title={item.label}>
            {item.label}
          </span>
          <span aria-hidden="true" className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-md bg-border">
            <span className={cn('block h-full rounded-md bg-current', INK[tone])} style={{ width: `${widths[i]}%` }} />
          </span>
          <b className="min-w-7 shrink-0 text-right tabular-nums text-foreground">{format(item.value)}</b>
        </li>
      ))}
    </ul>
  );
}

export function BarsCard({ title, items, aside, tone, format }: { title: string; items: LabelValue[]; aside?: React.ReactNode; tone?: SegmentTone; format?: (v: number) => string }) {
  return (
    <PanelCard title={title} aside={aside}>
      <BarRows items={items} tone={tone} format={format} />
    </PanelCard>
  );
}

/** Rosca. `center` é o texto no meio (ex.: porcentagem entregue). Sem fatias, mostra só o anel vazio. */
export function Donut({
  items,
  label,
  center,
  size = 'h-[132px] w-[132px]',
}: {
  items: { label: string; value: number; tone: SegmentTone | number }[];
  label: string;
  center?: string;
  size?: string;
}) {
  const arcs = donutArcs(items);
  const inkOf = (tone: SegmentTone | number) => (typeof tone === 'number' ? CATEGORY_INK[tone % CATEGORY_INK.length] : INK[tone]);
  return (
    <svg viewBox="0 0 120 120" className={cn('shrink-0', size)} role="img" aria-label={label}>
      <circle cx="60" cy="60" r={DONUT_RADIUS} fill="none" strokeWidth="18" className="stroke-border" />
      {arcs.map((a) => (
        <circle
          key={a.label}
          cx="60"
          cy="60"
          r={DONUT_RADIUS}
          fill="none"
          strokeWidth="18"
          strokeDasharray={a.dasharray}
          strokeDashoffset={a.dashoffset}
          transform="rotate(-90 60 60)"
          className={cn('stroke-current', inkOf(a.tone))}
        />
      ))}
      {center && (
        <text x="60" y="68" textAnchor="middle" fontSize="22" fontWeight="700" className="fill-foreground tabular-nums">
          {center}
        </text>
      )}
    </svg>
  );
}

/** Legenda das fatias: bolinha da cor e "nome (valor)". */
export function SegmentLegend({ items, className }: { items: { label: string; value: number; tone: SegmentTone | number; hint?: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap justify-center gap-x-3.5 gap-y-2', className)}>
      {items.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-foreground" title={s.hint}>
          <span
            aria-hidden="true"
            className={cn('h-2.5 w-2.5 rounded-full bg-current', typeof s.tone === 'number' ? CATEGORY_INK[s.tone % CATEGORY_INK.length] : INK[s.tone])}
          />
          {s.label} ({s.value})
        </li>
      ))}
    </ul>
  );
}

export function DonutCard({
  title,
  items,
  label,
  center,
  aside,
  footer,
  emptyMessage = 'Sem dados desta squad ainda.',
}: {
  title: string;
  items: Segment[];
  label: string;
  center?: string;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  emptyMessage?: string;
}) {
  const empty = items.every((i) => i.value <= 0);
  return (
    <PanelCard title={title} aside={aside}>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <div className="flex justify-center">
            <Donut items={items} label={label} center={center} />
          </div>
          <SegmentLegend items={items} className="border-t border-border pt-3" />
        </>
      )}
      {footer}
    </PanelCard>
  );
}

/** Número grande com ícone, dica e (opcional) um aviso curto. */
export function KpiTile({
  title,
  value,
  hint,
  icon,
  tone = 'brand',
  note,
  className,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(PAGE_CARD, 'flex min-w-0 flex-col gap-1.5 p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {icon && <IconTile icon={icon} tone={tone} size="md" />}
      </div>
      <span className="text-4xl font-bold leading-tight tabular-nums text-foreground">{value}</span>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      {note}
    </section>
  );
}

/** Aviso "Estimado": o número vem de uma regra por texto, não de um campo exato do Jira. */
export function EstimateTag({ hint, children = 'Estimado' }: { hint: string; children?: React.ReactNode }) {
  return (
    <span
      tabIndex={0}
      title={hint}
      aria-label={`${typeof children === 'string' ? children : 'Estimado'}: ${hint}`}
      className="inline-flex h-[22px] cursor-help items-center whitespace-nowrap rounded-full border border-dashed border-border px-2 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </span>
  );
}

/** Etiqueta de status da issue: concluído (verde), andamento (marca) ou neutro. */
export function IssueStatusPill({ issue }: { issue: { status?: string | null; statusCategory?: string | null } }) {
  const tone: Tone = isDoneIssue(issue) ? 'success' : isInProgressIssue(issue) ? 'brand' : 'neutral';
  return (
    <StatusChip tone={tone} className="h-6 shrink-0">
      {statusLabelPt(issue.status)}
    </StatusChip>
  );
}

/** Linha de issue: chave, título, uma linha de apoio e o status. */
export function IssueRow({
  jiraKey,
  title,
  meta,
  status,
  className,
}: {
  jiraKey: string;
  title: string;
  meta: string;
  status: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={cn('flex items-center justify-between gap-2.5 rounded-[14px] border border-border bg-muted/40 px-3 py-2.5', className)}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('shrink-0 font-mono text-xs font-bold', BRAND_TEXT)}>{jiraKey}</span>
          <span className="truncate text-[13px] font-bold text-foreground">{title}</span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {status}
    </li>
  );
}
