/**
 * Contrato da Revisão (E5). As chaves abaixo são as combinadas para o `ReviewView` do backend (o DTO Java ainda não
 * existia quando este teste foi escrito: ao ele chegar, conferir campo a campo aqui). O fixture tem o formato real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/review-view.json';
import distJson from './fixtures/distribution-view.json';
import planJson from './fixtures/plan-view.json';
import { CeremonyApiError } from '../../ceremony-api';

const h = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../../auth-client', () => ({ authFetch: h.authFetch, getAuthToken: () => 'tok' }));

import { SEND_NOT_AVAILABLE, parseReviewView, reviewApi } from '../api';
import { jumpTarget, pendingsCounter, sendBlockReason, summaryLine } from '../review';

const VIEW = ['planId', 'status', 'syncedAt', 'canEditPlan', 'sprint', 'goal', 'goalSavedInJira', 'people', 'tasks', 'pendings', 'blockingCount', 'warningCount', 'canSend', 'writeRulesDefined', 'jiraPreview', 'jiraSprintUrl'];
const PERSON = ['accountId', 'name', 'role', 'capacityHours', 'allocatedHours', 'freeHours', 'pct', 'zone', 'state', 'subtaskCount', 'datedSubtaskCount'];
const TASK = ['itemId', 'parentKey', 'title', 'devHours', 'qaHours', 'subtasks'];
const SUB = ['key', 'title', 'typeName', 'cls', 'assigneeId', 'assigneeName', 'startDate', 'endDate', 'estimateH'];
const PENDING = ['code', 'severity', 'message', 'subtaskKey', 'accountId', 'itemId'];
const CHANGE = ['issueKey', 'summary', 'field', 'jiraFieldName', 'from', 'to', 'kind'];
const sorted = (o: object) => Object.keys(o).sort();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('contrato: forma do ReviewView', () => {
  it('tem exatamente os campos combinados', () => {
    expect(sorted(fixture)).toEqual([...VIEW].sort());
    expect(sorted(fixture.sprint)).toEqual(['endDate', 'name', 'startDate']);
    for (const p of fixture.people) expect(sorted(p)).toEqual([...PERSON].sort());
    for (const t of fixture.tasks) {
      expect(sorted(t)).toEqual([...TASK].sort());
      for (const s of t.subtasks) expect(sorted(s)).toEqual([...SUB].sort());
    }
    for (const p of fixture.pendings) expect(sorted(p)).toEqual([...PENDING].sort());
    expect(sorted(fixture.jiraPreview)).toEqual(['changes', 'counts', 'rulesNote', 'sprintGoal']);
    expect(sorted(fixture.jiraPreview.counts)).toEqual(['change', 'issues', 'set', 'unchanged']);
    for (const c of fixture.jiraPreview.changes) expect(sorted(c)).toEqual([...CHANGE].sort());
  });

  it('severidades e tipos de mudança são os valores do enum', () => {
    for (const p of fixture.pendings) expect(['BLOCKING', 'WARNING']).toContain(p.severity);
    for (const c of fixture.jiraPreview.changes) {
      expect(['SET', 'CHANGE', 'UNCHANGED']).toContain(c.kind);
      expect(['assignee', 'sprint', 'plannedStart', 'plannedEnd']).toContain(c.field);
    }
  });

  it('o parser aceita a revisão e recusa DistributionView, PlanView e vazio', () => {
    expect(parseReviewView(fixture)).toBe(fixture);
    expect(() => parseReviewView(distJson)).toThrow(CeremonyApiError);
    expect(() => parseReviewView(planJson)).toThrow(CeremonyApiError);
    expect(() => parseReviewView(null)).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, jiraPreview: undefined })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, canSend: 'sim' })).toThrow(CeremonyApiError);
  });
});

describe('contrato: chamadas', () => {
  it('GET /review devolve a revisão; corpo errado vira erro 502', async () => {
    h.authFetch.mockResolvedValueOnce(json(fixture));
    expect(await reviewApi.get('SQ', 'p1')).toEqual(fixture);
    expect(h.authFetch.mock.calls[0][0]).toMatch(/\/squads\/SQ\/sprint-plans\/p1\/review$/);
    h.authFetch.mockResolvedValueOnce(json(distJson));
    await expect(reviewApi.get('SQ', 'p1')).rejects.toMatchObject({ status: 502 });
  });

  it('POST /send-to-jira com 501 vira a mensagem clara', async () => {
    h.authFetch.mockResolvedValueOnce(json({ message: 'não implementado' }, 501));
    await expect(reviewApi.sendToJira('SQ', 'p1')).rejects.toMatchObject({ status: 501, message: SEND_NOT_AVAILABLE });
  });
});

describe('helpers da revisão', () => {
  it('textos e atalhos', () => {
    expect(summaryLine(fixture as never)).toBe('1 pendência impede o envio · 2 avisos');
    expect(pendingsCounter(fixture as never)).toBe('3 · 1 impede enviar');
    expect(jumpTarget({ subtaskKey: null, accountId: null, itemId: null })).toBeNull();
    expect(sendBlockReason({ ...fixture, blockingCount: 0, canSend: true, writeRulesDefined: true } as never, true)).toBeNull();
  });
});
