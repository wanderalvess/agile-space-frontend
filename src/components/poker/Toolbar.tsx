'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { 
  ArrowLeft, 
  Copy, 
  HelpCircle, 
  Users, 
  LayoutGrid,
  BrainCircuit,
  ListPlus,
  WalletCards,
  Eye,
  Sparkles,
  Info,
  Trophy,
  CheckCircle2,
  Volume2,
  VolumeX,
  MessageSquareHeart,
  Settings
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { PokerGuide } from './PokerGuide';
import { cn, getRoomInitials } from '@/lib/utils';

interface ToolbarProps {
  roomId: string;
  roomTitle?: string;
  roomTeam?: string;
  onLeaveRoom: () => void;
  onCopyLink: () => void;
  isParticipantsOpen: boolean;
  onToggleParticipants: (open: boolean) => void;
  isQueueOpen: boolean;
  onToggleQueue: (open: boolean) => void;
  isSoundEnabled?: boolean;
  onSetIsSoundEnabled?: (enabled: boolean) => void;
  onOpenFeedback?: () => void;
  isFacilitator?: boolean;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
}

export function Toolbar({
  roomId,
  roomTitle,
  roomTeam,
  onLeaveRoom,
  onCopyLink,
  isParticipantsOpen,
  onToggleParticipants,
  isQueueOpen,
  onToggleQueue,
  isSoundEnabled,
  onSetIsSoundEnabled,
  onOpenFeedback,
  isFacilitator,
  isSettingsOpen,
  onToggleSettings,
}: ToolbarProps) {
  const [isGuideOpen, setIsGuideOpen] = React.useState(false);

  return (
    <header className="flex items-center justify-between gap-4 bg-card py-2 px-4 rounded-2xl border border-border/50 shadow-sm shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="sm" onClick={onLeaveRoom} className="h-8 text-muted-foreground hover:text-primary shrink-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest">Sair</span>
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-black text-sm shadow-inner border border-primary/20 shrink-0 italic tracking-tighter">
          {getRoomInitials(roomTitle || "Scrum Poker")}
        </div>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 leading-none mb-1">
            <h1 className="text-sm font-black tracking-tight text-foreground uppercase truncate">
              {roomTitle || "Scrum Poker"}
            </h1>
            {roomTeam && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[7px] font-black uppercase bg-primary/5 text-primary border-primary/10 shrink-0">
                {roomTeam}
              </Badge>
            )}
          </div>
          <p className="text-[9px] font-bold text-muted-foreground/50 uppercase truncate tracking-widest leading-none">
            ID: {roomId}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCopyLink} className="h-8 text-[9px] font-black uppercase tracking-widest px-3 border-border/50">
          <Copy className="h-3.5 w-3.5 mr-2" />
          Link
        </Button>

        <Button 
          variant={isQueueOpen ? "secondary" : "outline"} 
          size="sm" 
          onClick={() => onToggleQueue(!isQueueOpen)} 
          className={cn(
            "h-8 text-[9px] font-black uppercase tracking-widest border-border/50 transition-all",
            isQueueOpen ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-2" />
          Tarefas
        </Button>

        <Button 
          variant={isParticipantsOpen ? "secondary" : "outline"} 
          size="sm" 
          onClick={() => onToggleParticipants(!isParticipantsOpen)} 
          className={cn(
             "h-8 text-[9px] font-black uppercase tracking-widest border-border/50 transition-all ml-1 rounded-lg",
             isParticipantsOpen ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5 mr-2" />
          Time
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

        {onSetIsSoundEnabled && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onSetIsSoundEnabled(!isSoundEnabled)}
            className={cn(
              "h-8 w-8 border-border/50 rounded-lg transition-all",
              isSoundEnabled ? "text-primary bg-primary/5 border-primary/20" : "text-muted-foreground"
            )}
            title={isSoundEnabled ? "Desativar Sons" : "Ativar Sons"}
          >
            {isSoundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </Button>
        )}

        {onOpenFeedback && (
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenFeedback}
            className="h-8 w-8 border-border/50 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
            title="Sugerir Melhoria"
          >
            <MessageSquareHeart className="h-3.5 w-3.5" />
          </Button>
        )}

        {isFacilitator && (
          <Button
            variant={isSettingsOpen ? "secondary" : "outline"}
            size="icon"
            onClick={onToggleSettings}
            className={cn(
              "h-8 w-8 border-border/50 rounded-lg transition-all ml-1",
              isSettingsOpen ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
            )}
            title="Configurações da Sala"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        )}        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsGuideOpen(true)}
          className="h-8 w-8 p-0 font-black text-[9px] uppercase tracking-widest border-border/50 text-muted-foreground hover:bg-primary/5 rounded-lg ml-1" 
          title="GUIA DO POKER"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
        <PokerGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
      </div>
    </header>
  );
}
