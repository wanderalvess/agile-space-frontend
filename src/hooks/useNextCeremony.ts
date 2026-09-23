'use client';

/**
 * Resolve a "próxima cerimônia" pro card do /painel, a partir de uma de duas fontes —
 * nunca as duas ao mesmo tempo (ver SquadConfig.ceremonyMode em lib/types.ts):
 *
 * - 'google_calendar' (default): lê a agenda pessoal (primary) de quem conectou, via
 *   Google Identity Services + Calendar API, filtrando por palavra-chave de cerimônia.
 * - 'manual': a squad cadastrou uma lista de cerimônias recorrentes (dia da semana +
 *   horário) e a próxima ocorrência é calculada localmente (ceremony-schedule.ts).
 *
 * Não inventa horário: sem conexão/sem cadastro, mostra a ação correspondente; sem nada
 * encontrado, diz isso — nunca um card vazio silencioso.
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchCalendarEvents } from '@/lib/google-calendar';
import { computeNextOccurrence } from '@/lib/ceremony-schedule';
import { squadApi } from '@/app/squad/api';
import type { GoogleCalendarEvent, SquadCeremony, SquadConfig } from '@/lib/types';
import { useGoogleCalendarConnection } from './useGoogleCalendarConnection';

// Termos de cerimônia ágil — cobre pt-BR e en, com e sem o nome da squad no título.
const CEREMONY_KEYWORDS = [
  'daily', 'stand-up', 'standup',
  'planning', 'planejamento',
  'review', 'revisão',
  'retro', 'retrospectiva', 'retrospective',
  'refinement', 'refinamento', 'grooming',
  'showcase',
];

const EVENTS_REFRESH_MS = 5 * 60 * 1000; // 5min — reconsulta a agenda do Google
const COUNTDOWN_TICK_MS = 30 * 1000; // 30s — só recalcula o "faltam Xmin"

// Referência estável pro caso "squad sem cerimônia manual cadastrada" — `config?.ceremonies
// || []` criaria um array NOVO a cada render, e o CeremonySettingsDialog usa essa lista como
// dependência do efeito que sincroniza o rascunho; uma referência nova a cada 30s (tick do
// countdown) reabria o formulário do zero e descartava o que a pessoa estava digitando.
const EMPTY_CEREMONIES: SquadCeremony[] = [];

function eventStart(event: GoogleCalendarEvent): Date | null {
  const raw = event.start?.dateTime || event.start?.date;
  return raw ? new Date(raw) : null;
}

function eventEnd(event: GoogleCalendarEvent): Date | null {
  const raw = event.end?.dateTime || event.end?.date;
  return raw ? new Date(raw) : null;
}

function isCeremonyEvent(event: GoogleCalendarEvent): boolean {
  if (event.status === 'cancelled') return false;
  const summary = (event.summary || '').toLowerCase();
  if (!summary) return false;
  return CEREMONY_KEYWORDS.some((kw) => summary.includes(kw));
}

export interface NextCeremony {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  durationMinutes: number;
  confirmedCount: number;
  invitedCount: number;
  meetLink?: string;
  eventLink?: string;
}

export type CeremonyMode = 'google_calendar' | 'manual';

export interface NextCeremonyState {
  /** false quando NEXT_PUBLIC_GOOGLE_CLIENT_ID não está definida — só afeta o modo google_calendar. */
  isGoogleConfigured: boolean;
  /** null enquanto a config da squad ainda está carregando. */
  mode: CeremonyMode | null;
  isLoadingConfig: boolean;
  configError: string | null;
  manualCeremonies: SquadCeremony[];

  isConnected: boolean;
  isConnecting: boolean;
  isLoadingEvents: boolean;
  connectionError: string | null;
  eventsError: string | null;

  ceremony: NextCeremony | null;
  /** "now" atualizado a cada 30s, pra badges de contagem regressiva no card. */
  now: Date;

  connect: () => void;
  disconnect: () => void;
  refresh: () => void;
  /** Salva ceremonyMode e/ou ceremonies da squad (merge parcial, ver squadApi.saveSquad). */
  saveConfig: (patch: Partial<Pick<SquadConfig, 'ceremonyMode' | 'ceremonies'>>) => Promise<void>;
}

