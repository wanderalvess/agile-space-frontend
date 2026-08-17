'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  BookOpen, 
  LayoutDashboard, 
  WalletCards, 
  HeartPulse, 
  Terminal,
  ArrowRightLeft,
  ScanSearch,
  Globe,
  Zap,
  FileJson,
  Sparkles,
  GitCompare,
  Code2,
  Info,
  Layers,
  Hash,
  Calculator,
  Database,
  BarChart3,
  TrendingUp,
  PieChart,
  FileCode,
  Network,
  Scan,
  Clock,
  CalendarRange,
  Fingerprint,
  Lightbulb,
  BrainCircuit,
  Target,
  CheckCircle2,
  ShieldCheck,
  Download,
  Search,
  Users,
  MessageSquare,
  ListTodo,
  CalendarDays,
  Coffee,
  Percent,
  Trophy,
  Shield,
  Eye,
  ListPlus,
  ArrowRight,
  FileText,
  Server,
  ClipboardList,
  ShieldQuestion,
  Rocket,
  MessageSquareHeart,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { useEffect, useState } from 'react';

export default function ManualPage() {
  const [activeTab, setActiveTab] = useState('poker');
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  const navigation = [
    { id: 'poker', label: 'Scrum Poker', icon: WalletCards, color: 'text-blue-600' },
    { id: 'brainstorming', label: 'Brainstorming', icon: Lightbulb, color: 'text-amber-600' },
    { id: 'retro', label: 'Retrospectiva', icon: LayoutDashboard, color: 'text-orange-600' },
    { id: 'planner', label: 'Sprint Planner', icon: CalendarDays, color: 'text-indigo-600' },
    { id: 'health', label: 'Radar de Saúde', icon: HeartPulse, color: 'text-emerald-600' },
    { id: 'daily-flow', label: 'Daily Flow', icon: Zap, color: 'text-indigo-600' },
    { id: 'workspace', label: 'Meu Espaço', icon: LayoutGrid, color: 'text-slate-900 dark:text-slate-100' },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: Sparkles, color: 'text-cyan-600' },
    { id: 'prompt-hub', label: 'Prompt Hub', icon: MessageSquare, color: 'text-violet-600' },
    { id: 'showcase', label: 'Showcase', icon: Eye, color: 'text-pink-600' },
    { id: 'governance', label: 'Governança', icon: Shield, color: 'text-emerald-600' },
    { id: 'jolt', label: 'Jolt Hub', icon: FileJson, color: 'text-blue-500' },
    { id: 'devtools', label: 'DevTools', icon: Terminal, color: 'text-slate-600 dark:text-slate-300' },
  ];

  // Sincroniza a aba ativa com o hash da URL para navegação robusta
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && navigation.some(n => n.id === hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check on mount

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Título Dinâmico da Aba
  useEffect(() => {
    document.title = `Manual de Operações | Espaço Ágil`;
  }, []);

  return (
    <main className="flex flex-col items-center bg-slate-50 dark:bg-slate-950 min-h-dvh w-full font-sans selection:bg-primary/20 scroll-smooth">
      
      {/* HEADER ELITE DESIGN */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-50 backdrop-blur-xl bg-white dark:bg-slate-900/80">
        <div className="w-full px-4 md:px-12 py-4 max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 leading-none">Manual de Operações</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Guia Tático Espaço Ágil</p>
                </div>
            </div>
            
            <div className="hidden xl:flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:bg-white dark:bg-slate-900 hover:border-primary transition-all group">
                            <LayoutGrid className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                            <span>Explorar Seções</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[480px] p-4 grid grid-cols-2 gap-2 rounded-2xl border-slate-100 dark:border-slate-800 shadow-2xl">
                        <DropdownMenuLabel className="col-span-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 px-2">
                            Módulos da Plataforma
                        </DropdownMenuLabel>
                        {navigation.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                asChild
                                onSelect={() => setActiveTab(item.id)}
                            >
                                <a 
                                  href={`#${item.id}`}
                                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 dark:bg-slate-800 transition-colors group border border-transparent hover:border-slate-100 dark:border-slate-800"
                                >
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-slate-900 shadow-sm group-hover:scale-110 transition-transform")}>
                                        <item.icon className={cn("h-4 w-4", item.color)} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 leading-none">{item.label}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ver Detalhes</span>
                                    </div>
                                </a>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-[1px] h-6 bg-slate-200 mx-2" />

                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl">
                    {(() => {
                        const activeItem = navigation.find(n => n.id === activeTab);
                        return activeItem ? (
                            <>
                                <activeItem.icon className={cn("h-3.5 w-3.5", activeItem.color)} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white italic">{activeItem.label}</span>
                            </>
                        ) : null;
                    })()}
                </div>
            </div>

            <Button asChild variant="ghost" size="sm" className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-500 dark:text-slate-400 hover:text-primary transition-all">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Sair do Manual
                </Link>
            </Button>
        </div>
      </div>

      <div className="w-full px-4 md:px-12 py-6 max-w-7xl">
        
        <div className="flex flex-col gap-4 mb-10 max-w-5xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest w-fit animate-in fade-in slide-in-from-left-4 duration-500">
                <Sparkles className="h-3 w-3" /> Documentação Central
            </div>
            <h1 className="text-5xl md:text-8xl font-black leading-[0.85] uppercase tracking-tighter text-slate-900 dark:text-slate-100 animate-in fade-in slide-in-from-top-8 duration-700">
                O seu guia de <br />
                <span className="text-primary italic">Alta Performance</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg md:text-xl leading-relaxed animate-in fade-in duration-1000 delay-300">
                Aprenda a operar cada ferramenta do ecossistema Espaço Ágil com precisão técnica e colha resultados estratégicos para sua squad.
            </p>
        </div>
        
        <div className="space-y-12">

            {/* SECTION: SCRUM POKER */}
            <section id="poker" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-blue-500/10">
                            <WalletCards className="h-10 w-10 text-blue-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Scrum <br /><span className="text-blue-600">Poker</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            O padrão ouro para estimativas ágeis. Projetado para eliminar o "Efeito Manada" e garantir que todos os riscos técnicos sejam discutidos.
                        </p>
                        
                        <div className="p-6 bg-blue-600 rounded-[2rem] text-white shadow-2xl shadow-blue-500/30 space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">
                                <Shield className="h-4 w-4" /> Vantagem Estratégica
                            </h4>
                            <p className="text-sm font-medium leading-relaxed italic opacity-90">
                                "Ao ocultar os votos, forçamos o cérebro a pensar de forma independente. O valor não está no número final, mas na discussão que surge quando as opiniões divergem."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Manual de Operação</CardTitle>
                                <CardDescription className="text-xs font-medium">Passos para uma sessão impecável.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs">01</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Criação & Pauta</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">O organizador cria a sala e adiciona as tarefas na aba <strong>Tarefas</strong>. Cada item pode conter links do Jira e notas técnicas para contexto.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs">02</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Escolha do Deck</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Selecione entre <strong>Horas</strong> (ideal para sub-tarefas) ou <strong>Fibonacci</strong> (ideal para User Stories). Isso altera as cartas disponíveis para o time.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs">03</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Votação Silenciosa</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Os participantes escolhem suas cartas. O sistema mostra quem já votou, mas os valores permanecem ocultos até a <strong>Revelação</strong>.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs">04</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Revelação & Consenso</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">O facilitador revela os votos. Se houver divergência, o sistema destaca. O time debate, altera os votos se necessário e o facilitador <strong>Salva o Consenso</strong>.</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 font-sans ring-1 ring-slate-200/50">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                                        <Info className="h-4 w-4" /> Funções do Facilitador
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Pode pular tarefas (Skipped) se o time julgar não prioritário.</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Pode editar estimativas individuais em caso de erro do usuário.</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Responsável por "Limpar Mesa" para iniciar a próxima rodada.</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Gera o relatório final consolidado para exportação.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: BRAINSTORMING ALPHA */}
            <section id="brainstorming" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6 lg:order-last">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-amber-500/10">
                            <Lightbulb className="h-10 w-10 text-amber-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Brainstorming <br /><span className="text-amber-600">Alpha</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            A ferramenta de ideação mais completa do ecossistema. Vai do "caos criativo" ao plano de execução estruturado em apenas 5 passos.
                        </p>
                        
                        <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl space-y-6">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
                                <Zap className="h-4 w-4" /> Fluxo de Valor
                            </h4>
                            <div className="space-y-4">
                                {[
                                    { f: "Ideação", d: "Criatividade sem limites." },
                                    { f: "Clusterização", d: "Organização lógica." },
                                    { f: "Priorização", d: "Foco no que vale a pena." }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-3 items-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">{item.f}</p>
                                            <p className="text-[9px] text-slate-400 font-medium">{item.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">As 5 Fases da Criatividade</CardTitle>
                                <CardDescription className="text-xs font-medium">Como transformar ideias em projetos reais.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-50">
                                    {[
                                        { 
                                            title: "1. Ideação (Individual)", 
                                            icon: BrainCircuit, 
                                            desc: "O time escreve ideias de forma anônima. Ninguém vê o que o outro escreveu até a revelação. Isso evita que ideias tímidas, mas geniais, sejam perdidas.",
                                            label: "Modo Mural"
                                        },
                                        { 
                                            title: "2. Clusterização (Agrupamento)", 
                                            icon: Network, 
                                            desc: "Arraste uma ideia sobre a outra para criar 'Clusters'. Dê nomes a esses grupos. O objetivo é reduzir a repetição e encontrar grandes temas.",
                                            label: "Organização"
                                        },
                                        { 
                                            title: "3. Votação (Voz do Time)", 
                                            icon: Target, 
                                            desc: "Cada participante possui 5 votos para distribuir livremente entre ideias ou agrupamentos. A democracia aplicada à estratégia.",
                                            label: "Decisão"
                                        },
                                        { 
                                            title: "4. Matriz ROI (Prioridade)", 
                                            icon: BarChart3, 
                                            desc: "O facilitador posiciona as ideias mais votadas no gráfico de Impacto vs Esforço. Priorizamos o que dá 'Rápido Retorno' (Quick Wins).",
                                            label: "Estratégia"
                                        },
                                        { 
                                            title: "5. Ações (Execution)", 
                                            icon: ListTodo, 
                                            desc: "O fim do brainstorming é o começo do projeto. Selecionamos as ideias vencedoras e definimos QUEM fará O QUÊ e ONDE (URL).",
                                            label: "Comprometimento"
                                        }
                                    ].map((phase, i) => (
                                        <div key={i} className="p-6 hover:bg-slate-50 dark:bg-slate-800/50 transition-colors group">
                                            <div className="flex flex-col md:flex-row gap-4">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-100 group-hover:text-amber-600 transition-all">
                                                    <phase.icon className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-[13px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{phase.title}</h4>
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[7px] font-black uppercase text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-all">{phase.label}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{phase.desc}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: RETROSPECTIVA */}
            <section id="retro" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-orange-500/10">
                            <LayoutDashboard className="h-10 w-10 text-orange-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Retrospectiva <br /><span className="text-orange-600">Ágil</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            A base da Kaizen (melhoria contínua). Uma interface panorâmica projetada para clareza visual e foco em resultados.
                        </p>
                        
                        <div className="p-8 bg-orange-600 rounded-[3rem] text-white shadow-2xl shadow-orange-500/30">
                           <ul className="space-y-6">
                              <li className="space-y-2">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-orange-200">Segurança Psicológica</p>
                                 <p className="text-xs font-medium leading-relaxed opacity-90">Cartões ocultos durante a ideação para evitar julgamentos prematuros.</p>
                              </li>
                              <li className="space-y-2">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-orange-200">Filtro de Ruído</p>
                                 <p className="text-xs font-medium leading-relaxed opacity-90">Votação por pontos para extrair os temas mais latentes da squad.</p>
                              </li>
                           </ul>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">O Ciclo de Melhoria</CardTitle>
                                <CardDescription className="text-xs font-medium">Três colunas fundamentais.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-700">O que foi bom</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Celebração de vitórias e manutenção de processos que funcionam.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-700">O que melhorar</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Identificação honesta de gargalos, falhas de comunicação e débitos técnicos.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-700">Ações (Planos)</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Comprometimento com mudanças práticas para a próxima Sprint.</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                                    <div className="flex flex-col md:flex-row gap-6 items-center">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-900/10 rounded-xl flex items-center justify-center shrink-0">
                                            <Trophy className="h-6 w-6 text-orange-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-black uppercase tracking-[0.2em] text-xs text-orange-500">Fluxo Facilitado</h4>
                                            <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                                O facilitador tem o poder de "Revelar Cards" para iniciar o debate, "Limpar Votos" para recalibrar e "Importar Sugestões" de sessões anteriores para medir a execução dos planos.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: SPRINT PLANNER */}
            <section id="planner" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6 lg:order-last">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-indigo-500/10">
                            <CalendarDays className="h-10 w-10 text-indigo-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Sprint <br /><span className="text-indigo-600">Planner</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            Cansado de errar o tamanho da Sprint? O Planner calcula a capacidade real baseada na vida real da squad.
                        </p>
                        
                        <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/30 space-y-6">
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-200 flex items-center gap-2">
                                    <Calculator className="h-4 w-4" /> Engine de Cálculo
                                </h4>
                                <div className="p-4 bg-white dark:bg-slate-900/10 rounded-2xl font-mono text-[9px] border border-white/10 text-indigo-100">
                                    (Dias Úteis x Horas x Foco) - Ausências = Capacidade Real
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Guia de Planejamento</CardTitle>
                                <CardDescription className="text-xs font-medium">Equilíbrio perfeito entre demanda e entrega.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100/50 space-y-3">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-indigo-700 flex items-center gap-2">
                                            <Users className="h-4 w-4" /> Gestão de Time
                                        </h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Defina a composição da squad. Cada membro pode ter <strong>Feriados/Ausências</strong> e <strong>Fator de Foco</strong> individuais. O sistema soma a capacidade separadamente para DEV e QA.</p>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100/50 space-y-3">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-indigo-700 flex items-center gap-2">
                                            <ListPlus className="h-4 w-4" /> Escopo Sugerido
                                        </h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Adicione as tarefas do pool de refinamento. O <strong>Termômetro de Backlog</strong> mostrará em tempo real se o time está sobrecarregado (Overload).</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 px-2">Recurso: Integração Zero Retrabalho</h4>
                                    <div className="flex gap-6 p-8 bg-white dark:bg-slate-900 border border-slate-200 rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                                            <Zap className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-900 dark:text-slate-100 font-black uppercase tracking-tight">Importar do Poker</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-2">
                                              Não digite tudo de novo. O Planner permite importar os resultados de qualquer sessão de Scrum Poker finalizada, carregando títulos, links e as estimativas de consenso automaticamente.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: RADAR DE SAÚDE */}
            <section id="health" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-emerald-500/10">
                            <HeartPulse className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Radar de <br /><span className="text-emerald-600">Saúde</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            O diagnóstico sincero da squad. Focado em encontrar os problemas que as pessoas não costumam falar em reuniões abertas.
                        </p>
                        
                        <div className="p-8 bg-emerald-600 rounded-[3rem] text-white shadow-2xl shadow-emerald-500/30 font-sans">
                            <div className="flex gap-4 items-center">
                                <Shield className="h-8 w-8 text-emerald-200" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Anonimato Radical</p>
                                    <p className="text-xs font-medium leading-relaxed opacity-90">Ninguém sabe quem votou. O sistema agrupa os resultados para proteger a verdade.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Como Diagnosticar</CardTitle>
                                <CardDescription className="text-xs font-medium">As dimensões do sucesso sustentável.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-emerald-700">1. Votação por Dimensões</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">O time avalia pilares como: Qualidade do Código, Alinhamento, Missão da Squad, Processo e Diversão. Sem notas de 1 a 10, apenas o <strong>Farol (Verde, Amarelo, Vermelho)</strong>.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-emerald-700">2. Análise Radar</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Ao finalizar, o facilitador gera o <strong>Gráfico Radar</strong>. Ele revela os "Furos" na armadura da squad onde o time precisa dedicar tempo de gestão e cultura.</p>
                                    </div>
                                </div>

                                <div className="p-8 bg-emerald-50/50 rounded-[2.5rem] border border-emerald-100 flex flex-col md:flex-row gap-8 items-center">
                                    <div className="text-center md:text-left space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Dica de Mestre</p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">Compare os radares mensais para entender se a squad está ganhando ou perdendo maturidade ao longo do ano.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 h-fit shrink-0">
                                        <div className="w-12 h-4 bg-emerald-500 rounded-full" />
                                        <div className="w-12 h-4 bg-emerald-200 rounded-full" />
                                        <div className="w-12 h-4 bg-emerald-100 rounded-full" />
                                        <div className="w-12 h-4 bg-emerald-300 rounded-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SEÇÃO: REGRAS & PADRÕES (ENHANCED) */}
            <section className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 text-white">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                   <ShieldCheck className="h-48 w-48" />
                </div>
                <div className="relative z-10 space-y-12">
                   <div className="space-y-4">
                      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">Manifesto Agile <span className="text-primary">Space</span></h2>
                      <p className="text-slate-400 font-medium text-lg max-w-2xl">
                         Nossas diretrizes de design e fluxo para garantir a melhor experiência em colaboração remota.
                      </p>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { icon: HelpCircle, title: "Help First", desc: "Nenhuma funcionalidade é lançada sem um guia 'Como Usar' embutido." },
                        { icon: Fingerprint, title: "Privacy Radical", desc: "Dados sensíveis são anônimos por design para fomentar a honestidade." },
                        { icon: Zap, title: "Real-Time Sync", desc: "A tecnologia Firebase garante latência zero em todas as salas." },
                        { icon: Download, title: "Export Ready", desc: "Saídas processadas em PDF e CSV para facilitar a governança corporativa." }
                      ].map((rule, i) => (
                        <div key={i} className="p-6 bg-white dark:bg-slate-900/5 backdrop-blur-md rounded-3xl border border-white/10 space-y-4">
                           <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                              <rule.icon className="h-6 w-6 text-primary" />
                           </div>
                           <h4 className="font-black uppercase tracking-widest text-xs text-primary">{rule.title}</h4>
                           <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{rule.desc}</p>
                        </div>
                      ))}
                   </div>
                </div>
            </section>

            {/* SECTION: MEU ESPAÇO (WORKSPACE) */}
            <section id="workspace" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6 lg:order-last">
                        <div className="w-20 h-20 bg-slate-900/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-slate-900/10">
                            <LayoutGrid className="h-10 w-10 text-slate-900 dark:text-slate-100" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Meu <br /><span className="text-slate-900 dark:text-slate-100">Espaço</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            Sua central de comando pessoal. Ferramentas projetadas para acelerar o fluxo individual de engenharia e organização.
                        </p>
                        
                        <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl space-y-6">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                <Sparkles className="h-4 w-4" /> Produtividade Solo
                            </h4>
                            <p className="text-xs font-medium leading-relaxed italic opacity-80">
                                "O sucesso da squad começa na excelência individual. O Workspace elimina o atrito entre a ideação e o registro técnico."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Ferramentas de Comando</CardTitle>
                                <CardDescription className="text-sm font-medium">Potencialize sua rotina diária.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                <Zap className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-black uppercase tracking-widest text-[11px] text-slate-900 dark:text-slate-100">Daily Helper</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Prepare seu status da Daily com calma. Escreva seus impedimentos e progresso, use o <strong>Auto-Save</strong> para não perder nada e copie formatado para o Slack/Discord com um clique.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                                <Code2 className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-black uppercase tracking-widest text-[11px] text-slate-900 dark:text-slate-100">Snippet Library</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Seu repositório privado de conhecimento técnico. Salve comandos Docker, queries SQL complexas ou blocos de código com <strong>Syntax Highlighting</strong> profissional.</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Privacidade & Persistência</p>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold leading-tight">Seus rascunhos e snippets são vinculados ao seu UID, garantindo que seu conhecimento pessoal seja acessível apenas por você.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: DAILY FLOW */}
            <section id="daily-flow" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-indigo-500/10">
                            <Zap className="h-10 w-10 text-indigo-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Daily <br /><span className="text-indigo-600">Flow</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            Sincronização assíncrona para squads de alta performance. Elimine reuniões redundantes e mantenha o foco na entrega.
                        </p>
                        <div className="space-y-4 pt-4">
                            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <Users className="h-5 w-5 text-indigo-500 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">Visibilidade por Squad</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Mural filtrado automaticamente por squadId, garantindo foco no time relevante.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">Status de Impedimento</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Sinalização visual imediata para qualquer bloqueio de fluxo na squad.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-6 pb-2 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Check-in Assíncrono</CardTitle>
                                <CardDescription className="text-xs font-medium">Squad alinhada sem interrupções.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-indigo-700">1. Registro de Status</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Diariamente, cada membro informa o que foi concluído (Ontem) e o foco atual (Hoje). Este histórico é vital para o alinhamento técnico.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-indigo-700">2. Gestão de Bloqueios</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Ao ativar o modo "Estou Bloqueado", o card herda o efeito <strong>Red Glow</strong>, alertando SMs e TLs no ato do acesso.</p>
                                    </div>
                                </div>

                                <div className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100 flex flex-col md:flex-row gap-8 items-center">
                                    <div className="text-center md:text-left space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Dica de Mestre</p>
                                        <p className="text-sm text-slate-700 font-bold leading-relaxed">Check-ins curtos e técnicos reduzem o tempo de leitura do mural. Foque no resultado, não nas tarefas menores.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 h-fit shrink-0">
                                        <div className="w-12 h-4 bg-indigo-500 rounded-full" />
                                        <div className="w-12 h-4 bg-indigo-200 rounded-full" />
                                        <div className="w-12 h-4 bg-indigo-100 rounded-full animate-pulse" />
                                        <div className="w-12 h-4 bg-indigo-300 rounded-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: JOLT HUB */}
            <section id="jolt" className="scroll-mt-32 space-y-16 pb-32">
                <div className="flex flex-col gap-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest w-fit border border-blue-500/20">
                        <FileJson className="h-3 w-3" /> Motor de Transformação
                    </div>
                    <h2 className="text-5xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-[0.85]">
                        Jolt <br /><span className="text-blue-600">Hub</span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-2xl">
                        A suite definitiva para manipulações estruturais JSON complexas utilizando a engine Apache Jolt. Converta, mapeie e teste com precisão cirúrgica.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <div className="p-8 space-y-6 border-r border-slate-50 dark:border-slate-800/50">
                                    <div className="space-y-4">
                                        <Badge className="bg-blue-600 uppercase text-[9px] font-black tracking-widest">Transformação Avançada</Badge>
                                        <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Operadores Nativos</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">O motor Apache Jolt integrado permite manipulações sem a necessidade de servidor.</p>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            { op: "shift", desc: "Mapeamento estrutural. Suporta curingas (*) em valores primitivos para branching condicional complexo." },
                                            { op: "default", desc: "Define valores padrão. Suporta wildcards (*) para aplicação em massa." },
                                            { op: "cardinality", desc: "Normaliza a estrutura (ONE vs MANY). Corrige instabilidades de APIs que alternam entre Objeto e Array." },
                                            { op: "sort", desc: "Ordenação alfabética profunda das chaves do objeto final." }
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-4">
                                                <code className="text-[10px] font-black bg-slate-900 text-blue-400 px-2 py-1 rounded h-fit shrink-0">{item.op}</code>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-normal">{item.desc}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-6 bg-blue-50/50 dark:bg-slate-800/50 rounded-3xl border border-blue-100 dark:border-slate-700 flex gap-4">
                                        <Sparkles className="h-6 w-6 text-blue-600 shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest mb-1">Dica Pro: Macros de Caminho</p>
                                            <p className="text-[11px] text-blue-800/80 dark:text-slate-400 font-medium">Use <code>&1</code> para referenciar o nome da chave um nível acima, ou <code>$</code> para extrair o valor da própria chave.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 bg-slate-900 space-y-6 flex flex-col justify-center">
                                    <div className="space-y-8">
                                        <div>
                                            <h4 className="text-[14px] font-black uppercase text-white mb-2 flex items-center gap-2"><Terminal className="h-4 w-4 text-blue-500" /> Ferramentas Inclusas</h4>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="group p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                                                <h6 className="text-[11px] font-black uppercase text-white mb-2">Transformador Jolt (Sandbox)</h6>
                                                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-4">Ambiente Enterprise para testes de specs JOLT com editores Monaco sincronizados. Agora com validação contínua e raio-x de sintaxe em tempo real.</p>
                                            </div>
                                            <div className="group p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                                                <h6 className="text-[11px] font-black uppercase text-white mb-2">Mapeador Visual (ReactFlow)</h6>
                                                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-4">Interface inteligente para gerar specs Jolt através de vínculos arrastáveis. Suporta junções visuais e funções embutidas (=substring, =toDouble).</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: DEVTOOLS (ELITE TOOLKIT) */}
            <section id="devtools" className="scroll-mt-32 space-y-16 pb-32">
                <div className="flex flex-col gap-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-slate-100 text-[10px] font-black uppercase tracking-widest w-fit">
                        <Terminal className="h-3 w-3" />  Engineering Toolkit
                    </div>
                    <h2 className="text-5xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-[0.85]">
                        Espaço Ágil <br /><span className="text-primary">DevTools</span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-2xl">
                        Uma suíte de utilitários de alta performance projetada para acelerar o desenvolvimento, testes e arquitetura de software dentro do fluxo ágil.
                    </p>
                </div>



                {/* COMPREHENSIVE CATALOG */}
                <div className="space-y-12">
                    <div className="flex items-center gap-4">
                        <div className="h-px bg-slate-200 flex-1" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Catálogo Técnico Completo</h3>
                        <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* CATEGORY: DADOS & TRANSFORMAÇÃO */}
                        <div className="space-y-6">
                            <h5 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 italic">
                                <FileJson className="h-4 w-4" /> Dados & Transformação
                            </h5>
                            <div className="space-y-4">
                                {[
                                    {
                                        t: "Gerador de Modelos (Classes/Interfaces)", 
                                        d: "Infera interfaces TypeScript, classes Java ou Delphi a partir de payloads JSON.",
                                        tip: "Suporta geração recursiva. Ótimo para documentar contratos de integração rapidamente."
                                    },
                                    { 
                                        t: "Formatador e Validador JSON", 
                                        d: "Engine profissional para validação (com ponteiro de erro por linha), beautify e minificação de payloads.",
                                        tip: "Se houver erro de sintaxe, o sistema indicará a localização exata, permitindo correções rápidas em payloads gigantes."
                                    },
                                    { 
                                        t: "Conversor e Formatador XML", 
                                        d: "Motor de formatação XML robusto (stack-based) com conversão monitorada para JSON.",
                                        tip: "O novo formatador lida com tags complexas e atributos múltiplos sem quebrar a estrutura hierárquica."
                                    }
                                ].map((tool, i) => (
                                    <div key={i} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                                        <h6 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 mb-2">{tool.t}</h6>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">{tool.d}</p>
                                        <div className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-500/20">
                                            Tip: {tool.tip}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CATEGORY: SEGURANÇA & GERADORES */}
                        <div className="space-y-6">
                            <h5 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 italic">
                                <ShieldCheck className="h-4 w-4" /> Segurança & Geradores
                            </h5>
                            <div className="space-y-4">
                                {[
                                    { 
                                        t: "Decodificador Universal (Deep)", 
                                        d: "Analisa payloads codificados em Base64, JWT ou URIs aninhadas com decodificação recursiva.",
                                        tip: "Detecta automaticamente o formato de entrada. Útil para validar tokens de segurança rapidamente."
                                    },
                                    { 
                                        t: "Gerador de Documentos", 
                                        d: "Cria CPFs/CNPJs válidos, incluindo o novo formato Alfanumérico, para validação de fluxos.",
                                        tip: "Gera lotes de documentos. Útil para scripts de QA automatizados."
                                    },
                                    { 
                                        t: "Gerador de Snippets", 
                                        d: "Central de códigos úteis e conversor massivo de cURL para diversos padrões de linguagem.",
                                        tip: "Salve seus snippets mais usados para reduzir o overhead de escrita de testes de integração."
                                    },
                                    { 
                                        t: "Fábrica de Mocks", 
                                        d: "Geração em massa de dados fake realistas a partir de schemas ou DDL SQL.",
                                        tip: "Ideal para testes de carga onde você precisa de 1000+ registros coerentes com o schema original."
                                    },
                                    { 
                                        t: "Conversor Base64", 
                                        d: "Encode e decode ultra-fast para payloads binários e strings complexas.",
                                        tip: "Operação 100% local. Útil para extrair conteúdos de anexos trafegados via JSON."
                                    }
                                ].map((tool, i) => (
                                    <div key={i} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                                        <h6 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 mb-2">{tool.t}</h6>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">{tool.d}</p>
                                        <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                                            Tip: {tool.tip}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CATEGORY: UTILIDADES & DESIGN */}
                        <div className="space-y-6">
                            <h5 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-600 italic">
                                <Zap className="h-4 w-4" /> Utilidades & Design
                            </h5>
                            <div className="space-y-4">
                                {[
                                    { 
                                        t: "Quadro de Arquitetura", 
                                        d: "Canvas branco infinito via Excalidraw para modelagem rápida de fluxos e diagramas UML.",
                                        tip: "Os diagramas são salvos no browser. Ótimo para rascunhos de arquitetura em squads."
                                    },
                                    { 
                                        t: "JUnit Generator", 
                                        d: "Scaffolding de testes unitários seguindo Clean Architecture e o motor avançado.",
                                        tip: "Acelera a cobertura de testes automatizando os mocks e declarações boilerplates iniciais."
                                    },
                                    { 
                                        t: "Meu IP e Rede", 
                                        d: "Identificação de IP público e geolocalização para validação de túneis e VPNs.",
                                        tip: "Use para confirmar se você está saindo pelo IP correto da empresa ou da sua rede local."
                                    },
                                    { 
                                        t: "Comparador (Diff) & Cron", 
                                        d: "Ferramentas para visualização de diferenças de código e decifração de expressões cron.",
                                        tip: "O comparador aceita colagem direta de grandes blocos, ideal para diffs de logs."
                                    }
                                ].map((tool, i) => (
                                    <div key={i} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all">
                                        <h6 className="text-[11px] font-black uppercase text-slate-900 dark:text-slate-100 mb-2">{tool.t}</h6>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">{tool.d}</p>
                                        <div className="text-[9px] font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100/50">
                                            Tip: {tool.tip}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-10 bg-indigo-600 rounded-[3rem] text-white flex flex-col md:flex-row gap-8 items-center justify-between">
                    <div className="space-y-4 max-w-xl">
                        <h4 className="text-3xl font-black uppercase tracking-tighter italic">Potencialize seu desenvolvimento</h4>
                        <p className="text-indigo-100 font-medium text-sm leading-relaxed">
                            O Espaço Ágil não é apenas sobre o time, é sobre o indivíduo. Nossos DevTools são pensados para que cada desenvolvedor reduza o tempo gasto em tarefas repetitivas e foque no que realmente importa: resolver problemas complexos de negócio.
                        </p>
                    </div>
                    <Button asChild size="lg" className="h-16 px-10 rounded-2xl bg-white dark:bg-slate-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-black/20">
                        <Link href="/devtools">Acessar Todo o Toolkit <ArrowRight className="ml-3 h-5 w-5" /></Link>
                    </Button>
                </div>
            </section>

            {/* SECTION: BASE DE CONHECIMENTO */}
            <section id="knowledge" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-cyan-500/10">
                            <Sparkles className="h-10 w-10 text-cyan-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Knowledge <br /><span className="text-cyan-600">Hub</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            A central de conhecimento da sua squad. Um repositório organizado para guardar manuais, processos e padrões técnicos com o apoio de ferramentas avançadas.
                        </p>
                        
                        <div className="p-6 bg-cyan-600 rounded-[2rem] text-white shadow-2xl shadow-cyan-500/30 space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                                <ShieldCheck className="h-4 w-4" /> Sua Chave de Acesso
                            </h4>
                            <p className="text-sm font-medium leading-relaxed italic opacity-90">
                                "Privacidade em primeiro lugar — Sua senha de acesso ao motor avançado fica guardada apenas no seu navegador. O sistema nunca salva suas chaves em nossos servidores."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Manual de Operação</CardTitle>
                                <CardDescription className="text-sm font-medium">Siga estes passos para consultar o conhecimento do time.</CardDescription>
                                <div className="mt-4 p-4 bg-cyan-50 border border-cyan-100 rounded-2xl flex items-center gap-3">
                                   <Zap className="h-4 w-4 text-cyan-600" />
                                   <p className="text-[10px] font-black uppercase text-cyan-700 tracking-tight">Dica: Clique no botão "Como Usar" no cabeçalho do módulo para o guia interativo.</p>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">01</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Configurar API Key</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Acesse <strong>Configurações</strong> no módulo Conhecimento Avançado e insira sua chave do Google AI Studio (Gemini). O processo é gratuito e instantâneo.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">02</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Iniciar um Chat</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Clique em <strong>Novo Chat Assistente</strong> no dashboard do módulo. O assistente carrega automaticamente o contexto da base de documentos do projeto.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">03</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Explorar a Base</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Navegue pela <strong>Base de Documentos</strong> para ler manuais, guias de arquitetura e especificações técnicas em formato Markdown com renderização rica.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-black text-xs">04</div>
                                            <h4 className="font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">Administrar (Admin)</h4>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Admins podem gerenciar documentos, verificar métricas de uso do motor avançado e controlar o custo estimado de chamadas de API no <strong>Painel Admin</strong>.</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4 font-sans ring-1 ring-slate-200/50">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 flex items-center gap-2">
                                        <Info className="h-4 w-4" /> Funcionalidades-Chave
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Respostas em tempo real via streaming (Gemini Flash).</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Renderização Markdown completa com suporte a código e tabelas.</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Sugestões rápidas para iniciar conversas com o assistente.</p>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Painel admin com métricas de uso, custo e governança de dados.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: PROMPT HUB */}
            <section id="prompt-hub" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6 lg:order-last">
                        <div className="w-20 h-20 bg-violet-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-violet-500/10">
                            <MessageSquare className="h-10 w-10 text-violet-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Prompt <br /><span className="text-violet-600">Hub</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            A arte de estruturar instruções de alta performance. Gerencie, compartilhe e evolua seus prompts com a squad.
                        </p>
                        <div className="p-6 bg-violet-600 rounded-[2rem] text-white shadow-2xl space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">
                                <Zap className="h-4 w-4" /> Engenharia de Instrução
                            </h4>
                            <p className="text-sm font-medium leading-relaxed italic opacity-90">
                                "Um bom prompt economiza horas de código. No Hub, transformamos intuição em ativos reutilizáveis para todo o time."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Operação Social</CardTitle>
                                <CardDescription className="text-sm font-medium">Acelere a produtividade na sua squad.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-violet-700">1. Biblioteca Coletiva</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Descubra o que outras squads estão 'promptando'. Dê um <strong>Fork</strong> em prompts úteis e salve na sua coleção privada.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-violet-700">2. Variáveis Dinâmicas</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Crie templates com placeholders (ex: [CONTEXTO]). Ao usar o prompt, o sistema solicita os valores, garantindo flexibilidade total.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: SPRINT SHOWCASE */}
            <section id="showcase" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-pink-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-pink-500/10">
                            <Eye className="h-10 w-10 text-pink-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Sprint <br /><span className="text-pink-600">Showcase</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            O palco das suas entregas. Transforme dados técnicos em apresentações executivas que encantam os stakeholders.
                        </p>
                        <div className="p-6 bg-pink-600 rounded-[2rem] text-white shadow-2xl space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-pink-100">
                                <Rocket className="h-4 w-4" /> Go-to-Market
                            </h4>
                            <p className="text-sm font-medium leading-relaxed italic opacity-90">
                                "Engenharia de valor é saber comunicar o que foi construído. O Showcase é o seu aliado na hora da demo."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Show & Tell</CardTitle>
                                <CardDescription className="text-sm font-medium">Apresentações de impacto para cada entrega.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-pink-700">1. Slides Automáticos</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">O sistema gera slides de apresentação baseados no que foi planejado e entregue na Sprint, economizando horas de PowerPoint.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-pink-700">2. Modo Teatro</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Uma interface imersiva de apresentação com controle total por teclado e visual premium para compartilhar em chamadas de vídeo.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* SECTION: GOVERNANÇA */}
            <section id="governance" className="scroll-mt-32">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center transition-transform shadow-inner border border-emerald-500/10">
                            <Shield className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                            Governança <br /><span className="text-emerald-600">& Segurança</span>
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            Transparência total sobre como tratamos seus dados e garantimos a segurança da sua squad.
                        </p>
                        
                        <div className="p-6 bg-emerald-600 rounded-[2rem] text-white shadow-2xl space-y-4">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">
                                <ShieldCheck className="h-4 w-4" /> Compliance Ativo
                            </h4>
                            <p className="text-sm font-medium leading-relaxed italic opacity-90">
                                "O Espaço Ágil utiliza infraestrutura Google Cloud com isolamento por UID. Seus dados nunca são cruzados com outros usuários."
                            </p>
                        </div>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
                            <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Políticas & Transparência</CardTitle>
                                <CardDescription className="text-sm font-medium">Entenda como sua privacidade é protegida.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-emerald-700">Privacidade de Dados</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Não armazenamos senhas. O acesso é via Google OAuth. Seus boards e notas são privados e protegidos por Firestore Security Rules.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] text-emerald-700">Processamento do Motor</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">As chaves de API configuradas são suas. O processamento ocorre via chaves do próprio usuário e as informações não saem do ecossistema do Google.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

        </div>
      </div>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Manual" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </main>
  );
}
