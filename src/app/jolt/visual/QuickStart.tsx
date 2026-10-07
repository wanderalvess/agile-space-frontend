'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const QUICKSTART_STORAGE_KEY = 'jolt_visual_quickstart_dismissed';

const STEPS = [
  { title: 'Cole os JSONs', text: 'Cole um JSON de origem e um de destino de exemplo nos painéis e clique em Analisar JSON.' },
  { title: 'Ligue os campos', text: 'Arraste do ponto de um campo de origem até o campo de destino. Auto-Mapear liga os de mesmo nome.' },
  { title: 'Gere e refine', text: 'Gere a spec Jolt e abra na Sandbox para ajustar e testar com JSONs reais.' },
];

interface QuickStartProps {
  onDismiss: () => void;
}

// Passo-a-passo curto e dispensável do Mapeador Visual. Quem decide se aparece é a página
// (lê/grava o "dispensar" no localStorage); aqui só há apresentação.
export function QuickStart({ onDismiss }: QuickStartProps) {
  return (
    <section aria-label="Como começar" className="relative shrink-0 rounded-2xl border border-border bg-card p-3 pr-10 shadow-sm">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Como começar</h2>
      <ol className="mt-2 grid max-h-32 grid-cols-1 gap-2 overflow-y-auto sm:max-h-none sm:grid-cols-3 sm:overflow-visible">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{i + 1}</span>
            <span className="min-w-0 text-xs leading-snug">
              <strong className="block font-headline text-[11px] font-black uppercase tracking-tight text-foreground">{step.title}</strong>
              <span className="font-medium text-muted-foreground">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="absolute right-2 top-2 h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label="Dispensar passo-a-passo"
        title="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </section>
  );
}
