'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquareHeart,
  Send,
  CheckCircle2,
  LifeBuoy,
  Bug,
  Lightbulb,
  HelpCircle,
  Sparkles,
  Rocket,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { supportApi, type SupportTicket, type SupportTicketReply } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import { Footer } from '@/components/layout/Footer';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { FeedbackWidget } from '@/components/feedback-widget';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MessageCircle, ChevronRight, History as HistoryIcon } from 'lucide-react';

type TicketType = 'feedback' | 'bug' | 'suggestion' | 'support';

export default function SupportPage() {
  const router = useRouter();
  const { session, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  const [ticketType, setTicketType] = useState<TicketType>('support');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('new');

  const types = [
    { id: 'support', label: 'Suporte', icon: <LifeBuoy className="h-4 w-4" />, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'bug', label: 'Bug/Erro', icon: <Bug className="h-4 w-4" />, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'suggestion', label: 'Sugestão', icon: <Lightbulb className="h-4 w-4" />, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'feedback', label: 'Elogio', icon: <MessageSquareHeart className="h-4 w-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  // Lista de tickets do usuário
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Busca os tickets do usuário logado uma única vez (sem realtime)
  useEffect(() => {
    if (!isAuthenticated) {
      setMyTickets([]);
      setIsLoadingTickets(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTickets(true);
    setFetchError(false);

    supportApi.listMine()
      .then((tickets) => {
        if (cancelled) return;
        const sorted = [...tickets].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setMyTickets(sorted);
      })
      .catch((error) => {
        console.error("Erro ao buscar tickets:", error);
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTickets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !subject.trim() || !isAuthenticated) return;

    setIsSubmitting(true);
    try {
      const typeLabel = types.find((t) => t.id === ticketType)?.label || 'Suporte';
      const created = await supportApi.createTicket({
        subject: `[${typeLabel}] ${subject.trim()}`,
        message: description.trim(),
        requesterName: session?.name,
      });

      setMyTickets((prev) => [created, ...prev]);

      toast({
        title: "Solicitação Enviada",
        description: "Seu ticket foi recebido pelo time de governança.",
      });

      setDescription('');
      setSubject('');
      setIsSuccess(true);
    } catch (error) {
      console.error("Erro ao enviar ticket:", error);
      toast({
        title: "Erro no envio",
        description: "Não foi possível registrar seu ticket. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      {/* Background Glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full flex-1 flex flex-col">
        {/* ROOM HEADER */}
        <RoomHeader
          title="Central de Suporte"
          toolIcon={<LifeBuoy className="h-4 w-4" />}
          toolColorClass="text-primary"
          onOpenFeedback={() => setFeedbackSignal(Date.now())}
          badge={<Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">HELP & GOVERNANCE</Badge>}
        />

        <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
          <main className="w-full space-y-8">
            <div className="text-left space-y-3 mb-6">
              <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Atendimento Direto</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-tight italic font-headline">
                Como podemos <span className="text-primary not-italic">Acelerar</span> hoje?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium max-w-2xl italic border-l-2 border-primary/30 pl-4 py-1">
                Sua voz molda o futuro do Espaço Ágil. Relate problemas, sugira melhorias ou tire dúvidas diretamente com nosso time de governança.
              </p>
            </div>

            <Tabs defaultValue="new" className="w-full" onValueChange={setActiveTab}>
               <TabsList className="bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl mb-6 w-fit border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
                  <TabsTrigger value="new" className="rounded-xl px-8 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:text-slate-100">
                     Nova Solicitação
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-xl px-8 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm flex items-center gap-2 dark:text-slate-400 dark:data-[state=active]:text-slate-100">
                     Meus Tickets {myTickets.length > 0 && <Badge className="bg-primary/10 text-primary border-none text-[8px] h-4 min-w-4 flex items-center justify-center p-0">{myTickets.length}</Badge>}
                  </TabsTrigger>
               </TabsList>

               <TabsContent value="new" className="outline-none">
                 <Card className="border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-200/50 dark:shadow-black/30 rounded-[3rem] overflow-hidden bg-white dark:bg-slate-900">
                   <CardContent className="p-8 md:p-12">
                     <AnimatePresence mode="wait">
                       {isSuccess ? (
                         <motion.div
                           key="success"
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="py-12 flex flex-col items-center text-center space-y-6"
                         >
                           <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-950/50 rounded-[2.5rem] flex items-center justify-center text-emerald-500 shadow-inner">
                             <CheckCircle2 className="h-12 w-12" />
                           </div>
                           <div className="space-y-2">
                             <h3 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100">Ticket Enviado!</h3>
                             <p className="text-slate-500 dark:text-slate-400 font-medium italic uppercase text-xs tracking-widest">ID de rastreio gerado no painel administrativo</p>
                           </div>
                           <Button
                             variant="outline"
                             onClick={() => setIsSuccess(false)}
                             className="rounded-xl border-2 border-slate-200 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 font-black uppercase tracking-widest text-[10px] h-12 px-8"
                           >
                             Enviar Outra Solicitação
                           </Button>
                         </motion.div>
                       ) : (
                         <form onSubmit={handleSubmit} className="space-y-8">
                           <div className="space-y-4">
                             <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">O que você deseja fazer?</label>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                               {types.map((type) => (
                                 <button
                                   key={type.id}
                                   type="button"
                                   onClick={() => setTicketType(type.id as TicketType)}
                                   className={cn(
                                     "flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all gap-3 active:scale-95",
                                     ticketType === type.id
                                       ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-lg shadow-primary/10"
                                       : "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-400 grayscale hover:grayscale-0"
                                   )}
                                 >
                                   <div className={cn("p-3 rounded-2xl shadow-sm bg-white dark:bg-slate-700", ticketType === type.id ? 'text-primary' : type.color)}>
                                     {type.icon}
                                   </div>
                                   <span className={cn("text-[10px] font-black uppercase tracking-widest", ticketType === type.id ? "text-primary" : "text-slate-500 dark:text-slate-400")}>
                                     {type.label}
                                   </span>
                                 </button>
                               ))}
                             </div>
                           </div>

                           <div className="space-y-6">
                             <div className="space-y-2">
                               <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">Assunto</label>
                               <Input
                                 placeholder="Resumo em uma frase..."
                                 value={subject}
                                 onChange={(e) => setSubject(e.target.value)}
                                 className="h-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-6 font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:ring-primary/20"
                               />
                             </div>

                             <div className="space-y-2">
                               <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">Descrição Detalhada</label>
                               <Textarea
                                 placeholder="Nos conte mais detalhes sobre sua solicitação..."
                                 value={description}
                                 onChange={(e) => setDescription(e.target.value)}
                                 className="min-h-[180px] rounded-3xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-6 font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:ring-primary/20 leading-relaxed"
                                 required
                               />
                             </div>
                           </div>

                           <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center gap-6">
                             <Button
                               type="submit"
                               disabled={isSubmitting || !description.trim()}
                               className="w-full md:w-auto h-16 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl shadow-primary/20 transition-all active:scale-95 gap-3"
                             >
                               {isSubmitting ? 'Processando...' : 'Enviar Solicitação'}
                               <Send className="h-4 w-4" />
                             </Button>
                             <div className="flex items-center gap-2 text-slate-400">
                               <HelpCircle className="h-4 w-4" />
                               <span className="text-[10px] font-black uppercase tracking-widest italic">Análise em até 24h úteis</span>
                             </div>
                           </div>
                         </form>
                       )}
                     </AnimatePresence>
                   </CardContent>
                 </Card>
               </TabsContent>

               <TabsContent value="history" className="outline-none">
                 {fetchError ? (
                   <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-6">
                      <div className="w-20 h-20 bg-rose-100 dark:bg-rose-950/50 rounded-full flex items-center justify-center text-rose-500">
                         <AlertTriangle className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                         <h4 className="text-2xl font-black uppercase tracking-tighter italic text-rose-900 dark:text-rose-400">Erro de Acesso</h4>
                         <p className="text-rose-600/70 dark:text-rose-400/70 font-medium max-w-sm">Não foi possível carregar seu histórico. Isso pode ser um problema de permissão ou conexão.</p>
                      </div>
                      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 dark:hover:bg-rose-950/50 font-black uppercase tracking-widest text-[10px]">Tentar Novamente</Button>
                   </Card>
                 ) : isLoadingTickets ? (
                   <div className="grid grid-cols-1 gap-6">
                      {[0, 1].map((i) => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-[2.5rem]" />)}
                   </div>
                 ) : myTickets.length === 0 ? (
                   <Card className="border-slate-200 dark:border-slate-700 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-6 bg-white/50 dark:bg-slate-900/50">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                         <Clock className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                         <h4 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100">Histórico Vazio</h4>
                         <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">Você ainda não possui solicitações registradas no seu histórico do Espaço Ágil.</p>
                      </div>
                      <Button onClick={() => setActiveTab('new')} variant="outline" className="rounded-xl border-slate-200 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 font-black uppercase tracking-widest text-[10px]">Abrir Primeiro Ticket</Button>
                   </Card>
                 ) : (
                   <div className="grid grid-cols-1 gap-6">
                      {myTickets.map((ticket) => <UserTicketItem key={ticket.id} ticket={ticket} />)}
                   </div>
                 )}
               </TabsContent>
            </Tabs>
          </main>

          <aside className="xl:col-span-4 space-y-8">
            <Card className="border-none bg-indigo-600 dark:bg-indigo-700 text-white rounded-[2.5rem] p-10 shadow-xl shadow-indigo-600/20 relative overflow-hidden group min-h-[300px] flex flex-col justify-center">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                    <Rocket className="h-32 w-32" />
                 </div>
                 <div className="relative z-10 space-y-6">
                    <Badge className="bg-white/20 text-white border-none uppercase text-[8px] font-black tracking-widest px-3 py-1">Self-Service</Badge>
                    <h3 className="text-3xl font-black uppercase tracking-tighter italic font-headline">Dúvidas Técnicas?</h3>
                    <p className="text-white/70 text-base font-medium leading-relaxed">Consulte o manual oficial para guias passo-a-passo de cada ferramenta do Espaço Ágil.</p>
                    <Button
                      variant="link"
                      onClick={() => router.push('/manual')}
                      className="text-white p-0 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 hover:translate-x-2 transition-transform"
                    >
                      Acessar Manual <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                    </Button>
                 </div>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-sm dark:shadow-black/20 flex flex-col justify-center items-start text-left space-y-6 border-dashed border-2 min-h-[250px]">
                 <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <History className="h-7 w-7" />
                 </div>
                 <div className="space-y-1">
                    <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 italic font-headline">Evolução Contínua</h4>
                    <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">Build v3.4.0 stable</p>
                 </div>
                 <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Confira as últimas melhorias e correções feitas na plataforma em nosso registro oficial.</p>
                 <Button
                   variant="outline"
                   onClick={() => router.push('/changelog')}
                   className="h-12 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                 >
                   Explorar Changelog
                 </Button>
            </Card>

            <Card className="bg-slate-900 dark:bg-slate-800 border-none dark:border dark:border-slate-700 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[200px]">
                <div className="relative z-10">
                   <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-2">Governança Ágil</p>
                   <h3 className="text-white text-xl font-black uppercase tracking-tighter italic font-headline">Foco em Engenharia</h3>
                   <p className="text-slate-400 text-xs mt-3 leading-relaxed">Nossa prioridade é garantir que seu fluxo de trabalho nunca pare por problemas técnicos.</p>
                </div>
            </Card>
          </aside>
        </div>
      </div>

      <Footer className="mt-8 shrink-0" onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Suporte" externalTriggerSignal={feedbackSignal} triggerVariant="none" />
    </div>
  );
}

function History({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  );
}

function UserTicketItem({ ticket }: { ticket: SupportTicket }) {
  const date = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('pt-BR') : 'Agora';
  const [isOpen, setIsOpen] = useState(false);
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'OPEN': { label: 'Em Análise', color: 'text-rose-500', bg: 'bg-rose-50' },
    'IN_PROGRESS': { label: 'Processando', color: 'text-amber-500', bg: 'bg-amber-50' },
    'CLOSED': { label: 'Resolvido', color: 'text-emerald-500', bg: 'bg-emerald-50' }
  };

  const status = statusMap[ticket.status] || statusMap['OPEN'];

  useEffect(() => {
    if (!isOpen || replies.length > 0) return;
    setIsLoadingReplies(true);
    supportApi.getReplies(ticket.id)
      .then(setReplies)
      .catch((error) => console.error('Erro ao buscar respostas do ticket:', error))
      .finally(() => setIsLoadingReplies(false));
  }, [isOpen, ticket.id, replies.length]);

  return (
    <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/30 transition-all overflow-hidden border border-slate-100 dark:border-slate-700">
       <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shrink-0 shadow-sm", status.bg, status.color)}>
                   <LifeBuoy className="h-6 w-6" />
                </div>
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solicitação</span>
                      <Badge className={cn("text-[7px] font-black uppercase px-2 py-0 border-none", status.bg, status.color)}>{status.label}</Badge>
                   </div>
                   <h5 className="text-lg font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 font-headline">{ticket.subject}</h5>
                </div>
             </div>
             <div className="flex items-center gap-2 text-right">
                <div className="md:text-right">
                   <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest leading-none mb-1">Enviado em</p>
                   <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{date}</p>
                </div>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary transition-all ml-4"
                >
                  <ChevronRight className={cn("h-5 w-5 transition-transform", isOpen ? "rotate-90" : "")} />
                </button>
             </div>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-8">
                   <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                      <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">"{ticket.message}"</p>
                   </div>

                   {isLoadingReplies ? (
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando respostas...</p>
                   ) : replies.length > 0 && (
                      <div className="space-y-4">
                         <div className="flex items-center gap-2">
                           <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                           <h6 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Respostas da Governança</h6>
                         </div>
                         <div className="space-y-4 relative pl-4 border-l-2 border-emerald-100/50 dark:border-emerald-800/30">
                            {replies.map((reply) => (
                               <div key={reply.id} className="bg-emerald-50/40 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 animate-in fade-in slide-in-from-left-2 duration-500">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-300 mb-2 leading-relaxed">{reply.message}</p>
                                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest opacity-60 italic">
                                     <span>Agent: {(reply.authorName || 'Equipe').split('@')[0]}</span>
                                     <span>{reply.createdAt ? new Date(reply.createdAt).toLocaleString('pt-BR') : ''}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    </Card>
  );
}
