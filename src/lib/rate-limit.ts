// Rate limit em memória, por processo — suficiente pra conter abuso básico
// (scraping/relay) numa instância única; não é distribuído entre instâncias
// em deploy com múltiplas réplicas. Trocar por um store compartilhado
// (Redis/Upstash) se o app escalar horizontalmente.
const hits = new Map<string, number[]>();

/**
 * Retorna true se `key` ainda está dentro do limite (e registra esse
 * request); false se excedeu `max` requisições na janela de `windowMs`.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= max) {
    hits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}
