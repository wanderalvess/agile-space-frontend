import { describe, expect, it } from 'vitest';
import { RETRO_TEMPLATES } from '../types';
import {
  DEFAULT_SETUP_SETTINGS,
  RETRO_FORMATS,
  RETRO_FORMAT_GROUPS,
  SETUP_TOGGLES,
  buildNewRetroBoard,
  formatColumns,
  resolveNewColumns,
  retroFormatName,
  validateNewRetro,
} from '../retro-formats';

const custom = (...titles: string[]) => titles.map((title, i) => ({ title, theme: i === titles.length - 1 ? ('action' as const) : ('neutral' as const) }));

describe('formatos de retro', () => {
  it('todo formato pronto tem colunas e o personalizado não tem', () => {
    for (const f of RETRO_FORMATS) {
      if (f.key === 'custom') expect(formatColumns(f.key)).toBeNull();
      else expect(formatColumns(f.key)?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('cada formato tem grupo conhecido, chave única e colunas com ids únicos e uma coluna de ação (quando não é só comparação)', () => {
    const groups = new Set(RETRO_FORMAT_GROUPS.map((g) => g.id));
    const keys = RETRO_FORMATS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of RETRO_FORMATS) {
      expect(groups.has(f.group)).toBe(true);
      if (f.key === 'custom') continue;
      const cols = formatColumns(f.key) ?? [];
      expect(new Set(cols.map((c) => c.id)).size).toBe(cols.length);
      expect(cols.map((c) => c.order)).toEqual(cols.map((_, i) => i));
      expect(cols.some((c) => c.theme === 'action' || c.id === 'actionItems') || ['start_stop_continue', 'starfish', 'mad_sad_glad', 'rose_thorn_bud'].includes(f.key)).toBe(true);
    }
  });

  it('os formatos novos estão no seletor, em grupos', () => {
    for (const key of ['lean_coffee', 'rose_thorn_bud', 'hot_air_balloon', 'plus_delta', 'kudos', 'incident', 'workflow', 'sprint_goal'] as const) {
      expect(RETRO_FORMATS.some((f) => f.key === key)).toBe(true);
      expect(formatColumns(key)?.length).toBeGreaterThanOrEqual(3 - (key === 'plus_delta' ? 1 : 0));
    }
  });

  it('nomes em português, com o personalizado por último', () => {
    expect(retroFormatName('sailboat')).toBe('Veleiro');
    expect(retroFormatName('three_little_pigs')).toBe('Três porquinhos');
    expect(retroFormatName(undefined)).toBeUndefined();
    expect(RETRO_FORMATS[RETRO_FORMATS.length - 1].key).toBe('custom');
  });

  it('as opções padrão começam todas desligadas', () => {
    expect(Object.keys(DEFAULT_SETUP_SETTINGS)).toEqual(SETUP_TOGGLES.map((t) => t.key));
    expect(Object.values(DEFAULT_SETUP_SETTINGS).every((v) => v === false)).toBe(true);
  });
});

describe('validação da nova retro', () => {
  it('exige título', () => {
    expect(validateNewRetro({ title: '   ', template: 'classic', customColumns: [] })).toBe('no-title');
    expect(validateNewRetro({ title: 'Sprint 43', template: 'classic', customColumns: [] })).toBeNull();
  });

  it('formato personalizado pede 2 colunas nomeadas e sem repetição', () => {
    expect(validateNewRetro({ title: 'x', template: 'custom', customColumns: custom('Bom', '', '') })).toBe('custom-columns');
    expect(validateNewRetro({ title: 'x', template: 'custom', customColumns: custom('Bom', 'bom') })).toBe('custom-columns');
    expect(validateNewRetro({ title: 'x', template: 'custom', customColumns: custom('Bom', 'Ruim') })).toBeNull();
  });
});

describe('montagem do quadro novo', () => {
  it('colunas personalizadas só levam as nomeadas, em ordem, com id estável', () => {
    const cols = resolveNewColumns({ template: 'custom', customColumns: custom('Bom', '', 'Ações'), now: 99 });
    expect(cols).toEqual([
      { id: 'custom_0_99', title: 'Bom', theme: 'neutral', order: 0 },
      { id: 'custom_1_99', title: 'Ações', theme: 'action', order: 1 },
    ]);
  });

  it('formato pronto usa as colunas do modelo', () => {
    expect(resolveNewColumns({ template: 'daki', customColumns: [], now: 1 })).toBe(RETRO_TEMPLATES.daki);
  });

  it('mantém o contrato do POST: oculto, votação fechada, 5 votos, timer parado e criador como participante', () => {
    const board = buildNewRetroBoard({
      id: 'b1',
      userId: 'u1',
      title: '  Retro 43 ',
      team: '  ',
      template: 'classic',
      customColumns: [],
      settings: { ...DEFAULT_SETUP_SETTINGS, healthCheckEnabled: true },
      healthCheckQuestion: ' Como vai? ',
      squadId: 'PHOENIX',
      sprintId: 's43',
      now: new Date('2025-10-17T12:00:00Z'),
    });
    expect(board).toMatchObject({
      id: 'b1',
      creatorId: 'u1',
      isCardsRevealed: false,
      votingStatus: 'disabled',
      maxVotesPerParticipant: 5,
      title: 'Retro 43',
      team: 'Squad Geral',
      templateKey: 'classic',
      participantIds: ['u1'],
      healthCheckEnabled: true,
      healthCheckQuestion: 'Como vai?',
      squadId: 'PHOENIX',
      sprintId: 's43',
      createdAt: '2025-10-17T12:00:00.000Z',
    });
    expect(board.timer).toEqual({ status: 'stopped', endTime: null, initialDuration: 300, remainingOnPause: 300 });
    expect(board.columns).toBe(RETRO_TEMPLATES.classic);
  });

  it('sem pergunta, squad ou sprint, esses campos nem vão no corpo', () => {
    const board = buildNewRetroBoard({
      id: 'b2', userId: 'u1', title: 'x', team: 'Phoenix', template: 'classic', customColumns: [], settings: DEFAULT_SETUP_SETTINGS, healthCheckQuestion: '  ',
    });
    expect(board).not.toHaveProperty('healthCheckQuestion');
    expect(board).not.toHaveProperty('squadId');
    expect(board).not.toHaveProperty('sprintId');
    expect(board.team).toBe('Phoenix');
  });
});
