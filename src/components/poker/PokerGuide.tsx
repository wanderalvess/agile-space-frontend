"use client";

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { DECKS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GuideSheet, Kbd, type GuideTab } from '@/components/room-kit';

interface PokerGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FLOW = [
  { title: 'Discutir', desc: 'Tarefa, critérios de aceite e notas de DEV e QA na mesa.' },
  { title: 'Votar às cegas', desc: 'Cada pessoa vota as horas do seu papel. Os votos ficam ocultos até a revelação.' },
  { title: 'Revelar', desc: 'Média por papel, arredondada conforme a configuração da sala. Quem votou nos extremos explica primeiro.' },
  { title: 'Decidir e copiar', desc: 'Salve as horas por papel e copie a estimativa para a issue pai.', code: '(DEV 10h / QA 4h)' },
] as const;

const RULES = [
  { title: 'Consenso por papel', desc: 'Todo mundo do mesmo papel votou igual: a mesa marca o consenso.', dot: 'bg-emerald-500' },
  { title: 'Divergência', desc: 'Diferença por papel acima do limite de aviso ou crítico configurado.', dot: 'bg-amber-500' },
  { title: 'Teto de rodadas', desc: 'Passou do teto sem consenso: tirar da mesa ou adiar.', dot: 'bg-primary' },
  { title: 'Depois da sessão', desc: 'Relatório, exportação e dados disponíveis no Sprint Planner.', dot: 'bg-blue-500' },
] as const;

const DECK_INFO = [
  { id: 'hours', name: 'Horas reais', use: 'subtarefas e esforço técnico', mark: '8', rule: 'Resultado é a média por papel. A cópia sai como (DEV xh / QA yh / …).' },
  { id: 'fibonacci', name: 'Fibonacci', use: 'histórias de usuário', mark: '5', rule: 'Complexidade relativa. Resultado é a média por papel.' },
  { id: 'tshirt', name: 'Camisetas', use: 'tamanho relativo', mark: 'M', rule: 'Sem equivalência vale o mais votado. Com equivalência (hora, dia, semana, sprint…) calcula em horas.' },
] as const;

const KEY_GROUPS: { label: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    label: 'Votar',
    items: [
      { keys: ['0–9'], desc: 'Digite o valor da carta (1 e 6 em seguida dá 16)' },
      { keys: ['P', 'M', 'G'], desc: 'Camisetas: digite o tamanho (PP, GG)' },
      { keys: ['?'], desc: 'Não sei estimar' },
      { keys: ['C'], desc: 'Pausa para o café' },
      { keys: ['Esc'], desc: 'Cancela a digitação' },
    ],
  },
  {
    label: 'Facilitador, com a fila vazia',
    items: [
      { keys: ['I'], desc: 'Importar do Jira' },
      { keys: ['N'], desc: 'Adicionar tarefa' },
      { keys: ['S'], desc: 'Compartilhar a sala' },
    ],
  },
  {
    label: 'Chat',
    items: [
      { keys: ['Enter'], desc: 'Enviar' },
      { keys: ['Shift', 'Enter'], desc: 'Quebrar linha' },
      { keys: ['```'], desc: 'Modo código' },
      { keys: ['Ctrl', 'Enter'], desc: 'Enviar no modo código' },
    ],
  },
  { label: 'Sala', items: [{ keys: ['Esc'], desc: 'Sair do modo apresentação' }] },
];

function FlowTab() {
  return (
    <div className="flex flex-col gap-5">
      <ol className="m-0 flex list-none flex-col p-0">
        {FLOW.map((s, i) => (
          <li key={s.title} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground room-glow-ring">{i + 1}</span>
              {i < FLOW.length - 1 && <span aria-hidden="true" className="min-h-4 w-0.5 flex-1 bg-border" />}
            </div>
            <div className="flex flex-col gap-1 pb-[18px]">
              <span className="text-[15px] font-bold">{s.title}</span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">{s.desc}</span>
              {'code' in s && (
                <code className="mt-1 self-start rounded-lg border border-border bg-muted px-2.5 py-1 text-[13px] font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{s.code}</code>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {RULES.map((r) => (
          <div key={r.title} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', r.dot)} />
              {r.title}
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">{r.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecksTab() {
  return (
    <div className="flex flex-col gap-3.5">
      {DECK_INFO.map((d) => (
        <div key={d.id} className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-muted/40 p-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold">{d.name}</span>
            <span className="text-xs text-muted-foreground">{d.use}</span>
          </div>
          <div className="flex flex-wrap gap-[5px]">
            {DECKS[d.id].map((v) => (
              <span
                key={v}
                className={cn(
                  'flex h-9 min-w-[26px] items-center justify-center rounded-md border px-1 text-xs font-bold tabular-nums',
                  v === d.mark ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                )}
              >
                {v === '☕' ? 'café' : v}
              </span>
            ))}
          </div>
          <span className="text-xs leading-relaxed text-muted-foreground">{d.rule}</span>
        </div>
      ))}
    </div>
  );
}

function KeysTab() {
  return (
    <div className="flex flex-col gap-5">
      {KEY_GROUPS.map((g) => (
        <section key={g.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted-foreground">{g.label}</h3>
          {g.items.map((k) => (
            <div key={k.desc} className="flex items-center gap-3 border-b border-border py-2">
              <span className="flex min-w-[150px] gap-1">
                {k.keys.map((kk) => <Kbd key={kk}>{kk}</Kbd>)}
              </span>
              <span className="text-[13px]">{k.desc}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function PokerGuide({ open, onOpenChange }: PokerGuideProps) {
  const tabs: GuideTab[] = [
    { id: 'flow', label: 'Como funciona', content: <FlowTab /> },
    { id: 'decks', label: 'Baralhos', content: <DecksTab /> },
    { id: 'keys', label: 'Atalhos', content: <KeysTab /> },
  ];
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia do poker"
      description="Referência rápida da sala."
      icon={HelpCircle}
      tabs={tabs}
      manualHref="/manual#poker"
    />
  );
}
