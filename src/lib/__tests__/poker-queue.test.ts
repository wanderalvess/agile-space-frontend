import { describe, it, expect } from 'vitest';
import type { Issue } from '../types';
import {
  queueStatus, queueStats, matchesQueueFilter, filterQueue, taskNumber, nextQueueSort, findQueueDuplicate,
  detectBulkType, parseBulkLine, parseBulkText, parseBulkCsv, decorateBulkPreview, jiraIssueToQueueItem, importSummary,
} from '../poker-queue';

const mk = (p: Partial<Issue>): Issue => ({ id: 'x', title: 'T', status: 'pending', estimatedPoints: null, ...p } as Issue);

const queue: Issue[] = [
  mk({ id: 'a', key: 'PTV-12', title: 'PTV-12 Ajustar desconto' }),
  mk({ id: 'b', key: 'PTV-3', title: 'PTV-3 Corrigir NFC-e', parked: true }),
  mk({ id: 'c', title: 'Prototipar tela', status: 'completed', estimatedPoints: '5' }),
  mk({ id: 'd', key: 'PTV-40', title: 'PTV-40 Relatório', status: 'completed', skipped: true }),
  mk({ id: 'e', key: 'PTV-41', title: 'PTV-41 Comissões', status: 'completed', cancelled: true }),
  mk({ id: 'f', key: 'PTV-7', title: 'PTV-7 Em votação' }),
];

describe('queueStatus', () => {
  it('classifica cada situação', () => {
    expect(queueStatus(queue[0], 'f')).toBe('pending');
    expect(queueStatus(queue[1], 'f')).toBe('parked');
    expect(queueStatus(queue[2], 'f')).toBe('estimated');
    expect(queueStatus(queue[3], 'f')).toBe('skipped');
    expect(queueStatus(queue[4], 'f')).toBe('cancelled');
    expect(queueStatus(queue[5], 'f')).toBe('voting');
  });
  it('tarefa concluída nunca aparece como votando, mesmo se ainda for a ativa', () => {
    expect(queueStatus(queue[2], 'c')).toBe('estimated');
  });
});

describe('queueStats', () => {
  it('conta por situação e o progresso ignora o que ficou de fora', () => {
    const s = queueStats(queue, 'f');
    expect(s).toMatchObject({ total: 6, pending: 3, estimated: 1, out: 2, skipped: 1, cancelled: 1, parked: 1, voting: 1 });
    expect(s.progress).toBe(25); // 1 estimada de 4 que contam
  });
  it('fila vazia ou só descartada: progresso 0, sem divisão por zero', () => {
    expect(queueStats([], null).progress).toBe(0);
    expect(queueStats([queue[4]], null).progress).toBe(0);
  });
});

describe('filtro e ordem', () => {
  it('filtro por situação', () => {
    expect(matchesQueueFilter('parked', 'pending')).toBe(true);
    expect(matchesQueueFilter('estimated', 'pending')).toBe(false);
    expect(matchesQueueFilter('cancelled', 'out')).toBe(true);
    expect(matchesQueueFilter('voting', 'all')).toBe(true);
  });
  it('busca por título ou chave, sem diferenciar maiúsculas', () => {
    const ids = (q: string) => filterQueue(queue, { query: q, filter: 'all', sort: 'none' }, 'f').map((i) => i.id);
    expect(ids('ptv-3')).toEqual(['b']);
    expect(ids('prototipar')).toEqual(['c']);
    expect(ids('  ')).toHaveLength(6);
  });
  it('ordena pelo número e deixa quem não tem número no fim', () => {
    const asc = filterQueue(queue, { query: '', filter: 'all', sort: 'num-asc' }, 'f').map((i) => i.id);
    expect(asc).toEqual(['b', 'f', 'a', 'd', 'e', 'c']);
    const desc = filterQueue(queue, { query: '', filter: 'all', sort: 'num-desc' }, 'f').map((i) => i.id);
    expect(desc).toEqual(['e', 'd', 'a', 'f', 'b', 'c']);
  });
  it('taskNumber cai para o título e a ordenação cicla', () => {
    expect(taskNumber({ key: null, title: 'Sprint 52 revisão' })).toBe(52);
    expect(taskNumber({ key: null, title: 'sem número' })).toBeNull();
    expect(nextQueueSort('none')).toBe('num-asc');
    expect(nextQueueSort('num-asc')).toBe('num-desc');
    expect(nextQueueSort('num-desc')).toBe('none');
  });
});

