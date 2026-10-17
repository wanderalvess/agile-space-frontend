import { describe, expect, it, vi } from 'vitest';
import {
  isRetroFinished,
  isRetroReadOnly,
  retroFinishedAt,
  supportsRetroLifecycle,
} from '../retro-lifecycle';
import {
  applyTyping,
  createTypingThrottle,
  nextTypingExpiry,
  pruneTyping,
  targetKey,
  typersAt,
  typingLabel,
  typingMessage,
  TYPING_DISPLAY_MS,
  TYPING_SEND_INTERVAL_MS,
} from '../retro-typing';
import { filterLobbyRows, isRetroInProgress, lobbyFiltersFor, mergeLobbyRows } from '../retro-lobby';
import type { RetroBoard } from '../types';

const board = (over: Partial<RetroBoard> = {}): RetroBoard => ({
  id: 'b1', creatorId: 'u1', isCardsRevealed: false, votingStatus: 'disabled', isAuthorsRevealed: false, createdAt: '2026-10-17T10:00:00', ...over,
});

describe('ciclo de vida da retro: lifecycleStatus com fallback', () => {
  it('backend antigo (sem o campo): nunca encerrada, nunca somente leitura, sem recursos novos', () => {
    expect(supportsRetroLifecycle(board())).toBe(false);
    expect(isRetroFinished(board())).toBe(false);
    expect(isRetroReadOnly(board(), false)).toBe(false);
    expect(supportsRetroLifecycle(null)).toBe(false);
  });

  it('backend novo: OPEN e FINISHED', () => {
    expect(supportsRetroLifecycle(board({ lifecycleStatus: 'OPEN' }))).toBe(true);
    expect(isRetroFinished(board({ lifecycleStatus: 'OPEN' }))).toBe(false);
    expect(isRetroFinished(board({ lifecycleStatus: 'FINISHED' }))).toBe(true);
  });

  it('encerrada é somente leitura para participante; facilitador e ADMIN continuam podendo tudo', () => {
    const closed = board({ lifecycleStatus: 'FINISHED' });
    expect(isRetroReadOnly(closed, false)).toBe(true);
    expect(isRetroReadOnly(closed, true)).toBe(false);
    expect(isRetroReadOnly(board({ lifecycleStatus: 'OPEN' }), false)).toBe(false);
  });

  it('retroFinishedAt: data real ou nulo (nada de inventar)', () => {
    expect(retroFinishedAt(board({ finishedAt: '2026-10-17T15:30:00' }))?.getFullYear()).toBe(2026);
    expect(retroFinishedAt(board({ finishedAt: null }))).toBeNull();
    expect(retroFinishedAt(board())).toBeNull();
    expect(retroFinishedAt(board({ finishedAt: 'lixo' }))).toBeNull();
  });
});

describe('lobby da retro: Ao vivo / Encerrada', () => {
  const now = Date.parse('2026-10-17T20:00:00');

  it('sem o campo: a heurística de 24 h de hoje (votação encerrada tira de "em andamento")', () => {
    expect(isRetroInProgress(board(), now)).toBe(true);
    expect(isRetroInProgress(board({ votingStatus: 'finished' }), now)).toBe(false);
    expect(isRetroInProgress(board({ createdAt: '2026-10-10T10:00:00' }), now)).toBe(false);
  });

  it('com o campo: encerrada pelo facilitador sai; aberta e recente fica, mesmo com a votação encerrada', () => {
    expect(isRetroInProgress(board({ lifecycleStatus: 'FINISHED' }), now)).toBe(false);
    expect(isRetroInProgress(board({ lifecycleStatus: 'OPEN' }), now)).toBe(true);
    expect(isRetroInProgress(board({ lifecycleStatus: 'OPEN', votingStatus: 'finished' }), now)).toBe(true);
  });

  it('retros antigas (todas "abertas" desde a migração) não viram "ao vivo" para sempre', () => {
    expect(isRetroInProgress(board({ lifecycleStatus: 'OPEN', createdAt: '2026-08-01T10:00:00' }), now)).toBe(false);
  });

  it('filtro "Encerradas": só aparece quando o backend informa e filtra por lifecycleStatus', () => {
    const rows = mergeLobbyRows([board({ id: 'a', lifecycleStatus: 'FINISHED' }), board({ id: 'b', lifecycleStatus: 'OPEN' })], []);
    expect(lobbyFiltersFor(rows).map((f) => f.id)).toContain('finished');
    expect(filterLobbyRows(rows, 'finished', new Map()).map((r) => r.id)).toEqual(['a']);
    const old = mergeLobbyRows([board({ id: 'c' })], []);
    expect(lobbyFiltersFor(old).map((f) => f.id)).not.toContain('finished');
  });
});

