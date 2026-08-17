'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function GlobalAnnouncementListener() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [activeAnnouncement, setActiveAnnouncement] = useState<{ id: string, message: string, type: string } | null>(null);

  useEffect(() => {
    // Only listen if firestore is available AND user is signed in (even anonymously)
    // This prevents permission-denied errors on the landing page for guests
    if (!firestore || !user) return;

    // Ouve o anúncio mais recente criado nos últimos 5 minutos para evitar "spam" de alertas antigos no login
    const fiveMinutesAgo = new Timestamp(Math.floor(Date.now() / 1000) - 300, 0);
    const q = query(
      collection(firestore, 'global_announcements'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Só exibe se for um anúncio novo (criado após o mount do componente)
          if (data.timestamp && data.timestamp.toMillis() > Date.now() - 5000) {
             setActiveAnnouncement({
               id: change.doc.id,
               message: data.message,
               type: data.type || 'info'
             });
             
             // Também dispara um toast para garantir visibilidade
             toast({
               title: "ANÚNCIO GLOBAL",
               description: data.message,
               duration: 10000,
             });
          }
        }
      });
    }, (error) => {
      console.error("GlobalAnnouncementListener: error in snapshot listener:", error);
    });

    return () => unsubscribe();
  }, [firestore, user, toast]);

  return (
    <AnimatePresence>
      {activeAnnouncement && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-[600px]"
        >
          <div className="bg-slate-900 border border-primary/30 text-white p-5 rounded-[2rem] shadow-2xl shadow-primary/20 backdrop-blur-xl flex items-center gap-5">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shrink-0 animate-bounce">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">Comunicado Oficial Espaço Ágil</p>
              <p className="text-sm font-bold leading-tight">{activeAnnouncement.message}</p>
            </div>
            <button 
              onClick={() => setActiveAnnouncement(null)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
