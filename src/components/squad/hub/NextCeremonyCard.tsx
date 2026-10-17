'use client';

/**
 * Cartão "Próxima cerimônia" da aba Resumo. Lê UMA fonte só (SquadConfig.ceremonyMode, ver
 * useNextCeremony) — Google Calendar pessoal (OAuth client-side, sem mexer no login do
 * Portal Tech V&D) ou cadastro manual da squad — e mostra a próxima daily/planning/review/
 * retro/refinement/showcase.
 *
 * Sem dado real nunca inventa horário: cobre "sem conexão"/"sem cadastro", "carregando",
 * "erro" e "nada encontrado" como estados explícitos, pras duas fontes.
 * No modo manual, a lista de todas as cerimônias combinadas fica no mesmo cartão (antes era o
 * bloco "Cerimônias combinadas" da Visão geral).
 */

import { useState } from 'react';
import { CalendarClock, Link2, RefreshCw, Settings, Users, Video } from 'lucide-react';
import { SidePanelSection } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useNextCeremony } from '@/hooks/useNextCeremony';
import { formatCountdown } from '@/lib/ceremony-countdown';
import { safeHref } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import type { SquadCeremony } from '@/lib/types';
import { describeDays } from '@/components/squad/SquadRituals';
import { CeremonySettingsDialog } from './CeremonySettingsDialog';

function formatTimeRange(start: Date, end: Date, isAllDay: boolean) {
  if (isAllDay) return 'Dia inteiro';
  const fmt = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)}–${fmt(end)}`;
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${rest}min` : `${hours}h`;
}

const MUTED = 'text-[13px] leading-relaxed text-muted-foreground';
const SMALL_BUTTON = 'h-9 gap-2 px-3 text-[13px]';

function Shell({ onOpenSettings, children }: { onOpenSettings?: () => void; children: React.ReactNode }) {
  return (
    <SidePanelSection
      title="Próxima cerimônia"
      icon={CalendarClock}
      action={
        onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurar fonte da próxima cerimônia"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )
      }
    >
      {children}
    </SidePanelSection>
  );
}

export function NextCeremonyCard({ squadId, userKey }: { squadId: string; userKey: string }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    isGoogleConfigured,
    mode,
    isLoadingConfig,
    configError,
    manualCeremonies,
    estimationUnit,
    isConnected,
    isConnecting,
    isLoadingEvents,
    connectionError,
    eventsError,
    ceremony,
    now,
    connect,
    disconnect,
    refresh,
    saveConfig,
  } = useNextCeremony(squadId, userKey);

  const openSettings = () => setSettingsOpen(true);
  const settingsDialog = (
    <CeremonySettingsDialog
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      mode={mode || 'google_calendar'}
      ceremonies={manualCeremonies}
      estimationUnit={estimationUnit}
      onSave={saveConfig}
    />
  );

  if (isLoadingConfig) {
    return (
      <Shell>
        <div className="flex items-center gap-2.5 py-1" role="status">
          <AgileSpinner size="sm" />
          <p className="text-[13px] text-muted-foreground">Carregando…</p>
        </div>
      </Shell>
    );
  }

  if (configError) {
    return (
      <Shell onOpenSettings={openSettings}>
        <p role="alert" className="text-[13px] leading-relaxed text-destructive">{configError}</p>
        {settingsDialog}
      </Shell>
    );
  }

  // Modo manual: nem depende do Google, nem oculta o card sem client id configurado.
  if (mode === 'manual') {
    if (!ceremony) {
      return (
        <Shell onOpenSettings={openSettings}>
          <p className={MUTED}>
            {manualCeremonies.length === 0
              ? 'Nenhuma cerimônia cadastrada ainda pra essa squad.'
              : 'Nenhuma cerimônia cadastrada cai nos próximos 7 dias.'}
          </p>
          <ModalButton onClick={openSettings} className={cn(SMALL_BUTTON, 'self-start')}>
            <Settings className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Cadastrar cerimônia
          </ModalButton>
          <CombinedList ceremonies={manualCeremonies} />
          {settingsDialog}
        </Shell>
      );
    }
    return (
      <Shell onOpenSettings={openSettings}>
        <CeremonyBody ceremony={ceremony} now={now} />
        <CombinedList ceremonies={manualCeremonies} />
        {settingsDialog}
      </Shell>
    );
  }

  // Modo google_calendar sem client id configurado (NEXT_PUBLIC_GOOGLE_CLIENT_ID, ver
  // .env.example): não dá pra conectar, mas o card continua visível — é a única porta de
  // entrada pro modo manual, que não depende disso.
  if (!isGoogleConfigured) {
    return (
      <Shell onOpenSettings={openSettings}>
        <p className={MUTED}>
          A conexão automática com o Google Calendar ainda não está disponível pra essa squad.
          Enquanto isso, dá pra cadastrar o horário manualmente.
        </p>
        <ModalButton onClick={openSettings} className={cn(SMALL_BUTTON, 'self-start')}>
          <Settings className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Cadastrar manualmente
        </ModalButton>
        {settingsDialog}
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell onOpenSettings={openSettings}>
        <p className={MUTED}>
          Conecte sua agenda do Google pra ver aqui a próxima daily, planning, review, retro ou
          refinement que você foi convidado. A gente só lê — nada é criado ou alterado.
        </p>
        {connectionError && <p role="alert" className="text-[13px] text-destructive">{connectionError}</p>}
        <ModalButton variant="primary" onClick={connect} disabled={isConnecting} className={cn(SMALL_BUTTON, 'self-start')}>
          {isConnecting ? <AgileSpinner size="xs" variant="white" /> : <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          {isConnecting ? 'Conectando…' : 'Conectar minha agenda'}
        </ModalButton>
        {settingsDialog}
      </Shell>
    );
  }

  if (isLoadingEvents && !ceremony) {
    return (
      <Shell onOpenSettings={openSettings}>
        <div className="flex items-center gap-2.5 py-1" role="status">
          <AgileSpinner size="sm" />
          <p className="text-[13px] text-muted-foreground">Lendo sua agenda…</p>
        </div>
        {settingsDialog}
      </Shell>
    );
  }

  if (eventsError) {
    return (
      <Shell onOpenSettings={openSettings}>
        <p role="alert" className="text-[13px] leading-relaxed text-destructive">{eventsError}</p>
        <ModalButton onClick={refresh} className={cn(SMALL_BUTTON, 'self-start')}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
        </ModalButton>
        {settingsDialog}
      </Shell>
    );
  }

  if (!ceremony) {
    return (
      <Shell onOpenSettings={openSettings}>
        <p className={MUTED}>Nenhuma cerimônia encontrada na sua agenda pras próximas 48h.</p>
        <button
          type="button"
          onClick={disconnect}
          className="self-start text-[13px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11"
        >
          Desconectar agenda
        </button>
        {settingsDialog}
      </Shell>
    );
  }

  return (
    <Shell onOpenSettings={openSettings}>
      <CeremonyBody ceremony={ceremony} now={now} />
      {settingsDialog}
    </Shell>
  );
}