describe('TYPING: envio com limite de 2 s', () => {
  it('monta a mensagem sem userId (o servidor usa o do login)', () => {
    expect(typingMessage({ scope: 'card', columnKey: 'good' })).toEqual({ type: 'TYPING', scope: 'card', columnKey: 'good' });
    expect(typingMessage({ scope: 'chat', channelId: 'geral' })).toEqual({ type: 'TYPING', scope: 'chat', channelId: 'geral' });
    expect(JSON.stringify(typingMessage({ scope: 'chat', channelId: 'geral' }))).not.toContain('userId');
  });

  it('o primeiro toque envia na hora; o resto dentro de 2 s é descartado; depois volta a enviar', () => {
    let clock = 1000;
    const send = vi.fn(() => true);
    const throttle = createTypingThrottle(send, { now: () => clock });
    expect(throttle.notify({ scope: 'card', columnKey: 'a' })).toBe(true);
    clock += 500;
    expect(throttle.notify({ scope: 'card', columnKey: 'a' })).toBe(false);
    clock += TYPING_SEND_INTERVAL_MS - 501;
    expect(throttle.notify({ scope: 'card', columnKey: 'a' })).toBe(false);
    clock += 2;
    expect(throttle.notify({ scope: 'chat', channelId: 'geral' })).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sem conexão aberta o envio não conta: o próximo toque tenta de novo', () => {
    let clock = 0;
    const send = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const throttle = createTypingThrottle(send, { now: () => clock });
    expect(throttle.notify({ scope: 'card', columnKey: 'a' })).toBe(false);
    clock += 10;
    expect(throttle.notify({ scope: 'card', columnKey: 'a' })).toBe(true);
  });
});

describe('TYPING: recepção, validade de 5 s e anonimato', () => {
  const names = new Map([['u2', 'Beto'], ['u3', 'Ana'], ['u4', 'Carla']]);
  const nameOf = (id: string) => names.get(id);
  const event = (over: Record<string, unknown> = {}) => ({ userId: 'u2', anonymous: false, scope: 'card', columnKey: 'good', expiresInMs: 5000, ...over });

  it('registra e vence sozinho depois de 5 s', () => {
    const entries = applyTyping([], event(), 1000);
    expect(typersAt(entries, 'card', 'good', 2000, nameOf, { authorsRevealed: true }).names).toEqual(['Beto']);
    expect(nextTypingExpiry(entries)).toBe(1000 + TYPING_DISPLAY_MS);
    expect(pruneTyping(entries, 1000 + TYPING_DISPLAY_MS)).toEqual([]);
    expect(typersAt(entries, 'card', 'good', 1000 + TYPING_DISPLAY_MS, nameOf, { authorsRevealed: true })).toEqual({ names: [], anonymous: false });
  });

  it('o mesmo evento outra vez só renova a validade (sem repetir a pessoa)', () => {
    let entries = applyTyping([], event(), 1000);
    entries = applyTyping(entries, event(), 3000);
    expect(entries).toHaveLength(1);
    expect(entries[0].expiresAt).toBe(8000);
  });

  it('a validade nunca passa de 5 s, mesmo que o servidor mande mais', () => {
    expect(applyTyping([], event({ expiresInMs: 60000 }), 0)[0].expiresAt).toBe(5000);
    expect(applyTyping([], event({ expiresInMs: undefined }), 0)[0].expiresAt).toBe(5000);
  });

  it('autoria oculta (anonymous): "Alguém", sem nome', () => {
    const entries = applyTyping([], event({ userId: null, anonymous: true }), 0);
    const typers = typersAt(entries, 'card', 'good', 100, nameOf, { authorsRevealed: false });
    expect(typers).toEqual({ names: [], anonymous: true });
    expect(typingLabel(typers)).toBe('Alguém está escrevendo…');
  });

  it('mesmo se o evento trouxer o id, com os autores ocultos na tela o nome não aparece', () => {
    const entries = applyTyping([], event({ userId: 'u2', anonymous: false }), 0);
    expect(typingLabel(typersAt(entries, 'card', 'good', 100, nameOf, { authorsRevealed: false }))).toBe('Alguém está escrevendo…');
    expect(typingLabel(typersAt(entries, 'card', 'good', 100, nameOf, { authorsRevealed: true }))).toBe('Beto está escrevendo…');
  });

  it('chat sempre mostra o nome (não há anonimato no chat) e respeita o canal', () => {
    const entries = applyTyping([], { userId: 'u3', anonymous: false, scope: 'chat', channelId: 'geral' }, 0);
    expect(typingLabel(typersAt(entries, 'chat', 'geral', 1, nameOf))).toBe('Ana está escrevendo…');
    expect(typersAt(entries, 'chat', 'dm_a_b', 1, nameOf)).toEqual({ names: [], anonymous: false });
    expect(typersAt(entries, 'card', 'geral', 1, nameOf, { authorsRevealed: true })).toEqual({ names: [], anonymous: false });
  });

  it('escopo ausente vale "card"; escopo desconhecido, evento malformado e o próprio usuário são ignorados', () => {
    expect(applyTyping([], { userId: 'u2', columnKey: 'good' }, 0)[0].scope).toBe('card');
    expect(applyTyping([], event({ scope: 'dm' }), 0)).toEqual([]);
    expect(applyTyping([], null, 0)).toEqual([]);
    expect(applyTyping([], 'lixo', 0)).toEqual([]);
    expect(applyTyping([], { scope: 'chat', userId: 'u2' }, 0)).toEqual([]);
    expect(applyTyping([], event({ userId: 'me' }), 0, 'me')).toEqual([]);
  });

  it('frases: uma, duas, várias pessoas, ou ninguém', () => {
    expect(typingLabel({ names: ['Ana'], anonymous: false })).toBe('Ana está escrevendo…');
    expect(typingLabel({ names: ['Ana', 'Beto'], anonymous: false })).toBe('Ana e Beto estão escrevendo…');
    expect(typingLabel({ names: ['Ana', 'Beto', 'Carla', 'Dani'], anonymous: false })).toBe('Ana, Beto e mais 2 estão escrevendo…');
    expect(typingLabel({ names: [], anonymous: false })).toBeNull();
  });

  it('colunas e canais têm chaves distintas', () => {
    expect(targetKey('card', 'geral')).not.toBe(targetKey('chat', 'geral'));
  });
});
