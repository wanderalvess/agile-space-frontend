'use client';

import { KeyRound } from 'lucide-react';
import { ChangePasswordSection } from '@/components/layout/ChangePasswordSection';
import { IdentityRow } from './IdentityRow';

/** Linha "Senha": valor mascarado; aberta, traz a troca de senha. Quem decide se aparece é o modal (`canChangePassword`). */
export function RowPassword({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <IdentityRow id="senha" icon={KeyRound} label="Senha" value="••••••••" actionLabel="Trocar" open={open} onToggle={onToggle}>
      <ChangePasswordSection />
    </IdentityRow>
  );
}
