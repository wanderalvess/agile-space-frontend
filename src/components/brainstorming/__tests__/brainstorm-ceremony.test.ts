import { describe, expect, it } from 'vitest';
import type { BrainstormingBoard, Participant } from '../../../lib/types';
import {
  DEFAULT_VOTE_LIMIT,
  FACILITATOR_OFFLINE_SECONDS,
  boardVoteLimit,
  canEditIdeaText,
  canFinishOrReopen,
  canTransferFacilitation,
  canVoteOn,
  claimState,
  editedBadge,
  effectiveFacilitatorId,
  facilitatorDisplayName,
  isBoardFinished,
  isEndpointUnavailable,
  isFacilitatorOf,
  participantName,
  quotaLabel,
  readVoteLimit,
  supportsCeremonyApi,
  transferCandidates,
  voteQuota,
  votesUsedBy,
} from '../brainstorm-ceremony';
import { authorInfo, isStageNavLocked, participantNames } from '../brainstorm-room-logic';

const board = (over: Partial<BrainstormingBoard> = {}): BrainstormingBoard => ({
  id: 'b1', creatorId: 'ana', title: 'Deploy', team: 'PHX', createdAt: '2026-10-17T10:00:00Z', phase: 'ideation', settings: { isAnonymous: false }, ...over,
});
const people: Participant[] = [
  { id: 'ana', roomId: 'b1', nickname: 'Ana Souza', isFacilitator: true, role: 'dev' } as Participant,
  { id: 'bia', roomId: 'b1', nickname: 'bia', displayName: 'Bia Lima', isFacilitator: false, role: 'dev' } as Participant,
  { id: 'caio', roomId: 'b1', nickname: 'Caio Reis', isFacilitator: false, role: 'qa' } as Participant,
];

describe('facilitador efetivo', () => {
  it('usa facilitatorId e cai no criador no mural/servidor antigo', () => {
    expect(effectiveFacilitatorId(board({ facilitatorId: 'bia' }))).toBe('bia');
    expect(effectiveFacilitatorId(board())).toBe('ana');
    expect(effectiveFacilitatorId(null)).toBeUndefined();
  });

  it('"sou facilitador" compara com o facilitador efetivo, não com o criador', () => {
    const passed = board({ facilitatorId: 'bia' });
    expect(isFacilitatorOf(passed, 'bia')).toBe(true);
    expect(isFacilitatorOf(passed, 'ana')).toBe(false);
    expect(isFacilitatorOf(board(), 'ana')).toBe(true);
    expect(isFacilitatorOf(board(), undefined)).toBe(false);
  });

  it('o nome vem de displayName, depois do apelido, depois de facilitatorName', () => {
    expect(participantName(people[1])).toBe('Bia Lima');
    expect(participantName(people[0])).toBe('Ana Souza');
    expect(participantName(undefined)).toBe('Participante');
    expect(facilitatorDisplayName(board({ facilitatorId: 'bia' }), people)).toBe('Bia Lima');
    expect(facilitatorDisplayName(board({ facilitatorId: 'adm', facilitatorName: 'Admin Tech' }), people)).toBe('Admin Tech');
    expect(facilitatorDisplayName(board({ facilitatorId: 'adm', facilitatorName: null }), people)).toBe('');
  });

  it('candidatos à facilitação: todos da sala menos quem facilita', () => {
    expect(transferCandidates(board({ facilitatorId: 'bia' }), people).map((p) => p.id)).toEqual(['ana', 'caio']);
  });
});

describe('status e suporte do servidor', () => {
  it('só FINISHED é encerrado; sem o campo está aberto', () => {
    expect(isBoardFinished(board({ status: 'FINISHED' }))).toBe(true);
    expect(isBoardFinished(board({ status: 'OPEN' }))).toBe(false);
    expect(isBoardFinished(board())).toBe(false);
  });

  it('reconhece o backend novo pelos campos status/facilitatorId', () => {
    expect(supportsCeremonyApi(board())).toBe(false);
    expect(supportsCeremonyApi(board({ status: 'OPEN' }))).toBe(true);
    expect(supportsCeremonyApi(board({ facilitatorId: 'ana' }))).toBe(true);
    expect(supportsCeremonyApi(null)).toBe(false);
  });

  it('quem encerra/reabre: facilitador, criador e ADMIN; passar: facilitador e ADMIN', () => {
    const b = board({ facilitatorId: 'bia' });
    expect(canFinishOrReopen({ board: b, userId: 'bia' })).toBe(true);
    expect(canFinishOrReopen({ board: b, userId: 'ana' })).toBe(true); // criador
    expect(canFinishOrReopen({ board: b, userId: 'caio' })).toBe(false);
    expect(canFinishOrReopen({ board: b, userId: 'caio', isAdmin: true })).toBe(true);
    expect(canTransferFacilitation({ board: b, userId: 'bia' })).toBe(true);
    expect(canTransferFacilitation({ board: b, userId: 'ana' })).toBe(false); // criador que já passou
    expect(canTransferFacilitation({ board: b, userId: 'caio', isAdmin: true })).toBe(true);
  });

  it('a navegação de etapas trava para todos quando o mural está encerrado', () => {
    expect(isStageNavLocked(true)).toBe(false);
    expect(isStageNavLocked(true, true)).toBe(true);
    expect(isStageNavLocked(false)).toBe(true);
  });
});

