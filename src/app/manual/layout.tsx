'use client';

import React, { useState } from 'react';
import { ManualSidebar } from './components/ManualSidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { PageHeader, PageShell } from '@/components/page';

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sem documentTitle de propósito: cada tópico define o próprio título (generateMetadata em [topic]/page.tsx).
  return (
    <PageShell feedbackName="Manual" width="wide">
      <PageHeader
        title="Manual"
        module="manual"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Manual' }]}
        subtitle="Como usar cada módulo do Portal Tech V&D, passo a passo."
        actions={
          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-semibold max-sm:min-h-11">
                  <Menu className="h-4 w-4" strokeWidth={1.5} />
                  <span>Tópicos</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 max-w-[85vw] p-0">
                <SheetTitle className="sr-only">Tópicos do manual</SheetTitle>
                <ManualSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      <div className="flex w-full flex-1 items-start gap-6">
        {/* Índice dos tópicos (a partir de 1024 px), colado abaixo do cabeçalho do portal */}
        <div className="sticky top-20 hidden h-[calc(100dvh-6rem)] w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-card lg:block">
          <ManualSidebar className="w-full border-r-0" />
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageShell>
  );
}
