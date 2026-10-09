'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Download, 
  Ghost, 
  User,
  LayoutGrid,
  Network,
  Share2,
  Columns as ColumnsIcon,
  Target as TargetIcon,
  ListChecks as ActionsIcon,
  HelpCircle,
  Users,
  Monitor,
  Eye,
  EyeOff
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { EliteTimer } from '@/components/shared/EliteTimer';
import { BrainstormingBoard, BrainstormingPhase, BrainstormingIdea, BrainstormingGroup, TimerState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExportBrainstormingDialog } from './ExportDialog';
import { BrainstormingGuide } from './BrainstormingGuide';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

interface ToolbarProps {
  boardData: BrainstormingBoard;
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  isCreator: boolean;
  onPhaseChange: (phase: BrainstormingPhase) => void;
  onToggleAnonymous: () => void;
  onExportImage: () => void;
  isParticipantsOpen: boolean;
  onToggleParticipants: (open: boolean) => void;
  timer?: TimerState;
  onSetTimerDuration: (duration: number) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onTogglePresentationMode: () => void;
  onToggleReveal: () => void;
}

export function BrainstormingToolbar({
  boardData,
  ideas,
  groups,
  isCreator,
  onPhaseChange,
  onToggleAnonymous,
  onExportImage,
  isParticipantsOpen,
  onToggleParticipants,
  timer,
  onSetTimerDuration,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  isSoundEnabled,
  onSetIsSoundEnabled,
  onTogglePresentationMode,
  onToggleReveal
}: ToolbarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isGuideOpen, setIsGuideOpen] = React.useState(false);
  // Com as ideias ocultas pelo facilitador, exportar mostraria o texto de todo mundo: só o facilitador exporta.
  const isExportBlocked = boardData.settings.isRevealed === false && !isCreator;

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(ok
      ? { title: "Link copiado!", description: "Convide seu time para a sessão." }
      : { title: "Não foi possível copiar o link", variant: "destructive" });
  };

  return (
    <div className="sticky top-0 z-40 h-14 w-full bg-white/70 backdrop-blur-2xl border-b border-white/60 shrink-0 select-none shadow-sm overflow-hidden">
      <div className="h-full flex items-center justify-between px-4 md:px-6 gap-4">
        
        {/* Left: Navigation & Info */}
        <div className="flex items-center gap-3 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/')}
            aria-label="Voltar para o início"
            className="h-9 w-9 text-slate-400 hover:text-slate-900 hover:bg-slate-100/50 rounded-xl shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[200px] lg:max-w-[300px]">
            <h1 
              className="text-[10px] font-black text-slate-900 uppercase tracking-tighter truncate leading-none mb-1"
              title={boardData.title}
            >
              {boardData.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
              <span>BRAIN</span>
              <span className="opacity-30">•</span>
              <span className="text-amber-500 italic">
                {boardData.phase === 'ideation' && 'IDEAÇÃO'}
                {boardData.phase === 'diagram' && 'TEIA'}
                {boardData.phase === 'grouping' && 'AGRUPAMENTO'}
                {boardData.phase === 'prioritization' && 'PRIORIZAÇÃO'}
                {boardData.phase === 'actions' && 'AÇÕES'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Phase Transition */}
        <div className={cn(
          "hidden xl:flex items-center p-1 bg-slate-100/50 rounded-xl border border-slate-200/50",
          !isCreator && "opacity-80 pointer-events-none"
        )}>
          <Button
            onClick={() => isCreator && onPhaseChange('ideation')}
            variant="ghost"
            className={cn(
              "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all",
              boardData.phase === 'ideation' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-900"
            )}
          >
            <LayoutGrid className="h-3 w-3 mr-1.5" />
            Mural
          </Button>
          <Button
            onClick={() => isCreator && onPhaseChange('diagram')}
            variant="ghost"
            className={cn(
              "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all",
              boardData.phase === 'diagram' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-900"
            )}
          >
            <Network className="h-3 w-3 mr-1.5" />
            Teia
          </Button>
          <Button
            onClick={() => isCreator && onPhaseChange('grouping')}
            variant="ghost"
            className={cn(
              "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all",
              boardData.phase === 'grouping' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-900"
            )}
          >
            <ColumnsIcon className="h-3 w-3 mr-1.5" />
            Grupos
          </Button>
          <Button
            onClick={() => isCreator && onPhaseChange('prioritization')}
            variant="ghost"
            className={cn(
              "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all",
              boardData.phase === 'prioritization' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-900"
            )}
          >
            <TargetIcon className="h-3 w-3 mr-1.5" />
            Matriz
          </Button>
          <Button
            onClick={() => isCreator && onPhaseChange('actions')}
            variant="ghost"
            className={cn(
              "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all",
              boardData.phase === 'actions' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-900"
            )}
          >
            <ActionsIcon className="h-3 w-3 mr-1.5" />
            Plano
          </Button>
        </div>

        {/* Fase no celular/tablet: a barra de fases só cabe em telas largas */}
        {isCreator && (
          <select
            aria-label="Fase da sessão"
            value={boardData.phase}
            onChange={(e) => onPhaseChange(e.target.value as BrainstormingPhase)}
            className="xl:hidden h-8 max-w-[130px] rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-widest text-slate-600"
          >
            <option value="ideation">Mural</option>
            <option value="diagram">Teia</option>
            <option value="grouping">Grupos</option>
            <option value="prioritization">Matriz</option>
            <option value="actions">Plano</option>
          </select>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {timer && (
            <div className="hidden sm:block scale-90 origin-right">
              <EliteTimer
                timer={timer}
                onStart={onStartTimer}
                onPause={onPauseTimer}
                onResume={onResumeTimer}
                onReset={onResetTimer}
                onSetDuration={onSetTimerDuration}
                isSoundEnabled={isSoundEnabled}
                onToggleSound={(enabled) => onSetIsSoundEnabled(enabled)}
                isFacilitator={isCreator}
              />
            </div>
          )}

          <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block" />

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsGuideOpen(true)}
              className="h-8 w-8 text-slate-400 hover:text-amber-500 rounded-lg"
              title="Guia Rápido"
              aria-label="Guia rápido"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            {isCreator && (
              <div className="flex items-center gap-1">
                <Button
                  variant={boardData.settings.isAnonymous ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onToggleAnonymous}
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    boardData.settings.isAnonymous ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:text-indigo-500"
                  )}
                  title={boardData.settings.isAnonymous ? "Desativar Anonimato" : "Ativar Anonimato"}
                  aria-label={boardData.settings.isAnonymous ? "Desativar anonimato" : "Ativar anonimato"}
                >
                  {boardData.settings.isAnonymous ? <Ghost className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </Button>

                <Button
                  variant={boardData.settings.isRevealed === false ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onToggleReveal}
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    boardData.settings.isRevealed === false ? "bg-amber-100 text-amber-600" : "text-slate-400 hover:text-amber-500"
                  )}
                  title={boardData.settings.isRevealed === false ? "Revelar Ideias" : "Ocultar Ideias"}
                  aria-label={boardData.settings.isRevealed === false ? "Revelar ideias" : "Ocultar ideias"}
                >
                  {boardData.settings.isRevealed === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>

                <Button
                  variant={boardData.settings.isPresentationMode ? "secondary" : "ghost"}
                  size="icon"
                  onClick={onTogglePresentationMode}
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    boardData.settings.isPresentationMode ? "bg-amber-100 text-amber-600" : "text-slate-400 hover:text-amber-500"
                  )}
                  title={boardData.settings.isPresentationMode ? "Sair do Modo Apresentação" : "Modo Apresentação (Oculta Inputs)"}
                  aria-label={boardData.settings.isPresentationMode ? "Sair do modo apresentação" : "Ativar modo apresentação"}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg"
              title="Convidar Time"
              aria-label="Copiar link de convite"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            <Button
              variant={isParticipantsOpen ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onToggleParticipants(!isParticipantsOpen)}
              aria-label="Participantes"
              aria-pressed={isParticipantsOpen}
              className={cn(
                "h-8 w-8 rounded-lg",
                isParticipantsOpen && "bg-amber-100 text-amber-600"
              )}
            >
              <Users className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => setIsExportModalOpen(true)}
              disabled={isExportBlocked}
              title={isExportBlocked ? "Disponível quando o facilitador revelar as ideias" : "Exportar"}
              className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200 shrink-0"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>

        <BrainstormingGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
        <ExportBrainstormingDialog
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          boardData={boardData}
          ideas={ideas}
          groups={groups}
          onExportImage={onExportImage}
        />
      </div>
    </div>
  );
}
