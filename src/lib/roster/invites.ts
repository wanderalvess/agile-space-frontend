import type { Invite } from '@/lib/invite-api';
import { INVITE_ROLES } from './constants';
import { normalizeText } from './calc';
import { csvDocument, csvLine, parseCsv } from './csv';

const DAY_MS = 86_400_000;

/**
 * O servidor devolve datas sem fuso ("2026-10-20T14:00:00.123", sempre em UTC). Sem o "Z" o navegador as leria
 * como horário local e o vencimento erraria por algumas horas.
 */
export function parseServerInstant(value: string | null | undefined): number {
  if (!value) return NaN;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return Date.parse(hasZone ? value : `${value}Z`);
}

/** O convite segue PENDING no servidor depois de vencer (só vira EXPIRED quando alguém tenta aceitar). */
export function isInviteExpired(invite: Pick<Invite, 'expiresAt'>, now: number = Date.now()): boolean {
  const at = parseServerInstant(invite.expiresAt);
  return Number.isFinite(at) && at <= now;
}

/** "expira em 5 dias", "expira hoje", "venceu ontem", "venceu há 3 dias". */
export function inviteExpiryLabel(invite: Pick<Invite, 'expiresAt'>, now: number = Date.now()): string {
  const at = parseServerInstant(invite.expiresAt);
  if (!Number.isFinite(at)) return '';
  if (at > now) {
    const days = Math.floor((at - now) / DAY_MS);
    if (days === 0) return 'expira hoje';
    return days === 1 ? 'expira em 1 dia' : `expira em ${days} dias`;
  }
  const days = Math.floor((now - at) / DAY_MS);
  if (days === 0) return 'venceu hoje';
  return days === 1 ? 'venceu ontem' : `venceu há ${days} dias`;
}

// ---------------------------------------------------------------------------
// Convite em lote
// ---------------------------------------------------------------------------

export type BatchValidation = 'ready' | 'invalid-email' | 'role-not-allowed' | 'duplicate';

export interface BatchInviteRow {
  /** Linha no arquivo (1 = cabeçalho). */
  line: number;
  email: string;
  /** Papel como veio no arquivo. */
  roleRaw: string;
  /** Papel normalizado para um dos permitidos (ou null). */
  role: string | null;
  validation: BatchValidation;
}

export const BATCH_VALIDATION_LABEL: Record<BatchValidation, string> = {
  ready: 'Pronto',
  'invalid-email': 'E-mail inválido',
  'role-not-allowed': 'Papel não permitido',
  duplicate: 'E-mail repetido',
};

/** Limite de linhas de um lote (cada linha é uma chamada ao servidor). */
export const MAX_BATCH_INVITES = 200;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidInviteEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

const ROLE_ALIASES: Record<string, (typeof INVITE_ROLES)[number]> = {
  developer: 'Developer',
  dev: 'Developer',
  desenvolvedor: 'Developer',
  desenvolvedora: 'Developer',
  qa: 'QA',
  'ux/designer': 'UX/Designer',
  'ux designer': 'UX/Designer',
  ux: 'UX/Designer',
  designer: 'UX/Designer',
  sme: 'SME',
};

/** Papel permitido em convite (Developer, QA, UX/Designer, SME); liderança e qualquer outro texto viram null. */
export function normalizeInviteRole(raw: string): string | null {
  const key = normalizeText(raw).replace(/\s+/g, ' ').trim();
  return ROLE_ALIASES[key] ?? null;
}

export type BatchParseError = 'EMPTY' | 'TOO_MANY';

/**
 * Lê o CSV `e-mail;papel` (ou com vírgula). A primeira linha é o cabeçalho (ignorada se parecer um: sem "@" na
 * primeira coluna). Cada linha sai validada: e-mail inválido, papel que o servidor recusaria ou e-mail repetido.
 */
export function parseBatchInvites(text: string): { rows: BatchInviteRow[] } | BatchParseError {
  const { rows: lines } = parseCsv(text);
  if (lines.length === 0) return 'EMPTY';
  const hasHeader = !(lines[0][0] ?? '').includes('@');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) return 'EMPTY';
  if (dataLines.length > MAX_BATCH_INVITES) return 'TOO_MANY';

  const seen = new Set<string>();
  const rows: BatchInviteRow[] = dataLines.map((cols, i) => {
    const email = (cols[0] ?? '').trim().toLowerCase();
    const roleRaw = (cols[1] ?? '').trim();
    const role = normalizeInviteRole(roleRaw);
    let validation: BatchValidation = 'ready';
    if (!isValidInviteEmail(email)) validation = 'invalid-email';
    else if (!role) validation = 'role-not-allowed';
    else if (seen.has(email)) validation = 'duplicate';
    if (validation === 'ready') seen.add(email);
    return { line: i + (hasHeader ? 2 : 1), email, roleRaw, role, validation };
  });
  return { rows };
}

export function buildBatchTemplateCsv(): string {
  return csvDocument([
    csvLine(['e-mail', 'papel'], ';'),
    csvLine(['carla.mendes@empresa.com', 'Developer'], ';'),
    csvLine(['diego.alves@empresa.com', 'UX/Designer'], ';'),
    csvLine(['hugo@parceiro.com', 'QA'], ';'),
  ]);
}

export type BatchResultStatus = 'done' | 'error';

export interface BatchResultRow {
  email: string;
  role: string;
  status: BatchResultStatus;
  link?: string;
  error?: string;
}

/** CSV com os links gerados (separador ";" para abrir direto no Excel em português). */
export function buildBatchLinksCsv(rows: BatchResultRow[]): string {
  return csvDocument([
    csvLine(['e-mail', 'papel', 'link', 'situação'], ';'),
    ...rows.map((r) => csvLine([r.email, r.role, r.link ?? '', r.status === 'done' ? 'Gerado' : r.error || 'Erro'], ';')),
  ]);
}

// ---------------------------------------------------------------------------
// Fila com concorrência limitada
// ---------------------------------------------------------------------------

/** Concorrência do lote: o servidor limita 300 requisições por minuto por IP; três ao mesmo tempo ficam bem abaixo. */
export const BATCH_CONCURRENCY = 3;

/**
 * Executa `worker` para cada item com no máximo `concurrency` chamadas ao mesmo tempo, preservando a ordem do
 * resultado. O worker nunca deve lançar (devolva o erro como valor); se lançar, o erro vira o resultado da posição.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<Array<R | Error>> {
  const results: Array<R | Error> = new Array(items.length);
  let next = 0;
  let done = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        try {
          results[i] = await worker(items[i], i);
        } catch (err) {
          results[i] = err instanceof Error ? err : new Error(String(err));
        }
        done++;
        onProgress?.(done, items.length);
      }
    })
  );
  return results;
}
