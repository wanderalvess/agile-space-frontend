'use client';

/**
 * Peças pequenas compartilhadas pelas abas de operação e plataforma do admin.
 * Só tokens semânticos (valem nos 7 temas x claro/escuro); texto mínimo de 12 px.
 */
import * as React from 'react';
import { Minus, type LucideIcon } from 'lucide-react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { BRAND_TINT, FOCUS_RING, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Marcador de linha/cabeçalho com estado "alguns" (traço). Alvo de toque de 44 px no celular. */
export function AdminCheckbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean | 'indeterminate';
  onChange: () => void;
  label: string;
  className?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={() => onChange()}
      aria-label={label}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-muted-foreground/70 text-primary-foreground transition-colors duration-fast',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        FOCUS_RING,
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {checked === 'indeterminate' ? <Minus className="h-3 w-3" strokeWidth={2} /> : <Check className="h-3 w-3" strokeWidth={2} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

/** Grupo de pílulas de filtro rápido (tipo de sessão, faixa de nota, tipo de versão). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors duration-fast max-sm:h-11',
              FOCUS_RING,
              on
                ? cn('border-primary/50 text-primary [.theme-totvs:not(.dark)_&]:text-foreground', BRAND_TINT)
                : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            {o.label}
            {o.count != null && <span className="tabular-nums opacity-80">({o.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Rodapé de lista: "Exibindo 20 de 48 feedbacks" e o botão "Exibir mais" (soma a próxima página). */
export function ShowMoreFooter({
  shown,
  total,
  noun,
  chunk,
  onMore,
  note,
}: {
  shown: number;
  total: number;
  noun: string;
  /** Quantos itens o próximo clique soma. */
  chunk: number;
  onMore: () => void;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-border px-5 py-4 text-center">
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        Exibindo {shown} de {total} {noun}
        {note ? <> · {note}</> : null}
      </p>
      {chunk > 0 && (
        <ModalButton variant="secondary" onClick={onMore}>
          Exibir mais
          <span className="text-muted-foreground">+{chunk}</span>
        </ModalButton>
      )}
    </div>
  );
}

/** Rótulo de campo do kit de formulários do admin. */
export const FIELD_LABEL = 'text-[13px] font-semibold text-foreground';
/** Texto de ajuda sob um campo. */
export const FIELD_HINT = 'text-xs text-muted-foreground';

/**
 * Quantos itens a lista mostra ("Exibir mais" soma uma página). Volta ao tamanho de uma página quando
 * o filtro muda (`resetKey`), sem efeito: a chave guardada junto do limite diz se ele ainda vale.
 */
export function useVisibleLimit(resetKey: string, step: number): readonly [number, () => void] {
  const [state, setState] = React.useState({ key: resetKey, limit: step });
  const limit = state.key === resetKey ? state.limit : step;
  const more = React.useCallback(() => setState({ key: resetKey, limit: limit + step }), [resetKey, limit, step]);
  return [limit, more] as const;
}
