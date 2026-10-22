'use client';

import Link from 'next/link';
import { BookOpen, Copy, GraduationCap, Search, Share2, ShieldAlert, Star, Workflow, type LucideIcon } from 'lucide-react';
import { GuideSheet, IconTile, type GuideTab } from '@/components/room-kit';
import { TYPE_META, TYPE_ORDER, VISIBILITY_META, VISIBILITY_ORDER } from '@/app/prompt-hub/constants';

interface PromptGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOW_TO_FIND: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Search, title: 'Busque por qualquer coisa', description: 'A busca varre título, descrição, conteúdo, etiquetas e autor, não só o título. O termo aparece em destaque nos resultados.' },
  { icon: BookOpen, title: 'Filtre por tipo', description: 'Cada botão de tipo mostra quantos itens tem. Os que estão vazios ficam desligados. O botão Filtros reúne situação, impacto, visibilidade e etiquetas.' },
  { icon: Star, title: 'Marque favoritos', description: 'A estrela é sua: ninguém mais vê o que você favoritou. A aba Favoritos junta todos eles.' },
];

const HOW_TO_USE: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Copy, title: 'Copiar com campos', description: 'Se o texto tem {{campos}}, o item mostra caixas para preencher antes de copiar. O texto sai pronto.' },
  { icon: Workflow, title: 'Duplicar e adaptar', description: 'Cria uma cópia privada em "Meus itens". Ajuste sem alterar o original de quem publicou.' },
  { icon: Share2, title: 'Compartilhar por link', description: 'Cada item tem página própria. Item público abre para qualquer pessoa, mesmo sem login.' },
];

function Row({ icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <li className="flex gap-3">
      <IconTile icon={icon} size="sm" tone="neutral" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

/** Guia da biblioteca: o que cabe em cada tipo, como achar, como usar e quem enxerga o que é publicado. */
export function PromptGuide({ open, onOpenChange }: PromptGuideProps) {
  const tabs: GuideTab[] = [
    {
      id: 'tipos',
      label: 'O que cabe aqui',
      content: (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3.5">
            {TYPE_ORDER.map(type => (
              <Row key={type} icon={TYPE_META[type].icon} title={TYPE_META[type].label} description={TYPE_META[type].summary} />
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Escreva <span className="font-mono text-foreground">{'{{nome}}'}</span> no texto para criar um campo. Quem usar preenche os campos antes de copiar.
          </p>
        </div>
      ),
    },
    {
      id: 'uso',
      label: 'Como usar',
      content: (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-foreground">Para achar</h3>
            <ul className="flex flex-col gap-3.5">
              {HOW_TO_FIND.map(row => (
                <Row key={row.title} {...row} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-foreground">Para usar</h3>
            <ul className="flex flex-col gap-3.5">
              {HOW_TO_USE.map(row => (
                <Row key={row.title} {...row} />
              ))}
            </ul>
          </section>
          <Link
            href="/prompt-hub/tutorial"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center gap-2 self-start rounded-[10px] border border-border px-4 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Como criar uma skill
          </Link>
        </div>
      ),
    },
    {
      id: 'visibilidade',
      label: 'Quem vê o quê',
      content: (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3.5">
            {VISIBILITY_ORDER.map(key => (
              <Row key={key} icon={VISIBILITY_META[key].icon} title={VISIBILITY_META[key].label} description={VISIBILITY_META[key].description} />
            ))}
          </ul>
          <section className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Antes de publicar como público</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Item público é visível para qualquer pessoa, inclusive sem login. Remova tokens, chaves de API, dados de cliente e nomes internos de sistemas do conteúdo.
              </p>
            </div>
          </section>
        </div>
      ),
    },
  ];

  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia da biblioteca"
      description="O acervo de IA da empresa: o que cabe aqui, como achar e como reaproveitar."
      tabs={tabs}
      manualHref="/manual#prompt-hub"
    />
  );
}
