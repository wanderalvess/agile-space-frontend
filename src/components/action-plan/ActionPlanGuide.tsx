'use client';

import React from 'react';
import { ListChecks } from 'lucide-react';
import { GuideSheet, Kbd, type GuideTab } from '@/components/room-kit';

/** Os sete campos do 5W2H: o que escrever em cada um. Usado no guia da página e no lobby. */
export const FIVE_W_TWO_H_FIELDS = [
  { key: 'what', title: 'O quê (What)', desc: 'A ação, começando por um verbo. Obrigatório.' },
  { key: 'why', title: 'Por quê (Why)', desc: 'O propósito. Sem bom motivo, talvez a ação não deva existir.' },
  { key: 'how', title: 'Como (How)', desc: 'Os passos ou o método.' },
  { key: 'where', title: 'Onde (Where)', desc: 'Sistema, módulo, ambiente ou grupo.' },
  { key: 'when', title: 'Quando (When)', desc: 'Prazo ou data limite. Texto livre.' },
  { key: 'who', title: 'Quem (Who)', desc: 'A pessoa responsável. Quem entra como responsável é avisada se o nome bater com alguém da squad.' },
  { key: 'howMuch', title: 'Quanto (How Much)', desc: 'Custo ou esforço, em horas ou valor.' },
] as const;

const STEPS = [
  { title: 'Comece pelo quê e quem', desc: 'Toda ação tem uma descrição clara e uma pessoa responsável. O resto o time completa na tabela.' },
  { title: 'Edite no lugar', desc: 'Clique numa célula para editar. Enter salva, Esc cancela. Para tudo de uma vez, use o botão de lápis da linha.' },
  { title: 'Acompanhe o status', desc: 'Clique no status para avançar: A fazer, Em andamento, Concluído, Impedido.' },
  { title: 'Exporte quando precisar', desc: 'Markdown para colar no Confluence ou CSV para planilha.' },
] as const;

const KEY_GROUPS: { label: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    label: 'Na tabela',
    items: [
      { keys: ['clique'], desc: 'Editar uma célula' },
      { keys: ['Enter'], desc: 'Salvar a edição' },
      { keys: ['Esc'], desc: 'Cancelar a edição' },
      { keys: ['clique no status'], desc: 'Avançar o status' },
      { keys: ['lápis'], desc: 'Editar todos os campos da ação' },
    ],
  },
];

export function ActionPlanGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tabs: GuideTab[] = [
    {
      id: 'flow',
      label: 'Como funciona',
      content: (
        <div className="flex flex-col gap-5">
        <ol className="m-0 flex list-none flex-col p-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground room-glow-ring [.theme-totvs:not(.dark)_&]:text-foreground">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && <span aria-hidden="true" className="min-h-4 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="flex flex-col gap-1 pb-[18px]">
                <span className="text-[15px] font-bold">{step.title}</span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">{step.desc}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          <span className="text-[13px] font-bold">Dica ágil</span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Mantenha o quê e o porquê curtos e diretos: a tabela fica fácil de ler na reunião.
          </span>
        </div>
        </div>
      ),
    },
    {
      id: 'fields',
      label: 'Os 7 campos',
      content: (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {FIVE_W_TWO_H_FIELDS.map((f) => (
            <li key={f.key} className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <span className="text-[13px] font-bold">{f.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{f.desc}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'keys',
      label: 'Atalhos',
      content: (
        <div className="flex flex-col gap-5">
          {KEY_GROUPS.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-bold text-muted-foreground">{group.label}</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {group.items.map((it) => (
                  <li key={it.desc} className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2">
                    <span className="text-[13px]">{it.desc}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {it.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ),
    },
  ];

  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia do plano de ação"
      description="Como preencher, acompanhar e exportar o 5W2H."
      icon={ListChecks}
      tabs={tabs}
      manualHref="/manual#action-plan"
    />
  );
}
