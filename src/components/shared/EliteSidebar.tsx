"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, PanelRightClose, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EliteSidebarProps {
  children: React.ReactNode;
  participantsCount: number;
  isOpen: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  isTheaterMode?: boolean;
  title?: string;
  badgeContent?: React.ReactNode;
  footerAction?: React.ReactNode;
}

export function EliteSidebar({
  children,
  participantsCount,
  isOpen,
  onClose,
  onCopyLink,
  isTheaterMode = false,
  title = "Time Ativo",
  badgeContent,
  footerAction
}: EliteSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-l shadow-2xl bg-card transition-all duration-300 ease-in-out overflow-hidden relative",
        isOpen && !isTheaterMode ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
      )}
    >
      <div className="w-72 flex flex-col h-full shrink-0">
        <header className='p-4 border-b shrink-0 flex items-center justify-between'>
          <div className="flex items-center gap-3">
            <Users className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-xs font-black tracking-widest uppercase">{title}</h2>
            <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-0.5 rounded-full">
              {badgeContent || participantsCount}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </header>
        
        <div className='p-0 bg-muted/5 flex-1 flex flex-col min-h-0'>
          {children}
        </div>
        
        <div className="p-4 border-t space-y-3 shrink-0 bg-card">
          {footerAction || (
            <Button 
              variant="link" 
              size="sm" 
              onClick={onCopyLink} 
              className="w-full text-[9px] font-black uppercase text-primary hover:no-underline tracking-widest"
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              Convidar Time
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
