'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type HealthCheckParticipant, type HealthCheckVote, type HealthCheckVoteValue, type HealthCheckDimension, type HealthCheckScaleType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Users, Info, Copy, Loader2, ArrowLeft, MessageSquare, Sparkles, HelpCircle, HeartPulse, BarChart3, Shield, BrainCircuit, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Logo } from '../Logo';
import { Badge } from '../ui/badge';
import { HealthGuide } from './HealthGuide';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Progress } from "@/components/ui/progress";

interface HealthCheckVotingBoardProps {
  boardId: string;
  participants: HealthCheckParticipant[];
  userVotes: HealthCheckVote[];
  onVote: (dimension: string, value: HealthCheckVoteValue, comment?: string) => void;
  isCreator: boolean;
  onFinish: () => void;
  isFinishing: boolean;
  onLeave: () => void;
  dimensions: HealthCheckDimension[];
  roomTitle?: string;
  onOpenFeedback: () => void;
  scaleType?: HealthCheckScaleType;
}

export function HealthCheckVotingBoard({
  boardId,
  participants,
  userVotes,
  onVote,
  isCreator,
  onFinish,
  isFinishing,
  onLeave,
  dimensions,
  roomTitle,
  onOpenFeedback,
  scaleType = 'traffic_light',
}: HealthCheckVotingBoardProps) {
  const { toast } = useToast();
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [localComments, setLocalComments] = useState<Record<string, string>>(() => {
    const comments: Record<string, string> = {};
    userVotes.forEach(v => { if (v.comment) comments[v.dimensionKey] = v.comment; });
    return comments;
  });

  const handleCopyLink = async () => {
    const success = await copyToClipboard(window.location.href);
    if (success) {
      toast({ title: "Link Copiado!" });
    } else {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  const userVotesMap = useMemo(() => {
    return new Map(userVotes.map(v => [v.dimensionKey, v.value]));
  }, [userVotes]);

  const handleVoteClick = (dimensionKey: string, value: HealthCheckVoteValue) => {
    onVote(dimensionKey, value, localComments[dimensionKey]);
  };

  const handleCommentChange = (dimensionKey: string, comment: string) => {
    setLocalComments(prev => ({ ...prev, [dimensionKey]: comment }));
    const currentValue = userVotesMap.get(dimensionKey);
    if (currentValue) {
      onVote(dimensionKey, currentValue, comment);
    }
  };

  const handleFinishConfirm = () => {
    setIsFinishDialogOpen(false);
    onFinish();
  };

  const progress = Math.round((userVotes.length / dimensions.length) * 100);

  const getVoteColor = (value: HealthCheckVoteValue) => {
    if (value === 'green' || value === 'happy' || value === '5' || value === '4') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (value === 'yellow' || value === 'neutral' || value === '3' || value === '2') return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  const renderVoteButtons = (dimKey: string, currentVote?: string) => {
    if (scaleType === 'numbers_5') {
       return (
         <div className="grid grid-cols-5 gap-1.5 w-full">
           {['1', '2', '3', '4', '5'].map(val => (
             <Button
                key={val}
                variant="ghost"
                onClick={() => handleVoteClick(dimKey, val as HealthCheckVoteValue)}
                className={cn(
                  "flex flex-col gap-1.5 h-auto py-3 border-2 transition-all rounded-xl",
                  currentVote === val 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                    : "border-transparent bg-slate-50 hover:bg-slate-100"
                )}
             >
               <span className="text-sm font-black italic">{val}</span>
             </Button>
           ))}
         </div>
       );
    }

    if (scaleType === 'emojis') {
       const options = [
         { val: 'sad', emoji: '😫', label: 'Ruim' },
         { val: 'neutral', emoji: '😐', label: 'Médio' },
         { val: 'happy', emoji: '🙂', label: 'Bom' }
       ];
       return (
         <div className="grid grid-cols-3 gap-2 w-full">
           {options.map(opt => (
             <Button
                key={opt.val}
                variant="ghost"
                onClick={() => handleVoteClick(dimKey, opt.val as HealthCheckVoteValue)}
                className={cn(
                  "flex flex-col gap-1 h-auto py-3 border-2 transition-all rounded-xl",
                  currentVote === opt.val 
                    ? "bg-amber-100 border-amber-500 text-amber-900 shadow-md" 
                    : "border-transparent bg-slate-50 hover:bg-slate-100"
                )}
             >
               <span className="text-xl">{opt.emoji}</span>
               <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">{opt.label}</span>
             </Button>
           ))}
         </div>
       );
    }

    // Default: Traffic Light
    const trafficOptions = [
       { val: 'green', color: 'bg-emerald-500', label: 'Ótimo' },
       { val: 'yellow', color: 'bg-amber-500', label: 'Atenção' },
       { val: 'red', color: 'bg-rose-500', label: 'Ruim' }
    ];
    return (
      <div className="grid grid-cols-3 gap-2 w-full">
        {trafficOptions.map(opt => (
          <Button
            key={opt.val}
            variant="ghost"
            onClick={() => handleVoteClick(dimKey, opt.val as HealthCheckVoteValue)}
            className={cn(
              "flex flex-col gap-1.5 h-auto py-2.5 border-2 transition-all group rounded-xl shadow-sm",
              currentVote === opt.val 
                ? `${opt.val === 'green' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700' : opt.val === 'yellow' ? 'bg-amber-500/10 border-amber-500 text-amber-700' : 'bg-rose-500/10 border-rose-500 text-rose-700'}`
                : "border-transparent bg-slate-50 hover:bg-slate-100"
            )}
          >
            <div className={cn("w-3.5 h-3.5 rounded-full transition-transform shadow-inner", opt.color, currentVote === opt.val && "scale-110")} />
            <span className="text-[8px] font-black uppercase tracking-tighter">{opt.label}</span>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 bg-[#fafafa] relative overflow-hidden font-sans h-screen">
      {/* Mesh Gradient Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-200/30 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100/30 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <RoomHeader 
        title={roomTitle || "Radar de Saúde"} 
        toolIcon={<HeartPulse className="h-4 w-4" />}
        toolColorClass="text-emerald-600 bg-emerald-50"
        onOpenFeedback={onOpenFeedback}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3 bg-emerald-50/50 border border-emerald-100/50 px-4 py-1.5 rounded-xl mr-2">
              <div className="space-y-1 min-w-[100px]">
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-emerald-700/60">
                  <span>Progresso</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1 bg-emerald-100" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 mr-2">
              <div className="p-1 px-2.5 bg-slate-100 rounded-lg text-slate-500 font-black text-[10px] flex items-center gap-1.5 h-8">
                <Users className="h-3 w-3" />
                {participants.length}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyLink}
                className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                title="Copiar Link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

            {isCreator && (
              <Button 
                variant="secondary" 
                size="sm" 
                disabled={isFinishing} 
                onClick={() => setIsFinishDialogOpen(true)} 
                className="h-8 text-[9px] font-black uppercase tracking-widest shadow-sm border border-emerald-500/10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all rounded-xl ml-1"
              >
                {isFinishing ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                )}
                {isFinishing ? 'Salvando...' : 'Encerrar'}
              </Button>
            )}

            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsGuideOpen(true)}
              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all ml-1" 
              title="GUIA DO RADAR"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <HealthGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
          </div>
        } 
      />

      <div className="max-w-[1750px] mx-auto w-full space-y-4 px-4 md:px-10 pt-4 pb-12 overflow-y-auto min-h-0 flex-1">

        <Card className="bg-emerald-600/10 border border-emerald-500/20 backdrop-blur-md rounded-[1.5rem] overflow-hidden relative">
          <CardContent className="p-3 md:p-4 flex items-center justify-center gap-4 relative z-10">
            <div className="px-3 py-1 bg-emerald-600 rounded-full text-[8px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-500/20 shrink-0">Privacidade Anonimato</div>
            <p className="text-[11px] md:text-xs font-bold text-emerald-800 leading-none tracking-tight">
              Os votos são <span className="text-emerald-600">100% secretos</span>. Compilamos apenas a saúde geral da squad.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dimensions.map(dim => {
            const currentVote = userVotesMap.get(dim.key);

            return (
              <Card key={dim.key} className={cn(
                "flex flex-col border-white/60 shadow-xl shadow-slate-900/5 overflow-hidden bg-white/40 backdrop-blur-xl transition-all rounded-[2.5rem] hover:shadow-2xl hover:scale-[1.02] duration-300",
                currentVote && "border-emerald-500/30 ring-4 ring-emerald-500/5 bg-white/60"
              )}>
                <CardHeader className="p-4 md:p-5 pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-sm md:text-base font-black uppercase tracking-tight flex-1 leading-tight">{dim.title}</CardTitle>
                    {currentVote && <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1", getVoteColor(currentVote as HealthCheckVoteValue))} />}
                  </div>
                  <CardDescription className="text-[10px] md:text-[11px] font-medium leading-tight line-clamp-2 min-h-[22px] text-slate-500/80">{dim.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 p-4 md:p-5 pt-0 space-y-4">
                  {renderVoteButtons(dim.key, currentVote)}

                  {currentVote && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-1.5 mb-1.5 px-1 text-slate-400">
                        <MessageSquare className="h-2.5 w-2.5" />
                        <span className="text-[8px] font-black uppercase tracking-[0.1em]">Contexto</span>
                      </div>
                      <Textarea
                        placeholder="Por que essa nota?..."
                        value={localComments[dim.key] || ''}
                        onChange={(e) => handleCommentChange(dim.key, e.target.value)}
                        className="text-[10px] min-h-[60px] rounded-lg bg-slate-50/50 border-slate-100 focus:bg-white transition-all resize-none shadow-inner p-2"
                      />
                    </div>
                  )}
                  
                  {!currentVote && (
                    <div className="h-6 flex items-center justify-center">
                       <p className="text-[8px] font-black uppercase tracking-widest text-slate-200">Aguardando Avaliação</p>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className={cn(
                  "p-2.5 border-t flex items-center justify-center transition-colors",
                  currentVote ? "bg-primary/5" : "bg-muted/10"
                )}>
                  {currentVote ? (
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Voto Registrado
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Aguardando Avaliação</span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <AlertDialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight italic">Encerrar Radar de Saúde?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Deseja encerrar a votação e gerar o relatório consolidado para a squad? Esta ação é definitiva e a sala não aceitará novos votos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold text-[10px] uppercase">Continuar Votando</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishConfirm} className="bg-primary font-black text-[10px] uppercase tracking-widest px-8 shadow-lg shadow-primary/20">
              Confirmar e Gerar Resultados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
