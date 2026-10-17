import { format, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** "há 12 minutos"; data inválida vira vazio. */
export function relativeWhen(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceStrict(d, now, { addSuffix: true, locale: ptBR });
}

/** "15/10/2026 às 09:41". */
export function fullWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** "14/10/2026 16:20" (histórico). */
export function shortWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}
