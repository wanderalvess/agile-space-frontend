'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CalendarClock, ChevronDown, Menu } from 'lucide-react';
import { BrandWordmark } from '@/components/layout/BrandWordmark';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ModuleSearch, ModuleSearchButton } from '@/components/layout/ModuleSearch';
import { useSquadSwitcher } from '@/components/layout/useSquadSwitcher';
import { FOCUS_RING } from '@/components/home/home-ui';
import { NotificationCenter } from '@/components/home/NotificationCenter';
import { ProfileMenu } from '@/components/home/ProfileMenu';
import { SquadSwitcher } from '@/components/home/SquadSwitcher';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useUserContext } from '@/context/UserContext';
import type { SquadSummary } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import {
  MODULE_GROUP_LABELS,
  RITUAL_MODULE_KEYS,
  getModule,
  primaryNavFor,
  type ModuleKey,
  type PrimaryNavKey,
} from '@/lib/modules-registry';

/** Controle de squad vindo de fora (a Home tem o escopo "Todas as squads" e o resumo de sprint). */
export interface AppHeaderSquadControl {
  squads: SquadSummary[];
  /** null = todas as squads (só com `allowAll`). */
  scope: string | null;
  isMulti: boolean;
  switchingTo: string | null;
  onPick: (squadId: string | null) => void;
  allowAll?: boolean;
}

export interface AppHeaderProps {
  /**
   * Substitui o controle de squad padrão (que lê a sessão e troca a squad ativa). Só a Home precisa disso.
   * Use `squadControl={null}` em páginas sem contexto de squad para esconder o rótulo e o seletor.
   */
  squadControl?: AppHeaderSquadControl | null;
  /** Com `search`, a caixa só filtra a página (Home). Sem ele, a busca abre o módulo escolhido. */
  search?: { query: string; onQueryChange: (value: string) => void };
  /** Fixa o cabeçalho no topo ao rolar (padrão: sim, a partir de 1024 px). */
  sticky?: boolean;
  className?: string;
}

const NAV_ITEM =
  'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground';

function NavLink({ moduleKey, active, label, className }: { moduleKey: ModuleKey; active: boolean; label?: string; className?: string }) {
  const m = getModule(moduleKey);
  const Icon = m.icon;
  return (
    <Link href={m.href} aria-current={active ? 'page' : undefined} className={cn(NAV_ITEM, FOCUS_RING, className)}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {label ?? m.label}
    </Link>
  );
}

