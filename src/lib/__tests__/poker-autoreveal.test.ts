import { describe, it, expect } from 'vitest';
import { DEFAULT_ROOM_SETTINGS, buildDefaultSettingsPatch, shouldAutoReveal } from '../poker-utils';
import type { Participant } from '../types';

const dev = (id: string): Participant => ({ id, nickname: id, role: 'dev', globalRole: 'Developer' } as unknown as Participant);
const spectator = (id: string): Participant => ({ id, nickname: id, role: 'spectator' } as unknown as Participant);

const base = {
  isFacilitator: true,
  votesRevealed: false,
  activeIssueId: 'i1',
  participants: [dev('a'), dev('b')],
  onlineIds: new Set(['a', 'b']),
  votes: [{ participantId: 'a', issueId: 'i1' }, { participantId: 'b', issueId: 'i1' }],
};

describe('revelação: só por clique, a menos que "Revelar automaticamente" esteja ligado', () => {
  it('sala nova nasce com autoReveal desligado, explícito nos padrões', () => {
    expect(DEFAULT_ROOM_SETTINGS.autoReveal).toBe(false);
    expect(buildDefaultSettingsPatch().autoReveal).toBe(false);
  });

  it('todos votaram mas a opção está ausente, false ou ruim: NÃO revela', () => {
    expect(shouldAutoReveal({ ...base, settings: undefined })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: {} })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: { ...DEFAULT_ROOM_SETTINGS } })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: false } })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: 'false' as unknown as boolean } })).toBe(false);
  });

  it('com a opção ligada, revela quando todos os votantes online votaram', () => {
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true } })).toBe(true);
  });

  it('com a opção ligada, falta alguém votar: espera', () => {
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true }, votes: [{ participantId: 'a', issueId: 'i1' }] })).toBe(false);
  });

  it('só o facilitador dispara, e só uma vez por rodada', () => {
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true }, isFacilitator: false })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true }, votesRevealed: true })).toBe(false);
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true }, activeIssueId: null })).toBe(false);
  });

  it('quem está offline ou espectador não trava; voto de outra tarefa não conta', () => {
    expect(shouldAutoReveal({
      ...base,
      settings: { autoReveal: true },
      participants: [dev('a'), dev('b'), spectator('s')],
      onlineIds: new Set(['a']),
      votes: [{ participantId: 'a', issueId: 'i1' }],
    })).toBe(true);
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true }, votes: [{ participantId: 'a', issueId: 'i0' }, { participantId: 'b', issueId: 'i0' }] })).toBe(false);
  });
});
