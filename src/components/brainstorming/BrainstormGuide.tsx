'use client';

import { BookOpen } from 'lucide-react';
import { GuideSheet, Kbd, type GuideTab } from '@/components/room-kit';
import { STAGE_COPY } from './brainstorm-copy';
import { BRAIN_STAGES } from './brainstorm-room-logic';

const ROLES = [
  { title: 'Facilitador (quem criou)', desc: 'Muda de etapa, controla o cronômetro, liga autores anônimos, oculta e revela as ideias, ativa o modo apresentação, renomeia a sessão, remove pessoas e apaga o brainstorming.' },
  { title: 'Todas as pessoas', desc: 'Lançam, votam, editam qualquer ideia, juntam ideias no Mural, criam e apagam grupos, ligam ideias, arrastam na Matriz, criam o plano de ação e exportam (com as ideias reveladas).' },
  { title: 'Quem apaga ideias', desc: 'O autor da ideia e o facilitador.' },
  { title: 'Dica de facilitação', desc: 'Use o cronômetro para lançar ideias em rodadas curtas: evita o cansaço criativo.' },
] as const;

const KEYS: { label: string; items: { keys: string[]; text?: string; desc: string }[] }[] = [
  {
    label: 'No Mural',
    items: [
      { keys: ['Enter'], desc: 'Lançar a ideia' },
      { keys: [], text: 'botão Salvar', desc: 'Salvar uma edição' },
    ],
  },
  {
    label: 'Na Teia',
    items: [
      { keys: ['Ctrl'], text: '+ rolagem', desc: 'Aproximar e afastar' },
      { keys: [], text: 'botão do meio ou direito', desc: 'Mover o quadro' },
      { keys: [], text: 'puxar da bolinha de baixo', desc: 'Ligar duas ideias' },
    ],
  },
  {
    label: 'Em Grupos e Plano',
    items: [
      { keys: ['Enter'], desc: 'Criar grupo' },
      { keys: ['Enter'], desc: 'Salvar o texto no plano' },
    ],
  },
];

/** Guia do Brainstorming: as cinco etapas, só os gestos que existem de verdade e o que cada papel pode fazer. */
export function BrainstormGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tabs: GuideTab[] = [
    {
      id: 'flow',
      label: 'Como funciona',
      content: (
        <ol className="m-0 flex list-none flex-col p-0">
          {BRAIN_STAGES.map((stage, i) => (
            <li key={stage.id} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="room-glow-ring flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">{i + 1}</span>
                {i < BRAIN_STAGES.length - 1 && <span aria-hidden="true" className="min-h-4 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="flex flex-col gap-1 pb-[18px]">
                <span className="text-[15px] font-bold">{stage.label}</span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">{STAGE_COPY[stage.id].guide}</span>
              </div>
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: 'keys',
      label: 'Atalhos e gestos',
      content: (
        <div className="flex flex-col gap-5">
          {KEYS.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-bold text-muted-foreground">{group.label}</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {group.items.map((it) => (
                  <li key={it.desc} className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2">
                    <span className="text-[13px]">{it.desc}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {it.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                      {it.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ),
    },
    {
      id: 'roles',
      label: 'Papéis',
      content: (
        <div className="flex flex-col gap-2.5">
          {ROLES.map((r) => (
            <div key={r.title} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <span className="text-[13px] font-bold">{r.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{r.desc}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return <GuideSheet open={open} onOpenChange={onOpenChange} title="Guia do brainstorming" description="Como lançar, organizar, priorizar e virar plano." icon={BookOpen} tabs={tabs} manualHref="/manual/brainstorming" />;
}
