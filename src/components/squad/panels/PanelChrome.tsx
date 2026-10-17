'use client';

// Casca do painel único: aviso de dados, "este painel é de outro papel", barra de papéis, chip da unidade de
// estimativa e esqueleto de carregamento.
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Code2, Compass, DatabaseZap, Layers, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { IconTile, ModalButton, StatusChip, BRAND_TEXT, FOCUS_RING } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import type { DashboardTab, DashboardTabId } from '@/lib/dashboard-roles';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------------------------------------------------
// Aviso de dados: diz, em palavras, por que um painel está vazio e qual é o próximo passo (em vez de zeros que
// parecem dado real). Não aparece quando há dados ou enquanto carrega pela primeira vez.
// ---------------------------------------------------------------------------------------------------------------------

export type PanelNoticeKind = 'no-squad' | 'error' | 'not-synced' | 'no-data' | 'empty-sprint';

export function pickNotice(args: {
  hasSquad: boolean;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  /** A squad ainda não tem configuração no servidor (nunca conectou o Jira). null = ainda não sabemos. */
  configMissing: boolean | null;
  /** A sprint escolhida não é a atual. */
  pastSprint: boolean;
}): PanelNoticeKind | null {
  if (!args.hasSquad) return 'no-squad';
  if (args.loading) return null;
  if (args.error) return 'error';
  if (args.hasData) return null;
  if (args.configMissing) return 'not-synced';
  if (args.pastSprint) return 'empty-sprint';
  return 'no-data';
}

const NOTICE_TONE = {
  warn: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  info: 'border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300',
  danger: 'border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300',
} as const;

export function PanelDataNotice({ kind, error, onRetry }: { kind: PanelNoticeKind | null; error?: string | null; onRetry?: () => void }) {
  if (!kind) return null;
  const link = cn('font-semibold hover:underline', BRAND_TEXT);
  const shell = (tone: keyof typeof NOTICE_TONE, Icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>, role: 'status' | 'alert', body: React.ReactNode, action?: React.ReactNode) => (
    <div role={role} className={cn('flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed', NOTICE_TONE[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
      <p className="flex-1 text-foreground">{body}</p>
      {action}
    </div>
  );
  switch (kind) {
    case 'no-squad':
      return shell('warn', Users, 'status', <>Você ainda não está em uma squad, então não há números para mostrar. Escolha a sua equipe em <Link href="/onboarding" className={link}>Primeiros passos</Link>.</>);
    case 'error':
      return shell(
        'danger',
        AlertTriangle,
        'alert',
        <>Não foi possível carregar os dados desta squad agora. {error}</>,
        onRetry && (
          <ModalButton onClick={onRetry} className="h-9 shrink-0 px-3 text-[13px]">
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
          </ModalButton>
        ),
      );
    case 'not-synced':
      return shell('info', DatabaseZap, 'status', <>Esta squad ainda não está ligada ao Jira. Conecte o Jira em Configurar a squad e sincronize a sprint no <Link href="/squad" className={link}>Squad Hub</Link> para os números aparecerem aqui.</>);
    case 'empty-sprint':
      return shell('info', DatabaseZap, 'status', <>Não há itens sincronizados nesta sprint. Escolha outra sprint ou sincronize no <Link href="/squad" className={link}>Squad Hub</Link>.</>);
    default:
      return shell('info', DatabaseZap, 'status', <>Sem dados desta squad ainda. Sincronize a sprint com o Jira no <Link href="/squad" className={link}>Squad Hub</Link> e os números aparecem aqui.</>);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Acesso negado
// ---------------------------------------------------------------------------------------------------------------------

export function PanelAccessDenied({ role, onBackToHub, onOpenMine }: { role: string; onBackToHub: () => void; onOpenMine: () => void }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-[20px] border border-red-500/40 bg-muted/40 px-8 py-10 text-center motion-safe:animate-in motion-safe:fade-in-0">
      <IconTile icon={ShieldAlert} tone="danger" size="lg" />
      <div>
        <h3 className="text-xl font-bold text-foreground">Este painel é de outro papel</h3>
        <p className="mx-auto mt-1.5 max-w-[480px] text-sm leading-relaxed text-muted-foreground">
          Seu papel atual (<b className="text-foreground">{role}</b>) não tem acesso a esta visão. Você pode abrir o painel do seu papel ou voltar ao Squad Hub.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <ModalButton onClick={onBackToHub}>
          <Compass className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Voltar ao Squad Hub
        </ModalButton>
        <ModalButton variant="primary" onClick={onOpenMine}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Abrir o painel do meu papel
        </ModalButton>
      </div>
      <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        Controle só de interface: o servidor libera os dados a qualquer membro da squad. Não é segurança.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Barra de papéis
// ---------------------------------------------------------------------------------------------------------------------

export function PanelRoleTabs({
  tabs,
  activeId,
  onChange,
  showLeadershipTag,
  idPrefix = 'painel',
}: {
  tabs: DashboardTab[];
  activeId: DashboardTabId | null;
  onChange: (id: DashboardTabId) => void;
  showLeadershipTag: boolean;
  idPrefix?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === activeId);
    const next = tabs[(Math.max(i, 0) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    e.preventDefault();
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus());
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <div role="tablist" aria-label="Painéis por papel" onKeyDown={onKeyDown} className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const on = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`${idPrefix}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={on || (activeId === null && tab === tabs[0]) ? 0 : -1}
              title={tab.description}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex h-[38px] items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-colors duration-fast max-sm:min-h-11',
                FOCUS_RING,
                on ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {tab.id === 'custom' && <Code2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              {tab.label}
            </button>
          );
        })}
      </div>
      {showLeadershipTag && (
        <span className="ml-auto inline-flex items-center gap-2">
          <StatusChip>Visão de liderança</StatusChip>
          <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2 text-xs font-semibold text-muted-foreground" title="O servidor libera os dados a qualquer membro da squad">
            Só de interface
          </span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Unidade de estimativa
// ---------------------------------------------------------------------------------------------------------------------

export function EstimationChip({ unitLabel }: { unitLabel: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn('flex items-center gap-1 text-xs font-bold', BRAND_TEXT)}>
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        Unidade de estimativa
      </span>
      {unitLabel ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 text-[13px] font-bold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
          <Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {unitLabel}
        </span>
      ) : (
        <Link
          href="/painel"
          className={cn('inline-flex h-9 items-center gap-2 rounded-xl border border-dashed border-border px-3.5 text-[13px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground', FOCUS_RING)}
        >
          <Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Não definida · Configurar
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Carregando
// ---------------------------------------------------------------------------------------------------------------------

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <div role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
        Carregando o painel
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn(PAGE_CARD, 'h-[200px] rounded-[20px] motion-safe:animate-pulse')} />
        ))}
      </div>
    </div>
  );
}
