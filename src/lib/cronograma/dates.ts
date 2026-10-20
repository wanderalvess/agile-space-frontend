/**
 * Datas do Cronograma: leitura dos dois formatos que o backend manda ("YYYY-MM-DD" e ISO-8601 com horário e
 * deslocamento, ex. "2026-10-20T09:00:00-03:00") e aritmética de dias úteis.
 *
 * Tudo aqui trabalha com NÚMERO DE DIA (dias desde 1970-01-01, em UTC) em vez de `Date`: some o problema de fuso
 * e de horário de verão, e os laços de dia útil (cascata, sugestão pelas horas) não alocam objeto nenhum.
 */

/** Jornada usada como régua visual e como padrão de capacidade. Único lugar a mexer se a jornada mudar. */
export const JORNADA = {
  /** Início do expediente, em minutos desde a meia-noite (09:00). */
  inicioMin: 9 * 60,
  /** Fim do expediente, em minutos desde a meia-noite (18:00). */
  fimMin: 18 * 60,
  /** Capacidade diária padrão quando nem a pessoa nem a squad informam (8h12). */
  capacidadePadraoH: 8.2,
  /** Fuso em que os horários são lidos e mostrados (Brasília, UTC-03:00, sem horário de verão). */
  fusoMin: -180,
} as const;

const MS_DIA = 86_400_000;

/** Instante no eixo: dia (inteiro) + fração da jornada (0 = 09:00, 1 = 18:00). */
export interface Pt {
  day: number;
  frac: number;
}

/** Data e, se vier, hora de um campo do Jira. `minutes` = minutos desde a meia-noite, ou null quando só há data. */
export interface Stamp {
  day: number;
  minutes: number | null;
}

export const ptNum = (p: Pt): number => p.day + p.frac;

export function dayFromYmd(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / MS_DIA);
}

export function ymdOfDay(day: number): { y: number; m: number; d: number } {
  const dt = new Date(day * MS_DIA);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function isoOfDay(day: number): string {
  const { y, m, d } = ymdOfDay(day);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2026-10-20" ou "2026-10-20T09:00:00-03:00" -> número do dia (ignora a hora). null se não for data. */
export function parseDay(raw?: string | null): number | null {
  const s = parseStamp(raw);
  return s ? s.day : null;
}

const RE_STAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?/;

/**
 * Lê data ou data-hora. Com deslocamento (Z, -03:00, -0300) converte para o fuso do portal; sem deslocamento
 * usa o horário como veio escrito. Devolve null para vazio ou formato desconhecido.
 */
export function parseStamp(raw?: string | null): Stamp | null {
  if (!raw) return null;
  const m = RE_STAMP.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (m[4] === undefined) return { day: dayFromYmd(y, mo, d), minutes: null };
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = m[6] ? Number(m[6]) : 0;
  if (hh > 23 || mm > 59) return null;
  const off = m[7];
  if (!off) return { day: dayFromYmd(y, mo, d), minutes: hh * 60 + mm };
  let offMin = 0;
  if (off !== 'Z') {
    const digits = off.replace(':', '');
    offMin = (off[0] === '-' ? -1 : 1) * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)));
  }
  const utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss) - offMin * 60_000;
  const local = utcMs + JORNADA.fusoMin * 60_000;
  const day = Math.floor(local / MS_DIA);
  return { day, minutes: Math.floor((local - day * MS_DIA) / 60_000) };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Fração da jornada (0 a 1) de um horário; fora do expediente fica preso nas pontas. */
export function fracOfMinutes(minutes: number): number {
  return clamp01((minutes - JORNADA.inicioMin) / (JORNADA.fimMin - JORNADA.inicioMin));
}

export function minutesOfFrac(frac: number): number {
  return Math.round(JORNADA.inicioMin + clamp01(frac) * (JORNADA.fimMin - JORNADA.inicioMin));
}

/** Início de uma data: só data = começo do dia; com hora = posição dentro da jornada. */
export function stampStartPt(s: Stamp): Pt {
  return { day: s.day, frac: s.minutes === null ? 0 : fracOfMinutes(s.minutes) };
}

/** Fim de uma data: só data = fim do dia; com hora = posição dentro da jornada. */
export function stampEndPt(s: Stamp): Pt {
  return { day: s.day, frac: s.minutes === null ? 1 : fracOfMinutes(s.minutes) };
}

