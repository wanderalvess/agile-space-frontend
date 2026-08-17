'use client';

import React from 'react';
import { DevToolsSidebar } from '@/components/devtools/DevToolsSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function DevToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-dvh lg:h-dvh w-full bg-background overflow-y-auto lg:overflow-hidden relative">
        <DevToolsSidebar />
        <SidebarInset className="flex-1 flex flex-col lg:overflow-hidden bg-muted/10 relative">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
