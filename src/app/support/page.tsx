'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquareHeart,
  Send,
  CheckCircle2,
  LifeBuoy,
  Bug,
  Lightbulb,
  HelpCircle,
  BookOpen,
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
import { PageHeader, PageShell } from '@/components/page';
import { IconTile } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MessageCircle, ChevronRight, History as HistoryIcon } from 'lucide-react';

type TicketType = 'feedback' | 'bug' | 'suggestion' | 'support';

export default function SupportPage() {
  const router = useRouter();
  const { session, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [ticketType, setTicketType] = useState<TicketType>('support');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('new');

  const types = [
    { id: 'support', label: 'Suporte', icon: <LifeBuoy className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
    { id: 'bug', label: 'Bug/Erro', icon: <Bug className="h-4 w-4" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' },
    { id: 'suggestion', label: 'Sugestão', icon: <Lightbulb className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
    { id: 'feedback', label: 'Elogio', icon: <MessageSquareHeart className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
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
    <PageShell documentTitle="Suporte">
      <PageHeader
        title="Suporte"
        module="support"
        subtitle="Relate problemas, sugira melhorias ou tire dúvidas com o time do portal."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Suporte' }]}
      />

  <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
    <div className="space-y-8 xl:col-span-8">
      <Tabs defaultValue="new" className="w-full" onValueChange={setActiveTab}>
         <TabsList className="bg-muted/80 p-1.5 rounded-2xl mb-6 w-fit border border-border/50 backdrop-blur-sm">
            <TabsTrigger value="new" className="rounded-xl px-8 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
               Nova Solicitação
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-8 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-2 text-muted-foreground data-[state=active]:text-foreground">
               Meus Tickets {myTickets.length > 0 && <Badge className="bg-primary/10 text-primary border-none text-xs h-4 min-w-4 flex items-center justify-center p-0">{myTickets.length}</Badge>}
            </TabsTrigger>
         </TabsList>

         <TabsContent value="new" className="outline-none">
           <Card className="border border-border/80 shadow-2xl shadow-slate-200/40 dark:shadow-none rounded-3xl overflow-hidden bg-card/80 backdrop-blur-xl">
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
                       <h3 className="text-3xl font-black uppercase tracking-tighter italic text-foreground">Ticket Enviado!</h3>
                       <p className="text-muted-foreground font-medium italic uppercase text-xs tracking-widest">ID de rastreio gerado no painel administrativo</p>
                     </div>
                     <Button
                       variant="outline"
                       onClick={() => setIsSuccess(false)}
                       className="rounded-xl border-2 border-border text-muted-foreground hover:bg-muted font-black uppercase tracking-widest text-xs h-12 px-8"
                     >
                       Enviar Outra Solicitação
                     </Button>
                   </motion.div>
                 ) : (
                   <form onSubmit={handleSubmit} className="space-y-8">
                     <div className="space-y-4">
                       <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">O que você deseja fazer?</label>
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
                                 : "border-border bg-background/80 hover:border-border text-muted-foreground grayscale hover:grayscale-0"
                             )}
                           >
                             <div className={cn("p-3 rounded-2xl shadow-sm bg-card", ticketType === type.id ? 'text-primary' : type.color)}>
                               {type.icon}
                             </div>
                             <span className={cn("text-xs font-black uppercase tracking-widest", ticketType === type.id ? "text-primary" : "text-muted-foreground")}>
                               {type.label}
                             </span>
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="space-y-6">
                       <div className="space-y-2">
                         <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Assunto</label>
                         <Input
                           placeholder="Resumo em uma frase..."
                           value={subject}
                           onChange={(e) => setSubject(e.target.value)}
                           className="h-14 rounded-2xl border-border bg-background/70 px-6 font-bold text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                         />
                       </div>

                       <div className="space-y-2">
                         <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Descrição Detalhada</label>
                         <Textarea
                           placeholder="Nos conte mais detalhes sobre sua solicitação..."
                           value={description}
                           onChange={(e) => setDescription(e.target.value)}
                           className="min-h-[180px] rounded-3xl border-border bg-background/70 p-6 font-medium text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 leading-relaxed"
                           required
                         />
                       </div>
                     </div>

                     <div className="pt-4 border-t border-border flex flex-col md:flex-row items-center gap-6">
                       <Button
                         type="submit"
                         disabled={isSubmitting || !description.trim()}
                         className="w-full md:w-auto h-16 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl shadow-primary/20 transition-all active:scale-95 gap-3"
                       >
                         {isSubmitting ? 'Processando...' : 'Enviar Solicitação'}
                         <Send className="h-4 w-4" />
                       </Button>
                       <div className="flex items-center gap-2 text-muted-foreground">
                         <HelpCircle className="h-4 w-4" />
                         <span className="text-xs font-black uppercase tracking-widest italic">Análise em até 24h úteis</span>
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
             <Card className="border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 rounded-full flex items-center justify-center text-rose-500">
                   <AlertTriangle className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                   <h4 className="text-xl font-black uppercase tracking-tighter italic text-rose-900 dark:text-rose-400">Erro de Acesso</h4>
                   <p className="text-rose-600/80 dark:text-rose-400/80 font-medium text-xs max-w-sm">Não foi possível carregar seu histórico. Isso pode ser um problema de permissão ou conexão.</p>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 dark:hover:bg-rose-950/50 font-black uppercase tracking-widest text-xs">Tentar Novamente</Button>
              </Card>
           ) : isLoadingTickets ? (
             <div className="grid grid-cols-1 gap-6">
                {[0, 1].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />)}
             </div>
           ) : myTickets.length === 0 ? (
             <Card className="border border-border border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-6 bg-card/50">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
                   <Clock className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                   <h4 className="text-xl font-black uppercase tracking-tighter italic text-foreground">Histórico Vazio</h4>
                   <p className="text-muted-foreground font-medium text-xs max-w-sm">Você ainda não possui solicitações registradas no seu histórico do Portal Tech V&D.</p>
                </div>
                <Button onClick={() => setActiveTab('new')} variant="outline" className="rounded-xl border-border text-muted-foreground hover:bg-muted font-black uppercase tracking-widest text-xs">Abrir Primeiro Ticket</Button>
             </Card>
           ) : (
             <div className="grid grid-cols-1 gap-6">
                {myTickets.map((ticket) => <UserTicketItem key={ticket.id} ticket={ticket} />)}
             </div>
           )}
         </TabsContent>
      </Tabs>
    </div>

    <aside className="space-y-4 xl:col-span-4">
      <Card className="space-y-3 rounded-2xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex items-center gap-2">
          <IconTile icon={BookOpen} size="sm" />
          <h3 className="text-base font-semibold text-foreground">Dúvidas técnicas?</h3>
        </div>
        <p className="text-sm text-muted-foreground">Consulte o manual para guias passo a passo de cada módulo do Portal Tech V&D.</p>
        <Button variant="outline" onClick={() => router.push('/manual')} className="h-10 rounded-xl px-5 text-sm font-semibold">
          Abrir o manual
        </Button>
      </Card>

      <Card className="space-y-3 rounded-2xl border border-border bg-card p-6 text-card-foreground">
        <div className="flex items-center gap-2">
          <IconTile icon={HistoryIcon} size="sm" tone="neutral" />
          <h3 className="text-base font-semibold text-foreground">O que mudou</h3>
        </div>
        <p className="text-sm text-muted-foreground">Confira as melhorias e correções de cada versão do portal.</p>
        <Button variant="outline" onClick={() => router.push('/changelog')} className="h-10 rounded-xl px-5 text-sm font-semibold">
          Ver as versões
        </Button>
      </Card>
    </aside>
  </div>
    </PageShell>
  );
}