// ---------- Dias úteis ----------

/** 1970-01-01 foi quinta-feira: 0 = domingo ... 6 = sábado. */
export function weekdayOfDay(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

export function isWeekendDay(day: number): boolean {
  const w = weekdayOfDay(day);
  return w === 0 || w === 6;
}

/** Soma (ou subtrai) dias ÚTEIS, pulando sábado e domingo. */
export function addBusinessDays(day: number, n: number): number {
  if (n === 0) return day;
  const step = n > 0 ? 1 : -1;
  let left = Math.abs(n);
  let cur = day;
  while (left > 0) {
    cur += step;
    if (!isWeekendDay(cur)) left -= 1;
  }
  return cur;
}

/** Se cair em fim de semana, vai para a segunda-feira seguinte. */
export function nextBusinessDayOnOrAfter(day: number): number {
  let cur = day;
  while (isWeekendDay(cur)) cur += 1;
  return cur;
}

/**
 * Dias úteis entre duas datas, com sinal (positivo quando `to` é depois de `from`): conta os dias úteis em
 * (from, to]. Uso padrão: businessDaysBetween(prazo, hoje) > 0 = atrasado.
 */
export function businessDaysBetween(from: number, to: number): number {
  if (from === to) return 0;
  const sign = to > from ? 1 : -1;
  let count = 0;
  for (let cur = from + sign; sign > 0 ? cur <= to : cur >= to; cur += sign) {
    if (!isWeekendDay(cur)) count += sign;
  }
  return count;
}

/** Empurra um instante por N dias úteis mantendo a hora. */
export function shiftPt(p: Pt, businessDays: number): Pt {
  return businessDays === 0 ? p : { day: addBusinessDays(p.day, businessDays), frac: p.frac };
}

/** Leva o instante para um ponto onde dá para começar a trabalhar (dia útil, antes do fim da jornada). */
export function normalizeStart(p: Pt): Pt {
  let { day, frac } = p;
  if (frac >= 1 - 1e-9) {
    day += 1;
    frac = 0;
  }
  if (isWeekendDay(day)) return { day: nextBusinessDayOnOrAfter(day), frac: 0 };
  return { day, frac };
}

/** Instante atual no eixo do Cronograma (fuso do portal). Antes das 9h = 9h; depois das 18h = próximo dia útil. */
export function nowPt(nowMs: number): Pt {
  const local = nowMs + JORNADA.fusoMin * 60_000;
  const day = Math.floor(local / MS_DIA);
  const minutes = Math.floor((local - day * MS_DIA) / 60_000);
  return normalizeStart({ day, frac: fracOfMinutes(minutes) });
}

/** Dia (número) de "hoje" no fuso do portal. */
export function todayDay(nowMs: number): number {
  return Math.floor((nowMs + JORNADA.fusoMin * 60_000) / MS_DIA);
}

// ---------- Formatação ----------

const DOW_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad2 = (n: number) => String(n).padStart(2, '0');

export const dowShort = (day: number): string => DOW_CURTO[weekdayOfDay(day)];

/** "20/10" */
export function formatDay(day: number): string {
  const { m, d } = ymdOfDay(day);
  return `${pad2(d)}/${pad2(m)}`;
}

export function formatMinutes(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/** "20/10 09:00" para um instante do eixo. */
export function formatPt(p: Pt): string {
  return `${formatDay(p.day)} ${formatMinutes(minutesOfFrac(p.frac))}`;
}

/** Data do Jira como veio: "20/10 09:00" com hora, "20/10" só com data. */
export function formatStamp(s: Stamp | null): string {
  if (!s) return '-';
  return s.minutes === null ? formatDay(s.day) : `${formatDay(s.day)} ${formatMinutes(s.minutes)}`;
}

/** Horas decimais como "8h12". */
export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${hh}h` : `${hh}h${pad2(mm)}`;
}

/** Posição de "agora" dentro da jornada (0 a 1) para a linha de hoje. */
export function nowFrac(nowMs: number): number {
  const local = nowMs + JORNADA.fusoMin * 60_000;
  const day = Math.floor(local / MS_DIA);
  return fracOfMinutes(Math.floor((local - day * MS_DIA) / 60_000));
}
