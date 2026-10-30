import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VOTING_CARGOS,
  VOTING_CARGO_OPTIONS,
  canParticipantVote,
  getEligibleStatsVotes,
  isVotingCargo,
  observerHintOf,
  shouldAutoReveal,
  votingCargosOf,
} from '../poker-utils';
import { summarizeRound } from '../poker-results';
import { ROLES } from '../types';
import type { GlobalRole, Participant, Vote } from '../types';

const P = (id: string, role: Participant['role'], globalRole?: string): Participant =>
  ({ id, nickname: id, role, globalRole } as unknown as Participant);
const V = (participantId: string, value: string, extra: Partial<Vote> = {}): Vote =>
  ({ participantId, value, ...extra } as Vote);

describe('votingCargosOf: a política da sala', () => {
  it('sem configuração, só dev e QA votam', () => {
    expect(votingCargosOf(undefined)).toEqual(['Desenvolvedor(a)', 'Analista de QA']);
    expect(votingCargosOf({})).toEqual(DEFAULT_VOTING_CARGOS);
    expect(votingCargosOf({ allowManagementToVote: false })).toEqual(DEFAULT_VOTING_CARGOS);
  });

  it('sala nova usa a lista escolhida pelo facilitador', () => {
    expect(votingCargosOf({ votingCargos: ['Designer', 'Analista de QA'] })).toEqual(['Designer', 'Analista de QA']);
  });

  it('sala antiga com "Gestão pode votar" soma os cargos de gestão ao padrão', () => {
    const cargos = votingCargosOf({ allowManagementToVote: true });
    for (const c of DEFAULT_VOTING_CARGOS) expect(cargos).toContain(c);
    for (const c of ['Agile Master', 'Scrum Master', 'Product Owner', 'Tech Lead', 'People Lead', 'Tribe Lead']) expect(cargos).toContain(c);
    // Designer e UX nunca foram "gestão": continuam como eram (fora desta soma).
    expect(cargos).not.toContain('Designer');
  });

  it('votingCargos manda sobre o campo antigo', () => {
    expect(votingCargosOf({ votingCargos: ['Analista de QA'], allowManagementToVote: true })).toEqual(['Analista de QA']);
  });

  it('sala antiga com votingCargos nas grafias de antes continua valendo (cada cargo vira o canônico)', () => {
    const antiga = { votingCargos: ['Developer', 'QA'] };
    expect(votingCargosOf(antiga)).toEqual(['Desenvolvedor(a)', 'Analista de QA']);
    expect(canParticipantVote(P('a', 'dev', 'Developer'), votingCargosOf(antiga))).toBe(true);
    expect(canParticipantVote(P('b', 'qa', 'Analista de QA'), votingCargosOf(antiga))).toBe(true);
    expect(canParticipantVote(P('c', 'dev', 'Tech Lead'), votingCargosOf(antiga))).toBe(false);
  });

  it('as grafias repetidas da mesma sala viram um cargo só', () => {
    expect(votingCargosOf({ votingCargos: ['Developer', 'Desenvolvedor(a)', 'dev', 'Tech Lead'] })).toEqual(['Desenvolvedor(a)', 'Tech Lead']);
  });

  it('o padrão tem só dois cargos e as opções não repetem dev nem QA', () => {
    expect(DEFAULT_VOTING_CARGOS).toEqual(['Desenvolvedor(a)', 'Analista de QA']);
    expect(VOTING_CARGO_OPTIONS).not.toContain('Developer');
    expect(VOTING_CARGO_OPTIONS).not.toContain('QA');
    expect(new Set(VOTING_CARGO_OPTIONS).size).toBe(VOTING_CARGO_OPTIONS.length);
  });

  it('lista vazia não deixa a sala sem votantes: vale o padrão', () => {
    expect(votingCargosOf({ votingCargos: [] })).toEqual(DEFAULT_VOTING_CARGOS);
  });

  it('a lista de opções é a da administração (ROLES), sem o cargo que sempre entra como espectador', () => {
    expect(VOTING_CARGO_OPTIONS.every((o) => (ROLES as string[]).includes(o))).toBe(true);
    expect(VOTING_CARGO_OPTIONS).not.toContain('Stakeholder / Observador');
    expect(VOTING_CARGO_OPTIONS).toContain('Tech Lead');
    for (const c of DEFAULT_VOTING_CARGOS) expect(VOTING_CARGO_OPTIONS).toContain(c);
  });
});

