'use client';

import { Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MANAGER_ROLES, SQUAD_ROLES } from '@/lib/roster/constants';
import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

/**
 * Cargos oferecidos para uma pessoa. Tribe Lead fica oculto (só aparece para quem já é). Agile Master, Scrum
 * Master e People Lead só um administrador atribui: aparecem travados para os demais.
 */
export function roleOptionsFor(current: string, isAdmin: boolean, opts: { allowTribeLead: boolean }) {
  const roles: string[] = SQUAD_ROLES.filter((r) => opts.allowTribeLead || r !== 'Tribe Lead' || r === current);
  if (current && !roles.includes(current)) roles.push(current);
  return roles.map((r) => ({ value: r, locked: !isAdmin && MANAGER_ROLES.includes(r) && r !== current }));
}

interface RoleSelectProps {
  value: string;
  onChange: (role: string) => void;
  isAdmin: boolean;
  /** Sem permissão de gerir o time, o cargo é só leitura (sem seta). */
  editable: boolean;
  allowTribeLead?: boolean;
  'aria-label': string;
  className?: string;
  triggerClassName?: string;
}

export function RoleSelect({ value, onChange, isAdmin, editable, allowTribeLead = false, className, triggerClassName, ...rest }: RoleSelectProps) {
  if (!editable) {
    return (
      <span className={cn('flex h-8 items-center rounded-lg border border-transparent px-2.5 text-[13px] font-semibold text-foreground/80', className)}>
        {value}
      </span>
    );
  }
  const options = roleOptionsFor(value, isAdmin, { allowTribeLead });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={rest['aria-label']}
        className={cn('h-8 gap-1.5 rounded-lg border-border bg-transparent px-2.5 text-[13px] font-semibold', className, triggerClassName)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-popover text-popover-foreground">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.locked} className="text-[13px]">
            <span className="flex items-center gap-2">
              {o.value}
              {o.locked && <Lock className="h-3 w-3" strokeWidth={ICON_STROKE} aria-label="Só administrador atribui" />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
