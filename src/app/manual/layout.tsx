'use client';

import React, { useState } from 'react';
import { ManualSidebar } from './components/ManualSidebar';
import { Button } from '@/components/ui/button';
import { BookOpen, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Footer } from '@/components/layout/Footer';
import { FeedbackWidget } from '@/components/feedback-widget';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  return (
    <div className="h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-body selection:bg-primary/30">
      {/* ROOM HEADER (Standard across Agile Space) */}
      <RoomHeader
        title="Manual de Engenharia & Agilidade"
        toolIcon={<BookOpen className="h-4 w-4" />}
        toolColorClass="text-primary"
        badge={<Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">GUIA TÁTICO</Badge>}
        onOpenFeedback={() => setFeedbackSignal(Date.now())}
        actions={
          <div className="lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-xl gap-1.5 font-bold text-xs">
                  <Menu className="h-3.5 w-3.5" />
                  <span>Tópicos</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 max-w-[85vw]">
                <ManualSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      {/* Main Container: Sidebar + Scrollable Viewport */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden">
        {/* Desktop Fixed Sidebar */}
        <div className="hidden lg:flex w-72 shrink-0 h-full border-r border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex-col">
          <ManualSidebar />
        </div>

        {/* Scrollable Document Area (Only one scrollbar) */}
        <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="p-6 md:p-8 lg:p-10 w-full max-w-[1700px] mx-auto min-w-0">
            {children}
          </div>
          <Footer className="mt-12 shrink-0" onOpenFeedback={() => setFeedbackSignal(Date.now())} />
        </main>
      </div>

      <FeedbackWidget toolName="Portal Tech V&D - Manual" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
