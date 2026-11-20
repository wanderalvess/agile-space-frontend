import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Data curta (dd/MM/yyyy) ou vazio quando o servidor não informa a data. */
export function dateOnly(iso?: string | null): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
}