describe('canParticipantVote: regra única', () => {
  it('no padrão, dev e QA votam', () => {
    expect(canParticipantVote(P('a', 'dev', 'Developer'))).toBe(true);
    expect(canParticipantVote(P('a', 'dev', 'Desenvolvedor(a)'))).toBe(true);
    expect(canParticipantVote(P('a', 'qa', 'QA'))).toBe(true);
    expect(canParticipantVote(P('a', 'qa', 'Analista de QA'))).toBe(true);
  });

  it('cargo fora da lista observa, qualquer que seja o role da sala', () => {
    expect(canParticipantVote(P('a', 'organizador', 'Tech Lead'))).toBe(false);
    expect(canParticipantVote(P('a', 'dev', 'Designer'))).toBe(false);
    // role 'dev' (vindo do mapeamento) não decide mais: o cargo é que manda.
    expect(canParticipantVote(P('a', 'dev', 'UX'))).toBe(false);
  });

  it('sem cargo observa, mesmo com role dev ou qa', () => {
    expect(canParticipantVote(P('a', 'dev'))).toBe(false);
    expect(canParticipantVote(P('a', 'qa', ''))).toBe(false);
    expect(canParticipantVote(P('a', 'dev', '   '))).toBe(false);
  });

  it('espectador marcado pelo facilitador nunca vota, mesmo com cargo na lista', () => {
    expect(canParticipantVote(P('a', 'spectator', 'Developer'))).toBe(false);
  });

  it('o facilitador pode mandar outro cargo votar', () => {
    const cargos = votingCargosOf({ votingCargos: [...DEFAULT_VOTING_CARGOS, 'Tech Lead'] });
    expect(canParticipantVote(P('a', 'organizador', 'Tech Lead'), cargos)).toBe(true);
    expect(canParticipantVote(P('a', 'organizador', 'Product Owner'), cargos)).toBe(false);
  });

  it('retirar um cargo da lista o torna observador', () => {
    expect(canParticipantVote(P('a', 'dev', 'Developer'), ['Analista de QA'])).toBe(false);
  });

  it('não diferencia maiúsculas e espaços nas pontas', () => {
    expect(isVotingCargo('  developer ', DEFAULT_VOTING_CARGOS)).toBe(true);
    expect(isVotingCargo('', DEFAULT_VOTING_CARGOS)).toBe(false);
    expect(isVotingCargo(undefined, DEFAULT_VOTING_CARGOS)).toBe(false);
  });

  it('compatibilidade: sala antiga com a opção antiga mantém o comportamento', () => {
    const antiga = votingCargosOf({ allowManagementToVote: true });
    expect(canParticipantVote(P('a', 'organizador', 'Scrum Master'), antiga)).toBe(true);
    expect(canParticipantVote(P('a', 'organizador', 'Product Owner'), antiga)).toBe(true);
    const semOpcao = votingCargosOf({});
    expect(canParticipantVote(P('a', 'organizador', 'Scrum Master'), semOpcao)).toBe(false);
  });

  it('explica por que observa', () => {
    expect(observerHintOf({ globalRole: 'Tech Lead' })).toBe('cargo não vota nesta sala');
    expect(observerHintOf({ globalRole: undefined })).toBe('sem cargo na administração');
  });
});

