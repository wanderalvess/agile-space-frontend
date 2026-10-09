'use client';

/**
 * Primeira tela do /painel quando a squad ainda não tem dado de sprint.
 *
 * Estados do Jira:
 *  - syncing: sincronizando agora (carregamento com etapas)
 *  - error: falhou; mostra o motivo e permite tentar de novo
 *  - no-jira: sem token salvo; oferece conectar
 *  - done: sincronizou mas não há sprint aberta no Jira
 *  - idle: ainda não tentou
 *
 * Números reais de uso (pessoas, sessões de poker) vêm da API; nada é inventado.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Flame,
  Gauge,
  HeartPulse,
  Layers,
  Lightbulb,
  Loader2,
  Presentation,
  RefreshCw,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MemberAvatar } from '@/components/common/MemberAvatar';
import { projectService, type ProjectDetail } from '@/services/projectService';
import { pokerApi } from '@/app/room/api';
import { cn } from '@/lib/utils';

export type JiraSyncState = 'idle' | 'syncing' | 'done' | 'no-jira' | 'error';

interface Props {
  squadId: string;
  syncState: JiraSyncState;
  syncError?: string | null;
  myRole?: string;
  onRetry: () => void;
  onConnectJira: () => void;
}

const CEREMONIES = [
  { href: '/room', label: 'Scrum Poker', text: 'Estime o esforço do backlog com o time, em tempo real.', icon: Layers },
  { href: '/retro', label: 'Retrospectiva', text: 'Reflita sobre a sprint e transforme pontos em ações.', icon: Flame },
  { href: '/showcase', label: 'Review', text: 'Demonstre as entregas e registre o veredito.', icon: Presentation },
  { href: '/health-check', label: 'Radar de Clima', text: 'Meça a saúde do time com pesquisas rápidas.', icon: HeartPulse },
  { href: '/brainstorming', label: 'Ideias', text: 'Sessões criativas que viram backlog acionável.', icon: Lightbulb },
];

const SYNC_STEPS = [
  'Conectando ao Jira',
  'Buscando a sprint atual do projeto',
  'Calculando as métricas do time',
];

function Metric({ label, value, hint, loading }: { label: string; value: string; hint: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-headline text-3xl font-black tracking-tight">{loading ? '…' : value}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div>
    </div>
  );
}

export function PainelWelcome({ squadId, syncState, syncError, myRole, onRetry, onConnectJira }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [pokerSessions, setPokerSessions] = useState<number | null | "erro">(null);
  const [projectFailed, setProjectFailed] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    projectService.getProjectByKey(squadId).then(p => alive && setProject(p)).catch(() => alive && setProjectFailed(true));
    pokerApi.listRooms(squadId).then(r => alive && setPokerSessions(Array.isArray(r) ? r.length : 0)).catch(() => alive && setPokerSessions("erro"));
    return () => {
      alive = false;
    };
  }, [squadId]);

  // Etapas do carregamento: avançam sozinhas só para dar noção de progresso (a sync é uma chamada só).
  useEffect(() => {
    if (syncState !== 'syncing') {
      setStep(0);
      return;
    }
    const t = setInterval(() => setStep(s => Math.min(s + 1, SYNC_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [syncState]);

  const teamName = project?.name && project.name.toUpperCase() !== squadId.toUpperCase() ? project.name : squadId;
  const members = project?.members ?? [];
  const meta = [project?.segmentName, project?.tribeName, project?.locality].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-6 shadow-sm backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-3">
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Seu time foi criado no Portal Tech V&amp;D
            </Badge>
            <h1 className="font-headline text-3xl font-black leading-tight tracking-tight md:text-4xl">{teamName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-code text-[10px]">{squadId}</Badge>
              {meta && <span>{meta}</span>}
              {myRole && <span>· você é {myRole}</span>}
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Aqui aparecem as métricas do time conforme vocês usam o portal: sessões, estimativas, retrospectivas e, com o Jira, a sprint atual.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
            <div className="flex -space-x-2.5" aria-label={`${members.length} pessoas no time`}>
              {members.slice(0, 6).map((m, i) => (
                <MemberAvatar key={`${m.email || m.displayName}-${i}`} name={m.displayName} src={m.avatarUrl} className="h-9 w-9 border-2 border-background" />
              ))}
              {members.length > 6 && (
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[10px] font-black text-primary">
                  +{members.length - 6}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {members.length > 0 ? `${members.length} pessoas no time` : 'Time recém-criado'}
            </span>
          </div>
        </div>
      </section>

      {/* STATUS DO JIRA */}
      {syncState === 'syncing' && (
        <section className="rounded-3xl border border-primary/25 bg-card/80 p-5 backdrop-blur-xl" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-black">Sincronizando com o Jira</h2>
              <p className="text-xs text-muted-foreground">Buscando as informações da sprint atual de {squadId}. Pode levar até um minuto.</p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {SYNC_STEPS.map((label, i) => (
              <li key={label} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                i < step ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                  : i === step ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border/60 text-muted-foreground')}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-border" />}
                {label}
              </li>
            ))}
          </ol>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full w-1/3 animate-[pulse_1.6s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </section>
      )}

      {syncState === 'error' && (
        <section className="flex flex-col gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            <div>
              <h2 className="text-sm font-black">Não consegui sincronizar com o Jira agora</h2>
              <p className="text-xs text-muted-foreground">{syncError || 'Tente de novo em instantes.'}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onConnectJira} className="h-9 rounded-xl text-[11px] font-black uppercase tracking-widest">Atualizar conexão</Button>
            <Button onClick={onRetry} className="h-9 gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest">
              <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
            </Button>
          </div>
        </section>
      )}

      {syncState === 'done' && (
        <section className="flex items-start gap-3 rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <h2 className="text-sm font-black">Jira conectado, sem sprint aberta agora</h2>
            <p className="text-xs text-muted-foreground">
              Sincronizei {squadId} e não há sprint em andamento. Quando uma sprint abrir, as métricas aparecem aqui sozinhas.
            </p>
          </div>
          <Button variant="outline" onClick={onRetry} className="h-9 shrink-0 gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest">
            <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
          </Button>
        </section>
      )}

      {syncState === 'no-jira' && (
        <section className="flex flex-col gap-3 rounded-3xl border border-dashed border-border bg-card/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black">Quer ver a sprint aqui?</h2>
            <p className="text-xs text-muted-foreground">Conecte o Jira e as informações da sprint atual de {squadId} aparecem neste painel. É opcional.</p>
          </div>
          <Button variant="outline" onClick={onConnectJira} className="h-9 shrink-0 rounded-xl text-[11px] font-black uppercase tracking-widest">Conectar Jira</Button>
        </section>
      )}

      {/* MÉTRICAS DE USO */}
      <section aria-label="Métricas do time" className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" /> O que o painel vai mostrar
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Pessoas no time" value={projectFailed ? "—" : String(members.length)} hint={projectFailed ? "Não foi possível carregar o cadastro do projeto" : "Vindas do cadastro do projeto"} loading={!project && !projectFailed} />
          <Metric
            label="Sessões de Poker"
            value={typeof pokerSessions === "number" ? String(pokerSessions) : "—"}
            hint={pokerSessions === "erro" ? "Não foi possível carregar as salas" : pokerSessions ? 'Salas criadas pelo time' : 'Aparece após a primeira sala'}
            loading={pokerSessions === null}
          />
          <Metric label="Sprint atual" value={syncState === 'syncing' ? '…' : '—'} hint="Itens, progresso e board, via Jira" />
          <Metric label="Retrospectivas" value="—" hint="Ações e clima, conforme o uso" />
        </div>
      </section>

      {/* COMECE POR AQUI */}
      <section aria-label="Cerimônias" className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          <Rocket className="h-3.5 w-3.5" /> Comece por aqui
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CEREMONIES.map(c => {
            const Icon = c.icon;
            return (
              <Link key={c.href} href={c.href}
                className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur transition-all hover:border-primary/40 hover:shadow-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-black group-hover:text-primary">{c.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">{c.text}</span>
                </span>
              </Link>
            );
          })}
          <Link href="/" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-xs font-black uppercase tracking-widest text-muted-foreground hover:border-primary/40 hover:text-primary">
            <Users className="h-4 w-4" /> Ver todas as ferramentas
          </Link>
        </div>
      </section>
    </div>
  );
}