/** Todas as cerimônias combinadas da squad (modo manual), em lista recolhida. */
function CombinedList({ ceremonies }: { ceremonies: SquadCeremony[] }) {
  if (ceremonies.length === 0) return null;
  return (
    <details className="group border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Cerimônias combinadas
        <span className="text-xs font-normal text-muted-foreground">{ceremonies.length}</span>
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {ceremonies.map((c) => (
          <li key={c.id} className="flex flex-col rounded-xl bg-muted/50 px-3 py-2">
            <span className="truncate text-[13px] font-semibold text-foreground">{c.title}</span>
            <span className="text-xs text-muted-foreground">
              {describeDays(c.daysOfWeek)} às {c.startTime} · {c.durationMinutes} min
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CeremonyBody({
  ceremony,
  now,
}: {
  ceremony: NonNullable<ReturnType<typeof useNextCeremony>['ceremony']>;
  now: Date;
}) {
  const countdown = formatCountdown(ceremony.start, now);
  const meet = safeHref(ceremony.meetLink);
  const eventLink = safeHref(ceremony.eventLink);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-lg font-bold tracking-tight text-foreground">{ceremony.title}</h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
            countdown.isNow
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              : countdown.isSoon
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground'
          )}
        >
          {countdown.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span>{formatTimeRange(ceremony.start, ceremony.end, ceremony.isAllDay)}</span>
        {!ceremony.isAllDay && !!formatDuration(ceremony.durationMinutes) && <span>{formatDuration(ceremony.durationMinutes)}</span>}
        {ceremony.invitedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {ceremony.confirmedCount}/{ceremony.invitedCount} confirmados
          </span>
        )}
      </div>

      {meet || eventLink ? (
        <ModalButton variant="primary" asChild className="mt-1 w-full gap-2">
          <a href={(meet || eventLink)!} target="_blank" rel="noopener noreferrer">
            {meet ? (
              <>
                <Video className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Entrar no Meet
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ver na agenda
              </>
            )}
          </a>
        </ModalButton>
      ) : (
        <ModalButton variant="primary" disabled className="mt-1 w-full">
          Sem link disponível
        </ModalButton>
      )}
    </>
  );
}
