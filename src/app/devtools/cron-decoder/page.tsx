'use client';

import { useMemo, useState } from 'react';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/pt_BR';
import { CronExpressionParser } from 'cron-parser';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { cn } from '@/lib/utils';

const PRESETS: { exp: string; desc: string }[] = [
  { exp: '* * * * *', desc: 'Todo minuto' },
  { exp: '*/15 * * * *', desc: 'A cada 15 minutos' },
  { exp: '0 * * * *', desc: 'No início de toda hora' },
  { exp: '0 9 * * 1-5', desc: 'Dias úteis às 09:00' },
  { exp: '0 0 * * 0', desc: 'Todo domingo à meia-noite' },
  { exp: '0 0 1 * *', desc: 'Todo dia 1º do mês' },
  { exp: '0 0 1 1 *', desc: '1º de janeiro, uma vez por ano' },
];

const FIELDS = ['minuto (0-59)', 'hora (0-23)', 'dia do mês (1-31)', 'mês (1-12)', 'dia da semana (0-6, dom=0)'];
const NEXT_COUNT = 10;

// Traduz a expressão e calcula as próximas execuções; qualquer falha vira mensagem.
function decode(expression: string): { text: string; dates: Date[]; error: string | null } {
  if (!expression.trim()) return { text: '', dates: [], error: 'Informe uma expressão cron.' };
  try {
    const text = cronstrue.toString(expression, { locale: 'pt_BR' });
    const it = CronExpressionParser.parse(expression);
    const dates: Date[] = [];
    for (let i = 0; i < NEXT_COUNT; i++) dates.push(it.next().toDate());
    return { text, dates, error: null };
  } catch {
    return { text: '', dates: [], error: 'Expressão cron inválida ou incompleta.' };
  }
}

export default function CronDecoderPage() {
  const [expression, setExpression] = useState('*/15 * * * *');
  const [copied, setCopied] = useState(false);
  const { text, dates, error } = useMemo(() => decode(expression), [expression]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(expression);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard bloqueado: sem feedback, o texto continua selecionável */
    }
  };

  return (
    <DevToolPage toolId="cron-decoder">
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {/* Entrada: expressão, atalhos e legenda dos campos */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expressão cron</h2>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div className="flex items-center gap-2">
              <Input
                value={expression}
                onChange={e => setExpression(e.target.value)}
                placeholder="* * * * *"
                spellCheck={false}
                aria-label="Expressão cron"
                className={cn('h-12 rounded-xl text-center font-code text-lg font-bold tracking-widest', error && 'border-destructive text-destructive')}
              />
              <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl" onClick={copy} aria-label="Copiar expressão">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center">
              {FIELDS.map((f, i) => (
                <div key={f} className="rounded-lg border border-border bg-background px-1 py-1.5">
                  <p className="font-code text-[10px] font-bold text-primary">{expression.trim().split(/\s+/)[i] ?? '·'}</p>
                  <p className="text-[9px] font-semibold leading-tight text-muted-foreground">{f}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Atalhos</p>
              <div className="space-y-1">
                {PRESETS.map(p => (
                  <button
                    key={p.exp}
                    type="button"
                    onClick={() => setExpression(p.exp)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <code className="font-code text-xs font-bold text-primary">{p.exp}</code>
                    <span className="text-xs font-medium text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] font-medium text-muted-foreground">
              Símbolos: <code className="font-code font-bold text-foreground">*</code> qualquer valor,{' '}
              <code className="font-code font-bold text-foreground">,</code> lista,{' '}
              <code className="font-code font-bold text-foreground">-</code> intervalo,{' '}
              <code className="font-code font-bold text-foreground">/</code> passo.
            </p>
          </div>
        </section>

        {/* Resultado: tradução e próximas execuções */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado</h2>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{error}</p>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Em português</p>
                  <p className="mt-1 font-headline text-xl font-black leading-snug">{text}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Próximas {NEXT_COUNT} execuções (horário local)</p>
                  {dates.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-1.5">
                      <span className="w-5 text-[10px] font-black text-muted-foreground">{i + 1}</span>
                      <span className="font-code text-xs font-bold">
                        {d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
