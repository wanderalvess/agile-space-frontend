'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { matchesQuery } from '@/hooks/home/derive';
import { CARD, FOCUS_RING, IconTile, SectionHeading } from './home-ui';
import { MODULE_COUNT, MODULE_GROUPS, type HomeModule } from './modules';

function ModuleRow({ module, match }: { module: HomeModule; match: boolean }) {
  return (
    <div className={cn('rounded-xl transition-opacity', match ? 'opacity-100' : 'opacity-30', module.soon && match && 'opacity-70')}>
      <Link
        href={module.href}
        className={cn('flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60', FOCUS_RING)}
      >
        <IconTile icon={module.icon} size="sm" muted />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {module.title}
            {module.soon && (
              <span className="inline-flex h-[18px] items-center rounded-[5px] border border-dashed border-border px-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                Em breve
              </span>
            )}
          </span>
          <span className="text-xs leading-snug text-muted-foreground">{module.description}</span>
        </span>
      </Link>
      {module.links && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-2 pl-[58px]">
          {module.links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className={cn(
                'rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModuleGrid({ query }: { query: string }) {
  const hits = MODULE_GROUPS.flatMap((g) => g.items).filter((m) => matchesQuery(query, m.title, m.description)).length;
  const searching = query.trim().length > 0;

  return (
    <section aria-labelledby="home-modules" className="flex flex-col gap-3.5">
      <SectionHeading id="home-modules" aside={<span aria-live="polite">{searching ? `${hits} encontrado(s)` : `${MODULE_COUNT} módulos`}</span>}>
        Todos os módulos
      </SectionHeading>
      {searching && hits === 0 && <p className="text-sm text-muted-foreground">Nenhum módulo encontrado</p>}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {MODULE_GROUPS.map((group) => (
          <div key={group.id} className={cn(CARD, 'flex flex-col gap-1.5 p-4')}>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
            {group.items.map((m) => (
              <ModuleRow key={m.id} module={m} match={matchesQuery(query, m.title, m.description)} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
