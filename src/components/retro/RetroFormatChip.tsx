import { retroFormatTheme } from '@/lib/retro-format-themes';
import { retroFormatName } from '@/lib/retro-formats';
import type { RetroTemplateKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { COLUMN_ICONS } from './column-icons';

/** Chip do formato da retro com o mini-ícone do formato (lobby). Sem formato conhecido, não mostra nada. */
export function RetroFormatChip({ templateKey, className }: { templateKey?: RetroTemplateKey | null; className?: string }) {
  const name = retroFormatName(templateKey);
  if (!name) return null;
  const theme = retroFormatTheme(templateKey);
  const Icon = theme ? COLUMN_ICONS[theme.emblema] : null;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 text-xs font-semibold text-foreground', className)}>
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />}
      {name}
    </span>
  );
}
