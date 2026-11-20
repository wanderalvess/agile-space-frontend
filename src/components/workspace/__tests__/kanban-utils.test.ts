import { describe, expect, it } from 'vitest';
import {
  completionRate,
  countByStatus,
  describeDue,
  dueDateToServer,
  filterKanbanCards,
  formatDueFull,
  isUrgent,
  parseDueDate,
} from '../kanban-utils';
import type { KanbanCardData } from '../types';

const card = (over: Partial<KanbanCardData>): KanbanCardData => ({
  id: over.id ?? 'c',
  title: 't',
  status: 'todo',
  priority: 'media',
  tag: 'Manual',
  updatedAt: '2026-10-10T10:00:00Z',
  ...over,
});

const cards = [
  card({ id: 'a', priority: 'baixa' }),
  card({ id: 'b', priority: 'alta', dueDate: '2026-10-17T00:00:00' }),
  card({ id: 'c', priority: 'critica', originLink: '/room/1', status: 'doing' }),
  card({ id: 'd', priority: 'media', dueDate: '2026-10-20T00:00:00', originLink: '/retro/2', status: 'done' }),
];

describe('filtros do Kanban', () => {
  it('Todas devolve tudo', () => {
    expect(filterKanbanCards(cards, 'todas')).toHaveLength(4);
  });
  it('Urgentes = urgência Alta ou Crítica', () => {
    expect(filterKanbanCards(cards, 'urgentes').map((c) => c.id)).toEqual(['b', 'c']);
    expect(isUrgent(cards[0])).toBe(false);
  });
  it('Com prazo = tem data de prazo', () => {
    expect(filterKanbanCards(cards, 'com-prazo').map((c) => c.id)).toEqual(['b', 'd']);
  });
  it('De sessões = veio de uma cerimônia', () => {
    expect(filterKanbanCards(cards, 'de-sessoes').map((c) => c.id)).toEqual(['c', 'd']);
  });
});

describe('prazo', () => {
  it('lê a data do servidor sem mexer em fuso', () => {
    expect(parseDueDate('2026-10-17T00:00:00')).toBe('2026-10-17');
    expect(parseDueDate('2026-10-17')).toBe('2026-10-17');
    expect(parseDueDate('2026-10-17T23:59:59Z')).toBe('2026-10-17');
    expect(parseDueDate('')).toBeNull();
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate('2026-13-45')).toBeNull();
    expect(parseDueDate('amanhã')).toBeNull();
  });
  it('envia a data à meia-noite, sem fuso', () => {
    expect(dueDateToServer('2026-10-17')).toBe('2026-10-17T00:00:00');
  });
  it('formata por extenso', () => {
    expect(formatDueFull('2026-10-17T00:00:00')).toBe('17/10/2026');
    expect(formatDueFull(null)).toBe('');
  });
  const now = new Date(2026, 9, 16, 14, 0, 0); // 16/10/2026
  it('descreve atrasada, hoje, amanhã e data curta', () => {
    expect(describeDue('2026-10-15', { now })).toEqual({ label: 'atrasada', tone: 'overdue' });
    expect(describeDue('2026-10-16T00:00:00', { now })).toEqual({ label: 'hoje', tone: 'soon' });
    expect(describeDue('2026-10-17', { now })).toEqual({ label: 'amanhã', tone: 'soon' });
    expect(describeDue('2026-10-18', { now })).toEqual({ label: '18/10', tone: 'normal' });
    expect(describeDue(null, { now })).toBeNull();
  });
  it('tarefa concluída nunca fica atrasada', () => {
    expect(describeDue('2026-10-01', { now, done: true })).toEqual({ label: '01/10', tone: 'normal' });
  });
});

describe('números do Início', () => {
  it('% do Kanban concluído e contagem por status', () => {
    expect(completionRate([])).toBe(0);
    expect(completionRate(cards)).toBe(25);
    expect(countByStatus(cards)).toEqual({ todo: 2, doing: 1, done: 1 });
  });
});
