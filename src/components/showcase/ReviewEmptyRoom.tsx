'use client';

import React from 'react';
import { ChevronDown, CloudDownload, FileText, Plus, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FOCUS_RING, IconTile, ModalButton, OUTLINE_BUTTON } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import type { CardKind } from './types';

/** Sala sem cards: três passos, com a importação do Jira em destaque. */
export function ReviewEmptyRoom({ onOpenJira, onAddManualTask }: { onOpenJira: () => void; onAddManualTask: (kind: CardKind) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10 text-center md:py-16">
      <IconTile icon={moduleIcon('showcase')} size="lg" className="h-16 w-16 rounded-3xl [&_svg]:h-8 [&_svg]:w-8" />
      <h2 className="m-0 mt-6 text-3xl font-bold tracking-tight md:text-4xl">Sua Review está pronta</h2>
      <p className="m-0 mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
        Falta só trazer as tarefas da sprint. Depois é preparar as evidências e apresentar para o PO.
      </p>

      <ol className="m-0 mt-10 grid w-full list-none grid-cols-1 gap-4 p-0 text-left md:grid-cols-3">
        <li className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5 dark:bg-primary/10">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">1</span>
            <span className="text-sm font-bold">Importe as tarefas</span>
          </div>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">Traga as issues da sprint direto do Jira ou crie os cards à mão.</p>
          <div className="mt-auto flex flex-col gap-2">
            <ModalButton variant="primary" className="gap-2" onClick={onOpenJira}>
              <CloudDownload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar do Jira
            </ModalButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition-colors', OUTLINE_BUTTON, FOCUS_RING)}>
                  <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar card manual <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onAddManualTask('story')} className="gap-2">
                  <FileText className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card padrão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddManualTask('metrics')} className="gap-2">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card de métricas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
        <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</span>
            <span className="text-sm font-bold">Prepare as evidências</span>
          </div>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">Em cada card, conte o problema e a solução e anexe vídeo ou print. Marque como pronto quando terminar.</p>
        </li>
        <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">3</span>
            <span className="text-sm font-bold">Apresente e colete o aceite</span>
          </div>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            Em <strong className="font-semibold text-foreground">Apresentar</strong>, o Modo Teatro mostra uma entrega por vez e registra a decisão do PO.
          </p>
        </li>
      </ol>
    </div>
  );
}
