'use client';

import * as React from 'react';
import { Check, Crown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ROLE_STYLES, roleToneOf } from './tokens';

export function PersonAvatar({
  name,
  userId,
  size = 'md',
  highlight = false,
  className,
}: {
  name: string;
  /** Id da conta: com ele aparece a foto que a pessoa enviou (senão, iniciais). */
  userId?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Anel de destaque (a própria pessoa). */
  highlight?: boolean;
  className?: string;
}) {
  const box = size === 'sm' ? 'h-6 w-6 text-xs' : size === 'lg' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-xs';
  return (
    <InitialsAvatar
      name={name}
      userId={userId}
      className={cn(box, highlight && 'ring-2 ring-primary ring-offset-2 ring-offset-card', className)}
    />
  );
}

export type PresenceStatus = 'thinking' | 'voted' | 'away' | 'spectator' | 'observer' | 'idle';

/** Indicador de estado de uma pessoa: pensando, votou, ausente, espectador ou observando (gestão que não vota). */
export function PresenceIndicator({ status, label }: { status: PresenceStatus; label?: string }) {
  const text =
    label ??
    (status === 'voted' ? 'Votou' : status === 'thinking' ? 'Pensando' : status === 'away' ? 'Ausente' : status === 'spectator' ? 'Espectador' : status === 'observer' ? 'Observando' : '');
  if (status === 'idle') return null;
  return (
    <span title={text} role="img" aria-label={text} className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
      {status === 'voted' && (
        <span className="room-pop flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      )}
      {status === 'thinking' && (
        <span className="flex items-center gap-[3px]">
          <span className="room-dot-1 h-1 w-1 rounded-full bg-primary" />
          <span className="room-dot-2 h-1 w-1 rounded-full bg-primary" />
          <span className="room-dot-3 h-1 w-1 rounded-full bg-primary" />
        </span>
      )}
      {status === 'away' && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
      {(status === 'spectator' || status === 'observer') && <Eye className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />}
    </span>
  );
}

export interface PresenceItem {
  id: string;
  /** Id da CONTA, quando difere de `id` (ex.: voto de quem saiu, cujo item tem id sintético). Padrão: `id`. */
  userId?: string;
  name: string;
  /** Texto do papel exibido ao lado do nome ("DEV", "QA", "PO · facilitadora"). */
  roleLabel: string;
  /** Categoria técnica para agrupar/colorir (Developer, QA, UX, Designer, Management, null). */
  category?: string | null;
  /** Online agora. Sem o campo (`undefined`) a sala não sabe: sem ponto de presença e sem "ausente". */
  online?: boolean;
  status?: PresenceStatus;
  /** Texto do estado (dica e leitor de tela) quando precisa dizer mais que o padrão, ex.: "Observando · cargo não vota nesta sala". */
  statusLabel?: string;
  isYou?: boolean;
  isHost?: boolean;
  /** Voto de quem já saiu da sala: aparece esmaecido, sem ações. */
  ghost?: boolean;
}

export interface PresenceGroup {
  id: string;
  label: string;
  items: PresenceItem[];
}

/** Agrupa por categoria na ordem dada; o que não casa cai em "Outros". */
export function groupPresence(
  items: PresenceItem[],
  order: readonly { id: string; label: string }[],
  fallback: { id: string; label: string } = { id: 'outros', label: 'Outros' }
): PresenceGroup[] {
  const buckets = new Map<string, PresenceItem[]>();
  const known = new Set(order.map((o) => o.id));
  for (const it of items) {
    const key = it.category && known.has(it.category) ? it.category : fallback.id;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(it);
  }
  const groups: PresenceGroup[] = [];
  for (const o of order) {
    const list = buckets.get(o.id);
    if (list?.length) groups.push({ id: o.id, label: o.label, items: list });
  }
  const rest = buckets.get(fallback.id);
  if (rest?.length) groups.push({ id: fallback.id, label: fallback.label, items: rest });
  return groups;
}

export interface PresenceListProps {
  items: PresenceItem[];
  /** Agrupa por papel (ordem e rótulos dados). Sem isso, lista única. */
  groupOrder?: readonly { id: string; label: string }[];
  /** Grupo de quem não casa com nenhuma categoria. Padrão: "Outros". */
  fallbackGroup?: { id: string; label: string };
  renderActions?: (item: PresenceItem) => React.ReactNode;
  emptyLabel?: string;
  className?: string;
}

/**
 * Lista de presença: avatar, nome, papel, online/ausente e estado (pensando,
 * votou, espectador, organizador). Agrupada por papel quando `groupOrder` vem.
 */
export function PresenceList({ items, groupOrder, fallbackGroup, renderActions, emptyLabel = 'Ninguém na sala ainda', className }: PresenceListProps) {
  const groups = groupOrder ? groupPresence(items, groupOrder, fallbackGroup) : [{ id: 'all', label: '', items }];

  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-4', className)}>
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label || 'Participantes'} className="flex flex-col gap-0.5">
          {g.label && (
            <h3 className="flex items-center gap-2 px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
              {g.label}
              <span className="tabular-nums text-muted-foreground">{g.items.length}</span>
            </h3>
          )}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {g.items.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'group flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors duration-fast hover:bg-accent/60',
                  p.ghost && 'opacity-60'
                )}
              >
                <span className="relative">
                  <PersonAvatar name={p.name} userId={p.userId ?? p.id} highlight={p.isYou} />
                  {p.online !== undefined && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card',
                        p.online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                      )}
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <span className="truncate">{p.name}</span>
                    {p.isYou && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
                    {p.isHost && <Crown aria-label="Organizador" className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={1.5} />}
                  </span>
                  <span className={cn('truncate text-xs font-semibold', ROLE_STYLES[roleToneOf(p.category)].text)}>
                    {p.roleLabel}
                    {p.online === false && !p.ghost && <span className="font-normal text-muted-foreground"> · ausente</span>}
                    {p.ghost && <span className="font-normal text-muted-foreground"> · saiu da sala</span>}
                  </span>
                </span>
                {p.status && <PresenceIndicator status={p.status} label={p.statusLabel} />}
                {renderActions?.(p)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
