/**
 * true se a data cai em sábado ou domingo. Primitivo único de dia-útil —
 * addBusinessDays/businessDaysBetween (SquadPlansTimeline), countWorkdays
 * (useSquadStore) e o streak de dias úteis (SquadPerformanceView) tinham cada
 * um sua própria cópia de `getDay() === 0 || getDay() === 6`; consolidado
 * aqui pra uma futura regra de feriados só precisar mudar num lugar.
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
