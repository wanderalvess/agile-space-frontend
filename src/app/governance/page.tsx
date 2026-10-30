"use client";

import { useState } from 'react';
import { BookOpen, Clock } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { GovernanceContent } from './GovernanceContent';
import { GovernanceGuideSheet } from './GovernanceGuideSheet';
import { SECURITY_REVIEW, resolveRole } from './content';

export default function GovernancePage() {
  const { session } = useAuth();
  const [guideOpen, setGuideOpen] = useState(false);
  const role = resolveRole({ role: session?.role, accessibleProjects: session?.accessibleProjects });

  return (
    <PageShell documentTitle="Segurança e dados">
      <PageHeader
        title="Segurança e dados"
        module="governance"
        subtitle="O que o portal guarda, quem vê e o que sai daqui. Só o que está confirmado no sistema."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Segurança e dados' }]}
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
              Última revisão: {SECURITY_REVIEW.date} por {SECURITY_REVIEW.by}
            </span>
            <ModalButton onClick={() => setGuideOpen(true)} className="gap-2" aria-label="Guia de Segurança e dados">
              <BookOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Guia
            </ModalButton>
          </>
        }
      />
      <GovernanceContent role={role} />
      <GovernanceGuideSheet open={guideOpen} onOpenChange={setGuideOpen} />
    </PageShell>
  );
}
