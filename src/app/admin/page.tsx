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
  Brain,
  Lock,
  ChevronDown
} from 'lucide-react';
import { adminApi } from '@/app/admin/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
import { ApiKeysManager } from '@/components/admin/ApiKeysManager';
import { RoomHeader } from '@/components/layout/RoomHeader';

// 12 telas agrupadas em pares por afinidade -- cada grupo vira um dropdown na
// barra, em vez de 12 abas competindo por espaço horizontal (ver TabsTrigger
// original, cortava/quebrava em telas de notebook comuns).
const TAB_GROUPS = [
  {
    id: 'governance-group',
    label: 'Governança',
    icon: Building2,
    items: [
      { id: 'governance', label: 'Governança & Jira Sync', icon: Building2 },
      { id: 'users', label: 'Usuários & Cargos', icon: Users },
    ],
  },
  {
    id: 'ceremonies-group',
    label: 'Cerimônias',
    icon: Target,
    items: [
      { id: 'ceremonies', label: 'Analytics de Cerimônias', icon: Target },
      { id: 'sessions', label: 'Histórico de Sessões', icon: FileText },
    ],
  },
  {
    id: 'growth-group',
    label: 'Métricas',
    icon: TrendingUp,
    items: [
      { id: 'growth', label: 'Crescimento & Métricas', icon: TrendingUp },
      { id: 'feedback', label: 'Feedbacks & NPS', icon: MessageSquareHeart },
    ],
  },
  {
    id: 'comms-group',
    label: 'Sistema',
    icon: Megaphone,
    items: [
      { id: 'communications', label: 'Anúncios & Avisos', icon: Megaphone },
      { id: 'system', label: 'Configurações', icon: Settings2 },
    ],
  },
  {
    id: 'engineering-group',
    label: 'Engenharia',
    icon: GitBranch,
    items: [
      { id: 'changelog', label: 'Engenharia & Releases', icon: GitBranch },
      { id: 'intelligence', label: 'Motor AI & Conhecimento', icon: Brain },
    ],
  },
  {
    id: 'security-group',
    label: 'Segurança',
    icon: Lock,
    items: [
      { id: 'api-keys', label: 'API Keys', icon: Lock },
      { id: 'audit', label: 'Auditoria & Logs', icon: ShieldCheck },
    ],
  },
] as const;

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
        <Button
          onClick={() => router.replace('/')}
          className="h-auto px-6 py-2.5 rounded-xl shadow-md text-xs uppercase tracking-wider"
        >
          Voltar ao Início
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
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
              <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-2.5">
                <div className="bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl h-auto gap-1.5 flex flex-wrap w-full items-center border border-slate-200/50 dark:border-slate-800/50">
                  {TAB_GROUPS.map((group) => {
                    const activeItem = group.items.find(i => i.id === activeTab);
                    const isActive = !!activeItem;
                    const triggerClasses = cn(
                      "rounded-xl px-4 py-2 text-[10.5px] font-black uppercase tracking-wider transition-all gap-2 flex items-center border border-transparent whitespace-nowrap shrink-0 justify-center",
                      isActive
                        ? "bg-white dark:bg-slate-900 text-primary shadow-sm border-slate-200/80 dark:border-slate-800"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    );
                    return (
                      <DropdownMenu key={group.id}>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={triggerClasses}>
                            <group.icon className="h-3.5 w-3.5" />
                            <span>{activeItem ? activeItem.label : group.label}</span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl p-1.5 bg-white dark:bg-slate-900 mt-2">
                          {group.items.map((item) => (
                            <DropdownMenuItem
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              className={cn(
                                "rounded-xl text-[11px] font-black uppercase tracking-wider p-2.5 cursor-pointer gap-2 transition-colors",
                                item.id === activeTab
                                  ? "bg-primary/10 text-primary"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              )}
                            >
                              <item.icon className="h-3.5 w-3.5" />
                              {item.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative z-10 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
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
                <TabsContent value="api-keys" className="outline-none focus-visible:ring-0">
                  <ApiKeysManager />
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


