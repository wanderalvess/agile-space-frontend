'use client';

import * as React from 'react';
import { Lock, Pencil, RefreshCw, Trash2, Loader2, Users2 } from 'lucide-react';
import { IconButton, StatusChip } from '@/components/room-kit';
import { BRAND_TEXT } from '@/components/room-kit/tokens';
import { PANEL_TABLE_SHOWN } from '@/lib/squad-panel-engine';
import { cn } from '@/lib/utils';
import { BarRows, CATEGORY_INK, Donut, PanelCard } from '../PanelWidgets';
import { STORAGE_LABEL, capRows, formatPanelValue, type PanelCardModel } from './jql-model';

const MAX_BARS = 8;
const MAX_SLICES = 6;
const BODY = 'min-h-[190px]';

interface Props {
  card: PanelCardModel;
  running: boolean;
  onRefresh: (card: PanelCardModel) => void;
  onEdit: (card: PanelCardModel) => void;
  onDelete: (card: PanelCardModel) => void;
}

function CardBody({ card }: { card: PanelCardModel }) {
  const metric = card.aggregateMetric;
  const rows = card.resultRows ?? [];

  if (card.chartType === 'number') {
    return (
      <div className={cn(BODY, 'flex flex-col items-center justify-center gap-1.5 text-center')}>
        <span className="text-6xl font-bold leading-none tabular-nums text-foreground">{card.resultTotal ?? 0}</span>
        <span className="text-[13px] text-muted-foreground">Issues encontradas no Jira</span>
      </div>
    );
  }

  if (card.chartType === 'bar') {
    const { rows: shown, hidden } = capRows(rows, MAX_BARS);
    return (
      <div className={cn(BODY, 'flex flex-col justify-center gap-2')}>
        <BarRows items={shown} format={(v) => formatPanelValue(metric, v)} labelWidth="w-[96px] sm:w-[120px]" />
        {hidden > 0 && <p className="text-xs text-muted-foreground">Mostrando {shown.length} de {rows.length} grupos.</p>}
      </div>
    );
  }

  if (card.chartType === 'pie') {
    const { rows: top, hidden } = capRows(rows, MAX_SLICES);
    const rest = rows.slice(MAX_SLICES).reduce((sum, r) => sum + r.value, 0);
    const slices = [...top.map((r, i) => ({ label: r.label, value: r.value, tone: i })), ...(hidden > 0 ? [{ label: `Outros (${hidden} grupos)`, value: rest, tone: MAX_SLICES }] : [])];
    const total = slices.reduce((s, x) => s + x.value, 0);
    return (
      <div className={cn(BODY, 'flex flex-wrap items-center justify-center gap-x-6 gap-y-3')}>
        {total > 0 ? (
          <>
            <Donut items={slices} label={`${card.title}: ${slices.map((s) => `${s.label} ${formatPanelValue(metric, s.value)}`).join(', ')}`} />
            <ul className="flex flex-col gap-1.5">
              {slices.map((s) => (
                <li key={s.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full bg-current', CATEGORY_INK[s.tone % CATEGORY_INK.length])} />
                  <span className="max-w-[160px] truncate" title={s.label}>{s.label}</span>
                  <span className="tabular-nums text-muted-foreground">{formatPanelValue(metric, s.value)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhuma issue encontrada para esta consulta.</p>
        )}
      </div>
    );
  }

  const issues = (card.resultIssues ?? []).slice(0, PANEL_TABLE_SHOWN);
  const total = card.resultTotal ?? issues.length;
  return (
    <div className={BODY}>
      <div className="max-h-56 overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className="w-[120px] px-3 py-2 font-bold">Chave</th>
              <th scope="col" className="px-3 py-2 font-bold">Resumo</th>
              <th scope="col" className="w-[140px] px-3 py-2 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {issues.length > 0 ? (
              issues.map((iss) => (
                <tr key={iss.key} className="border-t border-border">
                  <td className={cn('whitespace-nowrap px-3 py-2 font-mono font-bold', BRAND_TEXT)}>{iss.key}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-semibold text-foreground" title={iss.title}>{iss.title}</td>
                  <td className="px-3 py-2"><StatusChip>{iss.status || '—'}</StatusChip></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-center text-[13px] text-muted-foreground">Nenhuma issue encontrada para esta consulta.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > issues.length && issues.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">Mostrando {issues.length} de {total} issues.</p>
      )}
    </div>
  );
}

export function JqlPanelCard({ card, running, onRefresh, onEdit, onDelete }: Props) {
  const hasResult = card.updatedLabel !== '' || card.resultTotal !== undefined;
  const showResult = !running && (hasResult || card.storage === 'local');
  const VisIcon = card.visibility === 'squad' ? Users2 : Lock;

  return (
    <PanelCard
      title={card.title}
      titleId={`jql-${card.key}`}
      aside={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* "Na squad" já diz que a squad inteira vê; o rótulo de visibilidade só entra quando acrescenta algo. */}
          {!(card.storage === 'squad' && card.visibility === 'squad') && (
            <StatusChip tone="neutral" className="gap-1">
              <VisIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              {card.visibility === 'squad' ? 'Squad' : 'Privado'}
            </StatusChip>
          )}
          <StatusChip tone={card.storage === 'squad' ? 'brand' : 'neutral'}>{STORAGE_LABEL[card.storage]}</StatusChip>
          {card.canEdit && (
            <>
              <IconButton label={`Atualizar ${card.title}`} icon={RefreshCw} size="sm" disabled={running} onClick={() => onRefresh(card)} className={running ? '[&_svg]:animate-spin' : undefined} />
              <IconButton label={`Editar ${card.title}`} icon={Pencil} size="sm" onClick={() => onEdit(card)} />
              <IconButton label={`Excluir ${card.title}`} icon={Trash2} size="sm" onClick={() => onDelete(card)} />
            </>
          )}
        </div>
      }
    >
      <div className="truncate rounded-[10px] border border-border bg-muted/40 px-2.5 py-2 font-mono text-xs text-muted-foreground" title={card.jql}>
        <b className={BRAND_TEXT}>JQL: </b>
        {card.jql}
      </div>

      {card.storage === 'squad' && card.ownerName && (
        <p className="text-xs text-muted-foreground">Criado por {card.fromOthers ? card.ownerName : 'você'}</p>
      )}

      {card.approximate && !running && (
        <p role="note" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Aproximação: o Jira não respondeu à consulta (confira o token), então este resultado usa as issues já sincronizadas da squad e pode não bater com a JQL.
        </p>
      )}

      {card.lastRunError && !running && (
        <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">
          A última atualização falhou: {card.lastRunError}
        </p>
      )}

      {running ? (
        <div role="status" className={cn(BODY, 'flex flex-col items-center justify-center gap-2 text-muted-foreground')}>
          <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-[13px]">Consultando Jira…</span>
        </div>
      ) : showResult ? (
        <CardBody card={card} />
      ) : (
        <p className={cn(BODY, 'flex items-center justify-center text-center text-[13px] text-muted-foreground')}>
          {card.fromOthers ? `Ainda sem resultado. ${card.ownerName || 'Quem criou'} precisa atualizar o painel.` : 'Ainda sem resultado. Atualize o painel para consultar o Jira.'}
        </p>
      )}

      {card.updatedLabel && <p className="text-right text-xs text-muted-foreground">Atualizado às {card.updatedLabel}</p>}
    </PanelCard>
  );
}
