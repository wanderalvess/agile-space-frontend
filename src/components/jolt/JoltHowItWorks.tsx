'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { GuideSheet, Kbd } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { SHORTCUT_LABEL } from '@/lib/jolt-shortcuts';
import { Notice } from './JoltBits';

export const HOW_STEPS = [
  { title: 'Dê o exemplo', text: 'No Gerador, cole a entrada e a saída que o destino espera.' },
  { title: 'Confirme', text: 'Ajuste só os campos em dúvida. A spec sai pronta e já conferida no servidor.' },
  { title: 'Refine', text: 'Na Sandbox, ajuste as regras e teste com JSONs reais.' },
  { title: 'Guarde e leve', text: 'Salve o layout e copie ou baixe o arquivo completo da rota.' },
] as const;

export const HOW_OPERATIONS = [
  { name: 'shift', label: 'Mover e renomear', text: 'Copia valores da entrada para a saída, mudando nome ou posição.', spec: '{ "numero": "idPedido" }' },
  { name: 'modify', label: 'Converter valores', text: 'Troca o tipo ou calcula um valor, como texto para número.', spec: '{ "total": "=toDouble" }' },
  { name: 'default', label: 'Valores padrão', text: 'Preenche o que não veio na entrada.', spec: '{ "moeda": "BRL" }' },
  { name: 'cardinality', label: 'Um ou vários', text: 'Força o campo a ser lista (MANY) ou valor único (ONE).', spec: '{ "itens": "MANY" }' },
  { name: 'remove', label: 'Remover', text: 'Tira da saída o que não deve seguir.', spec: '{ "senha": "" }' },
  { name: 'sort', label: 'Ordenar', text: 'Põe as chaves em ordem, para uma saída previsível.', spec: '"sort"' },
] as const;

export const HOW_SHORTCUTS = [
  { keys: SHORTCUT_LABEL.executar, text: 'Executar a transformação (Sandbox)' },
  { keys: SHORTCUT_LABEL.salvar, text: 'Salvar o layout (Sandbox)' },
  { keys: 'Esc', text: 'Fechar menus, folhas e janelas' },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-xs font-bold tracking-wide text-muted-foreground">{children}</h3>;
}

function HowContent() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Caminho recomendado">
        <SectionTitle>Caminho recomendado</SectionTitle>
        <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span aria-hidden="true" className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary/10 text-xs text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                  {i + 1}
                </span>
                {s.title}
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Operações">
        <SectionTitle>As 6 operações</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {HOW_OPERATIONS.map((op) => (
            <div key={op.name} className="flex flex-col gap-1.5 rounded-xl border border-border px-3.5 py-3">
              <span className="flex items-baseline gap-2">
                <span className="font-code text-sm font-bold text-foreground">{op.name}</span>
                <span className="text-xs text-muted-foreground">{op.label}</span>
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">{op.text}</span>
              <code className="rounded-lg bg-muted px-2 py-1.5 font-code text-xs text-foreground">{op.spec}</code>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Atalhos">
        <SectionTitle>Atalhos</SectionTitle>
        <ul className="flex flex-col gap-2">
          {HOW_SHORTCUTS.map((k) => (
            <li key={k.keys} className="flex items-center gap-3 text-[13px]">
              <span className="flex w-[104px] shrink-0 justify-center"><Kbd>{k.keys}</Kbd></span>
              <span className="text-muted-foreground">{k.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <Notice tone="warn" icon={TriangleAlert} role="note" className="text-[13px]">
        <strong>Seus dados saem do navegador.</strong> A execução acontece no servidor do portal: a entrada e a spec
        são enviadas para lá quando você executa ou gera uma spec, e é preciso estar logado. Prefira dados de exemplo.
        Layouts salvos e rascunhos ficam só neste navegador.
      </Notice>
    </div>
  );
}

/** Folha "Como funciona": uma só para o hub, a Sandbox e o Gerador. */
export function JoltHowItWorks({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Como funciona"
      description="O Jolt converte o JSON de uma API no formato de outra, com uma spec."
      icon={moduleIcon('jolt')}
      tabs={[{ id: 'como-funciona', label: 'Como funciona', content: <HowContent /> }]}
      manualHref="/manual/jolt"
    />
  );
}
