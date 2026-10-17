'use client';

import React from 'react';
import { AlertTriangle, ChevronDown, CloudDownload, FileText, Filter, Loader2, Plus, RefreshCw, Check, TrendingUp, WifiOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FOCUS_RING, OUTLINE_BUTTON } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { PREPARATION_STATUS, type CardKind } from './types';
import type { Readiness } from './review-room-logic';
import type { RoomConnection, SaveState } from './useShowcaseRoom';

export interface ReviewPrepBarProps {
  readiness: Readiness;
  /** true quando a lista está filtrada: os números são só dos cards visíveis. */
  isFiltered: boolean;
  sessionTotal: number;
  effort: { spentLabel: string; estimateLabel: string };
  connection: RoomConnection;
  saveState: SaveState;
  onToggleTaskStatus: (taskId: string, markAsDone: boolean) => void;
  onAddManualTask: (kind: CardKind) => void;
  onOpenJira: () => void;
  onRetrySave: () => void;
}

/** Prontidão e esforço no topo da lista: barra de progresso, divergências e o popover com a lista dos cards. */
function Readiness({ readiness, isFiltered, sessionTotal, onToggleTaskStatus }: Pick<ReviewPrepBarProps, 'readiness' | 'isFiltered' | 'sessionTotal' | 'onToggleTaskStatus'>) {
  const { readyCount, mismatchCount, total, percent, rows } = readiness;
  const allReady = total > 0 && readyCount === total;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Prontidão: ${readyCount} de ${total} cards prontos${mismatchCount ? `, ${mismatchCount} com status divergente` : ''}. Abrir a lista`}
          className={cn('group flex items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent/40 max-sm:min-h-11', FOCUS_RING)}
        >
          <span className="flex flex-col">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Prontidão {isFiltered && <Filter className="h-3 w-3" strokeWidth={1.5} aria-label="Filtrado" />}
            </span>
            <span className={cn('text-xl font-bold leading-none tabular-nums', allReady && 'text-emerald-700 dark:text-emerald-300')}>
              {readyCount}/{total}
            </span>
          </span>
          <span className="h-2 w-28 overflow-hidden rounded-full bg-muted sm:w-40" aria-hidden="true">
            <span className="block h-full rounded-full bg-emerald-600 transition-[width] duration-slow motion-reduce:transition-none dark:bg-emerald-400" style={{ width: `${percent}%` }} />
          </span>
          {mismatchCount > 0 && (
            <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
              {mismatchCount} {mismatchCount === 1 ? 'divergente' : 'divergentes'}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(30rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0">
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 text-sm font-bold">Prontidão da sessão</h3>
            <span className={cn('text-xs font-bold tabular-nums', allReady && 'text-emerald-700 dark:text-emerald-300')}>{readyCount}/{total} prontas</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-400" style={{ width: `${percent}%` }} />
          </div>
          {isFiltered && (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <Filter className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              Filtro da lista ativo: mostrando {total} de {sessionTotal} cards.
            </p>
          )}
          {mismatchCount > 0 && (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              Status manual e conteúdo real divergem em {mismatchCount} {mismatchCount > 1 ? 'cards' : 'card'}; veja abaixo.
            </p>
          )}
        </div>
        <ul className="m-0 max-h-[22rem] list-none overflow-y-auto p-0">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">{isFiltered ? 'Nenhum card neste filtro.' : 'Nenhum card ainda.'}</li>
          )}
          {rows.map(({ task: t, contentComplete, mismatch }) => {
            const meta = PREPARATION_STATUS[t.preparationStatus || 'todo'];
            return (
              <li key={t.id} className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 last:border-0">
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', contentComplete ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
                  title={contentComplete ? 'Conteúdo completo' : 'Conteúdo incompleto'}
                  role="img"
                  aria-label={contentComplete ? 'Conteúdo completo' : 'Conteúdo incompleto'}
                />
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-bold tabular-nums">{t.key}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{t.title || 'Sem título'}</span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', meta.cls)}>{meta.label}</span>
                {mismatch && (
                  <button
                    type="button"
                    title={t.preparationStatus === 'done' ? 'Marcada como pronta, mas falta conteúdo: clique para corrigir o status' : 'Conteúdo completo: clique para marcar como pronta'}
                    aria-label={t.preparationStatus === 'done' ? `Corrigir o status de ${t.key}: marcada como pronta, mas falta conteúdo` : `Marcar ${t.key} como pronta: o conteúdo está completo`}
                    onClick={() => onToggleTaskStatus(t.id, contentComplete)}
                    className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300', FOCUS_RING)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Conexão com a sala e gravação, os dois estados que o código já conhecia e a tela não mostrava. */
export function SyncIndicator({ connection, saveState, onRetrySave }: Pick<ReviewPrepBarProps, 'connection' | 'saveState' | 'onRetrySave'>) {
  const chip = 'inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap';
  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      {connection.state === 'live' && (
        <span className={cn(chip, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')} title="Conectado: as alterações dos outros chegam na hora">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> Conectado
        </span>
      )}
      {connection.state === 'connecting' && (
        <span className={cn(chip, 'bg-muted text-muted-foreground')}>
          <Loader2 className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Conectando…
        </span>
      )}
      {connection.state === 'reconnecting' && (
        <span className={cn(chip, 'bg-amber-500/10 text-amber-700 dark:text-amber-300')} title="A conexão caiu: a sala tenta de novo sozinha">
          <RefreshCw className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Reconectando… nova tentativa em {connection.retryInSec} s
        </span>
      )}
      {connection.state === 'offline' && (
        <span className={cn(chip, 'bg-red-500/10 text-red-700 dark:text-red-300')} title="Sem conexão com a sala">
          <WifiOff className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Sem conexão: tentando de novo em {connection.retryInSec} s
        </span>
      )}
      {saveState === 'saving' && (
        <span className={cn(chip, 'bg-muted text-muted-foreground')}>
          <Loader2 className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Salvando…
        </span>
      )}
      {saveState === 'saved' && (
        <span className={cn(chip, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
          <Check className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> Salvo agora
        </span>
      )}
      {saveState === 'error' && (
        <button type="button" onClick={onRetrySave} className={cn(chip, 'bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300', FOCUS_RING)} title="A última alteração não foi gravada e a tela voltou ao que está no servidor. Clique para reler a Review.">
          <AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Não salvou · reler
        </button>
      )}
    </div>
  );
}

/** Menu Adicionar: importar do Jira ou criar card manual (padrão ou de métricas). */
export function AddCardsMenu({ onOpenJira, onAddManualTask }: Pick<ReviewPrepBarProps, 'onOpenJira' | 'onAddManualTask'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tour="jira-import"
          title="Importar do Jira ou criar card"
          className={cn('inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold transition-colors max-sm:h-11', OUTLINE_BUTTON, FOCUS_RING)}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Adicionar <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onClick={onOpenJira} className="items-start gap-2.5 py-2">
          <CloudDownload className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-sm">Importar do Jira</span>
            <span className="text-xs text-muted-foreground">Traz as issues da sprint com problema e solução</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Card manual</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAddManualTask('story')} className="gap-2.5">
          <FileText className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card padrão
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddManualTask('metrics')} className="gap-2.5">
          <TrendingUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card de métricas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Faixa abaixo do cabeçalho da sala: prontidão, esforço total, conexão e gravação, e o menu Adicionar. */
export function ReviewPrepBar(p: ReviewPrepBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card/50 px-3 py-3 sm:px-4 xl:px-6">
      <Readiness readiness={p.readiness} isFiltered={p.isFiltered} sessionTotal={p.sessionTotal} onToggleTaskStatus={p.onToggleTaskStatus} />
      <div className="flex flex-col" title="Horas gastas / horas estimadas, somadas dos cards">
        <span className="text-xs text-muted-foreground">Esforço total</span>
        <span className="text-xl font-bold leading-none tabular-nums">
          {p.effort.spentLabel} <span className="text-[13px] font-medium text-muted-foreground">/ {p.effort.estimateLabel}</span>
        </span>
      </div>
      <span className="hidden flex-1 sm:block" />
      <SyncIndicator connection={p.connection} saveState={p.saveState} onRetrySave={p.onRetrySave} />
      <AddCardsMenu onOpenJira={p.onOpenJira} onAddManualTask={p.onAddManualTask} />
    </div>
  );
}