describe('estatísticas, denominador e revelação só com quem vota', () => {
  const people = [
    P('d1', 'dev', 'Developer'), P('d2', 'dev', 'Desenvolvedor(a)'),
    P('q1', 'qa', 'QA'), P('tl', 'organizador', 'Tech Lead'), P('nc', 'dev'), P('ux', 'dev', 'UX'),
  ];

  it('getEligibleStatsVotes descarta observador e quem está sem cargo', () => {
    const votes = [V('d1', '5'), V('q1', '3'), V('tl', '13'), V('nc', '21'), V('ux', '8')];
    expect(getEligibleStatsVotes(votes, people).map((v) => v.participantId)).toEqual(['d1', 'q1']);
    const comTl = getEligibleStatsVotes(votes, people, [...DEFAULT_VOTING_CARGOS, 'Tech Lead']);
    expect(comTl.map((v) => v.participantId)).toEqual(['d1', 'q1', 'tl']);
  });

  it('quem já saiu da sala vale pelo cargo congelado no voto ("votos são fatos")', () => {
    const votes = [
      V('gone-dev', '5', { participantRole: 'dev', participantGlobalRole: 'Developer' }),
      V('gone-tl', '13', { participantRole: 'organizador', participantGlobalRole: 'Tech Lead' }),
      V('gone-sem-papel', '2'),
    ];
    expect(getEligibleStatsVotes(votes, people).map((v) => v.participantId)).toEqual(['gone-dev']);
  });

  it('summarizeRound: consenso, média e extremos ignoram observadores', () => {
    const votes = [V('d1', '5'), V('d2', '5'), V('q1', '5'), V('tl', '40'), V('nc', '1')];
    const s = summarizeRound(votes, people, 'fibonacci');
    expect(s.consensus).toBe(true);
    expect(s.avg).toBe('5');
    expect(s.min).toBe('5');
    expect(s.max).toBe('5');
  });

  it('cargo não técnico mandado votar conta na média, como a antiga opção da gestão, sem bucket novo', () => {
    const votes = [V('d1', '5'), V('tl', '5')];
    const s = summarizeRound(votes, people, 'fibonacci', { votingCargos: [...DEFAULT_VOTING_CARGOS, 'Tech Lead'] });
    expect(s.consensus).toBe(true);
    expect(Object.keys(s.byRole)).toEqual(['Developer']);
  });

  it('shouldAutoReveal: observador e sem cargo não seguram a revelação', () => {
    const base = {
      settings: { autoReveal: true },
      isFacilitator: true,
      activeIssueId: 'i1',
      participants: people,
      onlineIds: new Set(people.map((p) => p.id)),
    };
    const votosDosVotantes = ['d1', 'd2', 'q1'].map((id) => ({ participantId: id, issueId: 'i1' }));
    expect(shouldAutoReveal({ ...base, votes: votosDosVotantes })).toBe(true);
    // Se o Tech Lead passa a votar, a rodada espera por ele.
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true, votingCargos: [...DEFAULT_VOTING_CARGOS, 'Tech Lead'] }, votes: votosDosVotantes })).toBe(false);
    // Sala antiga com a opção antiga: também espera pelos cargos de gestão.
    expect(shouldAutoReveal({ ...base, settings: { autoReveal: true, allowManagementToVote: true }, votes: votosDosVotantes })).toBe(false);
  });

  it('shouldAutoReveal: sala só com observadores nunca revela sozinha', () => {
    expect(shouldAutoReveal({
      settings: { autoReveal: true },
      isFacilitator: true,
      activeIssueId: 'i1',
      participants: [P('tl', 'organizador', 'Tech Lead'), P('nc', 'dev')],
      onlineIds: new Set(['tl', 'nc']),
      votes: [{ participantId: 'tl', issueId: 'i1' }],
    })).toBe(false);
  });

  it('todos os cargos oferecidos são aceitos como cargo de participante', () => {
    const all: GlobalRole[] = [...VOTING_CARGO_OPTIONS];
    expect(all.every((c) => canParticipantVote(P('x', 'dev', c), all))).toBe(true);
  });
});
