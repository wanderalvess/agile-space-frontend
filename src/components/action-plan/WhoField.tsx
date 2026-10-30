'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { FIELD } from '@/components/room-kit';
import { suggestPeople, type PlanPerson } from '@/lib/action-plan';
import { cn } from '@/lib/utils';

export interface WhoFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Pessoas da squad do plano. Vazio (ou falha ao carregar): vira um campo de texto simples. */
  people: readonly PlanPerson[];
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Campo "Quem": texto livre com sugestões da squad. Escolher uma sugestão escreve o nome da pessoa; digitar
 * outro nome continua valendo (o servidor só avisa quem consegue achar na squad).
 */
export function WhoField({ id, value, onChange, people, placeholder, invalid, describedBy }: WhoFieldProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const suggestions = suggestPeople(people, value);
  const showList = open && suggestions.length > 0;

  // Fecha ao clicar fora (o foco sai do campo antes do clique na sugestão, então o clique usa onMouseDown).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (person: PlanPerson) => {
    onChange(person.name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(suggestions[Math.min(active, suggestions.length - 1)]);
          } else if (e.key === 'Escape') {
            // fecha só a lista; o Esc não chega ao modal
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${Math.min(active, suggestions.length - 1)}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(FIELD, 'h-11', invalid && 'border-red-500/70')}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Pessoas da squad"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {suggestions.map((p, i) => (
            <li
              key={`${p.userId ?? p.email ?? p.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm', i === active && 'bg-accent text-accent-foreground')}
            >
              <InitialsAvatar name={p.name} email={p.email} userId={p.userId} className="h-6 w-6 text-xs" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.email && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{p.email}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
