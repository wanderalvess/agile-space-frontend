// Análise local de IPv4 / CIDR (sem rede). IPv6 só é reconhecido, não calculado.

export interface Ipv4Analysis {
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: 'A' | 'B' | 'C' | 'D (multicast)' | 'E (reservada)';
  kind: string;
  isPublic: boolean;
  binary: string;
}

const toInt = (parts: number[]) => ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
const toStr = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function parseIpv4(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255)) return null;
  return toInt(parts);
}

/** Classifica o endereço (faixas reservadas da IANA mais comuns). */
function classify(ip: number): { kind: string; isPublic: boolean } {
  const a = ip >>> 24;
  const b = (ip >>> 16) & 255;
  if (a === 10) return { kind: 'Privado (RFC 1918, 10.0.0.0/8)', isPublic: false };
  if (a === 172 && b >= 16 && b <= 31) return { kind: 'Privado (RFC 1918, 172.16.0.0/12)', isPublic: false };
  if (a === 192 && b === 168) return { kind: 'Privado (RFC 1918, 192.168.0.0/16)', isPublic: false };
  if (a === 127) return { kind: 'Loopback (127.0.0.0/8)', isPublic: false };
  if (a === 169 && b === 254) return { kind: 'Link-local / APIPA (169.254.0.0/16)', isPublic: false };
  if (a === 100 && b >= 64 && b <= 127) return { kind: 'CGNAT (100.64.0.0/10)', isPublic: false };
  if (a === 0) return { kind: 'Rede "this" (0.0.0.0/8)', isPublic: false };
  if (a >= 224 && a <= 239) return { kind: 'Multicast (224.0.0.0/4)', isPublic: false };
  if (a >= 240) return { kind: 'Reservado (240.0.0.0/4)', isPublic: false };
  return { kind: 'Público (roteável na internet)', isPublic: true };
}

/** Aceita "192.168.0.10" (assume /32) ou "192.168.0.10/24". Devolve erro em texto quando inválido. */
export function analyzeIpv4(input: string): { ok: true; data: Ipv4Analysis } | { ok: false; error: string } {
  const [ipPart, prefixPart, ...rest] = input.trim().split('/');
  if (rest.length) return { ok: false, error: 'Formato inválido: use IP ou IP/prefixo (ex.: 10.0.0.5/24).' };
  const ip = parseIpv4(ipPart);
  if (ip === null) return { ok: false, error: 'IPv4 inválido: use quatro números de 0 a 255 separados por ponto.' };
  let prefix = 32;
  if (prefixPart !== undefined) {
    if (!/^\d{1,2}$/.test(prefixPart) || +prefixPart > 32) return { ok: false, error: 'Prefixo inválido: use um número de 0 a 32.' };
    prefix = +prefixPart;
  }
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & maskInt) >>> 0;
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31 (ponto a ponto) e /32 não têm broadcast/rede separados
  const usable = prefix >= 31 ? total : Math.max(total - 2, 0);
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;
  const a = ip >>> 24;
  const ipClass: Ipv4Analysis['ipClass'] = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reservada)';
  const { kind, isPublic } = classify(ip);
  return {
    ok: true,
    data: {
      ip: toStr(ip),
      prefix,
      mask: toStr(maskInt),
      wildcard: toStr(~maskInt >>> 0),
      network: toStr(network),
      broadcast: toStr(broadcast),
      firstHost: toStr(first),
      lastHost: toStr(last),
      totalAddresses: total,
      usableHosts: usable,
      ipClass,
      kind,
      isPublic,
      binary: toStr(ip).split('.').map(o => (+o).toString(2).padStart(8, '0')).join('.'),
    },
  };
}
