'use client';

import { BookOpen } from 'lucide-react';
import { GuideSheet, Kbd, type GuideTab } from '@/components/room-kit';
import { RETRO_PHASES } from './retro-room-logic';

const PHASE_COPY: Record<(typeof RETRO_PHASES)[number]['id'], string> = {
  write: 'Cada pessoa escreve sem ver os cartões dos outros. Assim ninguém copia a opinião de quem falou primeiro.',
  reveal: 'O facilitador mostra tudo de uma vez. Use Juntar para unir cartões parecidos: os textos e os votos se somam.',
  vote: 'Cada pessoa distribui os votos que tem em cada painel. Clique de novo no cartão para retirar o voto.',
  act: 'Os mais votados viram ações na última coluna, cada uma com responsável e prazo. Ações abertas podem voltar na próxima retro.',
};

const TOOLS = [
  { title: 'Facilitador', desc: 'Quem criou a retro conduz as fases, o timer e a votação. Se ele sumir, outra pessoa pode assumir o controle na lista de participantes.' },
  { title: 'Autores abertos', desc: 'Nas configurações. Desligado, os cartões ficam anônimos, o que ajuda quando o time ainda não se sente à vontade.' },
  { title: 'Timer', desc: 'De 5 a 8 minutos por tema funciona bem. Nas configurações dá para revelar os cartões quando o tempo acabar.' },
  { title: 'Antes de encerrar', desc: 'Exporte o resumo pelo menu e compartilhe as ações combinadas no canal da squad.' },
] as const;

const KEYS: { label: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    label: 'Cartões',
    items: [
      { keys: ['Enter'], desc: 'Adicionar ou salvar o cartão' },
      { keys: ['Shift', 'Enter'], desc: 'Quebrar a linha' },
      { keys: ['Esc'], desc: 'Cancelar a edição ou a fusão' },
    ],
  },
  {
    label: 'Apresentação',
    items: [
      { keys: ['←', '→'], desc: 'Trocar de coluna (no facilitador, se a sincronização estiver ligada)' },
      { keys: ['Esc'], desc: 'Sair da apresentação' },
    ],
  },
];

export function RetroGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tabs: GuideTab[] = [
    {
      id: 'flow',
      label: 'Como funciona',
      content: (
        <div className="flex flex-col gap-5">
          <ol className="m-0 flex list-none flex-col p-0">
            {RETRO_PHASES.map((phase, i) => (
              <li key={phase.id} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground room-glow-ring [.theme-totvs:not(.dark)_&]:text-foreground">{i + 1}</span>
                  {i < RETRO_PHASES.length - 1 && <span aria-hidden="true" className="min-h-4 w-0.5 flex-1 bg-border" />}
                </div>
                <div className="flex flex-col gap-1 pb-[18px]">
                  <span className="text-[15px] font-bold">{phase.label}</span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">{PHASE_COPY[phase.id]}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <div key={t.title} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                <span className="text-[13px] font-bold">{t.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'keys',
      label: 'Atalhos',
      content: (
        <div className="flex flex-col gap-5">
          {KEYS.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-bold text-muted-foreground">{group.label}</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {group.items.map((it) => (
                  <li key={it.desc} className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2">
                    <span className="text-[13px]">{it.desc}</span>
                    <span className="flex shrink-0 items-center gap-1">{it.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ),
    },
  ];

  return <GuideSheet open={open} onOpenChange={onOpenChange} title="Guia da retro" description="Do primeiro cartão ao plano de ação." icon={BookOpen} tabs={tabs} manualHref="/manual/retro" />;
}
