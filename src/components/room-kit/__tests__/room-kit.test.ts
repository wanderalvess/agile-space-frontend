import { describe, it, expect } from 'vitest';
import { formatTimer, remainingSeconds, timerFraction, timerPhase } from '../timer-utils';
import { POKER_PHASES, pokerPhase } from '../PhaseStepper';
import { groupPresence, initialsOf, avatarToneOf, type PresenceItem } from '../PresenceList';
import { reactionKindOf, REACTION_KINDS, shortSeatName } from '../VoteKit';
import { roleToneOf } from '../tokens';
import type { TimerState } from '@/lib/types';

const running = (endTime: number, initialDuration = 120): TimerState => ({ status: 'running', endTime, initialDuration, remainingOnPause: initialDuration });

describe('timer-utils', () => {
  it('formata mm:ss com zero à esquerda e nunca negativo', () => {
    expect(formatTimer(125)).toBe('02:05');
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(-4)).toBe('00:00');
    expect(formatTimer(3599)).toBe('59:59');
  });

  it('calcula o restante pelo relógio do servidor (offset aplicado)', () => {
    const now = 1_000_000;
    expect(remainingSeconds(running(now + 90_000), now, 0)).toBe(90);
    // relógio local 5 s atrasado em relação ao servidor: offset +5000 encurta o restante
    expect(remainingSeconds(running(now + 90_000), now, 5_000)).toBe(85);
    expect(remainingSeconds(running(now - 3_000), now, 0)).toBe(0);
  });

  it('parado devolve a duração; pausado devolve o que sobrou', () => {
    expect(remainingSeconds({ status: 'stopped', endTime: null, initialDuration: 180, remainingOnPause: 180 }, 0)).toBe(180);
    expect(remainingSeconds({ status: 'paused', endTime: null, initialDuration: 180, remainingOnPause: 42 }, 0)).toBe(42);
    expect(remainingSeconds(undefined, 0)).toBe(0);
  });

  it('fase: âmbar nos últimos 10 s, expirado no zero', () => {
    expect(timerPhase(undefined, 0)).toBe('stopped');
    expect(timerPhase(running(1), 60)).toBe('running');
    expect(timerPhase(running(1), 10)).toBe('warning');
    expect(timerPhase(running(1), 0)).toBe('expired');
    expect(timerPhase({ status: 'paused', endTime: null, initialDuration: 60, remainingOnPause: 20 }, 20)).toBe('paused');
  });

  it('fração do anel fica entre 0 e 1', () => {
    expect(timerFraction(30, 120)).toBe(0.25);
    expect(timerFraction(500, 120)).toBe(1);
    expect(timerFraction(10, 0)).toBe(0);
  });
});

describe('pokerPhase', () => {
  it('sem tarefa ou sessão por iniciar: discutir', () => {
    expect(pokerPhase({ hasActiveIssue: false, sessionStarted: true, revealed: false })).toBe('discuss');
    expect(pokerPhase({ hasActiveIssue: true, sessionStarted: false, revealed: false })).toBe('discuss');
  });
  it('votando: votar; revelado: decidir', () => {
    expect(pokerPhase({ hasActiveIssue: true, sessionStarted: true, revealed: false })).toBe('vote');
    expect(pokerPhase({ hasActiveIssue: true, sessionStarted: true, revealed: true })).toBe('decide');
  });
  it('as quatro fases existem na ordem do ritual', () => {
    expect(POKER_PHASES.map((p) => p.id)).toEqual(['discuss', 'vote', 'reveal', 'decide']);
  });
});

describe('PresenceList helpers', () => {
  const mk = (id: string, category: string | null): PresenceItem => ({ id, name: id, roleLabel: id, category, online: true });
  const order = [
    { id: 'Developer', label: 'DEV' },
    { id: 'QA', label: 'QA' },
    { id: 'Management', label: 'Gestão' },
  ];

  it('agrupa na ordem dada e manda o resto para "Outros"', () => {
    const groups = groupPresence([mk('a', 'QA'), mk('b', 'Developer'), mk('c', 'UX'), mk('d', null), mk('e', 'Developer')], order);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['DEV', ['b', 'e']],
      ['QA', ['a']],
      ['Outros', ['c', 'd']],
    ]);
  });

  it('não cria grupo vazio', () => {
    expect(groupPresence([mk('a', 'QA')], order).map((g) => g.label)).toEqual(['QA']);
  });

  it('iniciais e cor de avatar são estáveis', () => {
    expect(initialsOf('Ana Ribeiro')).toBe('AR');
    expect(initialsOf('  carla ')).toBe('C');
    expect(initialsOf('')).toBe('?');
    expect(avatarToneOf('Ana Ribeiro')).toBe(avatarToneOf('Ana Ribeiro'));
  });
});

describe('reações', () => {
  it('reações antigas (emoji) viram o tipo equivalente', () => {
    expect(reactionKindOf('👍').id).toBe('agree');
    expect(reactionKindOf('🤔').id).toBe('doubt');
    expect(reactionKindOf('🔥').id).toBe('speedup');
  });
  it('ids novos passam direto; desconhecido cai em "agree"', () => {
    for (const k of REACTION_KINDS) expect(reactionKindOf(k.id).id).toBe(k.id);
    expect(reactionKindOf('zzz').id).toBe('agree');
  });
  it('todos os ids cabem no limite de 16 caracteres do backend', () => {
    for (const k of REACTION_KINDS) expect(k.id.length).toBeLessThanOrEqual(16);
  });
});

describe('roleToneOf', () => {
  it('mapeia categorias técnicas e cai em "other"', () => {
    expect(roleToneOf('Developer')).toBe('dev');
    expect(roleToneOf('QA')).toBe('qa');
    expect(roleToneOf('UX')).toBe('ux');
    expect(roleToneOf('Designer')).toBe('design');
    expect(roleToneOf('Management')).toBe('other');
    expect(roleToneOf(null)).toBe('other');
  });
});

describe('shortSeatName', () => {
  it('encurta nomes longos para primeiro nome e inicial do último', () => {
    expect(shortSeatName('Gabriel Alves Mendes')).toBe('Gabriel M.');
    expect(shortSeatName('Wanderson Alves')).toBe('Wanderson A.');
  });
  it('mantém nomes curtos e de uma palavra só', () => {
    expect(shortSeatName('Ana Souza')).toBe('Ana Souza');
    expect(shortSeatName('  Bruno ')).toBe('Bruno');
    expect(shortSeatName('Maximiliano-Constantino')).toBe('Maximiliano-Constantino');
  });
});
