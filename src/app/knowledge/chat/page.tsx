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
    <div role="status" className="flex h-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 motion-safe:animate-pulse">
        <div className="h-12 w-12 rounded-2xl bg-muted" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Preparando o assistente...</p>
      </div>
    </div>
  );
}
