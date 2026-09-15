'use client';

import React, { useState } from 'react';
import { ManualSidebar } from './components/ManualSidebar';
import { Button } from '@/components/ui/button';
import { Menu, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Footer } from '@/components/layout/Footer';
import { FeedbackWidget } from '@/components/feedback-widget';

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Mobile Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl gap-2 font-bold text-xs">
              <Menu className="h-4 w-4" />
              <span>Navegação</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 max-w-[85vw]">
            <ManualSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Sair</span>
        </Link>
      </div>

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto">
        {/* Desktop Fixed Sidebar */}
        <div className="hidden lg:block sticky top-0 h-screen shrink-0">
          <ManualSidebar />
        </div>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-10 lg:p-12 max-w-6xl w-full min-w-0">
          {children}
        </main>
      </div>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Manual" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
