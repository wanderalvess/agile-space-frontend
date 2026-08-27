"use client";

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
   Activity,
   BookOpen,
   Database,
   Zap,
   Clock,
   ArrowUpRight,
   TrendingUp,
   FileText,
   ShieldCheck,
   BrainCircuit,
   MessageSquare,
   HelpCircle
} from 'lucide-react';
import { KnowledgeGuide } from '@/components/knowledge/KnowledgeGuide';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { RoomHeader } from '@/components/layout/RoomHeader';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function KnowledgeDashboard() {
   const router = useRouter();
   const { isLoading } = useAuth();

   React.useEffect(() => {
      if (!isLoading) {
         router.replace('/knowledge/chat');
      }
   }, [isLoading, router]);

   return (
      <div className="flex-1 min-h-screen flex items-center justify-center bg-white">
         <AgileSpinner title="Redirecionando" subtitle="Acessando Assistente de Agilidade..." />
      </div>
   );
}
