'use client';

import { useEffect, useState } from 'react';
import { publicApi } from '@/app/admin/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Janela de "novidade": só exibimos o anúncio mais recente se ele tiver sido
// criado nos últimos 5 minutos, para evitar "spam" de alertas antigos a cada login.
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

export function GlobalAnnouncementListener() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeAnnouncement, setActiveAnnouncement] = useState<{ id: string, message: string, type: string } | null>(null);

  useEffect(() => {
    // Só busca se o usuário estiver autenticado — evita chamada desnecessária na tela de login
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const announcements = await publicApi.getAnnouncements();
        if (cancelled || !announcements || announcements.length === 0) return;

        const latest = announcements[0];
        const createdAtMs = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;

        // Só exibe se for um anúncio recente, para evitar reexibir alertas antigos
        if (createdAtMs && createdAtMs > Date.now() - FRESHNESS_WINDOW_MS) {
          setActiveAnnouncement({
            id: latest.id || '',
            message: latest.content,
            type: 'info'
          });

          // Também dispara um toast para garantir visibilidade
          toast({
            title: "ANÚNCIO GLOBAL",
            description: latest.content,
            duration: 10000,
          });
        }
      } catch (error) {
        console.error("GlobalAnnouncementListener: error fetching announcements:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, toast]);

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
