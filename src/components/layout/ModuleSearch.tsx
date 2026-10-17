'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FOCUS_RING } from '@/components/home/home-ui';
import { useUserContext } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { searchModules } from '@/lib/modules-registry';

const MAX_RESULTS = 8;

interface ModuleSearchProps {
  /** Com `onQueryChange` a caixa só filtra (a Home filtra o cartão "Todos os módulos"). Sem ele, navega. */
  query?: string;
  onQueryChange?: (value: string) => void;
  id?: string;
  autoFocus?: boolean;
  /** `inline`: a lista de resultados fica no fluxo da página (dentro de um popover). */
  listPosition?: 'dropdown' | 'inline';
  /** Chamado depois de ir a um módulo (para fechar o popover). */
  onDone?: () => void;
  className?: string;
}

/**
 * Busca de módulo do cabeçalho. Digitar lista os módulos que casam (nome, apelido, descrição; sem acento);
 * Enter abre o primeiro, setas escolhem, Esc fecha. Mesma lista de módulos da Home e dos menus.
 */
export function ModuleSearch({ query, onQueryChange, id, autoFocus, listPosition = 'dropdown', onDone, className }: ModuleSearchProps) {
  const router = useRouter();
  const { userProfile } = useUserContext();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const reactId = useId();
  const inputId = id ?? `module-search-${reactId}`;
  const listId = `${inputId}-list`;
  const filterMode = !!onQueryChange;

  const [inner, setInner] = useState('');
  const value = filterMode ? (query ?? '') : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => (filterMode || !value.trim() ? [] : searchModules(value, isAdmin).slice(0, MAX_RESULTS)), [filterMode, value, isAdmin]);
  const showList = !filterMode && open && value.trim().length > 0;

  // Clique fora fecha a lista.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setInner('');
    router.push(href);
    onDone?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filterMode) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        go(hit.href);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground max-sm:top-[14px]" strokeWidth={1.5} />
      <label htmlFor={inputId} className="sr-only">
        Buscar módulo
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          if (filterMode) onQueryChange?.(e.target.value);
          else {
            setInner(e.target.value);
            setActive(0);
            setOpen(true);
          }
        }}
        onFocus={() => !filterMode && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar módulo"
        autoComplete="off"
        {...(filterMode
          ? {}
          : {
              role: 'combobox',
              'aria-expanded': showList,
              'aria-controls': listId,
              'aria-autocomplete': 'list' as const,
              'aria-activedescendant': showList && results[active] ? `${inputId}-opt-${results[active].key}` : undefined,
            })}
        className={cn(
          'h-10 w-full rounded-[10px] border border-border bg-muted/40 pl-[38px] pr-3 text-sm text-foreground placeholder:text-muted-foreground max-sm:h-11',
          FOCUS_RING,
        )}
      />
      {!filterMode && (
        <div id={listId} role="listbox" aria-label="Módulos encontrados" hidden={!showList} className={cn(
            !showList && 'hidden',
            showList && listPosition === 'dropdown' && 'absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg',
            showList && listPosition === 'inline' && 'mt-2',
          )}>
          {showList && results.length === 0 && <p className="px-3 py-2.5 text-[13px] text-muted-foreground">Nenhum módulo encontrado</p>}
          {showList &&
            results.map((m, i) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  id={`${inputId}-opt-${m.key}`}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(m.href)}
                  className={cn('flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] max-sm:min-h-11', i === active && 'bg-accent text-accent-foreground')}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.label}</span>
                  {m.soon && <span className="text-[11px] text-muted-foreground">Em breve</span>}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/** Versão em botão de ícone (telas médias): abre a mesma busca num popover. */
export function ModuleSearchButton({ query, onQueryChange, className }: Pick<ModuleSearchProps, 'query' | 'onQueryChange' | 'className'>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Buscar módulo"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted/70',
            FOCUS_RING,
            className,
          )}
        >
          <Search aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] max-w-[calc(100vw-2rem)] rounded-xl p-2.5">
        <ModuleSearch
          query={query}
          onQueryChange={onQueryChange}
          autoFocus
          listPosition="inline"
          onDone={() => setOpen(false)}
          id="app-module-search-popover"
        />
      </PopoverContent>
    </Popover>
  );
}
