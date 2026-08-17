/**
 * Google Calendar API Integration for Espaço Ágil
 * Fetches user availability events to sync with Daily Flow Capacity Planner.
 */

import { GoogleCalendarEvent, UserAvailability, GlobalRole } from './types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Palavras-chave que indicam ausência no calendário
 */
const ABSENCE_KEYWORDS = [
  'férias', 'vacation', 'folga', 'ooo', 'out of office', 
  'ausente', 'ausência', 'afastamento', 'feriado', 'atestado',
  'médico', 'treinamento', 'workshop', 'curso'
];

/**
 * Busca eventos do calendário do usuário autenticado.
 * Requer o token de acesso obtido via Google Login (signInWithPopup).
 */
export async function fetchCalendarEvents(accessToken: string, timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
  try {
    const url = `${CALENDAR_API_BASE}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

/**
 * Converte eventos do Google Calendar em registros de UserAvailability do Espaço Ágil.
 */
export function parseEventsToAvailability(
  events: GoogleCalendarEvent[], 
  userId: string, 
  userName: string, 
  userRole: GlobalRole, 
  squadId: string
): UserAvailability[] {
  const availabilities: UserAvailability[] = [];

  events.forEach(event => {
    const summary = (event.summary || '').toLowerCase();
    
    // Verifica se o evento é uma ausência baseada em keywords
    const isAbsence = ABSENCE_KEYWORDS.some(kw => summary.includes(kw));
    
    if (isAbsence) {
      const startDate = event.start.date || event.start.dateTime?.split('T')[0];
      const endDate = event.end.date || event.end.dateTime?.split('T')[0];

      if (startDate) {
        // Para simplificar, registramos como 'full' (dia todo)
        // Em implementações avançadas, poderíamos iterar entre startDate e endDate
        availabilities.push({
          id: `${userId}_${startDate}`,
          userId,
          userName,
          userRole,
          squadId,
          date: startDate,
          type: 'full',
          note: event.summary,
          source: 'google_calendar',
          updatedAt: new Date().toISOString()
        });
      }
    }
  });

  return availabilities;
}
