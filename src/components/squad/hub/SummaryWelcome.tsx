'use client';

/**
 * Aba Resumo quando a squad ainda não tem dado de sprint.
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

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, Cloud, Flag, Gauge, Loader2, RefreshCw, Users } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { KpiCard, PAGE_CARD } from '@/components/page';
import { IconTile, ModalButton } from '@/components/room-kit';
import { projectService, type ProjectDetail } from '@/services/projectService';
import { pokerApi } from '@/app/room/api';
import { getModule, moduleLabel, type ModuleKey } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { mergeTeamPeople, type TeamPersonSource } from '@/lib/team-people';

export type JiraSyncState = 'idle' | 'syncing' | 'done' | 'no-jira' | 'error';

interface Props {
  squadId: string;
  syncState: JiraSyncState;
  syncError?: string | null;
  myRole?: string;
  /** Pessoas já sincronizadas do Jira (squad_members); somam ao cadastro do projeto na contagem do time. */
  squadMembers?: TeamPersonSource[];
  onRetry: () => void;
  onConnectJira: () => void;
}

const STARTERS: { module: ModuleKey; text: string }[] = [
  { module: 'poker', text: 'Estime o esforço do backlog com o time, em tempo real.' },
  { module: 'retro', text: 'Reflita sobre a sprint e transforme pontos em ações.' },
  { module: 'showcase', text: 'Demonstre as entregas e registre o veredito.' },
  { module: 'health', text: 'Meça a saúde do time com pesquisas rápidas.' },
  { module: 'brainstorming', text: 'Sessões criativas que viram backlog acionável.' },
];

const SYNC_STEPS = ['Conectando ao Jira', 'Buscando a sprint atual do projeto', 'Calculando as métricas do time'];

/** Frase de apoio sob o nome da squad, conforme o que se sabe do Jira. */
function jiraLine(state: JiraSyncState): string {
  switch (state) {
    case 'syncing':
      return 'Buscando a sprint no Jira';
    case 'error':
      return 'Não foi possível ler a sprint agora';
    case 'done':
      return 'Jira conectado, sem sprint aberta';
    default:
      return 'Conecte o Jira para ver a sprint';
  }
}

