'use client';

import { CloudDownload, Play, HelpCircle, Link2, Settings2, FileText, TrendingUp, MoreHorizontal, MessageSquareText, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CardKind } from './types';

interface ShowcaseRoomHeaderActionsProps {
  onGuide: () => void;
  onShare: () => void;
  onSettings: () => void;
  onAddManualTask: (cardKind: CardKind) => void;
  onOpenJira: () => void;
  onStartPresenting: () => void;
  /** Quando informado, "Retro desta sprint" aparece no menu Mais ações. */
  onOpenRetro?: () => void;
}

const secondaryBtn =
  'h-9 px-3 rounded-xl font-bold text-xs gap-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all';

/**
 * Três grupos, da esquerda para a direita: conteúdo (Adicionar: Jira ou card manual), sessão
 * (Configurar, Copiar link, Mais) e a ação principal (Apresentar), separada pelo divisor.
 * Antes eram cinco botões soltos com rótulos e ícones misturados.
 */
export function ShowcaseRoomHeaderActions({
  onGuide, onShare, onSettings, onAddManualTask, onOpenJira, onStartPresenting, onOpenRetro,
}: ShowcaseRoomHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-tour="jira-import" variant="ghost" className={secondaryBtn} title="Importar do Jira ou criar card">
              <Plus className="h-4 w-4" /> <span className="hidden md:inline">Adicionar</span>
              <ChevronDown className="h-3 w-3 opacity-60 hidden md:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl dark:bg-slate-900 dark:border-slate-800">
            <DropdownMenuItem onClick={onOpenJira} className="gap-2.5 text-xs font-semibold py-2">
              <CloudDownload className="h-4 w-4 text-sky-500" />
              <div>
                <p>Importar do Jira</p>
                <p className="text-[11px] font-medium text-muted-foreground">Traz as issues da sprint com problema e solução</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Card manual</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAddManualTask('story')} className="gap-2.5 text-xs font-semibold">
              <FileText className="h-4 w-4 text-slate-400" /> Card padrão
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddManualTask('metrics')} className="gap-2.5 text-xs font-semibold">
              <TrendingUp className="h-4 w-4 text-violet-500" /> Card de métricas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />

        <Button variant="ghost" onClick={onSettings} className={secondaryBtn} title="Configurações da Review" aria-label="Configurações da Review">
          <Settings2 className="h-4 w-4" /> <span className="hidden lg:inline">Configurar</span>
        </Button>
        <Button variant="ghost" onClick={onShare} className={secondaryBtn} title="Copiar o link da Review" aria-label="Copiar o link da Review">
          <Link2 className="h-4 w-4" /> <span className="hidden lg:inline">Copiar link</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all"
              title="Mais ações"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl dark:bg-slate-900 dark:border-slate-800">
            {onOpenRetro && (
              <DropdownMenuItem onClick={onOpenRetro} className="gap-2 text-xs font-semibold">
                <MessageSquareText className="h-3.5 w-3.5 text-slate-400" /> Retro desta sprint
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onGuide} className="gap-2 text-xs font-semibold">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" /> Como funciona
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        data-tour="start-teatro"
        onClick={onStartPresenting}
        className="h-9 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-2 shadow-lg shadow-violet-600/20 transition-all active:scale-95"
      >
        <Play className="h-3.5 w-3.5 fill-current" /> Apresentar
      </Button>
    </div>
  );
}
