'use client';

import * as React from 'react';
import { useElementSize } from '@/components/room-kit/useElementSize';
import { cn } from '@/lib/utils';
import { INK } from './PanelWidgets';
import type { WorkloadRow } from './panel-model';

const MIN_SLOT = 64; // largura mínima de cada pessoa (abaixo disso rola na horizontal)
const MAX_SLOT = 120;
const BAR = 22;
const LEFT = 40;
const TOP = 12;
const PLOT = 200; // altura da área das barras
const HEIGHT = 262;

/** Degrau "redondo" para as linhas de grade: 1, 2, 5, 10, 20, 50... Garante 4 faixas cobrindo o maior valor. */
export function niceStep(max: number): number {
  const raw = Math.max(max, 4) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] || name;
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

/**
 * Barras lado a lado por pessoa: horas estimadas no Jira e capacidade da semana. SVG sem escala (o texto fica em
 * 12 px); com muita gente, rola na horizontal dentro do cartão.
 */
export function WorkloadChart({ rows }: { rows: WorkloadRow[] }) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.jiraHours, r.capacity]));
  const step = niceStep(max);
  const top = step * 4;
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const people = Math.max(rows.length, 1);
  // Cada pessoa ganha o espaço que sobra no cartão (entre 64 e 120 px); o texto nunca é reduzido.
  const SLOT = Math.min(MAX_SLOT, Math.max(MIN_SLOT, box.width > 0 ? Math.floor((box.width - LEFT - 12) / people) : MIN_SLOT));
  const width = LEFT + 12 + people * SLOT;
  const y = (v: number) => TOP + PLOT - (v / top) * PLOT;
  const summary = rows.map((r) => `${r.name}: ${r.jiraHours} h estimadas, capacidade ${r.capacity} h`).join('; ');

  return (
    <div className="flex flex-col gap-3">
      <div ref={boxRef} className="overflow-x-auto">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`Horas estimadas e capacidade da semana por pessoa. ${summary}`} className="max-w-none">
          {[0, 1, 2, 3, 4].map((i) => {
            const v = i * step;
            return (
              <g key={i}>
                <line x1={LEFT} x2={width - 8} y1={y(v)} y2={y(v)} strokeDasharray="3 4" className="stroke-border" />
                <text x={LEFT - 6} y={y(v) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground tabular-nums">
                  {v}
                </text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const x0 = LEFT + i * SLOT + (SLOT - (BAR * 2 + 2)) / 2;
            const h1 = (r.jiraHours / top) * PLOT;
            const h2 = (r.capacity / top) * PLOT;
            return (
              <g key={`${r.name}-${i}`}>
                <title>{`${r.name}: ${r.jiraHours} h estimadas no Jira, capacidade da semana ${r.capacity} h`}</title>
                <rect x={x0} y={y(r.jiraHours)} width={BAR} height={h1} rx={3} className={cn('fill-current', INK.brand)} />
                <rect x={x0 + BAR + 2} y={y(r.capacity)} width={BAR} height={h2} rx={3} className={cn('fill-current', INK.success)} />
                <text x={x0 + BAR + 1} y={HEIGHT - 10} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
                  {firstName(r.name)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[13px] font-semibold text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-[3px] bg-current', INK.brand)} />
          Horas estimadas no Jira
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-[3px] bg-current', INK.success)} />
          Capacidade da semana
        </span>
      </div>
    </div>
  );
}