export function SummaryWelcome({ squadId, syncState, syncError, myRole, squadMembers, onRetry, onConnectJira }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [pokerSessions, setPokerSessions] = useState<number | null | 'erro'>(null);
  const [projectFailed, setProjectFailed] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    projectService.getProjectByKey(squadId).then((p) => alive && setProject(p)).catch(() => alive && setProjectFailed(true));
    pokerApi.listRooms(squadId).then((r) => alive && setPokerSessions(Array.isArray(r) ? r.length : 0)).catch(() => alive && setPokerSessions('erro'));
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
    const t = setInterval(() => setStep((s) => Math.min(s + 1, SYNC_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [syncState]);

  const hasOwnName = !!project?.name && project.name.toUpperCase() !== squadId.toUpperCase();
  const members = useMemo(() => mergeTeamPeople(squadMembers ?? [], project?.members ?? []), [squadMembers, project?.members]);
  const meta = [project?.segmentName, project?.tribeName, project?.locality].filter(Boolean).join(' · ');
  const peopleLabel = `${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'} no time`;

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Quem é a squad (o nome aparece uma vez; a chave só quando é diferente dele) */}
      <section className={cn(PAGE_CARD, 'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6')}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">Visão geral da squad</h2>
          <p className="text-sm text-muted-foreground">{jiraLine(syncState)}</p>
          {(hasOwnName || meta || myRole) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              {hasOwnName && <span className="font-code">{squadId}</span>}
              {meta && <span>{meta}</span>}
              {myRole && <span>você é {myRole}</span>}
            </p>
          )}
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Aqui aparecem as métricas do time conforme vocês usam o portal: sessões, estimativas, retrospectivas e, com o Jira, a sprint atual.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex -space-x-2.5" role="img" aria-label={peopleLabel}>
            {members.slice(0, 6).map((m, i) => (
              <InitialsAvatar key={`${m.key}-${i}`} name={m.displayName} src={m.avatarUrl} className="h-9 w-9 border-2 border-card text-xs" />
            ))}
            {members.length > 6 && (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-semibold text-muted-foreground">
                +{members.length - 6}
              </span>
            )}
          </div>
          <span className="text-[13px] text-muted-foreground">{members.length > 0 ? peopleLabel : 'Time recém-criado'}</span>
        </div>
      </section>

      {/* Estado do Jira */}
      {syncState === 'syncing' && (
        <section className={cn(PAGE_CARD, 'p-5')} role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Sincronizando com o Jira</h2>
              <p className="text-[13px] text-muted-foreground">Buscando as informações da sprint atual de {squadId}. Pode levar até um minuto.</p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {SYNC_STEPS.map((label, i) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors',
                  i < step
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : i === step
                      ? 'border-primary/40 bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground'
                )}
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                ) : i === step ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-border" aria-hidden="true" />
                )}
                {label}
              </li>
            ))}
          </ol>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]" />
          </div>
        </section>
      )}

      {syncState === 'error' && (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Não consegui sincronizar com o Jira agora</h2>
              <p className="text-[13px] text-muted-foreground">{syncError || 'Tente de novo em instantes.'}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ModalButton onClick={onConnectJira}>Atualizar conexão</ModalButton>
            <ModalButton variant="primary" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
            </ModalButton>
          </div>
        </section>
      )}

      {syncState === 'done' && (
        <section className={cn(PAGE_CARD, 'flex items-start gap-3 p-5')}>
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">Jira conectado, sem sprint aberta agora</h2>
            <p className="text-[13px] text-muted-foreground">
              Sincronizei {squadId} e não há sprint em andamento. Quando uma sprint abrir, as métricas aparecem aqui sozinhas.
            </p>
          </div>
          <ModalButton onClick={onRetry} className="shrink-0 gap-1.5">
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Sincronizar
          </ModalButton>
        </section>
      )}

      {syncState === 'no-jira' && (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">Quer ver a sprint aqui?</h2>
            <p className="text-[13px] text-muted-foreground">
              Conecte o Jira e as informações da sprint atual de {squadId} aparecem neste resumo. É opcional.
            </p>
          </div>
          <ModalButton onClick={onConnectJira} className="shrink-0">Conectar Jira</ModalButton>
        </section>
      )}

      {/* Métricas de uso */}
      <section aria-label="Métricas do time" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> O que o resumo vai mostrar
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Pessoas no time"
            value={!project && !projectFailed ? '…' : projectFailed ? '—' : String(members.length)}
            hint={projectFailed ? 'Não foi possível carregar o cadastro do projeto' : 'Vindas do cadastro do projeto'}
          />
          <KpiCard
            label="Sessões de Poker"
            value={pokerSessions === null ? '…' : typeof pokerSessions === 'number' ? String(pokerSessions) : '—'}
            hint={pokerSessions === 'erro' ? 'Não foi possível carregar as salas' : pokerSessions ? 'Salas criadas pelo time' : 'Aparece após a primeira sala'}
          />
          <KpiCard label="Sprint atual" value={syncState === 'syncing' ? '…' : '—'} hint="Itens, progresso e board, via Jira" />
          <KpiCard label="Retrospectivas" value="—" hint="Ações e clima, conforme o uso" />
        </div>
      </section>

      {/* Comece por aqui */}
      <section aria-label="Cerimônias" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Flag className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Comece por aqui
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {STARTERS.map((c) => {
            const m = getModule(c.module);
            return (
              <Link
                key={c.module}
                href={m.href}
                className={cn(PAGE_CARD, 'group flex items-start gap-3 p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
              >
                <IconTile icon={m.icon} size="md" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                    {moduleLabel(c.module)}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{c.text}</span>
                </span>
              </Link>
            );
          })}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Users className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ver todas as ferramentas
          </Link>
        </div>
      </section>
    </div>
  );
}