describe('assumir a facilitação', () => {
  const base = { board: board({ status: 'OPEN', facilitatorId: 'ana' }), userId: 'bia', isParticipant: true, offlineForMs: 0 };

  it('participante só vê com o facilitador offline, e habilita passado o tempo', () => {
    expect(claimState({ ...base, facilitatorOnline: true })).toEqual({ visible: false, enabled: false, waitSeconds: 0 });
    expect(claimState({ ...base, facilitatorOnline: undefined })).toMatchObject({ visible: false });
    const waiting = claimState({ ...base, facilitatorOnline: false, offlineForMs: 20_000 });
    expect(waiting).toEqual({ visible: true, enabled: false, waitSeconds: FACILITATOR_OFFLINE_SECONDS - 20 });
    expect(claimState({ ...base, facilitatorOnline: false, offlineForMs: FACILITATOR_OFFLINE_SECONDS * 1000 })).toEqual({ visible: true, enabled: true, waitSeconds: 0 });
  });

  it('criador e ADMIN assumem sempre, sem checar presença', () => {
    const passed = board({ status: 'OPEN', facilitatorId: 'bia' });
    expect(claimState({ board: passed, userId: 'ana', isParticipant: true, facilitatorOnline: true, offlineForMs: 0 })).toEqual({ visible: true, enabled: true, waitSeconds: 0 });
    expect(claimState({ board: passed, userId: 'zed', isAdmin: true, isParticipant: false, facilitatorOnline: true, offlineForMs: 0 }).enabled).toBe(true);
  });

  it('não aparece para quem já facilita, para quem não está na sala nem no backend antigo', () => {
    expect(claimState({ ...base, userId: 'ana', facilitatorOnline: false }).visible).toBe(false);
    expect(claimState({ ...base, isParticipant: false, facilitatorOnline: false }).visible).toBe(false);
    expect(claimState({ ...base, board: board(), facilitatorOnline: false }).visible).toBe(false);
  });
});

describe('limite de votos', () => {
  const ideas = [
    { votes: ['bia', 'caio'] },
    { votes: ['bia'] },
    { votes: [] },
    { votes: undefined as unknown as string[] },
  ];

  it('conta as ideias em que a pessoa votou', () => {
    expect(votesUsedBy(ideas, 'bia')).toBe(2);
    expect(votesUsedBy(ideas, 'caio')).toBe(1);
    expect(votesUsedBy(ideas, undefined)).toBe(0);
  });

  it('cota: usados, restantes e limite atingido; sem limite nunca bloqueia', () => {
    expect(voteQuota(3, ideas, 'bia')).toEqual({ limit: 3, used: 2, remaining: 1, reached: false });
    expect(voteQuota(2, ideas, 'bia')).toEqual({ limit: 2, used: 2, remaining: 0, reached: true });
    // reduzir o limite abaixo do usado: ninguém perde voto, só não vota de novo
    expect(voteQuota(1, ideas, 'bia')).toEqual({ limit: 1, used: 2, remaining: 0, reached: true });
    expect(voteQuota(null, ideas, 'bia')).toEqual({ limit: null, used: 2, remaining: null, reached: false });
    expect(voteQuota(undefined, ideas, 'bia').reached).toBe(false);
  });

  it('texto da cota, com singular', () => {
    expect(quotaLabel(voteQuota(3, ideas, 'bia'))).toBe('Você usou 2 de 3 votos');
    expect(quotaLabel(voteQuota(1, [{ votes: ['bia'] }], 'bia'))).toBe('Você usou 1 de 1 voto');
    expect(quotaLabel(voteQuota(null, ideas, 'bia'))).toBe('');
  });

  it('com a cota cheia só dá para tirar o voto; encerrado ninguém vota', () => {
    const full = voteQuota(2, ideas, 'bia');
    expect(canVoteOn({ quota: full, hasVoted: false })).toBe(false);
    expect(canVoteOn({ quota: full, hasVoted: true })).toBe(true);
    expect(canVoteOn({ quota: voteQuota(5, ideas, 'bia'), hasVoted: false })).toBe(true);
    expect(canVoteOn({ quota: voteQuota(5, ideas, 'bia'), hasVoted: true, readOnly: true })).toBe(false);
  });

  it('lê o limite do mural: 1 a 100 ou sem limite', () => {
    expect(boardVoteLimit(board({ votesPerParticipant: 5 }))).toBe(5);
    expect(boardVoteLimit(board({ votesPerParticipant: null }))).toBeNull();
    expect(boardVoteLimit(board())).toBeNull();
    expect(boardVoteLimit(board({ votesPerParticipant: 0 }))).toBeNull();
  });

  it('o campo "Votos por pessoa" só aceita inteiros de 1 a 100', () => {
    expect(readVoteLimit('3')).toEqual({ ok: true, value: 3 });
    expect(readVoteLimit(' 100 ')).toEqual({ ok: true, value: 100 });
    for (const bad of ['0', '101', '', 'abc', '2,5', '-1', '1000']) expect(readVoteLimit(bad)).toEqual({ ok: false });
    expect(DEFAULT_VOTE_LIMIT).toBeGreaterThanOrEqual(1);
  });
});

