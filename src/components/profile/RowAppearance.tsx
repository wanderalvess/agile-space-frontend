'use client';

import { Palette } from 'lucide-react';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { useTheme } from '@/context/ThemeContext';
import { THEME_MODES, THEME_VARIANTS } from '@/lib/theme-options';
import { IdentityRow } from './IdentityRow';

/** Linha "Aparência": "Modo · Tema" atuais; aberta, traz os controles compartilhados (aplicam na hora). */
export function RowAppearance({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { mode, variant } = useTheme();
  const modeName = THEME_MODES.find((m) => m.id === mode)?.name ?? '';
  const themeName = THEME_VARIANTS.find((t) => t.id === variant)?.name ?? '';
  return (
    <IdentityRow id="aparencia" icon={Palette} label="Aparência" value={[modeName, themeName].filter(Boolean).join(' · ')} actionLabel="Mudar" open={open} onToggle={onToggle}>
      <ThemeSettings idPrefix="identity-theme" compact />
    </IdentityRow>
  );
}
