'use client';

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { 
  Megaphone, 
  Send, 
  Trash2, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Bell,
  MessageSquare,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Announcement {
  id: string;
  message: string;
  createdBy: string;
  createdAt: any;
  isActive: boolean;
}

export function CommunicationsManager() {
  const { firestore, user } = useFirebase();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, 'global_announcements'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const handleBroadcast = async () => {
    if (!firestore || !newMessage.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(firestore, 'global_announcements'), {
        message: newMessage,
        createdBy: user?.email || 'Admin',
        createdAt: serverTimestamp(),
        isActive: true
      });

      await logSystemEvent(firestore, {
        content: `ANÚNCIO GLOBAL DISPARADO: "${newMessage.substring(0, 50)}..."`,
        type: 'admin',
        severity: 'info',
        userEmail: user?.email,
        module: 'Communications'
      });

      setNewMessage('');
      toast({ title: "Anúncio Publicado", description: "Todos os usuários conectados receberão o aviso." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao publicar" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'global_announcements', id));
      toast({ title: "Anúncio Removido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Canais de Comunicação...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* Editor de Broadcast */}
        <div className="xl:col-span-1 space-y-8">
          <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Megaphone className="h-6 w-6" /></div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Novo Anúncio</CardTitle>
                <CardDescription className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-1">Transmissão em Tempo Real</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Mensagem do Alerta</label>
                <textarea 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ex: Manutenção programada para amanhã às 20h..."
                  className="w-full min-h-[150px] p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-primary/30 focus:bg-white transition-all outline-none text-sm font-medium leading-relaxed italic"
                />
              </div>

              <Button 
                onClick={handleBroadcast} 
                disabled={sending || !newMessage.trim()}
                className="w-full h-16 rounded-[1.5rem] bg-slate-900 hover:bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all gap-3"
              >
                {sending ? 'TRANSMITINDO...' : 'DISPARAR AGORA'}
                <Send className="h-4 w-4" />
              </Button>

              <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2rem] flex items-start gap-4">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-1" />
                <p className="text-[11px] font-medium text-blue-700 leading-relaxed italic">
                  Esta mensagem aparecerá instantaneamente como um "Sticky Alert" no topo da tela de todos os usuários ativos na plataforma.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Transmissões */}
        <div className="xl:col-span-2 space-y-8">
           <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden min-h-[600px]">
            <CardHeader className="p-10 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-2xl text-slate-500"><Clock className="h-6 w-6" /></div>
                <div>
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Histórico Recente</CardTitle>
                  <CardDescription className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mt-1">Últimas 10 transmissões globais</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="px-4 py-1.5 rounded-full border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-widest">
                Fluxo em Tempo Real
              </Badge>
            </CardHeader>
            <CardContent className="p-10">
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {announcements.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                      <Bell className="h-10 w-10 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum anúncio ativo no momento</p>
                    </div>
                  ) : announcements.map((a) => (
                    <motion.div 
                      key={a.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group p-6 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 border border-slate-100 rounded-[2.5rem] transition-all relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                      <div className="flex justify-between items-start gap-6">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Transmitido por: <span className="text-slate-900 italic lowercase">{a.createdBy}</span></span>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">•</span>
                            <span className="text-[9px] font-bold text-slate-400 italic">
                              {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString('pt-BR') : 'Recentemente'}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold text-slate-700 leading-relaxed italic">
                            "{a.message}"
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(a.id)}
                          className="h-12 w-12 rounded-2xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
