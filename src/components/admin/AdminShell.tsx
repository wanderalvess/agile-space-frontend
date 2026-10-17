'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { PAGE_CARD, PageHeader, PageShell } from '@/components/page';
import { StatusChip } from '@/components/room-kit';
import { BRAND_TEXT, BRAND_TINT, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { ADMIN_TAB_GROUPS, adminTabHref, type AdminTab } from './admin-tabs';
import { navCount, navCountLabel, type AdminCounts } from './admin-counts';

function AdminNav({ active, counts, onNavigate }: { active: AdminTab; counts: AdminCounts; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-3.5">
      {ADMIN_TAB_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5" role="group" aria-label={group.label}>
          <span className="px-2.5 pb-1 text-xs font-bold text-muted-foreground">{group.label}</span>
          {group.tabs.map((tab) => {
            const on = tab.id === active.id;
            const n = navCount(tab.id, counts);
            return (
              <Link
                key={tab.id}
                href={adminTabHref(tab.id)}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm transition-colors duration-fast max-lg:min-h-11',
                  FOCUS_RING,
                  on ? cn(BRAND_TINT, BRAND_TEXT, 'font-bold') : 'text-foreground hover:bg-accent',
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                {n !== null && (
                  <span
                    aria-label={navCountLabel(tab.id, n)}
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-bold tabular-nums text-amber-800 dark:text-amber-300"
                  >
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Casca da Administração: cabeçalho do portal (PageShell), barra lateral com as 14 abas em 6 grupos
 * (cada aba tem endereço próprio) e o conteúdo da aba. Abaixo de 1024 px a barra vira um botão "seção".
 */
export function AdminShell({ active, counts, children }: { active: AdminTab; counts: AdminCounts; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ActiveIcon = active.icon;

  return (
    <PageShell documentTitle={`${active.label} · Administração`} feedbackName="Administração">
      <PageHeader
        title="Administração"
        module="admin"
        badges={<StatusChip>Administrador</StatusChip>}
        breadcrumb={[{ label: 'Início', href: '/' }, { label: 'Administração' }]}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[244px_minmax(0,1fr)] lg:gap-6">
        <aside aria-label="Seções da Administração" className="flex flex-col gap-2 lg:sticky lg:top-[81px]">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(PAGE_CARD, 'flex h-11 w-full items-center gap-2.5 px-3.5 text-sm font-semibold lg:hidden', FOCUS_RING)}
          >
            <ActiveIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1 truncate text-left">{active.label}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', menuOpen && 'rotate-180')} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <nav id="admin-nav" aria-label="Abas da Administração" className={cn(PAGE_CARD, 'p-3', menuOpen ? 'block' : 'hidden', 'lg:block')}>
            <AdminNav active={active} counts={counts} onNavigate={() => setMenuOpen(false)} />
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </PageShell>
  );
}