function UserTicketItem({ ticket }: { ticket: SupportTicket }) {
  const date = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('pt-BR') : 'Agora';
  const [isOpen, setIsOpen] = useState(false);
  const [replies, setReplies] = useState<SupportTicketReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    'OPEN': { label: 'Em Análise', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/40' },
    'IN_PROGRESS': { label: 'Processando', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40' },
    'CLOSED': { label: 'Resolvido', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40' }
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
    <Card className="border border-border/80 bg-card/80 backdrop-blur-xl rounded-[2rem] shadow-sm hover:shadow-lg transition-all overflow-hidden">
       <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shrink-0 shadow-sm", status.bg, status.color)}>
                   <LifeBuoy className="h-6 w-6" />
                </div>
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Solicitação</span>
                      <Badge className={cn("text-[7px] font-black uppercase px-2 py-0 border-none", status.bg, status.color)}>{status.label}</Badge>
                   </div>
                   <h5 className="text-lg font-black uppercase tracking-tighter italic text-foreground font-headline">{ticket.subject}</h5>
                </div>
             </div>
             <div className="flex items-center gap-2 text-right">
                <div className="md:text-right">
                   <p className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Enviado em</p>
                   <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{date}</p>
                </div>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="p-3 bg-background rounded-2xl text-muted-foreground hover:bg-muted hover:text-primary transition-all ml-4"
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
                <div className="pt-6 border-t border-border space-y-8">
                   <div className="bg-background p-6 rounded-3xl border border-border">
                      <p className="text-[12px] font-medium text-muted-foreground leading-relaxed italic">"{ticket.message}"</p>
                   </div>

                   {isLoadingReplies ? (
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Carregando respostas...</p>
                   ) : replies.length > 0 && (
                      <div className="space-y-4">
                         <div className="flex items-center gap-2">
                           <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                           <h6 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Respostas da Governança</h6>
                         </div>
                         <div className="space-y-4 relative pl-4 border-l-2 border-emerald-100/50 dark:border-emerald-800/30">
                            {replies.map((reply) => (
                               <div key={reply.id} className="bg-emerald-50/40 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 animate-in fade-in slide-in-from-left-2 duration-500">
                                  <p className="text-xs font-bold text-foreground mb-2 leading-relaxed">{reply.message}</p>
                                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest opacity-60 italic">
                                     <span>Atendente: {(reply.authorName || 'Equipe').split('@')[0]}</span>
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
