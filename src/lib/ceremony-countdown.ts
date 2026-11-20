export interface Countdown {
  label: string;
  isSoon: boolean;
  isNow: boolean;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Texto do contador da "Próxima cerimônia". Passadas 24h usa a diferença em DIAS DE CALENDÁRIO:
 * antes, qualquer cerimônia com 24h ou mais era "amanhã" (uma daqui a 5 dias aparecia como "amanhã 10:00").
 */
export function formatCountdown(start: Date, now: Date): Countdown {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return { label: 'agora', isSoon: true, isNow: true };

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return { label: `em ${diffMin} min`, isSoon: diffMin <= 15, isNow: false };

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return { label: `em ${diffHours}h`, isSoon: false, isNow: false };

  const time = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return { label: `hoje ${time}`, isSoon: false, isNow: false };
  if (days === 1) return { label: `amanhã ${time}`, isSoon: false, isNow: false };
  const weekday = start.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const date = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return { label: `${weekday} ${date} ${time}`, isSoon: false, isNow: false };
}
