'use client';

import { BriefcaseBusiness } from 'lucide-react';
import { SEM_CARGO } from '@/lib/cargo';
import { CargoRequestForm } from './CargoRequestForm';
import { IdentityRow } from './IdentityRow';

export interface RowCargoProps {
  open: boolean;
  onToggle: () => void;
  /** Cargo em exibição (lib/cargo.ts); só leitura. Mudança passa pelo Suporte. */
  cargo?: string;
  email?: string;
  name?: string;
  /** Squad ativa, para o corpo do pedido ao Suporte. */
  squad?: string;
  /** Liderança vem do Jira/convite: o cargo desejado do pedido é opcional. */
  leadership: boolean;
  /** Fecha o modal antes de seguir para outra página. */
  onNavigate: () => void;
}

/** Linha "Cargo": valor em leitura; aberta, traz o pedido de ajuste ao Suporte. */
export function RowCargo({ open, onToggle, cargo, email, name, squad, leadership, onNavigate }: RowCargoProps) {
  return (
    <IdentityRow id="cargo" icon={BriefcaseBusiness} label="Cargo" value={cargo || SEM_CARGO} actionLabel="Pedir ajuste" open={open} onToggle={onToggle}>
      <p className="text-[13px] text-muted-foreground">O cargo vem do Jira ou da administração. Se estiver errado, o pedido vai para o Suporte, que confere e ajusta.</p>
      <CargoRequestForm currentCargo={cargo} email={email} name={name} squad={squad} leadership={leadership} onClose={onToggle} onNavigate={onNavigate} />
    </IdentityRow>
  );
}
