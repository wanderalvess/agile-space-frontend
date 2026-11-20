'use client';

import Link from 'next/link';
import { Activity, ArrowRight, Compass, ListChecks, Users } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { SidePanelSection } from '@/components/page';
import { ModuleIcon } from '@/components/brand/ModuleIcon';
import { getModule, moduleLabel, type ModuleKey } from '@/lib/modules-registry';
import type { AttentionItem, AttentionTone } from '@/lib/squad-summary';
import type { TeamPerson } from '@/lib/team-people';
import type { SquadIssueSnapshot } from '@/lib/types';
import { cn } from '@/lib/utils';
import { timeAgo } from './SprintCard';

const LINK = 'rounded-md text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground max-sm:min-h-11';

const DOT: Record<AttentionTone, string> = {
  danger: 'bg-rose-500',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
};

/** "Precisa de atenção": atrasos, itens parados, sprint sem sincronizar e time sem pessoas. */
export function AttentionSection({ items, onSync }: { items: AttentionItem[]; onSync: () => void }) {
  return (
    <SidePanelSection title="Precisa de atenção" icon={ListChecks}>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nada pede atenção agora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[a.tone])} aria-hidden="true" />
              <p className="text-[13px] leading-snug text-foreground">
                {a.text}{' '}
                {a.actionLabel &&
                  (a.href ? (
                    <Link href={a.href} className={LINK}>
                      {a.actionLabel}
                    </Link>
                  ) : a.action === 'sync' ? (
                    <button type="button" onClick={onSync} className={LINK}>
                      {a.actionLabel}
                    </button>
                  ) : null)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SidePanelSection>
  );
}

/** "Seu time": até 4 avatares, a contagem de pessoas e o seu papel. */
export function TeamSection({
  people,
  myRole,
  avatarFor,
  canOpenPeople,
}: {
  people: TeamPerson[];
  myRole: string;
  avatarFor: (q: { email?: string; name?: string; accountId?: string }) => string | undefined;
  canOpenPeople: boolean;
}) {
  return (
    <SidePanelSection title="Seu time" icon={Users}>
      {people.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma pessoa cadastrada na squad ainda.</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {people.slice(0, 4).map((m) => (
              <InitialsAvatar
                key={m.key}
                name={m.displayName}
                userId={m.userId}
                title={m.displayName}
                src={m.avatarUrl || avatarFor({ email: m.email, name: m.displayName, accountId: m.jiraAccountId })}
                className="-ml-2 h-8 w-8 border-2 border-card first:ml-0"
              />
            ))}
            {people.length > 4 && (
              <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
                +{people.length - 4}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            {people.length} {people.length === 1 ? 'pessoa' : 'pessoas'}
            {myRole ? (
              <>
                {' '}· você é <strong className="font-semibold text-foreground">{myRole}</strong>
              </>
            ) : null}
          </p>
        </div>
      )}
      {canOpenPeople && (
        <Link href="/squad/roster" className={cn(LINK, 'inline-flex items-center gap-1 self-start')}>
          Gestão do time <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}
    </SidePanelSection>
  );
}

/** "Últimos movimentos": as 5 issues mexidas mais recentemente. */
export function MovementsSection({
  items,
  avatarFor,
}: {
  items: SquadIssueSnapshot[];
  avatarFor: (q: { email?: string; name?: string; accountId?: string }) => string | undefined;
}) {
  return (
    <SidePanelSection title="Últimos movimentos" icon={Activity}>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex min-w-0 gap-2.5">
            <InitialsAvatar
              name={item.assigneeName}
              title={item.assigneeName || undefined}
              src={avatarFor({ name: item.assigneeName, accountId: item.assigneeId })}
              className="h-8 w-8"
            />
            <p className="min-w-0 text-[13px] leading-snug text-muted-foreground">
              <strong className="font-semibold text-foreground">{item.assigneeName || 'Sem responsável'}</strong> · {item.key} em{' '}
              <span className="font-medium text-foreground">{item.status}</span>
              <span className="block text-xs text-muted-foreground">{timeAgo(item.updatedAtJira)}</span>
            </p>
          </li>
        ))}
      </ul>
    </SidePanelSection>
  );
}

/** Atalhos das cerimônias e ferramentas da squad (nomes e ícones do registro de módulos). */
const EXPLORE: ModuleKey[] = ['poker', 'retro', 'showcase', 'health', 'brainstorming', 'action-plan'];

export function ExploreSection() {
  const planner = getModule('sprint-planner');
  return (
    <SidePanelSection title="Explorar o Portal Tech V&D" icon={Compass}>
      <div className="grid grid-cols-2 gap-2">
        {EXPLORE.map((key) => (
          <Link
            key={key}
            href={getModule(key).href}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ModuleIcon module={key} className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{moduleLabel(key)}</span>
          </Link>
        ))}
        <span
          className="col-span-2 flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-[13px] text-muted-foreground"
          aria-label={`${planner.label}, em breve`}
        >
          <ModuleIcon module="sprint-planner" className="h-4 w-4 shrink-0" />
          <span className="truncate">{planner.label}</span>
          <span className="ml-auto rounded-full border border-amber-500/50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Em breve</span>
        </span>
      </div>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ir para home e ver tudo <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </SidePanelSection>
  );
}
