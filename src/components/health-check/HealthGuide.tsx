'use client';

import { GuideSheet, type GuideTab } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { ALERT_BELOW, CRITICAL_BELOW, CRITICAL_WORST_SHARE, STRONG_FROM } from '@/lib/health-check-rules';

const STEPS = [
  { title: 'Crie a pesquisa', desc: 'Escolha o modelo de perguntas e a escala. Quem cria é o facilitador.' },
  { title: 'Compartilhe o link', desc: 'Quem abrir o link, estando logado, entra na sala e responde. Não há bloqueio por squad.' },
  { title: 'Cada pessoa responde', desc: 'Uma resposta por pergunta, com comentário opcional. Dá para trocar a resposta até o facilitador encerrar.' },
  { title: 'O facilitador encerra', desc: 'Encerrar é definitivo e pede ao menos um voto. Depois, ninguém altera respostas e o resultado aparece para todos.' },
  { title: 'Leia o resultado e crie as ações', desc: 'Nota de clima, radar, o que está em atenção e o plano de ação a partir dos pontos críticos.' },
] as const;

const SCALES = [
  { title: 'Semáforo', desc: 'Ótimo, Atenção e Ruim. Valem 3, 2 e 1.' },
  { title: 'Numérica de 1 a 5', desc: 'De 1 (crítico) a 5 (muito bom). Cada número vale o próprio valor.' },
  { title: 'Emocional', desc: 'Bom, Médio e Ruim, com rostos de linha. Valem 3, 2 e 1.' },
] as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => String(n).replace('.', ',');

const READING = [
  { title: 'Nota de clima', desc: 'De 0 a 10, igual nas três escalas: a pior resposta vale 0 e a melhor, 10. É a média das notas das dimensões.' },
  { title: 'Forte', desc: `Dimensão com nota de ${num(STRONG_FROM)} ou mais.` },
  { title: 'Alerta', desc: `Dimensão com nota abaixo de ${ALERT_BELOW}.` },
  { title: 'Crítico', desc: `Nota abaixo de ${CRITICAL_BELOW}, ou ${pct(CRITICAL_WORST_SHARE)} ou mais dos votos na pior resposta.` },
] as const;

const PRIVACY = [
  { title: 'O que é anônimo', desc: 'Quem votou e quem comentou. O servidor remove o seu nome do voto antes de mostrar o resultado.' },
  { title: 'O que a squad vê', desc: 'No resultado, todos os votos e comentários, sem nome. Um comentário muito específico pode revelar quem escreveu: evite detalhes que só você sabe.' },
  { title: 'Enquanto coleta', desc: 'Cada pessoa vê só as próprias respostas. Os votos dos outros não chegam ao seu navegador.' },
  { title: 'Quem entrou', desc: 'A lista de participantes mostra quem entrou na sala, não quem já respondeu. O ponto verde marca quem está com a sala aberta agora; "ausente" é quem entrou mas fechou a página.' },
  { title: 'Quem encerra', desc: 'O facilitador (quem criou) e administradores. Ninguém altera respostas depois do encerramento.' },
] as const;

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
      <span className="text-[13px] font-bold">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{desc}</span>
    </div>
  );
}

/** Guia lateral do Radar de clima (kit): como funciona, as escalas e a nota, e a privacidade. */
export function HealthGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tabs: GuideTab[] = [
    {
      id: 'flow',
      label: 'Como funciona',
      content: (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            O Radar é uma pesquisa rápida e anônima do clima da squad. Cada pessoa responde sozinha; o resultado só aparece quando o facilitador encerra.
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
        </div>
      ),
    },
    {
      id: 'scales',
      label: 'Escalas',
      content: (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2" aria-label="Escalas de resposta">
            <h3 className="m-0 text-[13px] font-bold text-muted-foreground">Escalas de resposta</h3>
            {SCALES.map((s) => <Card key={s.title} {...s} />)}
          </section>
          <section className="flex flex-col gap-2" aria-label="Como ler a nota">
            <h3 className="m-0 text-[13px] font-bold text-muted-foreground">Como ler a nota</h3>
            {READING.map((s) => <Card key={s.title} {...s} />)}
          </section>
        </div>
      ),
    },
    {
      id: 'privacy',
      label: 'Privacidade',
      content: (
        <div className="grid grid-cols-1 gap-2.5">
          {PRIVACY.map((s) => <Card key={s.title} {...s} />)}
        </div>
      ),
    },
  ];

  return <GuideSheet open={open} onOpenChange={onOpenChange} title="Guia do radar" description="Como responder, encerrar e ler o resultado." icon={moduleIcon('health')} tabs={tabs} manualHref="/manual/health" />;
}
