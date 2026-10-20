/**
 * Teste de contrato da Distribuição (E4): `fixtures/distribution-view.json` segue o contrato combinado com o backend
 * (DistributionView). Se o backend mudar um campo, a lista de chaves abaixo é o primeiro lugar a conferir. Enquanto
 * os DTOs Java não existem, o contrato é o do pedido da E4 (ver relatório).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/distribution-view.json';
import planJson from './fixtures/plan-view.json';
import scopeJson from './fixtures/scope-view.json';
import { CeremonyApiError } from '../../ceremony-api';

const h = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../../auth-client', () => ({ authFetch: h.authFetch, getAuthToken: () => 'tok' }));

import { DistributionApiError, distributionApi, minStartDateOf, parseDistributionView } from '../api';
import { planSocketUrl } from '../plan-socket';

const VIEW = ['planId', 'status', 'syncedAt', 'canEditPlan', 'myAccountId', 'sprint', 'tasks', 'people', 'warnings'];
const SPRINT = ['startDate', 'endDate', 'holidays'];
const TASK = ['itemId', 'parentKey', 'title', 'devHours', 'qaHours', 'subtasks'];
const SUB = ['key', 'title', 'typeId', 'typeName', 'cls', 'codeReview', 'estimateH', 'remainingH', 'countedH', 'assigneeId', 'assigneeName', 'startDate', 'endDate', 'startsAfterKey', 'minStartDate', 'canClaim', 'canEditDates', 'status'];
const PERSON = ['accountId', 'name', 'role', 'capacityHours', 'allocatedHours', 'freeHours', 'pct', 'zone', 'state'];
const WARNING = ['code', 'message', 'subtaskKey', 'accountId'];
const sorted = (o: object) => Object.keys(o).sort();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('contrato: forma do DistributionView', () => {
  it('tem exatamente os campos combinados', () => {
    expect(sorted(fixture)).toEqual([...VIEW].sort());
    expect(sorted(fixture.sprint)).toEqual([...SPRINT].sort());
    for (const t of fixture.tasks) {
      expect(sorted(t)).toEqual([...TASK].sort());
      for (const s of t.subtasks) expect(sorted(s)).toEqual([...SUB].sort());
    }
    for (const p of fixture.people) expect(sorted(p)).toEqual([...PERSON].sort());
    for (const w of fixture.warnings) expect(sorted(w)).toEqual([...WARNING].sort());
  });

  it('o parser aceita a distribuição e recusa PlanView, ScopeView e vazio', () => {
    expect(parseDistributionView(fixture)).toBe(fixture);
    expect(() => parseDistributionView(planJson)).toThrow(CeremonyApiError);
    expect(() => parseDistributionView(scopeJson)).toThrow(CeremonyApiError);
    expect(() => parseDistributionView(null)).toThrow(CeremonyApiError);
    expect(() => parseDistributionView({ planId: 'p1', tasks: [] })).toThrow(CeremonyApiError);
  });
});

describe('contrato: cliente REST', () => {
  it('GET /distribution', async () => {
    h.authFetch.mockResolvedValue(json(fixture));
    expect(await distributionApi.get('SQ 1', 'p1')).toEqual(fixture);
    expect(h.authFetch.mock.calls[0][0]).toMatch(/\/squads\/SQ%201\/sprint-plans\/p1\/distribution$/);
  });

  it('POST /claim: com e sem accountId', async () => {
    h.authFetch.mockImplementation(async () => json(fixture));
    await distributionApi.claim('SQ', 'p1', 'K-1');
    await distributionApi.claim('SQ', 'p1', 'K-1', 'acc-ana');
    expect(h.authFetch.mock.calls[0][0]).toMatch(/\/distribution\/claim$/);
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ subtaskKey: 'K-1' }) });
    expect(h.authFetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ subtaskKey: 'K-1', accountId: 'acc-ana' }) });
  });

  it('DELETE /claim/{key}', async () => {
    h.authFetch.mockResolvedValue(json(fixture));
    await distributionApi.release('SQ', 'p1', 'K-1');
    expect(h.authFetch.mock.calls[0][0]).toMatch(/\/distribution\/claim\/K-1$/);
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('PUT /dates/{key} com yyyy-MM-dd', async () => {
    h.authFetch.mockResolvedValue(json(fixture));
    await distributionApi.setDates('SQ', 'p1', 'K-1', '2026-10-21', '2026-10-23');
    expect(h.authFetch.mock.calls[0][0]).toMatch(/\/distribution\/dates\/K-1$/);
    expect(h.authFetch.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ startDate: '2026-10-21', endDate: '2026-10-23' }) });
  });

  it('422 traz a mensagem do servidor e o minStartDate; 409 e 403 viram CeremonyApiError com o status', async () => {
    h.authFetch.mockResolvedValueOnce(json({ message: 'Fere a cadeia.', minStartDate: '2026-10-26' }, 422));
    const e = await distributionApi.setDates('SQ', 'p1', 'K-1', 'a', 'b').catch((x) => x);
    expect(e).toBeInstanceOf(DistributionApiError);
    expect(e).toBeInstanceOf(CeremonyApiError);
    expect(e.status).toBe(422);
    expect(e.message).toBe('Fere a cadeia.');
    expect(minStartDateOf(e)).toBe('2026-10-26');
    h.authFetch.mockResolvedValueOnce(json({ message: 'x' }, 409));
    expect((await distributionApi.claim('SQ', 'p1', 'K-1').catch((x) => x)).status).toBe(409);
    h.authFetch.mockResolvedValueOnce(json({ message: 'Sem permissão.' }, 403));
    expect((await distributionApi.release('SQ', 'p1', 'K-1').catch((x) => x)).message).toBe('Sem permissão.');
  });

  it('resposta de sucesso com a forma errada é recusada', async () => {
    h.authFetch.mockResolvedValue(json(planJson));
    await expect(distributionApi.get('SQ', 'p1')).rejects.toBeInstanceOf(CeremonyApiError);
  });
});

describe('tempo real: URL do WebSocket (isolada em plan-socket)', () => {
  it('troca http por ws e usa o caminho do plano', () => {
    expect(planSocketUrl('p1', 'https://api.exemplo.com.br/api')).toBe('wss://api.exemplo.com.br/ws/sprint-plan/p1');
    expect(planSocketUrl('p1', 'http://localhost:8002/api')).toBe('ws://localhost:8002/ws/sprint-plan/p1');
  });
});
