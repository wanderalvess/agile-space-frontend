'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MemberCardProps {
  nickname: string;
  avatarUrl?: string;
  role: string;
  isYou?: boolean;
  isFacilitator?: boolean;
  status?: 'online' | 'offline';
  actions?: React.ReactNode;
  indicator?: React.ReactNode;
  className?: string;
}

export function MemberCard({
  nickname,
  avatarUrl,
  role,
  isYou = false,
  isFacilitator = false,
  status = 'online',
  actions,
  indicator,
  className
}: MemberCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-2.5 rounded-[1.2rem] transition-all group relative overflow-hidden w-full',
        isYou
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500/20 dark:ring-indigo-500/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-800/60',
        status === 'offline' && 'opacity-50 grayscale',
        className
      )}
      title={status === 'offline' ? 'Offline (sem sinal há mais de 1 min)' : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8 text-[9px] shrink-0 shadow-sm border border-white">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={nickname} />}
            <AvatarFallback className={cn(isYou ? "bg-indigo-600 text-white font-black" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold")}>
              {nickname.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {status === 'online' ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
          ) : (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900" />
          )}
        </div>
        
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "font-bold text-[11px] truncate inline-block leading-none tracking-tight shrink min-w-0 max-w-[120px]",
              isYou ? "text-indigo-900 dark:text-indigo-200" : "text-slate-800 dark:text-slate-200"
            )}>
              {nickname}
            </span>
            {isYou && <span className="text-[8px] font-medium text-indigo-400/80 uppercase tracking-widest shrink-0">(Eu)</span>}
          </div>
          <Badge variant="secondary" className="w-fit max-w-[100px] h-[16px] px-1.5 text-[7px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none tracking-widest shadow-none mt-0.5 truncate inline-block">
            {role}
          </Badge>
        </div>
      </div>

      <div className="flex items-center shrink-0 gap-2 ml-2">
        {indicator}
        
        {isFacilitator && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1.5 bg-amber-500/10 rounded-xl">
                  <Crown className="h-3.5 w-3.5 text-amber-600 fill-amber-500/10" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none rounded-lg p-2 text-[10px] font-black uppercase tracking-widest"><p>Facilitador da Sala</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {actions}
      </div>
    </div>
  );
}
