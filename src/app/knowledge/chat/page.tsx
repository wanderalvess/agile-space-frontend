"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatLandingPage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para um novo ID de chat único usando crypto nativo
    const newId = crypto.randomUUID().slice(0, 10);
    router.replace(`/knowledge/chat/${newId}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-950/40 rounded-2xl" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Preparando ambiente de chat...</p>
      </div>
    </div>
  );
}
