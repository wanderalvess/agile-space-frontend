'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Check, Clock, FileText, Lock, PenLine, Wand2, type LucideIcon } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/room-kit';
import { FOCUS_RING, OUTLINE_BUTTON } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { SHORTCUT_LABEL } from '@/lib/jolt-shortcuts';
import { formatRecent, readLayouts, recentLayouts, type SavedLayout } from '@/lib/jolt-storage';
import { GuestBanner, LoginRequiredDialog, useJoltIdentity } from '@/components/jolt/JoltBits';
import { JoltHowItWorks } from '@/components/jolt/JoltHowItWorks';
import { JoltNav, joltHeaderProps } from '@/components/jolt/JoltNav';

interface Mode {
  href: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  summary: string;
  when: string[];
  give: string;
  get: string;
  sample: string;
  cta: string;
  keys: { k: string; d: string }[];
}

const MODES: Mode[] = [
  {
    href: '/jolt/sandbox',
    icon: PenLine,
    tag: 'Você escreve a spec',
    title: 'Sandbox',
    summary: 'Cole o JSON de entrada, escreva a spec e veja a saída ao lado. É o lugar para testar, depurar e guardar layouts.',
    when: [
      'Você já conhece a sintaxe ou tem uma spec pronta.',
      'Uma transformação está dando errado e precisa de ajuste.',
      'Quer testar a spec com JSONs reais antes de levar para a rota.',
    ],
    give: 'JSON de entrada e spec',
    get: 'JSON transformado',
    sample: '{ "pedido": { "numero": "idPedido",\n              "total": "valorTotal" } }',
    cta: 'Abrir Sandbox',
    keys: [{ k: SHORTCUT_LABEL.executar, d: 'executa' }, { k: SHORTCUT_LABEL.salvar, d: 'salva' }],
  },
  {
    href: '/jolt/gerador',
    icon: Wand2,
    tag: 'Você dá o exemplo',
    title: 'Gerador de spec',
    summary: 'Cole a entrada da API de origem e a saída que o destino espera. O portal descobre de onde vem cada campo e monta a spec.',
    when: [
      'Você tem um registro de exemplo e sabe como ele deve chegar.',
      'Vai começar uma rota nova sem escrever spec à mão.',
      'Quer provar que a spec gera a saída do contrato.',
    ],
    give: 'Entrada e saída esperada',
    get: 'Spec conferida, pronta para a Sandbox',
    sample: 'entrada  { "numero": 458213 }\nsaída    { "idPedido": 458213 }\nregra    idPedido  copia  pedido.numero',
    cta: 'Abrir Gerador',
    keys: [{ k: '3 passos', d: 'exemplos, regras, spec' }],
  },
];

