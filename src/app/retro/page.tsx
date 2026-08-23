'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  Target, 
  Users, 
  ShieldCheck,
  TrendingUp,
  ArrowRight as ArrowRightIcon,
  HeartPulse,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ListTodo,
  Trash2
} from 'lucide-react';
import { retroApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { RETRO_TEMPLATES, RetroTemplateKey, RetroColumnDef, RetroColumnTheme } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export default function RetroHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Setup State
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState(userProfile?.squadId || userProfile?.team || '');
  const [template, setTemplate] = useState<RetroTemplateKey>('classic');
  const [customColumns, setCustomColumns] = useState<{ title: string; theme: RetroColumnTheme }[]>([
    { title: '', theme: 'success' },
    { title: '', theme: 'warning' },
    { title: '', theme: 'action' },
  ]);

  const saveRoomMeta = (id: string, type: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = {
        roomId: id,
        type,
        title,
        team,
        createdBy: userProfile?.id,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error("Erro ao salvar metadados da sala", e);
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;

    if (!userProfile || !userProfile.id) {
      console.error("[retro] Tentativa de criação de quadro abortada: usuário nulo ou sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível carregar a sua identidade. Por favor, defina seu perfil e tente novamente.",
        variant: "destructive"
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título Obrigatório",
        description: "Dê um nome ao seu quadro antes de iniciar.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    // Resolve columns
    let columns: RetroColumnDef[];
    if (template === 'custom') {
      columns = customColumns
        .filter(c => c.title.trim())
        .map((c, i) => ({
          id: `custom_${i}_${Date.now()}`,
          title: c.title.trim(),
          theme: c.theme as any,
          order: i
        }));
    } else {
      // Sincronização garantida com RETRO_TEMPLATES do lib/types
      columns = RETRO_TEMPLATES[template as Exclude<RetroTemplateKey, 'custom'>] || RETRO_TEMPLATES.classic;
    }

    if (!columns || columns.length === 0) {
      toast({
        title: "Erro de Configuração",
        description: "O template selecionado não pôde ser carregado corretamente.",
        variant: "destructive"
      });
      setIsCreating(false);
      return;
    }

    const newBoard = {
      id: crypto.randomUUID(),
      creatorId: userProfile.id,
      isCardsRevealed: false,
      isAuthorsRevealed: false,
      votingStatus: 'disabled' as const,
      timer: { status: 'stopped', endTime: null, initialDuration: 300, remainingOnPause: 300 },
      title: title.trim(),
      team: team.trim() || 'Squad Geral',
      createdAt: new Date().toISOString(),
      participantIds: [userProfile.id],
      columns,
      templateKey: template,
    };

    try {
      const docRef = await retroApi.saveOrUpdateBoard(newBoard);
      if (docRef && docRef.id) {
        saveRoomMeta(docRef.id, 'retro', title.trim(), team.trim() || 'Squad');
        setIsSetupOpen(false);
        router.push(`/retro/${docRef.id}`);
      } else {
        console.error("[retro] Resposta da API ao criar quadro não veio com ID válido:", docRef);
        setIsCreating(false);
        toast({
          title: "Erro na Criação",
          description: "O servidor não retornou um ID para o novo quadro.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error creating retro board: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: error?.message || "Não foi possível iniciar o quadro no momento.",
        variant: "destructive"
      });
    }
  };

  const tips = [
    {
      title: "Segurança Psicológica",
      description: "A retro é um espaço seguro. O foco deve estar no processo e no sistema, nunca em apontar culpados.",
      icon: <ShieldCheck className="text-emerald-600" />
    },
    {
      title: "Ações Concretas",
      description: "Uma boa retrospectiva termina com itens de ação claros, com responsáveis e prazos definidos.",
      icon: <Target className="text-emerald-600" />
    },
    {
      title: "Melhoria Contínua",
      description: "Pequenos ajustes incrementais a cada ciclo geram resultados massivos no longo prazo.",
      icon: <TrendingUp className="text-emerald-600" />
    }
  ];

  const referenceSections = [
    {
      title: "O que foi bom",
      label: "Celebração",
      description: "Momento de reconhecer vitórias, elogiar o time e garantir que processos eficientes sejam mantidos e replicados.",
      icon: <CheckCircle2 className="text-emerald-500" />
    },
    {
      title: "O que melhorar",
      label: "Gargalos",
      description: "Identificação honesta de falhas de comunicação, débitos técnicos ou processos que estão travando a squad.",
      icon: <AlertCircle className="text-rose-500" />
    },
    {
      title: "Plano de Ação",
      label: "Execução",
      description: "Comprometimento real. Cada item de melhoria deve gerar uma ação prática com responsável definido para a próxima sprint.",
      icon: <ListTodo className="text-blue-500" />
    },
    {
      title: "Poderes do Facilitador",
      label: "Gestão",
      description: "O facilitador pode revelar cards em massa, limpar votos para recalibrar o foco e exportar o relatório final consolidado.",
      icon: <Zap className="text-amber-500" />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Retrospectiva"
        description="Feedbacks colaborativos e planos de ação para melhoria contínua. Olhe para trás para acelerar para frente."
        icon={<LayoutDashboard />}
        themeColor="emerald"
        toolType="retro"
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!userProfile) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/retro/${id}`)}
        isCreating={isCreating}
      />

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-[3rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20 text-white">
               <HeartPulse className="h-6 w-6" />
            </div>
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-none">Novo Quadro</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Escolha o formato ideal para seu time</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 font-sans">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título da Retro</Label>
                <Input 
                  placeholder="Ex: Fim da Sprint #42" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-12 rounded-2xl border-slate-100 focus:border-emerald-500 font-bold bg-slate-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Squad / Time</Label>
                <Input 
                  placeholder="Ex: Delta Force" 
                  value={team}
                  onChange={e => setTeam(e.target.value)}
                  className="h-12 rounded-2xl border-slate-100 focus:border-emerald-500 font-bold bg-slate-50/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Template de Colunas</Label>
              <Select value={template} onValueChange={(val: RetroTemplateKey) => setTemplate(val)}>
                <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 font-bold">
                  <SelectValue placeholder="Selecione um formato" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 p-2">
                  <SelectItem value="classic" className="rounded-xl font-bold py-3 px-4">🏆 Clássico (Parar, Começar, Continuar)</SelectItem>
                  <SelectItem value="start_stop_continue" className="rounded-xl font-bold py-3 px-4">🔄 Começar, Parar, Continuar</SelectItem>
                  <SelectItem value="four_ls" className="rounded-xl font-bold py-3 px-4">🍃 4L (Liked, Learned, Lacked...)</SelectItem>
                  <SelectItem value="daki" className="rounded-xl font-bold py-3 px-4">💎 DAKI (Drop, Add, Keep, Improve)</SelectItem>
                  <SelectItem value="sailboat" className="rounded-xl font-bold py-3 px-4">⛵ Sailboat (Vento, Sol, Âncora...)</SelectItem>
                  <SelectItem value="starfish" className="rounded-xl font-bold py-3 px-4">⭐ Starfish (5 Estágios: Manter, Menos, Mais...)</SelectItem>
                  <SelectItem value="mad_sad_glad" className="rounded-xl font-bold py-3 px-4">😤 Glad, Sad, Mad (Feliz, Triste, Irritado)</SelectItem>
                  <SelectItem value="three_little_pigs" className="rounded-xl font-bold py-3 px-4">🐷 Três Porquinhos (Palha, Madeira, Tijolo)</SelectItem>
                  <SelectItem value="speed_car" className="rounded-xl font-bold py-3 px-4">🏎️ Speed Car (Motor e Paraquedas)</SelectItem>
                  <SelectItem value="custom" className="rounded-xl font-bold py-3 px-4 text-emerald-600">🛠️ Personalizado...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {template === 'custom' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Definição de Colunas</Label>
                 <div className="grid grid-cols-1 gap-2">
                    {customColumns.map((col, idx) => (
                      <div key={idx} className="flex gap-2">
                         <Input 
                            value={col.title}
                            onChange={(e) => {
                              const newCols = [...customColumns];
                              newCols[idx].title = e.target.value;
                              setCustomColumns(newCols);
                            }}
                            placeholder={`Coluna ${idx + 1}`}
                            className="h-11 rounded-xl border-slate-100 bg-slate-50/30 font-bold"
                         />
                         {customColumns.length > 2 && (
                            <Button 
                              variant="ghost" 
                              onClick={() => setCustomColumns(customColumns.filter((_, i) => i !== idx))}
                              className="h-11 w-11 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50"
                            >
                               <Trash2 className="h-4 w-4" />
                            </Button>
                         )}
                      </div>
                    ))}
                    {customColumns.length < 5 && (
                       <Button 
                         variant="outline" 
                         onClick={() => setCustomColumns([...customColumns, { title: '', theme: 'neutral' }])}
                         className="h-11 rounded-xl border-dashed border-2 text-[10px] font-black uppercase tracking-[0.2em]"
                       >
                          + Adicionar Coluna
                       </Button>
                    )}
                 </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-6 border-t border-slate-100 flex-col gap-3">
             <Button 
               disabled={isCreating}
               onClick={handleCreate}
               className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-600/10 gap-3"
             >
               {isCreating ? 'Sincronizando...' : 'Abrir Sessão'}
               <ArrowRightIcon className="h-4 w-4" />
             </Button>
             <button 
               onClick={() => setIsSetupOpen(false)}
               className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
             >
                Cancelar
             </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
