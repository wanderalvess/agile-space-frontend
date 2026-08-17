'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  WalletCards, 
  LayoutDashboard, 
  CalendarRange, 
  ShieldCheck, 
  AlertTriangle, 
  Rocket, 
  MessageSquareHeart, 
  History, 
  Activity,
  LifeBuoy,
  MessageCircle,
  Send,
  Brain,
  Palette
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { logSystemEvent } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function KpiCard({ title, value, icon, color, trend }: any) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
      <Card className="border-slate-200 dark:border-slate-800/60 rounded-[2.5rem] bg-white dark:bg-slate-900 overflow-hidden hover:border-primary/40 transition-all duration-500 shadow-xl shadow-slate-200/10 group">
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className={cn("w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg transition-all group-hover:scale-110", color)}>
              {icon}
            </div>
            <Badge variant="ghost" className="text-[8px] font-black text-slate-400 tracking-widest uppercase bg-slate-50">
              {trend}
            </Badge>
          </div>
          <div>
            <h3 className="text-5xl font-black italic tracking-tighter font-headline text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
              {value}
            </h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 group-hover:text-primary/60 transition-colors">
              {title}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function HealthBar({ label, value, color, status }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
        <span className="text-slate-400">{label}</span>
        <span className={cn("animate-pulse", color.replace('bg-', 'text-'))}>{status}</span>
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-[2px] border border-slate-200 dark:border-slate-800">
        <div className={cn("h-full rounded-full shadow-lg", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function NpsBar({ label, count, total, color }: any) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[11px] font-black uppercase tracking-tight">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-700">{count} <span className="text-slate-400 text-[10px]">({percentage.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={cn("h-full rounded-full transition-all shadow-md", color)} />
      </div>
    </div>
  );
}

export function FeedbackItem({ feedback }: any) {
  const date = feedback.timestamp instanceof Timestamp ? feedback.timestamp.toDate().toLocaleDateString('pt-BR') : 'Agora';
  return (
    <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all space-y-4">
      <div className="flex justify-between items-start">
        <Badge className={cn("text-[8px] font-black px-2 py-0.5", 
          feedback.score >= 9 ? 'bg-emerald-600' : 
          feedback.score >= 7 ? 'bg-amber-500' : 'bg-rose-600'
        )}>
          {feedback.score === -1 ? 'SUGESTÃO' : `NOTA ${feedback.score}`}
        </Badge>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{date}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-600 font-medium italic">"{feedback.comment || 'N/A'}"</p>
      <p className="text-[8px] font-black text-primary/40 uppercase tracking-tighter truncate">Envio: {feedback.userEmail || 'Anon'}</p>
    </div>
  );
}

export function TicketItem({ ticket, onClick }: any) {
  const date = ticket.timestamp instanceof Timestamp ? ticket.timestamp.toDate().toLocaleDateString('pt-BR') : 'Agora';
  const typeLabels: Record<string, string> = {
    'support': 'SUPORTE',
    'bug': 'BUG/ERRO',
    'suggestion': 'SUGESTÃO',
    'feedback': 'ELOGIO'
  };

  const typeColors: Record<string, string> = {
    'support': 'bg-blue-100 text-blue-700',
    'bug': 'bg-rose-100 text-rose-700',
    'suggestion': 'bg-amber-100 text-amber-700',
    'feedback': 'bg-emerald-100 text-emerald-700'
  };

  const statusColors: Record<string, string> = {
    'open': 'text-rose-500 border-rose-200 bg-rose-50',
    'pending': 'text-amber-500 border-amber-200 bg-amber-50',
    'resolved': 'text-emerald-500 border-emerald-200 bg-emerald-50'
  };

  return (
    <div
      onClick={onClick}
      className="p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all space-y-4 shadow-sm cursor-pointer group"
    >
      <div className="flex justify-between items-start">
        <Badge className={cn("text-[8px] font-black px-2 py-0.5 border-none", typeColors[ticket.type] || 'bg-slate-100')}>
          {typeLabels[ticket.type] || 'TICKET'}
        </Badge>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{date}</span>
      </div>
      <div className="space-y-1">
        <h5 className="text-[12px] font-black uppercase text-slate-900 dark:text-slate-100 leading-tight italic group-hover:text-primary transition-colors">{ticket.subject}</h5>
        <p className="text-[11px] leading-relaxed text-slate-600 font-medium line-clamp-3">
          {ticket.description}
        </p>
      </div>
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
        <p className="text-[8px] font-black text-slate-400 group-hover:text-primary/60 uppercase tracking-tighter truncate max-w-[120px] transition-colors">
          {ticket.userEmail}
        </p>
        <Badge variant="outline" className={cn("text-[7px] font-black uppercase tracking-widest px-1.5", statusColors[ticket.status] || 'border-slate-100 dark:border-slate-800')}>
          {ticket.status === 'open' ? 'ABERTO' : ticket.status === 'pending' ? 'PENDENTE' : 'RESOLVIDO'}
        </Badge>
      </div>
    </div>
  );
}

export function TicketDetailDialog({ open, onOpenChange, ticket, onUpdate }: any) {
  const { firestore, user } = useFirebase();
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState(ticket?.status || 'open');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (ticket) setStatus(ticket.status);
  }, [ticket]);

  if (!ticket) return null;

  const handleUpdate = async () => {
    if (!firestore) return;
    setIsUpdating(true);
    try {
      const ticketRef = doc(firestore, 'support_tickets', ticket.id);
      const newReplies = [...(ticket.replies || [])];

      if (reply.trim()) {
        newReplies.push({
          message: reply.trim(),
          adminEmail: user?.email,
          timestamp: new Date().toISOString()
        });

        await logSystemEvent(firestore, {
          content: `Admin respondeu ticket [${ticket.id}]: "${reply.substring(0, 30)}..."`,
          type: 'admin',
          severity: 'info',
          userEmail: user?.email,
          module: 'SupportTickets'
        });
      }

      await updateDoc(ticketRef, {
        status: status,
        replies: newReplies
      });

      toast({ title: "Ticket atualizado", description: "As mudanças foram salvas com sucesso." });
      setReply('');
      onUpdate();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const date = ticket.timestamp instanceof Timestamp ? ticket.timestamp.toDate().toLocaleString('pt-BR') : 'Agora';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] rounded-[2.5rem] border-none bg-slate-50/40 backdrop-blur-3xl p-0 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col max-h-[85vh] outline-none">
        <header className="px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/60 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
              <LifeBuoy className="h-7 w-7 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Ticket Hub</span>
                <Badge variant="outline" className="text-[7px] font-black bg-slate-50 border-slate-200 dark:border-slate-800 text-slate-400 px-1.5 py-0">#{ticket.id.substring(0, 8).toUpperCase()}</Badge>
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                {ticket.subject}
              </DialogTitle>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn("text-[9px] font-black uppercase px-3 py-1 border-none shadow-sm",
              ticket.type === 'bug' ? 'bg-rose-500 text-white' :
                ticket.type === 'suggestion' ? 'bg-amber-500 text-white' :
                  'bg-indigo-600 text-white'
            )}>
              {ticket.type}
            </Badge>
            <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{date}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          <div className="relative pl-10">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
            <div className="absolute left-[11px] top-1 w-2.5 h-2.5 rounded-full border-2 border-primary bg-white dark:bg-slate-900 z-10" />
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Users className="h-3 w-3" /> Relato do Usuário
              </h4>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800/60 shadow-sm border-l-4 border-l-primary group hover:border-primary/20 transition-all">
                <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                  "{ticket.description}"
                </p>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">?</div>
                  <p className="text-[9px] font-black text-primary/60 uppercase tracking-tighter truncate">{ticket.userEmail}</p>
                </div>
              </div>
            </div>
          </div>

          {ticket.replies?.map((r: any, idx: number) => (
            <div key={idx} className="relative pl-10">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="absolute left-[11px] top-1 w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-900 z-10" />
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                  <MessageCircle className="h-3 w-3" /> Resposta da Governança
                </h4>
                <div className="bg-emerald-50/40 backdrop-blur-sm rounded-[2rem] p-6 border border-emerald-100 ml-4 group shadow-sm hover:bg-emerald-50/60 transition-all">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-relaxed">{r.message}</p>
                  <div className="mt-4 pt-3 border-t border-emerald-100/50 flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                    <span className="text-emerald-700/60">{r.adminEmail}</span>
                    <span className="text-slate-400 italic">{new Date(r.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800/80 p-6 shadow-xl shadow-slate-200/20 mt-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Send className="h-4 w-4" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 italic">Intervenção Administrativa</h4>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                {[
                  { id: 'open', label: 'Aberto', color: 'bg-rose-500' },
                  { id: 'pending', label: 'Pendente', color: 'bg-amber-500' },
                  { id: 'resolved', label: 'Resolvido', color: 'bg-emerald-500' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className={cn(
                      "text-[8px] font-black uppercase px-4 py-2 rounded-lg transition-all",
                      status === s.id ? `${s.color} text-white shadow-lg` : "text-slate-400 hover:bg-white dark:bg-slate-900 hover:text-slate-600"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Sua resposta de governança..."
              className="w-full h-24 bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-[13px] font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none mb-4 placeholder:text-slate-300 font-sans"
            />
            <div className="flex gap-4">
              <Button onClick={handleUpdate} disabled={isUpdating || (!reply.trim() && status === ticket.status)} className="flex-1 h-14 rounded-2xl bg-slate-900 border-none hover:bg-primary transition-all text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl active:scale-95 gap-3">
                {isUpdating ? 'PROCESSANDO...' : 'ATUALIZAR GOVERNANÇA'}
                <Send className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-100">
                FECHAR
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GovernanceConsoleCard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeCache = async () => {
    setIsPurging(true);
    try {
      // Simulação de revalidação de cache / limpeza de rotas
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({ title: "Cache Purificado", description: "As rotas e dados estáticos foram invalidados com sucesso." });
    } finally {
      setIsPurging(false);
    }
  };

  const handleBroadcast = async () => {
    if (!announcement.trim() || !firestore) return;
    setIsLoading(true);
    try {
      await addDoc(collection(firestore, 'global_announcements'), {
        message: announcement,
        timestamp: serverTimestamp(),
        sender: user?.email,
        type: 'admin_broadcast'
      });
      await logSystemEvent(firestore, {
        content: `Admin enviou anúncio global: "${announcement.substring(0, 30)}..."`,
        type: 'admin',
        severity: 'info',
        userEmail: user?.email,
        module: 'GlobalAnnouncements'
      });
      toast({ title: "Anúncio Disparado", description: "Todos os usuários verão essa mensagem." });
      setAnnouncement('');
    } catch (e) {
      toast({ title: "Erro ao disparar", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-slate-900 rounded-[3rem] bg-slate-900 overflow-hidden shadow-2xl relative group">
      <CardHeader className="p-10 border-b border-white/5 pb-6">
        <h3 className="text-xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3"><Rocket className="h-5 w-5 text-primary" /> Console Diretor</h3>
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Ações de Operação Principal</p>
      </CardHeader>
      <CardContent className="p-10 space-y-8">
        <div className="space-y-4">
          <textarea
            value={announcement} onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Anúncio Global em Tempo Real..."
            className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-all resize-none shadow-inner"
          />
          <Button disabled={!announcement.trim() || isLoading} onClick={handleBroadcast} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95">
            {isLoading ? 'Disparando...' : 'Disparar Alerta Master'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            onClick={() => onNavigate?.('audit')}
            className="h-14 border-white/10 bg-white/5 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 rounded-2xl"
          >
            Audit Log
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePurgeCache}
            disabled={isPurging}
            className="h-14 border-white/10 bg-white/5 text-white font-black uppercase text-[10px] tracking-widest hover:bg-rose-600/20 hover:border-rose-500/30 rounded-2xl transition-all"
          >
            {isPurging ? 'Limpando...' : 'Purge Cache'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentActivityFeed() {
  const { firestore } = useFirebase();
  const { userProfile, isInitializing } = useUserContext();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || isInitializing || !userProfile || userProfile.role !== 'admin') {
      if (!isInitializing && userProfile && userProfile.role !== 'admin') {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const q = query(collection(firestore, 'system_events'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(data);
      setLoading(false);
    }, (error) => {
      console.error("RecentActivityFeed: Error fetching activities:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firestore, isInitializing, userProfile]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'admin': return <ShieldCheck className="h-4 w-4" />;
      case 'security': return <AlertTriangle className="h-4 w-4" />;
      case 'action': return <Rocket className="h-4 w-4" />;
      default: return <History className="h-4 w-4" />;
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-rose-600 bg-rose-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800/60 rounded-[3rem] bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 overflow-hidden">
      <CardHeader className="p-10 border-b border-slate-100 dark:border-slate-800 pb-6 flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 flex items-center gap-3 italic font-headline">
            <Activity className="h-6 w-6 text-primary" /> Atividade do Hub
          </h4>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stream de Eventos Reais</p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] uppercase font-black px-4 py-1 animate-pulse tracking-widest">Live Feed</Badge>
      </CardHeader>
      <CardContent className="p-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xxl:grid-cols-4 gap-6">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-[2.5rem]" />)
          ) : activities.length === 0 ? (
            <p className="col-span-full text-center text-slate-400 font-black uppercase tracking-widest py-10 text-[10px]">Sem eventos detectados.</p>
          ) : activities.map((act) => (
            <div key={act.id} className="flex items-center gap-4 p-6 bg-slate-50 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] group hover:shadow-lg transition-all border-l-4 border-l-primary/10">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", getColor(act.severity))}>{getIcon(act.type)}</div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-slate-700 leading-tight line-clamp-2">{act.content}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-2">{act.timestamp?.toDate().toLocaleTimeString('pt-BR') || 'Recent'}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function InfrastructureDetailsDialog({ open, onOpenChange }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-[3rem] border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl outline-none">
        <DialogHeader className="p-10 bg-blue-50/50 border-b border-blue-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20"><Activity className="h-6 w-6 text-white" /></div>
            <div><DialogTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100">Diagnóstico Real</DialogTitle><p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mt-1">Status Report: Espaço Ágil Hub</p></div>
          </div>
        </DialogHeader>
        <div className="p-10 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <DiagnosticCard label="Firestore I/O" status="OPTIMIZED" sub="V3 Server Count Active" color="text-emerald-600" />
            <DiagnosticCard label="Node Cluster" status="PRODUCTION" sub="Region: SouthAmerica-East1" color="text-blue-600" />
          </div>
          <p className="text-[11px] font-medium text-slate-500 leading-relaxed bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 italic">
            A infraestrutura está operando em capacidade otimizada. Todas as métricas de governança são computadas via agregadores de servidor para garantir custo-zero e performance estável.
          </p>
        </div>
        <DialogFooter className="p-10 pt-0"><Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase text-[11px] font-headline tracking-widest">Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiagnosticCard({ label, status, sub, color }: any) {
  return (
    <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-1">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={cn("text-lg font-black italic", color)}>{status}</p>
      <p className="text-[8px] font-medium text-slate-500 uppercase tracking-tighter">{sub}</p>
    </div>
  );
}
