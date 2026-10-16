import { describe, it, expect } from 'vitest';
import {
  BATCH_CONCURRENCY,
  MAX_BATCH_INVITES,
  buildBatchLinksCsv,
  buildBatchTemplateCsv,
  inviteExpiryLabel,
  isInviteExpired,
  normalizeInviteRole,
  parseBatchInvites,
  parseServerInstant,
  runWithConcurrency,
} from '../invites';
import { parseCsv } from '../csv';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const DAY = 86_400_000;

describe('vencimento do convite', () => {
  it('datas do servidor sem fuso são UTC', () => {
    expect(parseServerInstant('2026-10-16T12:00:00')).toBe(NOW);
    expect(parseServerInstant('2026-10-16T12:00:00.123')).toBe(NOW + 123);
    expect(parseServerInstant('2026-10-16T09:00:00-03:00')).toBe(NOW);
    expect(parseServerInstant('2026-10-16T12:00:00Z')).toBe(NOW);
    expect(parseServerInstant(null)).toBeNaN();
  });

  it('vencido é calculado pelo expiresAt (o servidor mantém PENDING)', () => {
    expect(isInviteExpired({ expiresAt: new Date(NOW - 1000).toISOString() }, NOW)).toBe(true);
    expect(isInviteExpired({ expiresAt: new Date(NOW + DAY).toISOString() }, NOW)).toBe(false);
    expect(isInviteExpired({ expiresAt: 'lixo' }, NOW)).toBe(false);
  });

  it('rótulo de prazo', () => {
    const at = (ms: number) => ({ expiresAt: new Date(NOW + ms).toISOString() });
    expect(inviteExpiryLabel(at(5 * DAY + 3600_000), NOW)).toBe('expira em 5 dias');
    expect(inviteExpiryLabel(at(DAY + 3600_000), NOW)).toBe('expira em 1 dia');
    expect(inviteExpiryLabel(at(3600_000), NOW)).toBe('expira hoje');
    expect(inviteExpiryLabel(at(-3600_000), NOW)).toBe('venceu hoje');
    expect(inviteExpiryLabel(at(-DAY - 3600_000), NOW)).toBe('venceu ontem');
    expect(inviteExpiryLabel(at(-4 * DAY - 3600_000), NOW)).toBe('venceu há 4 dias');
  });
});

describe('papel do convite', () => {
  it('só os 4 papéis de contribuidor; liderança e desconhecidos viram null', () => {
    expect(normalizeInviteRole('Developer')).toBe('Developer');
    expect(normalizeInviteRole(' qa ')).toBe('QA');
    expect(normalizeInviteRole('ux/designer')).toBe('UX/Designer');
    expect(normalizeInviteRole('SME')).toBe('SME');
    expect(normalizeInviteRole('Agile Master')).toBeNull();
    expect(normalizeInviteRole('Tech Lead')).toBeNull();
    expect(normalizeInviteRole('')).toBeNull();
  });
});

describe('parseBatchInvites', () => {
  it('lê e-mail;papel com cabeçalho e valida cada linha', () => {
    const csv = [
      'e-mail;papel',
      'carla.mendes@totvs.com.br;Developer',
      'diego.alves@totvs.com.br;UX/Designer',
      'iara.lopes;Developer',
      'jonas.reis@totvs.com.br;Agile Master',
      'Carla.Mendes@totvs.com.br;QA',
    ].join('\r\n');
    const r = parseBatchInvites(csv);
    if (typeof r === 'string') throw new Error(r);
    expect(r.rows.map((x) => [x.email, x.role, x.validation, x.line])).toEqual([
      ['carla.mendes@totvs.com.br', 'Developer', 'ready', 2],
      ['diego.alves@totvs.com.br', 'UX/Designer', 'ready', 3],
      ['iara.lopes', 'Developer', 'invalid-email', 4],
      ['jonas.reis@totvs.com.br', null, 'role-not-allowed', 5],
      ['carla.mendes@totvs.com.br', 'QA', 'duplicate', 6],
    ]);
  });

  it('aceita vírgula e arquivo sem cabeçalho', () => {
    const r = parseBatchInvites('a@x.com,QA\nb@x.com,SME');
    if (typeof r === 'string') throw new Error(r);
    expect(r.rows.map((x) => x.validation)).toEqual(['ready', 'ready']);
    expect(r.rows[0].line).toBe(1);
  });

  it('vazio e grande demais', () => {
    expect(parseBatchInvites('')).toBe('EMPTY');
    expect(parseBatchInvites('e-mail;papel')).toBe('EMPTY');
    const big = ['e-mail;papel', ...Array.from({ length: MAX_BATCH_INVITES + 1 }, (_, i) => `p${i}@x.com;QA`)].join('\n');
    expect(parseBatchInvites(big)).toBe('TOO_MANY');
  });

  it('o modelo baixado passa na validação', () => {
    const r = parseBatchInvites(buildBatchTemplateCsv());
    if (typeof r === 'string') throw new Error(r);
    expect(r.rows.every((x) => x.validation === 'ready')).toBe(true);
    expect(r.rows).toHaveLength(3);
  });
});

describe('CSV dos links', () => {
  it('traz e-mail, papel, link e situação', () => {
    const csv = buildBatchLinksCsv([
      { email: 'a@x.com', role: 'QA', status: 'done', link: 'https://app/invite/abc' },
      { email: 'b@x.com', role: 'SME', status: 'error', error: 'Convite não concede papel de liderança' },
    ]);
    const { rows } = parseCsv(csv);
    expect(rows[0]).toEqual(['e-mail', 'papel', 'link', 'situação']);
    expect(rows[1]).toEqual(['a@x.com', 'QA', 'https://app/invite/abc', 'Gerado']);
    expect(rows[2][3]).toBe('Convite não concede papel de liderança');
  });
});

describe('runWithConcurrency', () => {
  it('nunca passa de 3 chamadas ao mesmo tempo e mantém a ordem do resultado', async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const out = await runWithConcurrency(items, BATCH_CONCURRENCY, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5 + (n % 3) * 3));
      running--;
      return n * 2;
    });
    expect(peak).toBe(3);
    expect(out).toEqual(items.map((n) => n * 2));
  });

  it('um item que falha não derruba os outros', async () => {
    const out = await runWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('falhou');
      return n;
    });
    expect(out[0]).toBe(1);
    expect(out[1]).toBeInstanceOf(Error);
    expect((out[1] as Error).message).toBe('falhou');
    expect(out[2]).toBe(3);
  });

  it('avisa o progresso e aceita lista vazia', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4], 2, async (n) => n, (done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(await runWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});
