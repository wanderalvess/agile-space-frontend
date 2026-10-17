'use client';

/**
 * Aba "Painéis" do hub da squad. Esta é uma peça provisória: o painel adaptativo por papel e as consultas JQL
 * chegam na branch dos painéis (w2-panels), que substitui este arquivo.
 */

import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/page';
import { ModalButton } from '@/components/room-kit';

export default function SquadPanelsTab() {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title="Painéis em preparação"
      description="O painel único por papel e as consultas do Jira chegam aqui. Enquanto isso, os painéis atuais continuam disponíveis."
      actions={
        <ModalButton variant="primary" asChild>
          <Link href="/squad/dashboards">Abrir os painéis por papel</Link>
        </ModalButton>
      }
    />
  );
}
