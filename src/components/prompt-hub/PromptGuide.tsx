'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Copy,
  GitFork,
  GraduationCap,
  Search,
  Share2,
  ShieldAlert,
  Star,
  BookOpen
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TYPE_ORDER, TYPE_META, VISIBILITY_META } from '@/app/prompt-hub/constants';
import type { PromptVisibility } from '@/app/prompt-hub/types';

interface PromptGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOW_TO_FIND = [
  {
    icon: Search,
    title: 'Busque por qualquer coisa',
    description: 'A busca varre título, descrição, conteúdo, tags e autor — não só o título.'
  },
  {
    icon: BookOpen,
    title: 'Filtre por categoria',
    description: 'Cada categoria mostra quantos itens tem. As vazias ficam desabilitadas.'
  },
  {
    icon: Star,
    title: 'Marque favoritos',
    description: 'A estrela é sua: ninguém mais vê o que você favoritou. O filtro isola só eles.'
  }
];

const HOW_TO_USE = [
  {
    icon: Copy,
    title: 'Copiar com variáveis',
    description:
      'Se o conteúdo tem {{marcadores}}, o item mostra campos para preencher antes de copiar. O texto sai pronto.'
  },
  {
    icon: GitFork,
    title: 'Duplicar e adaptar',
    description:
      'Cria uma cópia privada na sua biblioteca. Ajuste sem alterar o original de quem publicou.'
  },
  {
    icon: Share2,
    title: 'Compartilhar por link',
    description:
      'Cada item tem endereço próprio. Item público abre para qualquer pessoa, mesmo sem login.'
  }
];

export function PromptGuide({ open, onOpenChange }: PromptGuideProps) {
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
          <SheetTitle className="text-lg font-semibold">Como usar a biblioteca</SheetTitle>
          <SheetDescription className="text-sm">
            O acervo de IA da empresa: o que cabe aqui, como achar e como reaproveitar.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-8 px-6 py-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">O que cabe aqui</h3>
              <ul className="space-y-2.5">
                {TYPE_ORDER.map(type => {
                  const meta = TYPE_META[type];
                  const Icon = meta.icon;
                  return (
                    <li key={type} className="flex gap-3">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          meta.chip
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {meta.summary}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Para achar</h3>
              <ul className="space-y-3">
                {HOW_TO_FIND.map(item => (
                  <li key={item.title} className="flex gap-3">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Para usar</h3>
              <ul className="space-y-3">
                {HOW_TO_USE.map(item => (
                  <li key={item.title} className="flex gap-3">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Quem enxerga o que você publica</h3>
              <ul className="space-y-2.5">
                {(Object.keys(VISIBILITY_META) as PromptVisibility[])
                  .filter(key => VISIBILITY_META[key].available)
                  .map(key => {
                    const meta = VISIBILITY_META[key];
                    const Icon = meta.icon;
                    return (
                      <li key={key} className="flex gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{meta.label}</p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {meta.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Compartilhamento por squad e por cargo ainda não está disponível.
              </p>
            </section>

            <section className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Antes de publicar como público</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Item público é visível para qualquer pessoa, inclusive sem login. Remova tokens,
                  chaves de API, dados de cliente e nomes internos de sistemas do conteúdo.
                </p>
              </div>
            </section>

            <section className="space-y-2 pb-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onOpenChange(false);
                  router.push('/prompt-hub/tutorial');
                }}
              >
                <GraduationCap className="h-4 w-4" />
                Tutorial: como criar uma skill
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                <a href="/manual#prompt-hub">
                  <BookOpen className="h-4 w-4" />
                  Manual completo da plataforma
                </a>
              </Button>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
