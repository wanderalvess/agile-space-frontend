'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { ModalButton, SelectField, StatusChip, FIELD } from '@/components/room-kit';
import { SQUAD_ROLES } from '@/lib/roster/constants';
import type { RosterFilters } from '@/lib/roster/calc';
import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

const ROLE_OPTIONS = [{ value: 'ALL', label: 'Todos os cargos' }, ...SQUAD_ROLES.map((r) => ({ value: r, label: r }))];
const SOURCE_OPTIONS = [
  { value: 'ALL', label: 'Todas as fontes' },
  { value: 'OVERRIDDEN', label: 'Definidas pelo gestor' },
  { value: 'SYSTEM', label: 'Sugestão do sistema' },
];

interface RosterToolbarProps {
  filters: RosterFilters;
  onChange: (next: RosterFilters) => void;
  shown: number;
  total: number;
  onOpenRule: () => void;
}

/** Busca, cargo, fonte da carga, contador e o atalho para a regra de cálculo. */
export function RosterToolbar({ filters, onChange, shown, total, onOpenRule }: RosterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[340px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={ICON_STROKE} aria-hidden="true" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar integrante por nome, e-mail ou ID"
          aria-label="Buscar integrante"
          className={cn(FIELD, 'h-[38px] pl-9 text-sm')}
        />
      </div>
      <SelectField
        aria-label="Filtrar por cargo"
        value={filters.role}
        onChange={(role) => onChange({ ...filters, role })}
        options={ROLE_OPTIONS}
        className="h-[38px] w-full text-sm sm:w-[170px]"
      />
      <SelectField
        aria-label="Filtrar por fonte da carga"
        value={filters.source}
        onChange={(source) => onChange({ ...filters, source })}
        options={SOURCE_OPTIONS}
        className="h-[38px] w-full text-sm sm:w-[190px]"
      />
      <StatusChip tone="neutral" className="h-8 px-3.5 text-[13px]" >
        <span aria-live="polite">{shown} de {total} integrantes</span>
      </StatusChip>
      <span className="hidden flex-1 sm:block" />
      <ModalButton className="h-[38px] text-[13px]" onClick={onOpenRule}>
        <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={ICON_STROKE} aria-hidden="true" /> Regra de cálculo
      </ModalButton>
    </div>
  );
}
