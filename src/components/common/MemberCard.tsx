'use client';

import React from 'react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
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
        'flex items-center justify-between p-2.5 rounded-xl transition-all group relative overflow-hidden w-full',
        isYou
          ? 'bg-primary/10 ring-1 ring-primary/30'
          : 'hover:bg-muted border border-transparent hover:border-border',
        status === 'offline' && 'opacity-50 grayscale',
        className
      )}
      title={status === 'offline' ? 'Offline (sem sinal há mais de 1 min)' : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
        <div className="relative shrink-0">
          <InitialsAvatar
            name={nickname}
            src={avatarUrl}
            className={cn('h-8 w-8 text-xs shadow-sm', isYou && 'ring-2 ring-primary/40')}
          />
          {status === 'online' ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
          ) : (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-muted-foreground border-2 border-card" />
          )}
        </div>
        
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "font-semibold text-xs truncate inline-block leading-none shrink min-w-0 max-w-[120px]",
              isYou ? "text-primary" : "text-foreground"
            )}>
              {nickname}
            </span>
            {isYou && <span className="text-xs font-medium text-muted-foreground shrink-0">(Eu)</span>}
          </div>
          <Badge variant="secondary" className="w-fit max-w-[100px] h-5 px-1.5 text-xs font-semibold bg-muted text-muted-foreground border-none shadow-none mt-0.5 truncate inline-block">
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
              <TooltipContent className="text-xs font-semibold"><p>Facilitador da Sala</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {actions}
      </div>
    </div>
  );
}
