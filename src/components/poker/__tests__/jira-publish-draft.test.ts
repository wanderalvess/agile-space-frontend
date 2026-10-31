import { describe, expect, it } from 'vitest';
import type { JiraPublishPreview } from '@/app/room/jira-publish-api';
import { buildSteps, countsLabel, draftAttention, draftCounts, draftFromPreview, validateDraft } from '../jira-publish-draft';

const preview = (over: Partial<JiraPublishPreview> = {}): JiraPublishPreview => ({
  roomId: 'r1',
  issueId: 'i1',
  squadId: 's1',
  projectKey: 'DDW',
  parentKey: 'DDW-1',
  currentSummary: 'Mapear campo',
  hoursDeck: true,
  devHours: 10,
  qaHours: 4,
  warnings: [],
  steps: [
    { index: 0, kind: 'RENAME_PARENT', targetKey: 'DDW-1', summary: 'Mapear campo (DEV 10h / QA 4h)' },
    { index: 1, kind: 'CREATE_SUBTASK', issueType: 'Sub-tarefa', summary: 'Codificação', estimateHours: 10, role: 'DEV' },
    { index: 2, kind: 'ADD_COMMENT', dependsOnIndex: 1, comment: 'Notas do DEV' },
    { index: 3, kind: 'CREATE_SUBTASK', issueType: 'Sub-tarefa', summary: 'Testes', estimateHours: 4, role: 'QA' },
  ],
  ...over,
});

describe('rascunho do envio ao Jira', () => {
  it('a prévia vira rascunho: comentário ligado só onde há nota', () => {
    const d = draftFromPreview(preview());
    expect(d.renameEnabled).toBe(true);
    expect(d.subtasks.map(s => [s.create.summary, s.commentOn])).toEqual([['Codificação', true], ['Testes', false]]);
  });

  it('monta os passos reindexados, com o comentário logo depois da sua sub-tarefa', () => {
    const steps = buildSteps(draftFromPreview(preview()));
    expect(steps.map(s => [s.index, s.kind, s.dependsOnIndex ?? null])).toEqual([
      [0, 'RENAME_PARENT', null],
      [1, 'CREATE_SUBTASK', null],
      [2, 'ADD_COMMENT', 1],
      [3, 'CREATE_SUBTASK', null],
    ]);
  });

  it('"Comentar" desligado não manda o comentário, mesmo com texto', () => {
    const d = draftFromPreview(preview());
    d.subtasks[0].commentOn = false;
    expect(buildSteps(d).some(s => s.kind === 'ADD_COMMENT')).toBe(false);
    expect(draftCounts(d)).toEqual({ rename: 1, subtasks: 2, comments: 0 });
  });

  it('sub-tarefa desmarcada sai junto com o comentário dela', () => {
    const d = draftFromPreview(preview());
    d.subtasks[0].include = false;
    expect(buildSteps(d).map(s => s.kind)).toEqual(['RENAME_PARENT', 'CREATE_SUBTASK']);
  });

  it('resumo do rodapé no singular e no plural', () => {
    expect(countsLabel({ rename: 1, subtasks: 3, comments: 2 })).toBe('1 renomeação · 3 sub-tarefas · 2 comentários');
    expect(countsLabel({ rename: 0, subtasks: 1, comments: 1 })).toBe('1 sub-tarefa · 1 comentário');
  });

  it('não deixa enviar título vazio nem envio sem nada', () => {
    const d = draftFromPreview(preview());
    d.subtasks[1].create.summary = '  ';
    expect(validateDraft(d)).toMatch(/Título vazio/);
    const empty = draftFromPreview(preview());
    empty.renameEnabled = false;
    empty.subtasks.forEach(s => { s.include = false; });
    expect(validateDraft(empty)).toBe('Nada selecionado para enviar.');
  });

  it('aponta a sub-tarefa do QA sem cenários como ponto de atenção', () => {
    const att = draftAttention(draftFromPreview(preview({ warnings: ['Aviso do servidor'] })));
    expect(att[0]).toBe('Aviso do servidor');
    expect(att.some(w => w.includes('QA não escreveu'))).toBe(true);
  });
});
