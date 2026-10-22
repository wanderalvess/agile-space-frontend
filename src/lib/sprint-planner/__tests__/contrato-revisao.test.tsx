/**
 * Contrato da Revisão (E5), conferido campo a campo com SprintPlanReviewDtos.java do backend (records ReviewView,
 * ReviewPerson, ReviewTask, ReviewSubtask, Pending, JiraPreview, PreviewChange...). Os fixtures têm as chaves exatas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/review-view.json';
import edge from './fixtures/review-view-edge.json';
import distJson from './fixtures/distribution-view.json';
import planJson from './fixtures/plan-view.json';
import { CeremonyApiError } from '../../ceremony-api';

const h = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../../auth-client', () => ({ authFetch: h.authFetch, getAuthToken: () => 'tok' }));

import { SEND_NOT_AVAILABLE, parseReviewView, reviewApi } from '../api';
import { issueKindLabel, jiraFieldLabel, jumpTarget, pendingsCounter, resolveJumpFocus, sendBlockReason, summaryLine } from '../review';

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

const normal = fixture;
const PENDING_CODES = ['SCOPE_EMPTY', 'SUBTASK_UNASSIGNED', 'SUBTASK_NO_DATES', 'QA_BEFORE_DEV', 'CODE_REVIEW_BEFORE_CODING', 'DATES_OUTSIDE_SPRINT', 'PERSON_OVER_CAPACITY', 'TASK_ON_HOLIDAY', 'TITLE_DIVERGENCE', 'NO_ESTIMATE', 'UNCLASSIFIED_TYPES', 'GOAL_EMPTY'];

describe.each([['fixture normal', fixture], ['fixture com nulos e bordas', edge]])('contrato: forma do ReviewView (%s)', (_n, fixture) => {
  it('tem exatamente os campos do backend', () => {
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
    for (const p of fixture.pendings) {
      expect(['BLOCKING', 'WARNING']).toContain(p.severity);
      expect(PENDING_CODES).toContain(p.code);
    }
    for (const t of fixture.tasks) for (const s of t.subtasks) expect(['DEV', 'QA']).toContain(s.cls);
    expect(['SET', 'CHANGE', 'UNCHANGED']).toContain(fixture.jiraPreview.sprintGoal.kind);
    for (const c of fixture.jiraPreview.changes) {
      expect(['SET', 'CHANGE', 'UNCHANGED']).toContain(c.kind);
      expect(['assignee', 'sprint', 'plannedStart', 'plannedEnd']).toContain(c.field);
    }
  });

  it('o parser aceita a revisão e recusa DistributionView, PlanView e vazio', () => {
    expect(parseReviewView(fixture)).toBe(fixture);
    expect(parseReviewView(edge)).toBe(edge);
    expect(() => parseReviewView(distJson)).toThrow(CeremonyApiError);
    expect(() => parseReviewView(planJson)).toThrow(CeremonyApiError);
    expect(() => parseReviewView(null)).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, jiraPreview: undefined })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, canSend: 'sim' })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, goalSavedInJira: undefined })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, sprint: { ...fixture.sprint, endDate: null } })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, pendings: [{ ...fixture.pendings[0], severity: 'INFO' }] })).toThrow(CeremonyApiError);
    expect(() => parseReviewView({ ...fixture, jiraPreview: { ...fixture.jiraPreview, counts: {} } })).toThrow(CeremonyApiError);
  });

  it('nulos do backend não derrubam o parser nem os helpers', () => {
    const v = parseReviewView(edge);
    expect(v.syncedAt).toBeNull();
    expect(v.goal).toBeNull();
    expect(v.jiraSprintUrl).toBeNull();
    expect(v.people[0].pct).toBeNull();
    expect(summaryLine(v)).toBe('1 pendência impede o envio · 1 aviso');
  });

  it('campo do Jira: nativos sem nome, datas com "campo a definir" ou o nome real', () => {
    const [parentSprint, assignee, , start, end] = normal.jiraPreview.changes as never[];
    expect(jiraFieldLabel(assignee)).toBeNull();
    expect(jiraFieldLabel(parentSprint)).toBeNull();
    expect(jiraFieldLabel(start)).toBe('campo a definir');
    expect(jiraFieldLabel(end)).toBe('Target end');
    expect(jiraFieldLabel({ field: 'plannedEnd', jiraFieldName: null })).toBe('campo a definir');
  });

  it('diferencia a issue pai da subtarefa e resolve o atalho do Escopo pela chave', () => {
    expect(issueKindLabel('DDWMISSI-5810', normal as never)).toBe('Tarefa');
    expect(issueKindLabel('DDWMISSI-5811', normal as never)).toBe('Subtarefa');
    expect(resolveJumpFocus({ step: 'escopo', focus: 'i1' }, normal as never)).toBe('DDWMISSI-5810');
    expect(resolveJumpFocus({ step: 'distribuicao', focus: 'DDWMISSI-5812' }, normal as never)).toBe('DDWMISSI-5812');
  });
});

describe('contrato: chamadas', () => {
  it('GET /review devolve a revisão; corpo errado vira erro 502', async () => {
    h.authFetch.mockResolvedValueOnce(json(normal));
    expect(await reviewApi.get('SQ', 'p1')).toEqual(normal);
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
    expect(summaryLine(normal as never)).toBe('1 pendência impede o envio · 2 avisos');
    expect(pendingsCounter(normal as never)).toBe('3 · 1 impede enviar');
    expect(jumpTarget({ subtaskKey: null, accountId: null, itemId: null })).toBeNull();
    expect(sendBlockReason({ ...normal, blockingCount: 0, canSend: true, writeRulesDefined: true } as never, true)).toBeNull();
  });
});