describe('findQueueDuplicate', () => {
  it('chave válida compara pela chave; texto livre, pelo título', () => {
    expect(findQueueDuplicate(queue, 'PTV-12')?.id).toBe('a');
    expect(findQueueDuplicate(queue, 'prototipar TELA')?.id).toBe('c');
    expect(findQueueDuplicate(queue, 'PTV-999')).toBeUndefined();
    expect(findQueueDuplicate(queue, '')).toBeUndefined();
  });
});

describe('importação em lote', () => {
  it('lê CHAVE | Título | Link, só título e só chave', () => {
    expect(parseBulkLine('EX-101 | Ajustar botões | https://j/101')).toEqual({ key: 'EX-101', title: 'Ajustar botões', link: 'https://j/101' });
    expect(parseBulkLine('EX-102 | Refatorar API')).toEqual({ key: 'EX-102', title: 'Refatorar API', link: '' });
    expect(parseBulkLine('Apenas um título')).toEqual({ key: '', title: 'Apenas um título', link: '' });
    expect(parseBulkLine('EX-103')).toEqual({ key: 'EX-103', title: 'EX-103', link: '' });
    expect(parseBulkLine('xx | Chave inválida')).toEqual({ key: '', title: 'Chave inválida', link: '' });
  });
  it('ignora linhas em branco', () => {
    expect(parseBulkText('A-1 | Um\n\n   \nDois')).toHaveLength(2);
  });
  it('CSV com ; ou , e aspas', () => {
    expect(parseBulkCsv('A-1;"Primeira";http://x\r\nB-2,Segunda')).toEqual([
      { key: 'A-1', title: 'Primeira', link: 'http://x' },
      { key: 'B-2', title: 'Segunda', link: '' },
    ]);
    expect(parseBulkCsv('só título')[0].title).toBe('só título');
  });
  it('detecta o tipo pelas palavras do título', () => {
    expect(detectBulkType('Corrigir bug no PDV')).toBe('qa');
    expect(detectBulkType('Protótipo no Figma')).toBe('design');
    expect(detectBulkType('Spike de infra')).toBe('other');
    expect(detectBulkType('Criar endpoint')).toBe('dev');
  });
  it('marca duplicata contra a fila e dentro do lote', () => {
    const items = decorateBulkPreview(
      [
        { key: 'PTV-12', title: 'PTV-12 Ajustar desconto', link: '' },
        { key: 'NEW-1', title: 'Nova tarefa', link: '' },
        { key: 'NEW-1', title: 'Nova tarefa de novo', link: '' },
        { key: '', title: 'prototipar tela', link: '' },
      ],
      queue
    );
    expect(items.map((i) => i.duplicate)).toEqual([true, false, true, true]);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
  });
});

describe('jiraIssueToQueueItem', () => {
  const base = { key: 'PTV-1', title: 'Resumo', url: 'https://j/PTV-1' };
  it('prefixa a chave no título quando ela não aparece nele', () => {
    expect(jiraIssueToQueueItem(base).title).toBe('PTV-1 - Resumo');
    expect(jiraIssueToQueueItem({ ...base, title: 'PTV-1 Resumo' }).title).toBe('PTV-1 Resumo');
    expect(jiraIssueToQueueItem({ ...base, title: '' }).title).toBe('PTV-1');
  });
  it('carrega os campos do Jira e mapeia o tipo', () => {
    const item = jiraIssueToQueueItem({ ...base, type: 'Bug', status: 'Aberto', points: 5, labels: ['a'], acceptanceCriteria: 'ok' });
    expect(item).toMatchObject({ key: 'PTV-1', jiraLink: 'https://j/PTV-1', jiraType: 'Bug', jiraStatus: 'Aberto', jiraPoints: '5', jiraLabels: ['a'], acceptanceCriteria: 'ok', type: 'qa' });
    expect(jiraIssueToQueueItem({ ...base, points: 0 }).jiraPoints).toBe('');
  });
  it('importSummary conta só o que entrou', () => {
    expect(importSummary(3, 2, { one: 'tarefa', many: 'tarefas' })).toEqual({ count: 2, skipped: 1, noun: 'tarefas' });
    expect(importSummary(1, undefined, { one: 'tarefa', many: 'tarefas' })).toEqual({ count: 1, skipped: 0, noun: 'tarefa' });
  });
});
