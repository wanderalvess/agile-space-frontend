// Geradores de identificadores (usam crypto do navegador / Node, nunca Math.random).

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function format(h: string): string {
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV4(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  return format(hex(b));
}

// UUID v7: 48 bits de timestamp (ms) + aleatório; ordenável por tempo.
export function uuidV7(now: number = Date.now()): string {
  const b = randomBytes(16);
  // Sem BigInt: o timestamp em ms cabe com folga em 53 bits, então divisão inteira é exata.
  let ts = Math.floor(now);
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70; // versão 7
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(hex(b));
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ULID: 10 chars de timestamp + 16 chars aleatórios (Crockford base32).
export function ulid(now: number = Date.now()): string {
  let t = now;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rnd = randomBytes(16);
  return time + Array.from(rnd, b => CROCKFORD[b % 32]).join('');
}

const NANO_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

// NanoID de 21 caracteres (alfabeto URL-safe padrão). 64 símbolos: b & 63 é uniforme.
export function nanoId(size = 21): string {
  return Array.from(randomBytes(size), b => NANO_ALPHABET[b & 63]).join('');
}

export type IdKind = 'v4' | 'v7' | 'ulid' | 'nanoid';

export function generateId(kind: IdKind): string {
  switch (kind) {
    case 'v4': return uuidV4();
    case 'v7': return uuidV7();
    case 'ulid': return ulid();
    case 'nanoid': return nanoId();
  }
}
