'use client';

/**
 * Card "Próxima cerimônia" do /painel. Lê UMA fonte só (SquadConfig.ceremonyMode, ver
 * useNextCeremony) — Google Calendar pessoal (OAuth client-side, sem mexer no login do
 * Espaço Ágil) ou cadastro manual da squad — e mostra a próxima daily/planning/review/
 * retro/refinement/showcase.
 *
 * Sem dado real nunca inventa horário: cobre "sem conexão"/"sem cadastro", "carregando",
 * "erro" e "nada encontrado" como estados explícitos, pras duas fontes.
 */

import { useState } from 'react';
import { CalendarClock, Link2, RefreshCw, Settings, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useNextCeremony } from '@/hooks/useNextCeremony';
import { CeremonySettingsDialog } from './CeremonySettingsDialog';
import { cn } from '@/lib/utils';

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

function formatCountdown(start: Date, now: Date): { label: string; isSoon: boolean; isNow: boolean } {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return { label: 'agora', isSoon: true, isNow: true };

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return { label: `em ${diffMin} min`, isSoon: diffMin <= 15, isNow: false };

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return { label: `em ${diffHours}h`, isSoon: false, isNow: false };

  const isTomorrow = start.getDate() !== now.getDate() || start.getMonth() !== now.getMonth();
  const time = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { label: isTomorrow ? `amanhã ${time}` : `hoje ${time}`, isSoon: false, isNow: false };
}

function CardShell({ onOpenSettings, children }: { onOpenSettings?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> Próxima cerimônia
        </h3>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configurar fonte da próxima cerimônia"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
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
      onSave={saveConfig}
    />
  );

  if (isLoadingConfig) {
    return (
      <CardShell>
        <div className="flex items-center gap-2.5 py-2">
          <AgileSpinner size="sm" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Carregando…</p>
        </div>
      </CardShell>
    );
  }

  if (configError) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{configError}</p>
        {settingsDialog}
      </CardShell>
    );
  }

  // Modo manual: nem depende do Google, nem oculta o card sem client id configurado.
  if (mode === 'manual') {
    if (!ceremony) {
      return (
        <CardShell onOpenSettings={openSettings}>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            {manualCeremonies.length === 0
              ? 'Nenhuma cerimônia cadastrada ainda pra essa squad.'
              : 'Nenhuma cerimônia cadastrada cai nos próximos 7 dias.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={openSettings}
            className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2"
          >
            <Settings className="h-3.5 w-3.5" /> Cadastrar cerimônia
          </Button>
          {settingsDialog}
        </CardShell>
      );
    }
    return (
      <CardShell onOpenSettings={openSettings}>
        <CeremonyBody ceremony={ceremony} now={now} />
        {settingsDialog}
      </CardShell>
    );
  }

  // Modo google_calendar sem client id configurado (NEXT_PUBLIC_GOOGLE_CLIENT_ID, ver
  // .env.example): não dá pra conectar, mas o card continua visível — é a única porta de
  // entrada pro modo manual, que não depende disso.
  if (!isGoogleConfigured) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          A conexão automática com o Google Calendar ainda não está disponível pra essa squad.
          Enquanto isso, dá pra cadastrar o horário manualmente.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={openSettings}
          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2"
        >
          <Settings className="h-3.5 w-3.5" /> Cadastrar manualmente
        </Button>
        {settingsDialog}
      </CardShell>
    );
  }

  if (!isConnected) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Conecte sua agenda do Google pra ver aqui a próxima daily, planning, review, retro ou
          refinement que você foi convidado. A gente só lê — nada é criado ou alterado.
        </p>
        {connectionError && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mb-2">{connectionError}</p>
        )}
        <Button
          size="sm"
          onClick={connect}
          disabled={isConnecting}
          className="h-9 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2"
        >
          {isConnecting ? <AgileSpinner size="xs" variant="white" /> : <Link2 className="h-3.5 w-3.5" />}
          {isConnecting ? 'Conectando…' : 'Conectar minha agenda'}
        </Button>
        {settingsDialog}
      </CardShell>
    );
  }

  if (isLoadingEvents && !ceremony) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <div className="flex items-center gap-2.5 py-2">
          <AgileSpinner size="sm" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Lendo sua agenda…</p>
        </div>
        {settingsDialog}
      </CardShell>
    );
  }

  if (eventsError) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <p className="text-xs text-rose-600 dark:text-rose-400 mb-3 leading-relaxed">{eventsError}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
        </Button>
        {settingsDialog}
      </CardShell>
    );
  }

  if (!ceremony) {
    return (
      <CardShell onOpenSettings={openSettings}>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Nenhuma cerimônia encontrada na sua agenda pras próximas 48h.
        </p>
        <button
          type="button"
          onClick={disconnect}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Desconectar agenda
        </button>
        {settingsDialog}
      </CardShell>
    );
  }

  return (
    <CardShell onOpenSettings={openSettings}>
      <CeremonyBody ceremony={ceremony} now={now} />
      {settingsDialog}
    </CardShell>
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

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h4 className="text-lg font-black tracking-tight min-w-0 truncate">{ceremony.title}</h4>
        <span
          className={cn(
            'shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
            countdown.isNow
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : countdown.isSoon
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-primary/10 text-primary'
          )}
        >
          {countdown.label}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <span>{formatTimeRange(ceremony.start, ceremony.end, ceremony.isAllDay)}</span>
        {!ceremony.isAllDay && !!formatDuration(ceremony.durationMinutes) && (
          <span>{formatDuration(ceremony.durationMinutes)}</span>
        )}
        {ceremony.invitedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {ceremony.confirmedCount}/{ceremony.invitedCount} confirmados
          </span>
        )}
      </div>

      <Button
        asChild={!!(ceremony.meetLink || ceremony.eventLink)}
        size="sm"
        className="w-full mt-4 h-9 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2"
        disabled={!ceremony.meetLink && !ceremony.eventLink}
      >
        {ceremony.meetLink ? (
          <a href={ceremony.meetLink} target="_blank" rel="noopener noreferrer">
            <Video className="h-3.5 w-3.5" /> Entrar no Meet
          </a>
        ) : ceremony.eventLink ? (
          <a href={ceremony.eventLink} target="_blank" rel="noopener noreferrer">
            <CalendarClock className="h-3.5 w-3.5" /> Ver na agenda
          </a>
        ) : (
          <span>Sem link disponível</span>
        )}
      </Button>
    </>
  );
}
