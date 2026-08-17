import dns from 'dns';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isPrivateOrReservedIp(ip: string): boolean {
  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = parseInt(ipv4[1], 10);
    const b = parseInt(ipv4[2], 10);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (inclui metadata de nuvem: 169.254.169.254)
    if (a === 0) return true;
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.split(':').pop();
    if (mapped) return isPrivateOrReservedIp(mapped);
  }
  return false;
}

/**
 * Valida um domínio/URL informado pelo cliente antes de o servidor fazer
 * fetch para ele, bloqueando alvos internos/privados (loopback, redes
 * privadas, link-local — inclui o endpoint de metadata de nuvem
 * 169.254.169.254) para evitar que a rota vire um proxy SSRF. Resolve o
 * DNS e valida o(s) IP(s) resultante(s) para também cobrir DNS rebinding.
 * Retorna o host "limpo" (sem protocolo/paths) já validado.
 */
export async function resolveSafeHost(rawDomainOrUrl: string): Promise<string> {
  if (!rawDomainOrUrl || typeof rawDomainOrUrl !== 'string') {
    throw new Error('Domínio/URL inválido.');
  }
  const cleaned = rawDomainOrUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const hostname = cleaned.split('/')[0].split('@').pop()!.split(':')[0];

  if (!hostname || BLOCKED_HOSTNAMES.has(hostname.toLowerCase()) || hostname.toLowerCase().endsWith('.local')) {
    throw new Error('Host de destino não permitido.');
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('Host de destino não permitido.');
    }
    return cleaned;
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('Host de destino não permitido.');
      }
    }
  } catch (e: any) {
    if (e.message === 'Host de destino não permitido.') throw e;
    throw new Error('Não foi possível resolver o host informado.');
  }

  return cleaned;
}
