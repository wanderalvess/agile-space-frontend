/**
 * Datas vindas do servidor.
 *
 * Alguns carimbos chegam como `LocalDateTime.toString()` (ex.: "2026-10-17T22:43:10.123456"), gravados em UTC
 * mas SEM `Z` nem deslocamento. `new Date(...)` lê esse formato como horário LOCAL do navegador, então em
 * Brasília a hora aparecia 3 h adiantada (22:43 quando eram 19:43). Registros antigos continuam sem fuso mesmo
 * depois que o servidor passar a gravar com `Z`.
 *
 * Aqui, data e hora ISO sem zona valem UTC; com `Z` ou `+hh:mm`/`-hh:mm` ficam como estão (idempotente).
 */

/** Data e hora ISO ("2026-10-17T22:43" ou "2026-10-17 22:43:10.5"). Data pura não entra: o JS já a lê como UTC. */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}.*)$/;
/** Zona no fim da parte da hora: Z, +hh, +hhmm ou +hh:mm (e o mesmo com "-"). */
const ZONE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** Hora com zona fica como está (só completa "-03" e "-0300" para "-03:00", que o `Date` lê); sem zona ganha Z. */
function withZone(time: string): string {
  if (!ZONE.test(time)) return `${time}Z`;
  return time.replace(/([+-]\d{2})(?::?(\d{2}))?$/, (_all, hh: string, mm?: string) => `${hh}:${mm ?? '00'}`);
}

/** Texto do servidor → `Date`. Sem zona vale UTC. Vazio, `null` ou inválido devolvem `null`. */
export function parseServerDate(iso: string | null | undefined): Date | null {
  if (typeof iso !== 'string') return null;
  const text = iso.trim();
  if (!text) return null;
  const m = DATE_TIME.exec(text);
  const normalized = m ? `${m[1]}T${withZone(m[2])}` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Mesmo que {@link parseServerDate}, em milissegundos; `null` se a data não existir ou for inválida. */
export function parseServerTime(iso: string | null | undefined): number | null {
  return parseServerDate(iso)?.getTime() ?? null;
}
