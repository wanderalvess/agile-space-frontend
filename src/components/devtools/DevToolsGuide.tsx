'use client';

import React from 'react';
import { Cloud, Monitor, Wrench } from 'lucide-react';
import { GuideSheet, Kbd } from '@/components/room-kit';
import { TONES } from '@/components/room-kit/tokens';
import { networkTools } from '@/lib/devtools/hub';
import { cn } from '@/lib/utils';

/** Guia do DevTools: o que os selos significam, quais ferramentas usam a rede, o que fica no navegador e os atalhos. */
export function DevToolsGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const net = networkTools();
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia do DevTools"
      description="Onde cada ferramenta roda e o que fica guardado."
      icon={Wrench}
      manualHref="/manual"
      tabs={[
        {
          id: 'selos',
          label: 'Selos e rede',
          content: (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-2.5">
                <h3 className="text-[15px] font-bold text-foreground">O que os selos significam</h3>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                  <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">
                    <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Roda no navegador
                  </span>
                  <span className="text-sm leading-normal text-muted-foreground">O que você cola fica na sua máquina. Nada é enviado a servidor.</span>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                  <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', TONES.warn.chip)}>
                    <Cloud className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Usa serviço externo
                  </span>
                  <span className="text-sm leading-normal text-muted-foreground">Parte do que você digita sai do navegador. A lista abaixo diz o que e para onde.</span>
                </div>
              </section>
              <section className="flex flex-col gap-2.5">
                <h3 className="text-[15px] font-bold text-foreground">Ferramentas que usam a rede ({net.length})</h3>
                <ul className="flex flex-col gap-2.5">
                  {net.map((t) => (
                    <li key={t.id} className="flex flex-col gap-1 rounded-xl border border-border px-3.5 py-3">
                      <div className="flex items-baseline justify-between gap-2.5">
                        <strong className="text-sm font-semibold text-foreground">{t.title}</strong>
                        <span className="text-right text-xs font-semibold text-foreground">{t.network?.host}</span>
                      </div>
                      <span className="text-[13px] leading-normal text-muted-foreground">{t.network?.what}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ),
        },
        {
          id: 'navegador',
          label: 'Neste navegador',
          content: (
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold text-foreground">Guardado neste navegador</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Favoritas, recentes, o Cofre de segredos e as massas de dados salvas ficam só aqui, neste navegador e para a sua conta.
                Limpar os dados do navegador apaga tudo.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                O Gerador JUnit guarda a chave do Gemini, se você informar uma, em texto puro no armazenamento do navegador.
                Use uma chave só sua e apague-a quando não precisar mais.
              </p>
            </div>
          ),
        },
        {
          id: 'atalhos',
          label: 'Atalhos',
          content: (
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex items-center gap-3"><Kbd>/</Kbd><span className="text-muted-foreground">Ir para a busca</span></li>
              <li className="flex items-center gap-3"><Kbd>Esc</Kbd><span className="text-muted-foreground">Fechar esta folha</span></li>
              <li className="flex items-center gap-3"><Kbd>Tab</Kbd><span className="text-muted-foreground">Andar pelos cartões; Enter abre a ferramenta</span></li>
            </ul>
          ),
        },
      ]}
    />
  );
}
