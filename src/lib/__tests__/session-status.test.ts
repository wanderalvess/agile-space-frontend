import { describe, expect, it } from 'vitest';
import { deriveSessionStatus, normalizeTool, sessionStatusChip, sessionStatusLabel } from '../session-status';

const NOW = new Date('2026-10-15T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

describe('sessionStatusChip', () => {
  it('mapeia cada status para o rótulo e o tom do chip', () => {
    expect(sessionStatusChip('LIVE')).toEqual({ label: 'Ao vivo', tone: 'live' });
    expect(sessionStatusChip('ASYNC_OPEN')).toEqual({ label: 'Assíncrona', tone: 'neutral' });
    expect(sessionStatusChip('PLANNING')).toEqual({ label: 'Planejando', tone: 'neutral' });
    expect(sessionStatusChip('FINISHED')).toEqual({ label: 'Concluída', tone: 'done' });
  });

  it('status ausente ou desconhecido nunca vira "Ao vivo"', () => {
    expect(sessionStatusLabel(undefined)).toBe('Concluída');
    expect(sessionStatusLabel('completed' as never)).toBe('Concluída');
  });
});

describe('normalizeTool', () => {
  it('aceita os nomes das listagens cruas e do contrato', () => {
    expect(normalizeTool('poker')).toBe('POKER');
    expect(normalizeTool('health')).toBe('HEALTH_CHECK');
    expect(normalizeTool('health-check')).toBe('HEALTH_CHECK');
    expect(normalizeTool('BRAINSTORMING')).toBe('BRAINSTORMING');
    expect(normalizeTool('jira')).toBeNull();
  });
});

describe('deriveSessionStatus', () => {
  it('poker encerrado é Concluída, mesmo que tenha começado', () => {
    const room = { sessionStartedAt: hoursAgo(2), sessionEndedAt: hoursAgo(1), createdAt: hoursAgo(3) };
    expect(deriveSessionStatus('poker', room, NOW)).toBe('FINISHED');
    expect(sessionStatusLabel(deriveSessionStatus('poker', room, NOW))).not.toBe('Ao vivo');
  });

  it('poker: assíncrono → Assíncrona; iniciado → Ao vivo; não iniciado → Planejando', () => {
    expect(deriveSessionStatus('poker', { mode: 'async', createdAt: hoursAgo(50) }, NOW)).toBe('ASYNC_OPEN');
    expect(deriveSessionStatus('poker', { sessionStartedAt: hoursAgo(1) }, NOW)).toBe('LIVE');
    expect(deriveSessionStatus('poker', { createdAt: hoursAgo(1) }, NOW)).toBe('PLANNING');
  });

  it('poker iniciado e abandonado há mais de 12 h é Concluída', () => {
    expect(deriveSessionStatus('poker', { sessionStartedAt: hoursAgo(13) }, NOW)).toBe('FINISHED');
  });

  it('retro com votação encerrada ou antiga não aparece "Ao vivo"', () => {
    expect(deriveSessionStatus('retro', { votingStatus: 'finished', createdAt: hoursAgo(1) }, NOW)).toBe('FINISHED');
    expect(deriveSessionStatus('retro', { votingStatus: 'disabled', createdAt: hoursAgo(48) }, NOW)).toBe('FINISHED');
    expect(deriveSessionStatus('retro', { votingStatus: 'active', createdAt: hoursAgo(1) }, NOW)).toBe('LIVE');
    expect(deriveSessionStatus('retro', {}, NOW)).toBe('FINISHED');
  });

  it('health check: coletando → Assíncrona; finished → Concluída', () => {
    expect(deriveSessionStatus('health', { status: 'collecting', createdAt: hoursAgo(100) }, NOW)).toBe('ASYNC_OPEN');
    expect(deriveSessionStatus('health', { status: 'finished', createdAt: hoursAgo(1) }, NOW)).toBe('FINISHED');
    expect(sessionStatusLabel(deriveSessionStatus('health', { status: 'finished' }, NOW))).toBe('Concluída');
  });

  it('showcase segue o status da sessão', () => {
    expect(deriveSessionStatus('showcase', { status: 'planning' }, NOW)).toBe('PLANNING');
    expect(deriveSessionStatus('showcase', { status: 'active', updatedAt: hoursAgo(1) }, NOW)).toBe('LIVE');
    expect(deriveSessionStatus('showcase', { status: 'finished' }, NOW)).toBe('FINISHED');
  });

  it('brainstorming na fase final é Concluída', () => {
    expect(deriveSessionStatus('brainstorming', { phase: 'actions', createdAt: hoursAgo(1) }, NOW)).toBe('FINISHED');
    expect(deriveSessionStatus('brainstorming', { phase: 'ideation', createdAt: hoursAgo(1) }, NOW)).toBe('LIVE');
  });

  it('o "completed" que nenhum backend devolve não vira mais "Ao vivo"', () => {
    expect(deriveSessionStatus('poker', { status: 'completed', sessionEndedAt: hoursAgo(5) }, NOW)).toBe('FINISHED');
    expect(deriveSessionStatus('desconhecida', { status: 'active' }, NOW)).toBe('FINISHED');
  });
});
