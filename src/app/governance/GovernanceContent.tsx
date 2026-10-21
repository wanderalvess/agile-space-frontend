'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { DataTable, PAGE_CARD, type DataColumn } from '@/components/page';
import { FOCUS_RING, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import {
  DATA_REQUEST_HREF,
  DATA_REQUEST_TEXT,
  DATA_ROWS,
  INTEGRATIONS,
  LIMITATIONS,
  MATRIX_ROWS,
  NEGATIVE_CELLS,
  ROLE_COLUMNS,
  SECTIONS,
  SESSION_CARDS,
  type ContentIcon,
  type DataRow,
  type RoleId,
  type SectionId,
} from './content';

const ICONS: Record<ContentIcon, LucideIcon> = {
  login: LogIn,
  refresh: RefreshCw,
  logout: LogOut,
  key: KeyRound,
  lock: Lock,
  list: ListChecks,
  link: Link2,
  sparkles: Sparkles,
  wrench: Wrench,
  vault: Archive,
};

const SECTION_CLASS = cn(PAGE_CARD, 'flex scroll-mt-24 flex-col gap-4 p-5 sm:p-6');

const DATA_COLUMNS: DataColumn<DataRow>[] = [
  {
    id: 'dado',
    header: 'Dado',
    width: 'minmax(0,1.3fr)',
    primary: true,
    cell: (r) => (
      <span className="flex flex-col gap-0.5">
        <strong className="text-sm font-semibold text-foreground">{r.name}</strong>
        <span className="text-xs text-muted-foreground">{r.detail}</span>
      </span>
    ),
  },
  { id: 'onde', header: 'Onde fica', width: 'minmax(0,0.9fr)', cell: (r) => <span className="text-sm text-muted-foreground">{r.where}</span> },
  { id: 'quem', header: 'Quem vê', width: 'minmax(0,1.7fr)', cell: (r) => <span className="text-sm text-foreground">{r.who}</span> },
  { id: 'tempo', header: 'Por quanto tempo', width: 'minmax(0,1fr)', cell: (r) => <span className="text-sm text-muted-foreground">{r.keep}</span> },
];

function SectionTitle({ id, children, hint }: { id: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-xl font-bold text-foreground">
        {children}
      </h2>
      {hint && <span className="text-[13px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Conteúdo da página "Segurança e dados". `role` destaca a coluna da pessoa na matriz. */
export function GovernanceContent({ role }: { role: RoleId }) {
  const [active, setActive] = useState<SectionId>('sessao');

  // Acompanha a seção que está no topo ao rolar. Sem IntersectionObserver (testes), o clique no índice ainda marca.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace('sec-', '') as SectionId);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (id: SectionId) => {
    setActive(id);
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const roleLabel = ROLE_COLUMNS.find((c) => c.id === role)?.label ?? 'Membro';

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7">
      <nav aria-label="Nesta página" className="flex flex-col gap-0.5 lg:sticky lg:top-[88px]">
        <span className="mb-1.5 px-3 text-xs font-bold tracking-wide text-muted-foreground">Nesta página</span>
        <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={on ? 'true' : undefined}
                  className={cn(
                    'h-10 w-full border-l-2 px-3 text-left text-sm transition-colors duration-base hover:bg-accent max-lg:rounded-lg max-lg:border-l-0 max-lg:whitespace-nowrap',
                    on ? 'border-primary font-bold text-foreground max-lg:bg-accent' : 'border-transparent font-medium text-muted-foreground',
                    FOCUS_RING,
                  )}
                >
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        <section id="sec-sessao" aria-labelledby="h-sessao" className={SECTION_CLASS}>
          <SectionTitle id="h-sessao">Como você entra e como a sessão funciona</SectionTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {SESSION_CARDS.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3.5">
                <IconTile icon={ICONS[c.icon]} size="sm" />
                <strong className="text-sm font-bold text-foreground">{c.title}</strong>
                <span className="text-[13px] leading-relaxed text-muted-foreground">{c.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="sec-guarda" aria-labelledby="h-guarda" className={SECTION_CLASS}>
          <SectionTitle id="h-guarda" hint="Quando não há prazo de guarda definido, a tabela diz isso em vez de inventar.">
            O que o portal guarda
          </SectionTitle>
          <DataTable columns={DATA_COLUMNS} rows={DATA_ROWS} getRowId={(r) => r.id} ariaLabel="Dados que o portal guarda" stickyHeader={false} className="shadow-none" />
        </section>

        <section id="sec-quem" aria-labelledby="h-quem" className={SECTION_CLASS}>
          <SectionTitle id="h-quem" hint={<>Sua coluna: <strong className="font-semibold text-foreground">{roleLabel}</strong></>}>
            Quem pode ver o quê
          </SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">O que cada perfil vê no portal. A coluna do seu perfil está destacada.</caption>
              <thead>
                <tr className="bg-muted">
                  <th scope="col" className="px-3.5 py-2.5 text-left font-bold text-foreground">
                    O quê
                  </th>
                  {ROLE_COLUMNS.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      aria-current={c.id === role ? 'true' : undefined}
                      className={cn('w-[22%] px-3.5 py-2.5 text-left font-bold', c.id === role ? 'bg-primary/10 text-foreground dark:bg-primary/15' : 'text-foreground')}
                    >
                      {c.label}
                      {c.id === role && <span className="ml-2 align-middle"><StatusChip tone="brand">Você</StatusChip></span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <th scope="row" className="px-3.5 py-2.5 text-left font-semibold text-foreground">
                      {r.what}
                    </th>
                    {ROLE_COLUMNS.map((c) => {
                      const text = r.cells[c.id];
                      return (
                        <td
                          key={c.id}
                          className={cn('px-3.5 py-2.5 align-top', c.id === role && 'bg-primary/10 dark:bg-primary/15', NEGATIVE_CELLS.has(text) ? 'text-muted-foreground' : 'text-foreground')}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="sec-integ" aria-labelledby="h-integ" className={SECTION_CLASS}>
          <SectionTitle id="h-integ" hint="Nada sai sem você usar a ferramenta.">
            Integrações e dados que saem do portal
          </SectionTitle>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.map((i) => (
              <li key={i.id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/40 p-4">
                <span className="flex items-center gap-2.5">
                  <IconTile icon={ICONS[i.icon]} size="sm" />
                  <strong className="text-[15px] font-bold text-foreground">{i.title}</strong>
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">O que sai</span>
                  <span className="text-sm leading-snug text-foreground">{i.out}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Quando</span>
                  <span className="text-sm leading-snug text-foreground">{i.when}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
          <section id="sec-lim" aria-labelledby="h-lim" className={SECTION_CLASS}>
            <SectionTitle id="h-lim">Limitações conhecidas</SectionTitle>
            <ul className="flex flex-col gap-2.5">
              {LIMITATIONS.map((l) => (
                <li key={l.id} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                  <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} />
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="sec-seus" aria-labelledby="h-seus" className={SECTION_CLASS}>
            <SectionTitle id="h-seus">Seus dados</SectionTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">{DATA_REQUEST_TEXT}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <ModalButton variant="primary" asChild>
                <Link href={DATA_REQUEST_HREF}>Pedir exportação ou exclusão</Link>
              </ModalButton>
              <span className="text-xs text-muted-foreground">Abre o Suporte com o tipo já escolhido.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
