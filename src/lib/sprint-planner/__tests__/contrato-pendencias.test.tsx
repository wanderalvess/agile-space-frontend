/**
 * Contrato das pendências do Sprint Planner: copy-from-previous (PlanView), next-sprint (NextSprintView),
 * absences em DistributionView.people, planVersion em ScopeView e jiraGoal em PlanView. As chaves vêm do combinado
 * com o backend (nomes exatos); se o backend mudar um campo, esta lista é o primeiro lugar a conferir.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import planJson from './fixtures/plan-view.json';
import scopeJson from './fixtures/scope-view.json';
import distJson from './fixtures/distribution-view.json';
import { CeremonyApiError } from '../../ceremony-api';

const h = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../../auth-client', () => ({ authFetch: h.authFetch, getAuthToken: () => 'tok' }));

import { parseDistributionView, parseScopeView, sprintPlanApi } from '../api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sorted = (o: object) => Object.keys(o).sort();
const NEXT = { found: true, jiraSprintId: '777', name: 'Sprint 2026.11/1', startDate: '2026-11-04', endDate: '2026-11-17', goal: 'Meta', state: 'future' };

beforeEach(() => vi.clearAllMocks());

describe('contrato: copy-from-previous', () => {
  it('POST sem corpo útil ({}), com sourcePlanId opcional, e devolve o PlanView', async () => {
    h.authFetch.mockResolvedValueOnce(json(planJson)).mockResolvedValueOnce(json(planJson));
    expect(await sprintPlanApi.copyFromPrevious('SQ', 'p1')).toEqual(planJson);
    await sprintPlanApi.copyFromPrevious('SQ', 'p1', 'p0');
    const [url, init] = h.authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/squads\/SQ\/sprint-plans\/p1\/copy-from-previous$/);
    expect(init).toMatchObject({ method: 'POST', body: '{}' });
    expect(h.authFetch.mock.calls[1][1]).toMatchObject({ body: JSON.stringify({ sourcePlanId: 'p0' }) });
  });

  it('404 mostra "Nenhum planejamento anterior"; corpo fora do formato vira erro', async () => {
    h.authFetch.mockResolvedValueOnce(json({ message: 'Nenhum planejamento anterior.' }, 404));
    await expect(sprintPlanApi.copyFromPrevious('SQ', 'p1')).rejects.toMatchObject({ status: 404, message: 'Nenhum planejamento anterior.' });
    h.authFetch.mockResolvedValueOnce(json(scopeJson));
    await expect(sprintPlanApi.copyFromPrevious('SQ', 'p1')).rejects.toBeInstanceOf(CeremonyApiError);
  });
});

describe('contrato: next-sprint', () => {
  it('GET devolve NextSprintView com as chaves combinadas', async () => {
    h.authFetch.mockResolvedValueOnce(json(NEXT));
    const v = await sprintPlanApi.nextSprint('SQ');
    expect(sorted(v)).toEqual(['endDate', 'found', 'goal', 'jiraSprintId', 'name', 'startDate', 'state']);
    expect(String(h.authFetch.mock.calls[0][0])).toMatch(/\/squads\/SQ\/sprint-plans\/next-sprint$/);
  });

  it('found=false é resposta válida; 400/429/502 trazem a mensagem do servidor; vazio vira erro', async () => {
    h.authFetch.mockResolvedValueOnce(json({ ...NEXT, found: false, jiraSprintId: null, name: null, startDate: null, endDate: null, goal: null, state: null }));
    expect((await sprintPlanApi.nextSprint('SQ')).found).toBe(false);
    for (const [status, message] of [[400, 'Sem token do Jira.'], [429, 'Tente de novo em 12 s'], [502, 'Jira indisponível.']] as const) {
      h.authFetch.mockResolvedValueOnce(json({ message }, status));
      // 5xx: o cliente mostra o texto padrão em português (a mensagem do servidor só vale em 4xx)
      await expect(sprintPlanApi.nextSprint('SQ')).rejects.toMatchObject({ status, message: status === 502 ? 'Não foi possível buscar a próxima sprint no Jira.' : message });
    }
    h.authFetch.mockResolvedValueOnce(json({}));
    await expect(sprintPlanApi.nextSprint('SQ')).rejects.toBeInstanceOf(CeremonyApiError);
  });
});

describe('contrato: absences, planVersion e jiraGoal', () => {
  it('cada pessoa da distribuição traz absences [{startDate,endDate,hours,reason}] (hours null = dia inteiro)', () => {
    for (const p of distJson.people) {
      expect(Array.isArray(p.absences)).toBe(true);
      for (const a of p.absences) expect(sorted(a)).toEqual(['endDate', 'hours', 'reason', 'startDate']);
    }
    expect(distJson.people[0].absences[0].hours).toBeNull();
    expect(parseDistributionView(distJson)).toBe(distJson);
  });

  it('o parser recusa pessoa sem absences', () => {
    const bad = JSON.parse(JSON.stringify(distJson));
    delete bad.people[0].absences;
    expect(() => parseDistributionView(bad)).toThrow(CeremonyApiError);
  });

  it('ScopeView exige planVersion numérico', () => {
    expect(typeof scopeJson.planVersion).toBe('number');
    expect(parseScopeView(scopeJson)).toBe(scopeJson);
    const bad = { ...scopeJson } as Record<string, unknown>;
    delete bad.planVersion;
    expect(() => parseScopeView(bad)).toThrow(CeremonyApiError);
  });

  it('PlanView traz jiraGoal (texto ou null)', () => {
    expect('jiraGoal' in planJson).toBe(true);
    expect(typeof planJson.jiraGoal === 'string' || planJson.jiraGoal === null).toBe(true);
  });
});
