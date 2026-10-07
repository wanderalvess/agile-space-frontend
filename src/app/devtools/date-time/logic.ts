// Lógica de data e hora (funções puras, testáveis).

export const ZONES: { id: string; label: string }[] = [
  { id: 'UTC', label: 'UTC' },
  { id: 'America/Sao_Paulo', label: 'São Paulo' },
  { id: 'America/New_York', label: 'Nova York' },
  { id: 'Europe/London', label: 'Londres' },
  { id: 'Europe/Lisbon', label: 'Lisboa' },
  { id: 'Asia/Kolkata', label: 'Índia' },
  { id: 'Asia/Tokyo', label: 'Tóquio' },
];

// Interpreta timestamp (segundos ou milissegundos) ou uma data textual (ISO etc.).
// Heurística: números com valor absoluto < 1e11 são segundos (até o ano 5138); acima, milissegundos.
export function parseMoment(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const d = new Date(Math.abs(n) < 1e11 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatInZone(d: Date, timeZone: string): string {
  return d.toLocaleString('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'medium' });
}

// "há 3 dias", "em 2 horas"… usando Intl.RelativeTimeFormat.
export function relativeTime(d: Date, now: Date = new Date()): string {
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

// Intervalo absoluto entre duas datas, quebrado em dias/horas/minutos.
export function describePeriod(a: Date, b: Date): { text: string; totalDays: number } | null {
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = Math.abs(b.getTime() - a.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { text: `${days} dias, ${hours} horas e ${minutes} minutos`, totalDays: ms / 86_400_000 };
}