function RitualsMenu({ active }: { active: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-current={active ? 'page' : undefined} className={cn(NAV_ITEM, FOCUS_RING)}>
          <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Rituais
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5">
        {RITUAL_MODULE_KEYS.map((key) => {
          const m = getModule(key);
          const Icon = m.icon;
          return (
            <DropdownMenuItem key={key} asChild className="cursor-pointer gap-2.5 rounded-lg py-2 text-[13px]">
              <Link href={m.href}>
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                {m.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SHEET_LINK =
  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 aria-[current=page]:bg-muted';
const SHEET_GROUP = 'mt-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground';

/** Menu das telas estreitas (< 1024 px): a mesma navegação do cabeçalho, em alvos de 44 px. */
function MobileNav({ active, isAdmin }: { active: PrimaryNavKey | null; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const link = (key: ModuleKey, current: boolean) => {
    const m = getModule(key);
    const Icon = m.icon;
    return (
      <SheetClose asChild key={key}>
        <Link href={m.href} aria-current={current ? 'page' : undefined} className={cn(SHEET_LINK, FOCUS_RING)}>
          <Icon aria-hidden="true" className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.5} />
          {m.label}
        </Link>
      </SheetClose>
    );
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors hover:bg-muted/60 max-sm:h-11 max-sm:w-11 lg:hidden',
            FOCUS_RING,
          )}
        >
          <Menu aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(320px,86vw)] flex-col gap-4 overflow-y-auto p-4">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">
            <BrandWordmark />
          </SheetTitle>
          <SheetDescription className="sr-only">Navegação principal do portal</SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu principal" className="flex flex-col gap-1">
          {link('home', active === 'home')}
          {link('squad', active === 'squad')}
          {link('workspace', active === 'workspace')}
          <p className={SHEET_GROUP}>{MODULE_GROUP_LABELS.rituais}</p>
          {RITUAL_MODULE_KEYS.map((key) => link(key, false))}
          {isAdmin && (
            <>
              <p className={SHEET_GROUP}>{MODULE_GROUP_LABELS.conta}</p>
              {link('admin', active === 'admin')}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Cabeçalho padrão de toda página que não é sala. Marca em texto, navegação curta (Home, Squad, Meu espaço,
 * Rituais, Admin só para admin), seletor da squad ativa (só com 2+ vínculos), busca de módulo, sino, tema e
 * menu da conta. A squad ativa é trocada aqui e em mais nenhum lugar, e o nome dela não se repete no resto do
 * cabeçalho. Salas ao vivo continuam com o `RoomTopBar`.
 */
export function AppHeader({ squadControl, search, sticky = true, className }: AppHeaderProps) {
  const pathname = usePathname();
  const { userProfile } = useUserContext();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const own = useSquadSwitcher();
  const active = primaryNavFor(pathname ?? '/');

  const control: AppHeaderSquadControl | null =
    squadControl === undefined
      ? { squads: own.squads, scope: own.activeId ?? null, isMulti: own.isMulti, switchingTo: own.switchingTo, onPick: own.pick, allowAll: false }
      : squadControl;

  return (
    <header
      className={cn(
        'z-40 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80',
        sticky && 'lg:sticky lg:top-0',
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-8 2xl:px-12">
        <Link href="/" aria-label="Portal Tech V&D, página inicial" className={cn('order-1 rounded-md', FOCUS_RING)}>
          <BrandWordmark className="max-[1359px]:[&>span:last-child]:hidden" />
        </Link>

        <nav aria-label="Principal" className="order-2 hidden items-center gap-0.5 lg:flex">
          {/* De 1024 a 1279 px o logo já leva à Home e o espaço é curto: o item Home só aparece a partir de 1280. */}
          <NavLink moduleKey="home" active={active === 'home'} className="lg:max-xl:hidden" />
          <NavLink moduleKey="squad" active={active === 'squad'} />
          <NavLink moduleKey="workspace" active={active === 'workspace'} />
          <RitualsMenu active={active === 'rituais'} />
          {isAdmin && <NavLink moduleKey="admin" active={active === 'admin'} label="Admin" />}
        </nav>

        {control && control.squads.length > 0 && (
          <div className="order-4 lg:order-3">
            <SquadSwitcher
              squads={control.squads}
              scope={control.scope}
              isMulti={control.isMulti}
              switchingTo={control.switchingTo}
              onPick={control.onPick}
              allowAll={control.allowAll}
            />
          </div>
        )}

        {/* Telas estreitas: a busca ocupa a linha de baixo, ao lado da squad. */}
        <div className="order-5 min-w-0 flex-1 lg:hidden">
          <ModuleSearch query={search?.query} onQueryChange={search?.onQueryChange} id="app-module-search-narrow" />
        </div>
        {/* 1360 px ou mais: a busca fica inteira no cabeçalho; de 1024 a 1359 vira o botão de lupa. */}
        <div className="order-4 mx-auto hidden w-full min-w-0 max-w-[380px] flex-1 min-[1360px]:block">
          <ModuleSearch query={search?.query} onQueryChange={search?.onQueryChange} id="app-module-search" />
        </div>

        <div className="order-3 ml-auto flex items-center gap-2.5 lg:order-5">
          <div className="hidden lg:block min-[1360px]:hidden">
            <ModuleSearchButton query={search?.query} onQueryChange={search?.onQueryChange} />
          </div>
          <NotificationCenter />
          <ThemeToggle className="h-10 w-10 rounded-[10px] max-sm:h-11 max-sm:w-11" />
          <ProfileMenu compact />
          <MobileNav active={active} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