export function useNextCeremony(squadId: string, userKey: string): NextCeremonyState {
  const connection = useGoogleCalendarConnection(userKey);

  const [config, setConfig] = useState<SquadConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsRefreshSignal, setEventsRefreshSignal] = useState(0);

  const [now, setNow] = useState(() => new Date());

  // Ticker só pra countdown — não refaz nenhuma chamada de rede.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Config da squad (mode + lista manual) — fonte: /api/squads/{squadId}.
  useEffect(() => {
    if (!squadId) {
      setIsLoadingConfig(false);
      return;
    }
    let cancelled = false;
    setIsLoadingConfig(true);
    setConfigError(null);
    squadApi
      .getSquad(squadId)
      .then((fetched) => {
        if (!cancelled) setConfig(fetched);
      })
      .catch((err: any) => {
        if (!cancelled) setConfigError(err?.message || 'Não consegui ler a configuração da squad.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [squadId]);

  const mode: CeremonyMode | null = isLoadingConfig ? null : config?.ceremonyMode === 'manual' ? 'manual' : 'google_calendar';
  const manualCeremonies = config?.ceremonies || EMPTY_CEREMONIES;

  // Eventos do Google — só busca quando o modo é google_calendar e há token.
  useEffect(() => {
    if (mode !== 'google_calendar' || !connection.accessToken) {
      setEvents([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoadingEvents(true);
      setEventsError(null);
      try {
        const timeMin = new Date();
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date(timeMin);
        timeMax.setDate(timeMax.getDate() + 2); // hoje + amanhã

        const fetched = await fetchCalendarEvents(
          connection.accessToken!,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
        if (!cancelled) setEvents(fetched);
      } catch (err: any) {
        if (!cancelled) {
          setEventsError(err?.message || 'Não consegui ler sua agenda do Google.');
          setEvents([]);
        }
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    }

    load();
    const id = setInterval(load, EVENTS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, connection.accessToken, eventsRefreshSignal]);

  const googleCeremony = useMemo<NextCeremony | null>(() => {
    const candidates = events
      .filter(isCeremonyEvent)
      .map((event) => {
        const start = eventStart(event);
        const end = eventEnd(event);
        if (!start || !end) return null;
        return { event, start, end };
      })
      .filter((c): c is { event: GoogleCalendarEvent; start: Date; end: Date } => !!c)
      .filter((c) => c.end.getTime() > now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const next = candidates[0];
    if (!next) return null;

    const attendees = next.event.attendees || [];
    const confirmedCount = attendees.filter((a) => a.responseStatus === 'accepted').length;
    const isAllDay = !next.event.start.dateTime;

    return {
      id: next.event.id,
      title: next.event.summary || 'Cerimônia',
      start: next.start,
      end: next.end,
      isAllDay,
      durationMinutes: Math.max(Math.round((next.end.getTime() - next.start.getTime()) / 60000), 0),
      confirmedCount,
      invitedCount: attendees.length,
      meetLink: next.event.hangoutLink,
      eventLink: next.event.htmlLink,
    };
  }, [events, now]);

  const manualCeremony = useMemo<NextCeremony | null>(() => {
    const occurrence = computeNextOccurrence(manualCeremonies, now);
    if (!occurrence) return null;
    return {
      id: occurrence.ceremony.id,
      title: occurrence.ceremony.title || 'Cerimônia',
      start: occurrence.start,
      end: occurrence.end,
      isAllDay: false,
      durationMinutes: occurrence.ceremony.durationMinutes,
      confirmedCount: 0,
      invitedCount: 0,
      meetLink: occurrence.ceremony.meetLink,
    };
  }, [manualCeremonies, now]);

  const ceremony = mode === 'manual' ? manualCeremony : googleCeremony;

  return {
    isGoogleConfigured: connection.isConfigured,
    mode,
    isLoadingConfig,
    configError,
    manualCeremonies,

    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isLoadingEvents,
    connectionError: connection.error,
    eventsError,

    ceremony,
    now,

    connect: connection.connect,
    disconnect: connection.disconnect,
    refresh: () => setEventsRefreshSignal((n) => n + 1),
    saveConfig: async (patch) => {
      const saved = await squadApi.saveSquad(squadId, patch);
      setConfig(saved);
    },
  };
}
