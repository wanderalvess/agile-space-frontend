import { describe, expect, it } from 'vitest';
import type { JiraPublishEvent, JiraPublishJob, JiraPublishStep } from '@/app/room/jira-publish-api';
import {
  applyFilter,
  canDiscard,
  canRetry,
  canVerify,
  countByFilter,
  defaultFilter,
  eventLabel,
  eventTone,
  filterOf,
  formatWhen,
  jiraIssueUrl,
  stepDetail,
  stepLabel,
} from '../queue-helpers';

function job(status: JiraPublishJob['status'], extra: Partial<JiraPublishJob> = {}, steps: JiraPublishStep[] = []): JiraPublishJob {
  return { id: `j-${status}`, squadId: 'S', roomId: 'r', issueId: 'i', parentKey: 'DDW-1', requestedBy: 'u', status, steps, ...extra };
}
const step = (kind: JiraPublishStep['kind'], status: JiraPublishStep['status'], extra: Partial<JiraPublishStep> = {}): JiraPublishStep => ({
  index: 0, kind, status, ...extra,
});

describe('fila de envios ao Jira: filtros', () => {
  it('classifica erro, andamento e concluído; travado conta como erro', () => {
    expect(filterOf(job('DONE'))).toBe('DONE');
    expect(filterOf(job('ERROR'))).toBe('ERROR');
    expect(filterOf(job('RUNNING'))).toBe('RUNNING');
    expect(filterOf(job('PENDING'))).toBe('RUNNING');
    expect(filterOf(job('RUNNING', { stale: true }))).toBe('ERROR');
  });

  it('conta por filtro e abre no que precisa de atenção', () => {
    const jobs = [job('DONE'), job('ERROR'), job('RUNNING'), job('DONE')];
    const counts = countByFilter(jobs);
    expect(counts).toEqual({ ALL: 4, ERROR: 1, RUNNING: 1, DONE: 2 });
    expect(defaultFilter(counts)).toBe('ERROR');
    expect(defaultFilter({ ALL: 3, ERROR: 0, RUNNING: 1, DONE: 2 })).toBe('RUNNING');
    expect(defaultFilter({ ALL: 2, ERROR: 0, RUNNING: 0, DONE: 2 })).toBe('ALL');
    expect(applyFilter(jobs, 'ALL')).toHaveLength(4);
    expect(applyFilter(jobs, 'DONE')).toHaveLength(2);
  });
});

describe('fila de envios ao Jira: ações permitidas', () => {
  it('tentar de novo e descartar só com erro ou travado', () => {
    expect(canRetry(job('ERROR'))).toBe(true);
    expect(canRetry(job('RUNNING', { stale: true }))).toBe(true);
    expect(canRetry(job('RUNNING'))).toBe(false);
    expect(canRetry(job('DONE'))).toBe(false);
    expect(canDiscard(job('ERROR'))).toBe(true);
    expect(canDiscard(job('DONE'))).toBe(false);
  });

  it('conferir só quando há passo concluído', () => {
    expect(canVerify(job('ERROR', {}, [step('RENAME_PARENT', 'ERROR')]))).toBe(false);
    expect(canVerify(job('ERROR', {}, [step('RENAME_PARENT', 'DONE'), step('ADD_COMMENT', 'ERROR')]))).toBe(true);
  });
});

describe('fila de envios ao Jira: textos', () => {
  it('monta o link da issue no Jira e recusa chave ou domínio estranhos', () => {
    expect(jiraIssueUrl('jiraproducao.totvs.com.br', 'ddwmissi-5909')).toBe('https://jiraproducao.totvs.com.br/browse/DDWMISSI-5909');
    expect(jiraIssueUrl('https://jira.x.com/', 'DDW-1')).toBe('https://jira.x.com/browse/DDW-1');
    expect(jiraIssueUrl(null, 'DDW-1')).toBeNull();
    expect(jiraIssueUrl('jira.x.com', 'nao e chave')).toBeNull();
    expect(jiraIssueUrl('jira.x.com', '../../admin')).toBeNull();
  });

  it('descreve o passo e resume o conteúdo', () => {
    expect(stepLabel(step('RENAME_PARENT', 'DONE', { targetKey: 'DDW-1' }))).toBe('Renomear DDW-1');
    expect(stepLabel(step('CREATE_SUBTASK', 'DONE', { issueType: 'Codificação' }))).toBe('Criar sub-tarefa Codificação');
    expect(stepLabel(step('ADD_COMMENT', 'DONE', { targetKey: 'DDW-2' }))).toBe('Comentar em DDW-2');
    expect(stepDetail(step('ADD_COMMENT', 'DONE', { comment: 'linha 1\n\nlinha 2' }))).toBe('linha 1 linha 2');
    expect(stepDetail(step('RENAME_PARENT', 'DONE', { summary: 'x'.repeat(200) }), 10)).toBe(`${'x'.repeat(10)}…`);
    expect(stepDetail(step('CREATE_SUBTASK', 'DONE'))).toBe('');
  });

  it('rotula e colore as linhas do log', () => {
    const e = (action: JiraPublishEvent['action'], extra: Partial<JiraPublishEvent> = {}): JiraPublishEvent => ({ id: 'e', action, createdAt: '2026-10-31T04:17:46', ...extra });
    expect(eventLabel(e('STEP_ERROR', { stepPosition: 0 }))).toBe('Passo com erro (passo 1)');
    expect(eventLabel(e('VERIFIED'))).toBe('Conferência no Jira');
    expect(eventTone(e('STEP_DONE', { ok: true }))).toBe('ok');
    expect(eventTone(e('STEP_ERROR', { ok: false }))).toBe('error');
    expect(eventTone(e('RETRY'))).toBe('neutral');
  });

  it('formata a data (servidor manda UTC sem fuso) e tolera lixo', () => {
    expect(formatWhen('2026-10-31T04:17:46')).toBe(formatWhen('2026-10-31T04:17:46Z'));
    expect(formatWhen('2026-10-31T04:17:46Z')).toMatch(/^\d\d\/\d\d \d\d:\d\d$/);
    expect(formatWhen(null)).toBe('');
    expect(formatWhen('ontem')).toBe('');
  });
});