function ModeCard({ mode }: { mode: Mode }) {
  const Icon = mode.icon;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors duration-base hover:border-primary/50">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">{mode.tag}</span>
          <h2 className="text-[22px] font-bold leading-tight text-foreground">{mode.title}</h2>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{mode.summary}</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground">Quando usar</h3>
          <ul className="flex flex-col gap-2">
            {mode.when.map((w) => (
              <li key={w} className="flex gap-2 text-sm leading-snug text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.8} aria-hidden="true" />
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground">O que entrega</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px]">
            <dt className="text-muted-foreground">Você dá</dt>
            <dd className="font-semibold text-foreground">{mode.give}</dd>
            <dt className="text-muted-foreground">Você recebe</dt>
            <dd className="font-semibold text-foreground">{mode.get}</dd>
          </dl>
          <pre aria-label="Exemplo" className="overflow-auto rounded-xl bg-muted px-3.5 py-3 font-code text-xs leading-relaxed text-foreground">{mode.sample}</pre>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button asChild className="h-10 rounded-[10px] px-4 font-bold">
          <Link href={mode.href}>
            {mode.cta}
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
        <span className="inline-flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
          {mode.keys.map((k) => (
            <span key={k.k} className="inline-flex items-center gap-1.5">
              <Kbd>{k.k}</Kbd>
              {k.d}
            </span>
          ))}
        </span>
      </div>
    </article>
  );
}

function RecentLayouts({ layouts, total }: { layouts: SavedLayout[]; total: number }) {
  return (
    <>
      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {layouts.map((l) => (
          <li key={l.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors duration-base hover:border-primary/50">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[15px] font-bold text-foreground" title={l.name}>{l.name || 'Layout sem nome'}</span>
              <span className="truncate font-code text-xs text-muted-foreground" title={l.apiUrl}>{l.apiUrl || 'Sem URL de origem'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                {formatRecent(l.updatedAt)}
              </span>
              <Link
                href={`/jolt/sandbox?layout=${encodeURIComponent(l.id)}`}
                aria-label={`Abrir ${l.name || 'layout sem nome'}`}
                className={cn('inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold', OUTLINE_BUTTON, FOCUS_RING)}
              >
                Abrir
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {total > layouts.length && <p className="sr-only">Mostrando os {layouts.length} mais recentes de {total}.</p>}
    </>
  );
}

export default function JoltHubPage() {
  const router = useRouter();
  const id = useJoltIdentity();
  const [howOpen, setHowOpen] = useState(false);
  const [layouts, setLayouts] = useState<SavedLayout[] | null>(null);

  useEffect(() => {
    if (id.isLoading) return;
    setLayouts(id.userId ? readLayouts(id.userId) : []);
  }, [id.isLoading, id.userId]);

  const recent = layouts ? recentLayouts(layouts, 4) : [];

  return (
    <PageShell documentTitle="Jolt" header={joltHeaderProps(id.isGuest)}>
      <JoltNav active="inicio" />
      <PageHeader
        title="Jolt"
        module="jolt"
        subtitle="Converta o JSON de uma API no formato que outra espera."
        actions={
          <Button variant="outline" onClick={() => setHowOpen(true)} className="h-10 gap-2 rounded-[10px] px-4 font-semibold">
            <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Como funciona
          </Button>
        }
      />

      {id.isGuest && (
        <GuestBanner onLogin={id.askLogin}>
          <strong>Entre para executar.</strong> Você pode ver os modos e ler o guia sem entrar. Executar, gerar e salvar layouts pedem login.
        </GuestBanner>
      )}

      <section aria-label="Modos" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {MODES.map((m) => (
          <ModeCard key={m.href} mode={m} />
        ))}
      </section>

      <section aria-labelledby="recentes-titulo" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="recentes-titulo" className="text-lg font-bold text-foreground">Seus layouts recentes</h2>
          {layouts && layouts.length > recent.length && (
            <span className="text-[13px] text-muted-foreground">Mostrando os {recent.length} mais recentes de {layouts.length}</span>
          )}
        </div>

        {id.isGuest && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-8">
            <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-muted text-muted-foreground"><Lock className="h-[22px] w-[22px]" strokeWidth={1.5} /></span>
            <div className="flex min-w-[260px] flex-1 flex-col gap-1">
              <strong className="text-base text-foreground">Entre para ver os seus layouts</strong>
              <span className="text-sm leading-relaxed text-muted-foreground">Os layouts salvos ficam ligados ao seu usuário neste navegador.</span>
            </div>
            <Button variant="outline" onClick={id.askLogin} className="h-10 rounded-[10px] px-4 font-semibold">Entrar</Button>
          </div>
        )}

        {!id.isGuest && layouts && layouts.length === 0 && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-8">
            <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-muted text-muted-foreground"><FileText className="h-[22px] w-[22px]" strokeWidth={1.5} /></span>
            <div className="flex min-w-[260px] flex-1 flex-col gap-1">
              <strong className="text-base text-foreground">Nenhum layout salvo ainda</strong>
              <span className="text-sm leading-relaxed text-muted-foreground">
                Na Sandbox, aperte <Kbd>{SHORTCUT_LABEL.salvar}</Kbd> para guardar a spec e a última entrada. Os layouts ficam neste navegador, ligados ao seu usuário.
              </span>
            </div>
            <Button onClick={() => router.push('/jolt/sandbox')} className="h-10 rounded-[10px] px-4 font-bold">Abrir Sandbox</Button>
          </div>
        )}

        {!id.isGuest && layouts && layouts.length > 0 && <RecentLayouts layouts={recent} total={layouts.length} />}
      </section>

      <JoltHowItWorks open={howOpen} onOpenChange={setHowOpen} />
      <LoginRequiredDialog open={id.loginOpen} onOpenChange={(o) => (o ? id.askLogin() : id.closeLogin())} onLogin={id.goLogin} />
    </PageShell>
  );
}
