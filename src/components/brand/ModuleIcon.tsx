import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODULE_ICONS, moduleIcon, moduleLabel, type ModuleKey } from '@/lib/modules-registry';

export { moduleIcon };

interface ModuleIconProps {
  module: ModuleKey;
  /** Classes de tamanho e cor (ex.: "h-4 w-4"). O traço é sempre de 1,5. */
  className?: string;
  /** Com título o ícone é lido como imagem; sem título é decorativo (o nome do módulo já está ao lado). */
  title?: string;
}

/** Ícone de linha de um módulo. O mesmo ícone em Home, menus, cabeçalho, cards e busca. */
export function ModuleIcon({ module, className, title }: ModuleIconProps) {
  const Icon: LucideIcon = MODULE_ICONS[module];
  return (
    <Icon
      className={cn('h-4 w-4 shrink-0', className)}
      strokeWidth={1.5}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      role={title ? 'img' : undefined}
    />
  );
}

/** Nome acessível padrão de um módulo, para quando só o ícone aparece. */
export function moduleTitle(module: ModuleKey): string {
  return moduleLabel(module);
}
