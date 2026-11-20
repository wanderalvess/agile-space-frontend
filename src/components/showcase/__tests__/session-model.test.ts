import { describe, expect, it } from 'vitest';
import {
  JIRA_KEY,
  appendUnique,
  buildManualTask,
  isManualTask,
  newIssueKeys,
  nextManualKey,
  normalizeSession,
  syncsToWorkItems,
  workItemSquad,
  workItemStatusFor,
} from '../session-model';
import { FINISHED_STATUS, PRESENTING_STATUS, REOPENED_STATUS } from '../review-room-logic';

describe('normalizeSession', () => {
  it('campo apagado continua vazio; só o ausente cai no valor legado', () => {
    const s = normalizeSession({
      id: 's', name: 'R', tasks: [
        { id: 'a', key: 'A-1', description: 'texto antigo', assignee: 'Ana', evidence: { problem: '', video: null } },
        { id: 'b', key: 'A-2', description: 'texto antigo', assignee: 'Ana', evidence: {} },
      ],
    });
    expect(s.tasks[0].evidence.problem).toBe('');
    expect(s.tasks[1].evidence.problem).toBe('texto antigo');
    expect(s.tasks[1].evidence.dev).toBe('Ana');
    expect(s.tasks[0].decision).toBe('open');
    expect(s.tasks[0].preparationStatus).toBe('todo');
    expect(s.tasks[0].attachments).toEqual([]);
  });

  it('sessão sem cards ou campos vira estrutura completa', () => {
    const s = normalizeSession({ id: 's', name: 'R' });
    expect(s.tasks).toEqual([]);
    expect(s.members).toEqual([]);
    expect(s.squadName).toBe('');
    expect(s.coverImage).toBe('');
  });
});

describe('cards manuais', () => {
  it('a próxima chave é o maior número usado + 1 (não a contagem de cards)', () => {
    expect(nextManualKey([])).toBe('MANUAL-001');
    expect(nextManualKey([{ key: 'MANUAL-001' }, { key: 'MANUAL-002' }])).toBe('MANUAL-003');
    expect(nextManualKey([{ key: 'MANUAL-002' }, { key: 'PTV-9' }])).toBe('MANUAL-003');
    expect(nextManualKey([{ key: 'MANUAL-009' }])).toBe('MANUAL-010');
  });

  it('o card de métricas nasce com uma linha campo/valor aberta; o padrão, não', () => {
    const m = buildManualTask({ id: 'manual_1', key: 'MANUAL-001', cardKind: 'metrics', author: 'Ana' });
    const p = buildManualTask({ id: 'manual_2', key: 'MANUAL-002', cardKind: 'story', author: 'Ana' });
    expect(m.metrics).toEqual([{ field: '', value: 0 }]);
    expect(p.metrics).toBeUndefined();
    expect(m.evidence.dev).toBe('Ana');
    expect(m.decision).toBe('open');
    expect(isManualTask(m)).toBe(true);
    expect(isManualTask({ id: 'x', key: 'PTV-1' })).toBe(false);
    expect(isManualTask({ id: 'x', key: 'MANUAL-004' })).toBe(true);
  });
});

describe('importação sem duplicar', () => {
  it('só entram chaves novas, mesmo se outra pessoa importou a mesma issue no meio-tempo', () => {
    const issues = [{ key: 'A-1' }, { key: 'A-2' }, { key: 'A-3' }];
    expect(newIssueKeys(issues, [{ key: 'A-2' }]).map((i) => i.key)).toEqual(['A-1', 'A-3']);
    const base = [buildManualTask({ id: '1', key: 'A-1', cardKind: 'story', author: '' })];
    const incoming = [buildManualTask({ id: '2', key: 'A-1', cardKind: 'story', author: '' }), buildManualTask({ id: '3', key: 'A-9', cardKind: 'story', author: '' })];
    expect(appendUnique(base, incoming).map((t) => t.key)).toEqual(['A-1', 'A-9']);
  });
});

describe('veredito para os work items da squad', () => {
  it('aprovada=entregue, rejeitada=rejeitada, ajuste=carregada, aberta=comprometida', () => {
    expect(workItemStatusFor('approved')).toBe('delivered');
    expect(workItemStatusFor('rejected')).toBe('rejected');
    expect(workItemStatusFor('needs_adjustment')).toBe('carried_over');
    expect(workItemStatusFor('open')).toBe('committed');
  });

  it('só chaves reais do Jira sincronizam; card manual e chave vazia, não', () => {
    expect(JIRA_KEY.test('PTV-1305')).toBe(true);
    expect(syncsToWorkItems({ key: 'PTV-1305' })).toBe(true);
    expect(syncsToWorkItems({ key: 'MANUAL-001' })).toBe(false);
    expect(syncsToWorkItems({ key: '' })).toBe(false);
    expect(syncsToWorkItems({ key: 'sem chave' })).toBe(false);
  });

  it('squad do work item: a da Review, senão o projeto da chave, senão a ativa', () => {
    expect(workItemSquad({ key: 'PTV-1' }, 'PHOENIX', 'OUTRA')).toBe('PHOENIX');
    expect(workItemSquad({ key: 'ptv-1' }, '', 'OUTRA')).toBe('PTV');
    expect(workItemSquad({ key: '' }, '', 'OUTRA')).toBe('OUTRA');
  });
});

describe('status gravados pela sala', () => {
  it('apresentar grava active (o servidor trata como Ao vivo), finalizar grava finished e reabrir volta a planning', () => {
    expect(PRESENTING_STATUS).toBe('active');
    expect(FINISHED_STATUS).toBe('finished');
    expect(REOPENED_STATUS).toBe('planning');
  });
});
