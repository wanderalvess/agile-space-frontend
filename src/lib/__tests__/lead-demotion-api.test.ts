import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LeadDemotionApiError,
  isLeadDemotionUnavailable,
  leadDemotionQuery,
  parseLeadDemotionReport,
  restoreLeadLevel,
  runLeadDemotion,
} from '../lead-demotion-api';

const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('sem corpo');
      return body;
    },
  });
}

const REPORT = {
  mode: 'DRY_RUN',
  leadLevel: 'off',
  limit: 20,
  summary: { leadUsers: 3, hasLeadershipLink: 1, noLeadershipLink: 2, wouldDemote: 1, demoted: 0, keptNoLeadershipLink: 2, overLimit: 0 },
  users: [
    {
      userId: 'uid-1', email: 'ana@totvs.com.br', name: 'Ana', active: true, classification: 'HAS_LEADERSHIP_LINK',
      leadershipSquads: ['DDWMISSI', 'DDWPRIME'], action: 'WOULD_DEMOTE', activeApiKeys: 2, apiKeysNote: 'x',
    },
    { userId: 'uid-2', email: 'bia@totvs.com.br', name: 'Bia', active: true, classification: 'NO_LEADERSHIP_LINK', leadershipSquads: [], action: 'KEPT_NO_LEADERSHIP_LINK', activeApiKeys: 0, apiKeysNote: null },
  ],
  warnings: ['aviso'],
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('leadDemotionQuery', () => {
  it('simulação não manda apply (nunca grava por engano)', () => {
    expect(leadDemotionQuery()).toBe('');
    expect(leadDemotionQuery({ apply: false })).toBe('');
    expect(leadDemotionQuery({ apply: false, limit: 10 })).toBe('?limit=10');
  });

  it('apply, lote, conta e forceDemote (este só vale com userId)', () => {
    expect(leadDemotionQuery({ apply: true, limit: 10 })).toBe('?apply=true&limit=10');
    expect(leadDemotionQuery({ apply: true, userId: 'uid 7', forceDemote: true })).toBe('?apply=true&userId=uid+7&forceDemote=true');
    expect(leadDemotionQuery({ apply: true, forceDemote: true })).toBe('?apply=true');
  });
});

describe('runLeadDemotion', () => {
  it('simulação: POST sem apply e lê o relatório do contrato', async () => {
    reply(200, REPORT);
    const r = await runLeadDemotion();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/admin\/membership\/lead-demotion$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(r.mode).toBe('DRY_RUN');
    expect(r.summary).toMatchObject({ leadUsers: 3, wouldDemote: 1, noLeadershipLink: 2 });
    expect(r.users.map((u) => [u.userId, u.classification, u.action])).toEqual([
      ['uid-1', 'HAS_LEADERSHIP_LINK', 'WOULD_DEMOTE'],
      ['uid-2', 'NO_LEADERSHIP_LINK', 'KEPT_NO_LEADERSHIP_LINK'],
    ]);
    expect(r.users[0]).toMatchObject({ leadershipSquads: ['DDWMISSI', 'DDWPRIME'], activeApiKeys: 2 });
    expect(r.warnings).toEqual(['aviso']);
  });

  it('apply: manda apply=true e o lote', async () => {
    reply(200, { ...REPORT, mode: 'APPLIED' });
    const r = await runLeadDemotion({ apply: true, limit: 20 });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/lead-demotion\?apply=true&limit=20$/);
    expect(r.mode).toBe('APPLIED');
  });

  it('forceDemote: userId + forceDemote=true', async () => {
    reply(200, { ...REPORT, mode: 'APPLIED' });
    await runLeadDemotion({ apply: true, userId: 'uid-2', forceDemote: true });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/lead-demotion\?apply=true&userId=uid-2&forceDemote=true$/);
  });

  it('404 e 405 contam como "ainda não disponível"; 403 e 500 não', async () => {
    reply(404, { message: 'Not Found' });
    const nf = await runLeadDemotion().catch((e) => e);
    expect(nf).toBeInstanceOf(LeadDemotionApiError);
    expect(isLeadDemotionUnavailable(nf)).toBe(true);
    reply(405);
    expect(isLeadDemotionUnavailable(await runLeadDemotion().catch((e) => e))).toBe(true);
    reply(403);
    const forbidden = await runLeadDemotion().catch((e) => e);
    expect(isLeadDemotionUnavailable(forbidden)).toBe(false);
    expect(forbidden.message).toBe('Você não tem permissão para esta ação.');
    reply(500);
    expect(isLeadDemotionUnavailable(await runLeadDemotion().catch((e) => e))).toBe(false);
    expect(isLeadDemotionUnavailable(new Error('rede'))).toBe(false);
  });

  it('usa a mensagem do servidor quando vem', async () => {
    reply(409, { message: 'Conta não é LEAD' });
    expect((await runLeadDemotion({ apply: true, userId: 'x' }).catch((e) => e)).message).toBe('Conta não é LEAD');
  });

  it('corpo fora do contrato vira erro, não relatório vazio', async () => {
    reply(200, { ok: true });
    await expect(runLeadDemotion()).rejects.toBeInstanceOf(LeadDemotionApiError);
  });
});

describe('parseLeadDemotionReport', () => {
  it('é tolerante: ignora usuários sem id e classificação desconhecida vira "sem liderança" (o lado seguro)', () => {
    const r = parseLeadDemotionReport({
      summary: {},
      users: [{ email: 'sem-id' }, { userId: 'a', classification: 'NOVO' }],
    });
    expect(r?.users).toHaveLength(1);
    expect(r?.users[0].classification).toBe('NO_LEADERSHIP_LINK');
    expect(r?.summary.leadUsers).toBe(0);
    expect(parseLeadDemotionReport(null)).toBeNull();
  });
});

describe('restoreLeadLevel', () => {
  it('sem conta restaura todos; com conta manda userId', async () => {
    reply(200, { restored: 1, skipped: 1, users: [{ userId: 'u', email: 'e', result: 'RESTORED', reason: null }, { userId: 'v', email: 'f', result: 'SKIPPED', reason: 'ALREADY_LEAD' }] });
    const all = await restoreLeadLevel();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/admin\/membership\/lead-restore$/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(all).toMatchObject({ restored: 1, skipped: 1 });
    expect(all.users[1]).toMatchObject({ result: 'SKIPPED', reason: 'ALREADY_LEAD' });
    reply(200, { restored: 0, skipped: 0, users: [] });
    await restoreLeadLevel('uid 1');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/lead-restore\?userId=uid%201$/);
  });

  it('falha sobe com o status', async () => {
    reply(404);
    const err = await restoreLeadLevel('x').catch((e) => e);
    expect(err).toBeInstanceOf(LeadDemotionApiError);
    expect(err.status).toBe(404);
  });
});
