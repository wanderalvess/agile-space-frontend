import { describe, expect, it } from 'vitest';
import {
  filterBrainstormRows,
  ideasFromSummary,
  isLobbyRowLive,
  lobbyStageLabel,
  mergeBrainstormRows,
  parseRoomCode,
  readRoomCode,
} from '../brainstorming-lobby';
import type { BrainstormingBoard } from '../types';

const ID = '3f9a2c71-5d0e-4b86-a1c4-7e2d8b90f315';

describe('entrar por ID ou link', () => {
  it('campo vazio', () => {
    expect(readRoomCode('')).toEqual({ state: 'empty' });
    expect(readRoomCode('   ')).toEqual({ state: 'empty' });
    expect(parseRoomCode('')).toBeNull();
  });

  it('ID puro (UUID) é aceito e volta em minúsculas', () => {
    expect(readRoomCode(ID)).toEqual({ state: 'id', id: ID });
    expect(parseRoomCode(ID.toUpperCase())).toBe(ID);
    expect(parseRoomCode(`  ${ID}  `)).toBe(ID);
  });

  it('o link inteiro da sala dá o ID, com ou sem domínio, parâmetros ou âncora', () => {
    expect(readRoomCode(`https://portal.espacoagil.com.br/brainstorming/${ID}`)).toEqual({ state: 'link', id: ID });
    expect(parseRoomCode(`http://localhost:9002/brainstorming/${ID}?x=1#topo`)).toBe(ID);
    expect(parseRoomCode(`/brainstorming/${ID}`)).toBe(ID);
    expect(parseRoomCode(`portal.espacoagil.com.br/brainstorming/${ID}/`)).toBe(ID);
    expect(parseRoomCode(`https://x.com/BRAINSTORMING/${ID.toUpperCase()}`)).toBe(ID);
  });

  it('um ID que não é UUID mantém as letras como foram digitadas', () => {
    expect(parseRoomCode('Sala_Antiga-01')).toBe('Sala_Antiga-01');
  });

  it('texto que não serve é recusado', () => {
    expect(readRoomCode('abc def')).toEqual({ state: 'invalid' });
    expect(readRoomCode('https://portal.com/retro/abc')).toEqual({ state: 'invalid' });
    expect(readRoomCode('ID com ç')).toEqual({ state: 'invalid' });
    expect(parseRoomCode('../../etc/passwd')).toBeNull();
    expect(parseRoomCode(`/brainstorming/${'a'.repeat(101)}`)).toBeNull();
  });
});

const board = (over: Partial<BrainstormingBoard> & { id: string }): BrainstormingBoard => ({
  creatorId: 'u1', title: 'Sessão', team: 'PHOENIX', createdAt: '2026-10-10T10:00:00Z', phase: 'ideation',
  settings: { isAnonymous: false }, ...over,
});

describe('lista do hub', () => {
  const NOW = Date.parse('2026-10-10T12:00:00Z');

  it('lê as ideias do resumo do histórico', () => {
    expect(ideasFromSummary('23 ideias')).toBe(23);
    expect(ideasFromSummary('1 ideia')).toBe(1);
    expect(ideasFromSummary(null)).toBeUndefined();
    expect(ideasFromSummary('3 respostas')).toBeUndefined();
  });

  it('junta murais da squad e histórico, mais novos primeiro', () => {
    const rows = mergeBrainstormRows(
      [board({ id: 'a', createdAt: '2026-10-01T10:00:00Z', phase: 'actions' }), board({ id: 'b', createdAt: '2026-10-09T10:00:00Z', phase: 'prioritization' })],
      [
        { id: 'a', participantsCount: 11, summary: '41 ideias', status: 'FINISHED' },
        { id: 'b', participantsCount: 9, summary: '23 ideias', status: 'LIVE' },
      ],
      [],
      NOW
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(rows[0]).toMatchObject({ ideas: 23, people: 9, status: 'LIVE', phase: 'prioritization' });
    expect(rows[1]).toMatchObject({ ideas: 41, people: 11, status: 'FINISHED' });
  });

  it('sem histórico, as contagens ficam ausentes e o status é derivado da etapa', () => {
    const rows = mergeBrainstormRows([board({ id: 'a', phase: 'actions' }), board({ id: 'b', phase: 'grouping' })], [], [], NOW);
    const a = rows.find((r) => r.id === 'a')!;
    const b = rows.find((r) => r.id === 'b')!;
    expect(a.ideas).toBeUndefined();
    expect(a.people).toBeUndefined();
    expect(a.status).toBe('FINISHED');
    expect(b.status).toBe('LIVE');
  });

  it('resumo vazio no histórico significa zero ideias', () => {
    const [row] = mergeBrainstormRows([board({ id: 'a' })], [{ id: 'a', participantsCount: 1, summary: null }], [], NOW);
    expect(row.ideas).toBe(0);
  });

  it('acrescenta o que só existe neste navegador, sem repetir', () => {
    const rows = mergeBrainstormRows(
      [board({ id: 'a' })],
      [],
      [
        { roomId: 'a', title: 'repetida', team: '', createdAt: '2026-10-10T10:00:00Z' },
        { roomId: 'z', title: 'Só aqui', team: 'OUTRA', createdAt: '2026-10-11T10:00:00Z' },
      ],
      NOW
    );
    expect(rows.map((r) => r.id)).toEqual(['z', 'a']);
    expect(rows[0].localOnly).toBe(true);
    expect(rows[1].localOnly).toBeUndefined();
  });

  it('nome de reserva para mural sem título', () => {
    const [row] = mergeBrainstormRows([board({ id: 'a', title: '' })], [], [], NOW);
    expect(row.title).toBe('Brainstorming sem título');
  });

  it('filtros e busca', () => {
    const rows = mergeBrainstormRows(
      [
        board({ id: 'a', title: 'Redesenho do onboarding', phase: 'prioritization' }),
        board({ id: 'b', title: 'Ideias para o Dia do Cliente', phase: 'actions' }),
        board({ id: 'c', title: 'Nome do painel', phase: 'ideation' }),
      ],
      [],
      [],
      NOW
    );
    expect(filterBrainstormRows(rows, 'all', '')).toHaveLength(3);
    expect(filterBrainstormRows(rows, 'plan', '').map((r) => r.id)).toEqual(['b']);
    expect(filterBrainstormRows(rows, 'live', '').map((r) => r.id).sort()).toEqual(['a', 'c']);
    expect(filterBrainstormRows(rows, 'all', 'ONBOARD').map((r) => r.id)).toEqual(['a']);
    expect(filterBrainstormRows(rows, 'plan', 'onboard')).toEqual([]);
  });

  it('etapa em palavras e "em andamento"', () => {
    expect(lobbyStageLabel('ideation')).toBe('Mural');
    expect(lobbyStageLabel('diagram')).toBe('Teia');
    expect(lobbyStageLabel('grouping')).toBe('Grupos');
    expect(lobbyStageLabel('prioritization')).toBe('Matriz');
    expect(lobbyStageLabel('actions')).toBe('Plano');
    expect(lobbyStageLabel(undefined)).toBe('');
    expect(isLobbyRowLive({ status: 'LIVE' })).toBe(true);
    expect(isLobbyRowLive({ status: 'FINISHED' })).toBe(false);
  });
});