describe('quem edita o texto', () => {
  const idea = { authorId: 'caio' };
  const args = { idea, userId: 'bia', isFacilitator: false, isAdmin: false };

  it('sem restrição qualquer participante edita (como sempre)', () => {
    expect(canEditIdeaText({ ...args })).toBe(true);
  });

  it('com restrição: só autor, facilitador atual e ADMIN', () => {
    expect(canEditIdeaText({ ...args, restrictEdits: true })).toBe(false);
    expect(canEditIdeaText({ ...args, userId: 'caio', restrictEdits: true })).toBe(true);
    expect(canEditIdeaText({ ...args, isFacilitator: true, restrictEdits: true })).toBe(true);
    expect(canEditIdeaText({ ...args, isAdmin: true, restrictEdits: true })).toBe(true);
    expect(canEditIdeaText({ idea: { authorId: null }, userId: 'bia', isFacilitator: false, restrictEdits: true })).toBe(false);
  });

  it('mural encerrado: ninguém edita', () => {
    expect(canEditIdeaText({ ...args, userId: 'caio', isFacilitator: true, readOnly: true })).toBe(false);
  });
});

describe('autor e selo "editada"', () => {
  const names = participantNames(people);

  it('authorName vale antes da lista de participantes; anônimo e "Você" não mudam', () => {
    expect(authorInfo({ authorId: 'caio', authorName: 'Caio Reis' }, { currentUserId: 'bia', anonymous: false, names })).toEqual({ kind: 'person', label: 'Caio' });
    expect(authorInfo({ authorId: 'zed', authorName: 'Zed Alves' }, { currentUserId: 'bia', anonymous: false, names })).toEqual({ kind: 'person', label: 'Zed' });
    expect(authorInfo({ authorId: 'zed' }, { currentUserId: 'bia', anonymous: false, names })).toEqual({ kind: 'unknown', label: 'Participante' });
    expect(authorInfo({ authorId: null, authorName: undefined }, { currentUserId: 'bia', anonymous: true, names })).toEqual({ kind: 'anonymous', label: 'Anônimo' });
    expect(authorInfo({ authorId: 'bia', authorName: 'Bia' }, { currentUserId: 'bia', anonymous: false, names })).toEqual({ kind: 'you', label: 'Você' });
  });

  it('o mapa de nomes prefere displayName', () => {
    expect(names.get('bia')).toBe('Bia Lima');
    expect(names.get('ana')).toBe('Ana Souza');
  });

  it('selo: "editada" e "editada por Caio" quando o nome vier; nada sem editedAt', () => {
    expect(editedBadge({})).toBeNull();
    expect(editedBadge({ editedAt: null })).toBeNull();
    expect(editedBadge({ editedAt: '2026-10-17T13:20:00.123Z' })?.label).toBe('editada');
    const named = editedBadge({ editedAt: '2026-10-17T13:20:00.123Z', editedByName: 'Caio Reis' });
    expect(named?.label).toBe('editada por Caio');
    expect(named?.title).toMatch(/^Texto editado em \d{2}\/\d{2} às \d{2}:\d{2} por Caio Reis$/);
    expect(editedBadge({ editedAt: 'lixo' })?.title).toBe('Texto editado');
  });
});

describe('rotas novas em backend antigo', () => {
  const err = (status: number, message = '') => Object.assign(new Error(message), { status });

  it('404 e 405 = indisponível; 403 e 409 são mensagens do servidor', () => {
    for (const action of ['finish', 'reopen', 'claim'] as const) {
      expect(isEndpointUnavailable(action, err(404, 'No static resource'))).toBe(true);
      expect(isEndpointUnavailable(action, err(405))).toBe(true);
      expect(isEndpointUnavailable(action, err(403, 'Apenas o facilitador pode encerrar o brainstorming.'))).toBe(false);
      expect(isEndpointUnavailable(action, err(409, 'O facilitador está online.'))).toBe(false);
    }
    expect(isEndpointUnavailable('claim', new Error('rede'))).toBe(false);
  });

  it('passar: 404 "Essa pessoa não está nesta sala." é mensagem, não rota ausente', () => {
    expect(isEndpointUnavailable('transfer', err(404, 'Essa pessoa não está nesta sala.'))).toBe(false);
    expect(isEndpointUnavailable('transfer', err(404, 'No static resource api/x'))).toBe(true);
    expect(isEndpointUnavailable('transfer', err(405))).toBe(true);
  });
});
