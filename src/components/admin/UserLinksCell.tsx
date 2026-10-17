'use client';

import { Link2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { linkText, linksView, type SquadLink } from './user-admin';

/** `undefined` = ainda não pedido, `'loading'` = em voo, `null` = falhou, lista = carregado (pode ser vazia). */
export type UserLinksState = SquadLink[] | null | 'loading' | undefined;

const CHIP = 'inline-flex h-[22px] max-w-full items-center gap-1 truncate rounded-full border border-border px-2.5 text-xs font-semibold';

/**
 * Coluna "Squad" da lista: os vínculos reais (squad × papel). A API de usuários só devolve a squad ativa, então
 * os vínculos são pedidos sob demanda (ao passar o mouse, focar ou abrir) e guardados; nada de uma chamada por linha ao carregar.
 */
export function UserLinksCell({
  name,
  activeSquadId,
  state,
  onLoad,
}: {
  name: string;
  activeSquadId?: string | null;
  state: UserLinksState;
  onLoad: () => void;
}) {
  const view = Array.isArray(state) ? linksView(state) : null;
  const loaded = Array.isArray(state);

  const label = (() => {
    if (state === 'loading') return 'Carregando…';
    if (state === null) return 'Tentar de novo';
    if (loaded && !view) return 'Sem vínculo';
    if (view) return linkText(view.primary);
    return 'Ver vínculos';
  })();

  return (
    <Popover onOpenChange={(open) => { if (open && (state === undefined || state === null)) onLoad(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Vínculos de ${name}`}
          onMouseEnter={() => { if (state === undefined) onLoad(); }}
          onFocus={() => { if (state === undefined) onLoad(); }}
          className={cn(
            'flex min-w-0 max-w-full items-center gap-1 rounded-full text-left hover:opacity-80 max-sm:min-h-11',
            FOCUS_RING,
          )}
        >
          <span className={cn(CHIP, state === null ? TONES.danger.text : 'text-muted-foreground', view && 'text-foreground')}>
            {!view && <Link2 className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />}
            <span className="truncate">{label}</span>
          </span>
          {view && view.extra > 0 && (
            <span className={cn(CHIP, 'shrink-0 bg-muted text-muted-foreground')}>+{view.extra}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="mb-2 text-xs font-bold text-muted-foreground">Vínculos com squads</p>
        {state === 'loading' || state === undefined ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : state === null ? (
          <p role="alert" className={cn('text-sm', TONES.danger.text)}>Não foi possível carregar os vínculos.</p>
        ) : view ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {view.all.map((l) => (
              <li key={`${l.squadId}-${l.role ?? ''}`} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-semibold text-foreground">{l.squadId}</span>
                {l.role ? <span className="text-muted-foreground">· {l.role}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {activeSquadId ? `Sem vínculo. Squad ativa da conta: ${activeSquadId}.` : 'Sem vínculo com nenhuma squad.'}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
