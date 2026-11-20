'use client';

import { BookOpen, Play } from 'lucide-react';
import { GuideSheet, Kbd, ModalButton, type GuideTab } from '@/components/room-kit';

const STEPS = [
  { title: 'Importe as tarefas', desc: 'Do Jira por XML ou API, ou crie cards à mão (padrão ou de métricas).' },
  { title: 'Prepare as evidências', desc: 'Em cada card: problema, solução, links, anexos. Marque Pronta quando terminar; o card recolhe.' },
  { title: 'Apresente', desc: 'Apresentar abre o Modo Teatro em tela cheia. Setas trocam de card; Esc sai.' },
  { title: 'Colete o aceite', desc: 'PO ou SME aprova, pede ajuste ou rejeita. Ajuste e rejeição levam um feedback.' },
  { title: 'Finalize e exporte', desc: 'O resumo traz PDF, log em Markdown, a tabela de aprovações e a lista de links das issues.' },
] as const;

const NOTES = [
  { title: 'Quem decide', desc: 'Só quem tem o cargo Product Owner ou SME no perfil registra a decisão. Os demais preparam os cards e veem o botão desativado.' },
  { title: 'Pronta', desc: 'Um card está completo com problema, solução e alguma evidência (link ou anexo). A faixa de prontidão avisa quando o status manual discorda.' },
  { title: 'Anexos', desc: 'Até 5 arquivos por card, PNG, JPEG ou PDF de até 10 MB. Valem como evidência na apresentação.' },
  { title: 'Equipe junto', desc: 'Quem abre o link edita a mesma Review. A última gravação vence, então combinem quem mexe em cada card.' },
  { title: 'Ordem', desc: 'A ordem da lista e da apresentação vem das configurações. Os filtros da lista não mudam a apresentação.' },
] as const;

const KEYS: { label: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    label: 'No Modo Teatro',
    items: [
      { keys: ['→'], desc: 'Próximo card' },
      { keys: ['←'], desc: 'Card anterior' },
      { keys: ['Esc'], desc: 'Sair da apresentação' },
      { keys: ['Esc'], desc: 'Fechar o quadro de feedback' },
    ],
  },
  {
    label: 'Na tela do tour',
    items: [
      { keys: ['→'], desc: 'Próximo passo' },
      { keys: ['Esc'], desc: 'Pular o tour' },
    ],
  },
];

/** Guia lateral da Review (kit): como funciona, regras da Review e atalhos. */
export function ReviewGuide({ open, onOpenChange, onRedoTour }: { open: boolean; onOpenChange: (open: boolean) => void; onRedoTour: () => void }) {
  const tabs: GuideTab[] = [
    {
      id: 'flow',
      label: 'Como funciona',
      content: (
        <div className="flex flex-col gap-5">
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            A Review troca os slides por uma apresentação feita direto dos cards da sprint. Cada pessoa prepara o seu card; na cerimônia, o Modo Teatro mostra uma entrega por vez e o PO registra a decisão.
          </p>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl border border-border px-3.5 py-3">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold">{s.title}</span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <div>
            <ModalButton
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onRedoTour();
              }}
            >
              <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Refazer o tour pela tela
            </ModalButton>
          </div>
        </div>
      ),
    },
    {
      id: 'review',
      label: 'Review',
      content: (
        <div className="grid grid-cols-1 gap-2.5">
          {NOTES.map((n) => (
            <div key={n.title} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <span className="text-[13px] font-bold">{n.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{n.desc}</span>
            </div>
          ))}
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
          <p className="m-0 text-xs text-muted-foreground">Em tela cheia, o primeiro Esc sai da tela cheia e só o segundo fecha a apresentação.</p>
        </div>
      ),
    },
  ];

  return <GuideSheet open={open} onOpenChange={onOpenChange} title="Guia da Review" description="Como preparar, apresentar e fechar a Review." icon={BookOpen} tabs={tabs} manualHref="/manual/showcase" />;
}
