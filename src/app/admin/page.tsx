'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { IconTile, ModalButton } from '@/components/room-kit';
import { useUserContext } from '@/context/UserContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { adminTabHref, isCanonicalTabParam, resolveAdminTab, type AdminTabId } from '@/components/admin/admin-tabs';
import { useAdminCounts } from '@/components/admin/useAdminCounts';
import { UserExplorer } from '@/components/admin/UserExplorer';
import { ApprovalsHub } from '@/components/admin/approvals/ApprovalsHub';
import { TicketsManager } from '@/components/admin/tickets/TicketsManager';
import { FeedbackManager } from '@/components/admin/FeedbackManager';
import { GrowthDashboard } from '@/components/admin/GrowthDashboard';
import { CeremoniesDashboard } from '@/components/admin/CeremoniesDashboard';
import { SessionMonitor } from '@/components/admin/SessionMonitor';
import { CommunicationsManager } from '@/components/admin/CommunicationsManager';
import { ChangelogManager } from '@/components/admin/ChangelogManager';
import { GovernanceHub } from '@/components/admin/GovernanceHub';
import { IntelligenceHubMonitor } from '@/components/admin/IntelligenceHubMonitor';
import { ApiKeysManager } from '@/components/admin/ApiKeysManager';
import { SystemConfigManager } from '@/components/admin/SystemConfigManager';
import { AuditLogExplorer } from '@/components/admin/AuditLogExplorer';

/** Quem não é administrador: aviso e volta ao início sozinho (o servidor também recusa /api/admin/**). */
function RestrictedAccess({ email, onBack }: { email?: string; onBack: () => void }) {
  return (
    <div className="flex min-h-dvh w-full flex-1 items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="flex max-w-[520px] flex-col items-center gap-4 text-center">
        <IconTile icon={ShieldAlert} tone="danger" size="lg" className="h-16 w-16 rounded-[18px] [&_svg]:h-[30px] [&_svg]:w-[30px]" />
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">Acesso restrito</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Seu usuário ({email || 'não identificado'}) não possui privilégios de administrador para acessar este painel.
        </p>
        <ModalButton variant="primary" onClick={onBack}>
          Voltar ao início
        </ModalButton>
      </section>
    </div>
  );
}

function TabContent({ tab, pendingResets, onTicketsOpen }: { tab: AdminTabId; pendingResets: number | null; onTicketsOpen: (n: number) => void }) {
  switch (tab) {
    case 'usuarios':
      return <UserExplorer pendingResets={pendingResets} />;
    case 'aprovacoes':
      return <ApprovalsHub />;
    case 'chamados':
      return <TicketsManager onOpenCount={onTicketsOpen} />;
    case 'feedbacks':
      return <FeedbackManager />;
    case 'crescimento':
      return <GrowthDashboard />;
    case 'cerimonias':
      return <CeremoniesDashboard />;
    case 'sessoes':
      return <SessionMonitor />;
    case 'avisos':
      return <CommunicationsManager />;
    case 'versoes':
      return <ChangelogManager />;
    case 'jira':
      return <GovernanceHub />;
    case 'motor-ai':
      return <IntelligenceHubMonitor />;
    case 'apikeys':
      return <ApiKeysManager />;
    case 'sistema':
      return <SystemConfigManager />;
    case 'auditoria':
      return <AuditLogExplorer />;
  }
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, isInitializing } = useUserContext();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  const rawTab = searchParams.get('tab');
  const tab = resolveAdminTab(rawTab);
  const { counts, setTicketsOpen } = useAdminCounts(tab.id, !isInitializing && isAdmin);

  // Quem não é admin volta ao início logo em seguida (a tela de aviso aparece nesse meio tempo).
  useEffect(() => {
    if (!isInitializing && !isAdmin) {
      const timer = setTimeout(() => router.replace('/'), 100);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, isInitializing, router]);

  // Apelido antigo (?tab=governance) ou aba desconhecida: troca o endereço pelo da aba que de fato abriu.
  useEffect(() => {
    if (rawTab && isAdmin && !isCanonicalTabParam(rawTab)) router.replace(adminTabHref(tab.id), { scroll: false });
  }, [rawTab, isAdmin, tab.id, router]);

  if (isInitializing) return <LoadingScreen />;
  if (!userProfile || !isAdmin) return <RestrictedAccess email={userProfile?.email} onBack={() => router.replace('/')} />;

  return (
    <AdminShell active={tab} counts={counts}>
      <TabContent key={tab.id} tab={tab.id} pendingResets={counts.resets} onTicketsOpen={setTicketsOpen} />
    </AdminShell>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminContent />
    </Suspense>
  );
}
