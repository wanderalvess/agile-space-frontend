'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

type Answer = 'yes' | 'no' | null;

/**
 * "Este tópico ajudou?" Resposta só visual, neste aparelho: nada é gravado nem enviado.
 * Por isso o texto não promete ajuste; quem quer ser ouvido segue para o Suporte.
 */
export function TopicHelpful({ topicId }: { topicId: string }) {
  const [answer, setAnswer] = useState<Answer>(null);
  // Troca de tópico começa sem resposta (o componente é remontado pela chave do tópico).
  const btn = (on: boolean) =>
    cn(
      'h-8 rounded-lg border px-3.5 text-sm font-medium text-foreground hover:bg-accent max-sm:h-11',
      on ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border bg-transparent',
      FOCUS_RING,
    );

  return (
    <section aria-label="Este tópico ajudou?" data-topic={topicId} className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="flex-1 basis-40">Este tópico ajudou?</span>
        <button type="button" aria-pressed={answer === 'yes'} onClick={() => setAnswer('yes')} className={btn(answer === 'yes')}>
          Sim
        </button>
        <button type="button" aria-pressed={answer === 'no'} onClick={() => setAnswer('no')} className={btn(answer === 'no')}>
          Não
        </button>
      </div>
      <div role="status" className="text-sm text-muted-foreground">
        {answer === 'yes' && <p>Que bom que ajudou.</p>}
        {answer === 'no' && (
          <p>
            Sentimos muito. Conte ao time o que faltou: <Link href="/support" className={cn('rounded-sm font-semibold text-foreground underline underline-offset-2', FOCUS_RING)}>abra um chamado no Suporte</Link>.
          </p>
        )}
      </div>
    </section>
  );
}
