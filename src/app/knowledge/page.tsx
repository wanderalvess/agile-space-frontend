"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useRouter } from 'next/navigation';

export default function KnowledgeDashboard() {
   const router = useRouter();
   const { isLoading } = useAuth();

   React.useEffect(() => {
      if (!isLoading) {
         router.replace('/knowledge/chat');
      }
   }, [isLoading, router]);

   return (
      <div className="flex h-full min-h-[24rem] flex-1 items-center justify-center bg-background">
         <AgileSpinner title="Redirecionando" subtitle="Acessando Assistente de Agilidade..." />
      </div>
   );
}
