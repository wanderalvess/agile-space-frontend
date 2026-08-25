'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import {
  Users,
  ShieldCheck,
  Building2,
  Target,
  FileText,
  TrendingUp,
  Settings2,
  Megaphone,
  MessageSquareHeart,
  GitBranch,
  Brain
} from 'lucide-react';
import { adminApi } from '@/app/admin/api';
import { Badge } from '@/components/ui/badge';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserExplorer } from '@/components/admin/UserExplorer';
import { useUserContext } from '@/context/UserContext';
import { AuditLogExplorer } from '@/components/admin/AuditLogExplorer';
import { GovernanceHub } from '@/components/admin/GovernanceHub';
import { CeremoniesDashboard } from '@/components/admin/CeremoniesDashboard';
import { SessionMonitor } from '@/components/admin/SessionMonitor';
import { GrowthDashboard } from '@/components/admin/GrowthDashboard';
import { SystemConfigManager } from '@/components/admin/SystemConfigManager';
import { CommunicationsManager } from '@/components/admin/CommunicationsManager';
import { FeedbackManager } from '@/components/admin/FeedbackManager';
import { ChangelogManager } from '@/components/admin/ChangelogManager';
import { IntelligenceHubMonitor } from '@/components/admin/IntelligenceHubMonitor';
import { RoomHeader } from '@/components/layout/RoomHeader';

export default function AdminDashboard() {
  const router = useRouter();
  const { userProfile, isInitializing } = useUserContext();
  const [activeTab, setActiveTab] = useState('governance');
  const [feedbackSignal, setFeedbackSignal] = useState(0);

  // Redirecionamento de Segurança
  useEffect(() => {
    const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
    if (!isInitializing && (!userProfile || !isAdmin)) {
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [userProfile, isInitializing, router]);

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  if (isInitializing) return <LoadingScreen />;
  if (!userProfile || !isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 font-body">
        <ShieldCheck className="h-16 w-16 text-red-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Acesso Restrito</h1>
        <p className="text-sm font-medium text-slate-500 max-w-md text-center mb-6">
          Seu usuário ({userProfile?.email || 'não identificado'}) não possui privilégios de administrador para acessar este painel.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-xs uppercase tracking-wider"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <RoomHeader
            title="Painel de Governança & Administração"
            toolIcon={<ShieldCheck className="h-4 w-4" />}
            toolColorClass="text-primary"
            onOpenFeedback={() => setFeedbackSignal(Date.now())}
            badge={<Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">POSTGRES CORE</Badge>}
            actions={
              <div className="hidden md:flex flex-col items-end pr-3 border-r border-slate-200 dark:border-slate-800">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Governança Ágil</p>
                <p className="text-[9px] font-bold text-primary italic lowercase leading-none">{userProfile?.email || 'admin'}</p>
              </div>
            }
          />
          
            <div className="w-full bg-white dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 sticky top-12 z-[40]">
              <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-2.5 overflow-x-auto no-scrollbar">
                <TabsList className="bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl h-auto gap-1.5 inline-flex w-auto min-w-full sm:min-w-0 flex-nowrap items-center border border-slate-200/50 dark:border-slate-800/50">
                  {[
                    { id: 'governance', label: 'Governança & Jira Sync', icon: <Building2 className="h-3.5 w-3.5" /> },
                    { id: 'ceremonies', label: 'Analytics de Cerimônias', icon: <Target className="h-3.5 w-3.5" /> },
                    { id: 'sessions', label: 'Histórico de Sessões', icon: <FileText className="h-3.5 w-3.5" /> },
                    { id: 'users', label: 'Usuários & Cargos', icon: <Users className="h-3.5 w-3.5" /> },
                    { id: 'growth', label: 'Crescimento & Métricas', icon: <TrendingUp className="h-3.5 w-3.5" /> },
                    { id: 'communications', label: 'Anúncios & Avisos', icon: <Megaphone className="h-3.5 w-3.5" /> },
                    { id: 'feedback', label: 'Feedbacks & NPS', icon: <MessageSquareHeart className="h-3.5 w-3.5" /> },
                    { id: 'system', label: 'Configurações', icon: <Settings2 className="h-3.5 w-3.5" /> },
                    { id: 'changelog', label: 'Engenharia & Releases', icon: <GitBranch className="h-3.5 w-3.5" /> },
                    { id: 'intelligence', label: 'Motor AI & Conhecimento', icon: <Brain className="h-3.5 w-3.5" /> },
                    { id: 'audit', label: 'Auditoria & Logs', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-4 py-2 text-[10.5px] font-black uppercase tracking-wider transition-all gap-2 flex items-center border border-transparent data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-slate-800 whitespace-nowrap shrink-0 justify-center"
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
              <main className="w-full space-y-6">
                <TabsContent value="governance" className="outline-none focus-visible:ring-0">
                  <GovernanceHub />
                </TabsContent>
                <TabsContent value="ceremonies" className="outline-none focus-visible:ring-0">
                  <CeremoniesDashboard />
                </TabsContent>
                <TabsContent value="sessions" className="outline-none focus-visible:ring-0">
                  <SessionMonitor />
                </TabsContent>
                <TabsContent value="users" className="outline-none focus-visible:ring-0">
                  <UserExplorer />
                </TabsContent>
                <TabsContent value="growth" className="outline-none focus-visible:ring-0">
                  <GrowthDashboard />
                </TabsContent>
                <TabsContent value="communications" className="outline-none focus-visible:ring-0">
                  <CommunicationsManager />
                </TabsContent>
                <TabsContent value="feedback" className="outline-none focus-visible:ring-0">
                  <FeedbackManager />
                </TabsContent>
                <TabsContent value="system" className="outline-none focus-visible:ring-0">
                  <SystemConfigManager />
                </TabsContent>
                <TabsContent value="changelog" className="outline-none focus-visible:ring-0">
                  <ChangelogManager />
                </TabsContent>
                <TabsContent value="intelligence" className="outline-none focus-visible:ring-0">
                  <IntelligenceHubMonitor />
                </TabsContent>
                <TabsContent value="audit" className="outline-none focus-visible:ring-0">
                  <AuditLogExplorer />
                </TabsContent>
              </main>
            </div>
        </Tabs>
      </div>

      <Footer className="mt-8" onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Admin" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}


