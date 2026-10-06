'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  FileJson,
  Network,
  PenLine,
  Terminal,
  Workflow,
} from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Mode {
  href: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  summary: string;
  useWhen: string[];
  input: string;
  output: string;
  extras: string[];
  cta: string;
}

const MODES: Mode[] = [
  {
    href: '/jolt/sandbox',
    icon: <PenLine className="h-5 w-5 text-primary" />,
    tag: 'Você escreve a spec',
    title: 'Jolt Sandbox',
    summary: 'Cole o JSON de entrada, escreva a especificação Jolt e veja o resultado ao lado, na hora. É o laboratório para testar e depurar.',
    useWhen: [
      'Você já conhece a sintaxe do Jolt ou tem uma spec pronta.',
      'Precisa ajustar ou depurar uma transformação que está dando errado.',
      'Quer conferir se o resultado em JavaScript bate com o da produção (Java).',
    ],
    input: 'JSON de entrada + spec Jolt',
    output: 'JSON transformado',
    extras: [
      'Três motores: JavaScript (instantâneo, no navegador), Java (oficial Bazaarvoice, no backend) e Comparar (roda os dois e aponta diferenças).',
      'Salva e recarrega layouts de trabalho.',
    ],
    cta: 'Abrir Sandbox',
  },
  {
    href: '/jolt/visual',
    icon: <Network className="h-5 w-5 text-primary" />,
    tag: 'Você desenha o mapa',
    title: 'Mapeador Visual',
    summary: 'Ligue campos de origem a campos de destino num quadro e a spec Jolt é gerada para você. Sem decorar sintaxe.',
    useWhen: [
      'Você não domina a sintaxe do Jolt ou quer começar sem escrever nada.',
      'O mapeamento é grande, campo a campo, e vale documentar o de-para.',
      'Quer um ponto de partida para depois refinar na Sandbox.',
    ],
    input: 'JSON de origem + JSON de destino de exemplo',
    output: 'Spec Jolt pronta (abre na Sandbox)',
    extras: [
      'Projetos salvos no navegador ou na nuvem, com histórico de versões e restauração.',
      'Executa a spec gerada em JavaScript ou Java para conferir o resultado.',
    ],
    cta: 'Abrir Mapeador',
  },
];

const FLOW = [
  { title: 'Desenhe', text: 'No Mapeador Visual, ligue os campos de origem aos de destino.' },
  { title: 'Gere a spec', text: 'A spec Jolt é montada e aberta na Sandbox.' },
  { title: 'Refine', text: 'Na Sandbox, ajuste regras e teste com JSONs reais.' },
  { title: 'Confirme no Java', text: 'Use o modo Comparar para garantir que produção terá o mesmo resultado.' },
];

const OPERATIONS = [
  { name: 'shift', label: 'Mover e renomear', text: 'Copia valores da entrada para a saída, mudando nome ou posição.', spec: '{ "nome": "cliente.nome" }' },
  { name: 'default', label: 'Valores padrão', text: 'Preenche campos que não vieram na entrada.', spec: '{ "status": "ativo" }' },
  { name: 'remove', label: 'Remover', text: 'Tira da saída as propriedades indesejadas.', spec: '{ "senha": "" }' },
  { name: 'sort', label: 'Ordenar', text: 'Ordena as chaves para uma saída previsível, útil em testes.', spec: '"sort"' },
];

function ModeCard({ mode }: { mode: Mode }) {
  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/60 p-7 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-transform duration-700 group-hover:scale-125 dark:bg-primary/10" />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">{mode.icon}</div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800/80 dark:bg-slate-950">
          {mode.tag}
        </span>
      </div>
      <h2 className="relative z-10 mt-4 font-headline text-2xl font-black uppercase tracking-tight text-slate-950 transition-colors group-hover:text-primary dark:text-slate-50">
        {mode.title}
      </h2>
      <p className="relative z-10 mt-2 text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{mode.summary}</p>

      <div className="relative z-10 mt-5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-background/60 p-3 text-xs">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Você entrega</span>
        <span className="font-semibold text-foreground">{mode.input}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Você recebe</span>
        <span className="font-semibold text-foreground">{mode.output}</span>
      </div>

      <h3 className="relative z-10 mt-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Use quando</h3>
      <ul className="relative z-10 mt-2 space-y-1.5">
        {mode.useWhen.map(item => (
          <li key={item} className="flex gap-2 text-[13px] font-medium leading-snug text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> {item}
          </li>
        ))}
      </ul>

      <ul className="relative z-10 mb-6 mt-4 space-y-1.5 border-t border-border/60 pt-4">
        {mode.extras.map(item => (
          <li key={item} className="text-xs font-medium leading-snug text-muted-foreground">{item}</li>
        ))}
      </ul>

      <Button asChild className="relative z-10 mt-auto h-10 w-full rounded-xl border-none bg-primary text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground hover:bg-orange-600">
        <Link href={mode.href}>
          {mode.cta} <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
}

export default function JoltHubPage() {
  useEffect(() => {
    document.title = 'Jolt | Portal Tech V&D';
  }, []);

  return (
    <div className="relative min-h-dvh bg-[#fafafa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-[-10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[140px]" />
      </div>
      <RoomHeader title="Jolt" toolIcon={<Terminal className="h-4 w-4" />} />

      <main className="mx-auto w-full max-w-[1200px] space-y-10 px-4 py-6 md:px-8">
        <section className="space-y-2">
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight sm:text-4xl">Transforme JSON sem escrever código</h1>
          <p className="max-w-2xl text-sm font-medium text-muted-foreground">
            O Jolt descreve, em uma especificação JSON, como converter um JSON de entrada em outro formato. Aqui há dois jeitos de chegar lá: escrever a spec
            você mesmo ou desenhar o mapa e deixar a spec ser gerada.
          </p>
        </section>

        <section aria-label="Modos" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {MODES.map(mode => (
            <ModeCard key={mode.href} mode={mode} />
          ))}
        </section>

        <section aria-label="Fluxo recomendado" className="space-y-4">
          <div>
            <h2 className="font-headline text-xl font-black uppercase tracking-tight">Os dois juntos funcionam melhor</h2>
            <p className="text-sm font-medium text-muted-foreground">Quem está começando costuma seguir este caminho.</p>
          </div>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {FLOW.map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border border-border bg-card p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{i + 1}</span>
                <h3 className="mt-3 text-sm font-black uppercase tracking-tight">{step.title}</h3>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">{step.text}</p>
                {i < FLOW.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground md:block" aria-hidden />}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Referência das operações" className="space-y-4">
          <div>
            <h2 className="font-headline text-xl font-black uppercase tracking-tight">As quatro operações do Jolt</h2>
            <p className="text-sm font-medium text-muted-foreground">Toda spec combina estas operações, aplicadas em ordem.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OPERATIONS.map(op => (
              <Card key={op.name} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-code text-sm font-bold">{op.name}</span>
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider">{op.label}</h3>
                <p className="text-xs font-medium leading-relaxed text-muted-foreground">{op.text}</p>
                <code className="mt-auto rounded-lg bg-muted px-2 py-1.5 font-code text-[11px] text-foreground">{op.spec}</code>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-xs font-medium text-muted-foreground">
          <FileJson className="h-4 w-4 shrink-0" aria-hidden />
          <span>Precisa só formatar, validar ou converter JSON?</span>
          <Link href="/devtools/json" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
            <Workflow className="h-3.5 w-3.5" aria-hidden /> Use o JSON Studio no DevTools
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
