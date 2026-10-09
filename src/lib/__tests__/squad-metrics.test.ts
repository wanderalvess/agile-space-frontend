import { describe, it, expect } from 'vitest';
import {
  percentOf, parseCalendarDate, formatShortDate, daysUntil, normalizeName, isAssignedTo,
  isDoneIssue, isInProgressIssue, isBugIssue, issuesOfSprint, countWorkdays, sprintTimeProgress,
  dailyDeltas, workTypeBreakdown,
} from '../squad-metrics';

describe('percentOf', () => {
  it('não divide por zero: sem total devolve null (o painel diz "sem dados")', () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(3, 0)).toBeNull();
    expect(percentOf(3, undefined)).toBeNull();
    expect(percentOf(NaN, 10)).toBeNull();
  });
  it('arredonda e limita a 0–100', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 10)).toBe(0);
    expect(percentOf(12, 10)).toBe(100);
  });
});

describe('datas de calendário', () => {
  it('YYYY-MM-DD vale o dia escrito, sem escorregar para o dia anterior no fuso do Brasil', () => {
    const d = parseCalendarDate('2026-10-09')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 9]);
    expect(formatShortDate('2026-10-09')).toBe('09/10');
  });
  it('data inválida ou vazia vira vazio, não "Invalid Date"', () => {
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate('lixo')).toBeNull();
    expect(formatShortDate(undefined)).toBe('');
  });
  it('daysUntil: vencido é negativo, hoje é zero', () => {
    const now = new Date(2026, 9, 9, 15, 0);
    expect(daysUntil('2026-10-09', now)).toBe(0);
    expect(daysUntil('2026-10-08', now)).toBe(-1);
    expect(daysUntil('2026-10-12', now)).toBe(3);
    expect(daysUntil('', now)).toBeNull();
  });
});

describe('isAssignedTo (id ou nome completo, nunca "contém")', () => {
  it('"Ana" não pega as tarefas de "Mariana"', () => {
    expect(isAssignedTo({ assigneeName: 'Mariana Souza' }, { displayName: 'Ana' })).toBe(false);
  });
  it('casa por id do Jira', () => {
    expect(isAssignedTo({ assigneeId: 'acc-1', assigneeName: 'Outro Nome' }, { jiraAccountId: 'acc-1', displayName: 'Ana Lima' })).toBe(true);
  });
  it('casa por nome completo ignorando caixa, acento e espaços repetidos', () => {
    expect(isAssignedTo({ assigneeName: 'JOSÉ  da Silva' }, { displayName: 'jose da silva' })).toBe(true);
    expect(normalizeName('  Ação  Ágil ')).toBe('acao agil');
  });
  it('sem id nem nome não casa com ninguém', () => {
    expect(isAssignedTo({ assigneeId: '', assigneeName: '' }, { jiraAccountId: '', displayName: '' })).toBe(false);
  });
});

describe('status por categoria do Jira', () => {
  it('usa statusCategory quando existe e cai no texto do status quando não', () => {
    expect(isDoneIssue({ statusCategory: 'done', status: 'Qualquer coisa' })).toBe(true);
    expect(isDoneIssue({ statusCategory: 'indeterminate', status: 'Done' })).toBe(false);
    expect(isDoneIssue({ status: 'Concluído' })).toBe(true);
    expect(isInProgressIssue({ statusCategory: 'indeterminate' })).toBe(true);
    expect(isInProgressIssue({ status: 'Em andamento' })).toBe(true);
    expect(isInProgressIssue({ status: 'Done' })).toBe(false);
  });
  it('bug por flag ou por nome do tipo (Bug, Defeito, Erro)', () => {
    expect(isBugIssue({ isBug: true })).toBe(true);
    expect(isBugIssue({ type: 'Defeito' })).toBe(true);
    expect(isBugIssue({ type: 'Debugging story' })).toBe(false);
  });
});

describe('issuesOfSprint', () => {
  const issues = [{ sprintId: '7' }, { sprintId: '8' }, { sprintId: 'UNMAPPED' }, {}];
  it('filtra pela sprint pedida', () => {
    expect(issuesOfSprint(issues, '7')).toEqual([{ sprintId: '7' }]);
  });
  it('sem sprint devolve tudo', () => {
    expect(issuesOfSprint(issues, '')).toHaveLength(4);
  });
});

describe('tempo da sprint', () => {
  it('conta só dias úteis (seg–sex)', () => {
    // 2026-10-05 (segunda) a 2026-10-18 (domingo) = 10 úteis
    expect(countWorkdays(new Date(2026, 9, 5), new Date(2026, 9, 18))).toBe(10);
  });
  it('meio da sprint: faltam os dias úteis de hoje até o fim e a porcentagem acompanha', () => {
    const p = sprintTimeProgress('2026-10-05', '2026-10-16', new Date(2026, 9, 12, 9, 0));
    expect(p).toEqual({ total: 10, remaining: 5, pct: 50 });
  });
  it('antes de começar: nada passou; depois do fim: faltam 0 e 100%', () => {
    expect(sprintTimeProgress('2026-10-05', '2026-10-16', new Date(2026, 9, 1))).toEqual({ total: 10, remaining: 10, pct: 0 });
    expect(sprintTimeProgress('2026-10-05', '2026-10-16', new Date(2026, 9, 30))).toEqual({ total: 10, remaining: 0, pct: 100 });
  });
  it('sem datas válidas não inventa progresso', () => {
    expect(sprintTimeProgress(undefined, '2026-10-16')).toBeNull();
    expect(sprintTimeProgress('2026-10-16', '2026-10-05')).toBeNull();
  });
  it('datas com hora e fuso (como o Jira manda) também funcionam', () => {
    expect(sprintTimeProgress('2026-10-05T10:00:00.000Z', '2026-10-16T10:00:00.000Z', new Date(2026, 9, 12))?.total).toBe(10);
  });
});

describe('dailyDeltas', () => {
  it('o do dia é a diferença para o snapshot anterior; o primeiro dia não tem valor', () => {
    const d = dailyDeltas([
      { snapshotDate: '2026-10-06', loggedSec: 7200, doneIssues: 1 },
      { snapshotDate: '2026-10-05', loggedSec: 3600, doneIssues: 0 },
      { snapshotDate: '2026-10-07', loggedSec: 7200, doneIssues: 4 },
    ]);
    expect(d.has('2026-10-05')).toBe(false);
    expect(d.get('2026-10-06')).toEqual({ loggedHours: 1, done: 1 });
    expect(d.get('2026-10-07')).toEqual({ loggedHours: 0, done: 3 });
  });
  it('virada de sprint (acumulado zera) não vira horas negativas', () => {
    const d = dailyDeltas([
      { snapshotDate: '2026-10-06', loggedSec: 90000, doneIssues: 9 },
      { snapshotDate: '2026-10-07', loggedSec: 0, doneIssues: 0 },
    ]);
    expect(d.get('2026-10-07')).toEqual({ loggedHours: 0, done: 0 });
  });
});

describe('workTypeBreakdown', () => {
  it('conta por tipo real e omite o que não existe', () => {
    const r = workTypeBreakdown([
      { type: 'Story' }, { type: 'Story' }, { type: 'Sub-task', parentKey: 'A-1' }, { type: 'Bug', isBug: true },
    ]);
    expect(r).toEqual([
      { name: 'Histórias e demais', count: 2 },
      { name: 'Subtarefas', count: 1 },
      { name: 'Bugs', count: 1 },
    ]);
    expect(workTypeBreakdown([])).toEqual([]);
  });
});
