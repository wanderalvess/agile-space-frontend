'use client';

import Link from 'next/link';
import { LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './home-ui';

/** Menu da conta: Meu perfil, Configurações, Administração (só admin) e Sair. */
export function ProfileMenu() {
  const { userProfile, logout, setIsEditProfileOpen, requestIdentity } = useUserContext();
  const { session } = useAuth();

  if (!userProfile) {
    return (
      <button
        type="button"
        onClick={() => requestIdentity()}
        className={cn('h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground', FOCUS_RING)}
      >
        Entrar
      </button>
    );
  }

  const isAdmin = userProfile.role?.toLowerCase() === 'admin';
  const roleLabel = session?.activeProjectRole || (isAdmin ? 'Administrador' : '');
  const first = userProfile.name?.trim().split(/\s+/)[0] || 'Conta';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu do perfil"
          className={cn(
            'flex h-10 items-center gap-2.5 rounded-full border border-border py-0 pl-1 pr-2.5 text-foreground transition-colors hover:bg-muted/60 data-[state=open]:border-primary',
            FOCUS_RING,
          )}
        >
          <ProfileAvatar className="h-8 w-8 shrink-0 rounded-full bg-muted" />
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-[13px] font-semibold">{first}</span>
            {roleLabel && <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">{roleLabel}</span>}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
        <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)} className="cursor-pointer gap-2 rounded-lg py-2 text-[13px]">
          <User className="h-4 w-4" strokeWidth={1.5} />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-lg py-2 text-[13px]">
          <Link href="/configuracoes">
            <Settings className="h-4 w-4" strokeWidth={1.5} />
            Configurações
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-lg py-2 text-[13px]">
            <Link href="/admin">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
              Administração
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer gap-2 rounded-lg py-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
