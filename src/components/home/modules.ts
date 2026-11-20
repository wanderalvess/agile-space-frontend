import type { LucideIcon } from 'lucide-react';
import { getModule, homeModuleGroups, type ModuleKey } from '@/lib/modules-registry';

export interface HomeModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Módulo ainda não liberado: o link leva à página "Em breve". */
  soon?: boolean;
  /** Atalhos extras do módulo (Políticas e ajuda). */
  links?: { label: string; href: string }[];
}

export interface HomeModuleGroup {
  id: string;
  label: string;
  items: HomeModule[];
}

/**
 * Os 12 módulos do cartão "Todos os módulos", com as mesmas rotas de sempre.
 * Nome, rota, ícone e descrição vêm do registro único (`lib/modules-registry.ts`).
 */
export const MODULE_GROUPS: HomeModuleGroup[] = homeModuleGroups().map((g) => ({
  id: g.id,
  label: g.label,
  items: g.items.map((m) => ({
    id: m.key,
    title: m.home?.title ?? m.label,
    description: m.description,
    icon: m.icon,
    href: m.href,
    ...(m.soon ? { soon: true } : {}),
    ...(m.home?.links
      ? {
          links: m.home.links.map((k: ModuleKey) => {
            const l = getModule(k);
            return { label: l.label, href: l.href };
          }),
        }
      : {}),
  })),
}));

export const MODULE_COUNT = MODULE_GROUPS.reduce((n, g) => n + g.items.length, 0);
