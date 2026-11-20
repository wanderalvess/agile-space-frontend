/**
 * Teste de contrato da Distribuição (E4). As chaves abaixo são as dos records de `SprintPlanDistributionDtos.java`
 * (conferidas campo a campo). `distribution-view.json` é o caso comum; `distribution-view-edge.json` cobre nulos
 * (pct, datas, startsAfterKey, minStartDate, label de feriado) e as classes FORA/SEM. Os corpos de erro seguem o
 * ErrorMessageAdvice ({error, message}) e o handler do controller (422 com minStartDate). Se o backend mudar um campo,
 * a lista de chaves é o primeiro lugar a conferir.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/distribution-view.json';
import edge from './fixtures/distribution-view-edge.json';
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
const PERSON = ['accountId', 'name', 'role', 'capacityHours', 'allocatedHours', 'freeHours', 'pct', 'zone', 'state', 'absences'];
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

  it('caso de borda: nulos, FORA/SEM e feriado sem rótulo têm as mesmas chaves e o parser aceita', () => {
    expect(sorted(edge)).toEqual([...VIEW].sort());
    for (const t of edge.tasks) for (const x of t.subtasks) expect(sorted(x)).toEqual([...SUB].sort());
    for (const p of edge.people) expect(sorted(p)).toEqual([...PERSON].sort());
    expect(edge.people[0].pct).toBeNull();
    expect(edge.tasks[0].subtasks.map((x) => x.cls)).toEqual(['FORA', 'SEM', 'QA']);
    expect(parseDistributionView(edge)).toBe(edge);
  });

  it('holidays são {day, label} (label pode ser null); datas são strings yyyy-MM-dd; horas são números', () => {
    for (const h of fixture.sprint.holidays) expect(typeof h.day).toBe('string');
    expect(edge.sprint.holidays[1].label).toBeNull();
    for (const t of fixture.tasks) for (const x of t.subtasks) {
      for (const n of [x.estimateH, x.remainingH, x.countedH]) expect(typeof n).toBe('number');
      for (const d of [x.startDate, x.endDate, x.minStartDate]) if (d !== null) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
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

  it('corpos de erro reais: 422 da cadeia, 422 de regra (sem minStartDate), 409, 403 e 404', async () => {
    const call = (status: number, body: object) => {
      h.authFetch.mockResolvedValueOnce(json(body, status));
      return distributionApi.setDates('SQ', 'p1', 'K-1', '2026-11-02', '2026-11-04').catch((x) => x);
    };
    const chain = await call(422, { error: 'UNPROCESSABLE_ENTITY', message: 'O início não pode ser antes de 04/11.', minStartDate: '2026-11-04' });
    expect([chain.status, chain.message, minStartDateOf(chain)]).toEqual([422, 'O início não pode ser antes de 04/11.', '2026-11-04']);
    const rule = await call(422, { error: '422 UNPROCESSABLE_ENTITY', message: 'Assuma a subtarefa antes de marcar as datas.' });
    expect([rule.status, rule.message, minStartDateOf(rule)]).toEqual([422, 'Assuma a subtarefa antes de marcar as datas.', null]);
    const nullMin = await call(422, { error: 'UNPROCESSABLE_ENTITY', message: 'x', minStartDate: null });
    expect(minStartDateOf(nullMin)).toBeNull();
    const conflict = await call(409, { error: 'CONFLICT', message: 'A distribuição foi alterada por outra pessoa. Recarregue e tente de novo.' });
    expect([conflict.status, conflict.message]).toEqual([409, 'A distribuição foi alterada por outra pessoa. Recarregue e tente de novo.']);
    const forbidden = await call(403, { error: '403 FORBIDDEN', message: 'Só a liderança da squad ou um administrador pode atribuir subtarefas a outra pessoa.' });
    expect(forbidden.status).toBe(403);
    const notFound = await call(404, { error: '404 NOT_FOUND', message: 'Plano não encontrado.' });
    expect([notFound.status, notFound.message]).toEqual([404, 'Plano não encontrado.']);
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

describe('tempo real: conexão (URL com token, evento, reconexão, fechamento)', () => {
  class FakeWS {
    static all: FakeWS[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readyState = 1;
    closed = false;
    constructor(public url: string) { FakeWS.all.push(this); }
    close() { this.closed = true; }
  }

  beforeEach(() => { FakeWS.all = []; vi.stubGlobal('WebSocket', FakeWS); vi.useFakeTimers(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('abre /ws/sprint-plan/{planId}?token=..., como as outras salas, e o REFRESH_PLAN real recarrega', async () => {
    const { connectPlanSocket } = await import('../plan-socket');
    const onRefresh = vi.fn();
    const close = connectPlanSocket('p 1', { onRefresh });
    expect(FakeWS.all[0].url).toMatch(/^wss?:\/\/[^/]+\/ws\/sprint-plan\/p%201\?token=tok$/);
    FakeWS.all[0].onopen?.();
    FakeWS.all[0].onmessage?.({ data: JSON.stringify({ type: 'REFRESH_PLAN', planId: 'p 1', boardId: 'p 1', payload: null, timestamp: 1760000000000 }) });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    FakeWS.all[0].onmessage?.({ data: JSON.stringify({ type: 'OUTRO', planId: 'p 1' }) });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    close();
    expect(FakeWS.all[0].closed).toBe(true);
  });

  it('cai e reconecta recarregando; depois de fechar de propósito não reconecta', async () => {
    const { connectPlanSocket } = await import('../plan-socket');
    const onRefresh = vi.fn();
    const close = connectPlanSocket('p1', { onRefresh });
    FakeWS.all[0].onopen?.();
    FakeWS.all[0].onclose?.();
    vi.advanceTimersByTime(2000);
    expect(FakeWS.all).toHaveLength(2);
    FakeWS.all[1].onopen?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    close();
    FakeWS.all[1].onclose?.();
    vi.advanceTimersByTime(60000);
    expect(FakeWS.all).toHaveLength(2);
  });
});
