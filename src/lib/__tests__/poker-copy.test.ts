import { describe, it, expect } from 'vitest';
import { formatEstimateCopy, buildDefaultSettingsPatch, CEREMONY_TOGGLE_KEYS, DEFAULT_ROOM_SETTINGS } from '../poker-utils';

describe('formatEstimateCopy (Copiar estimativa)', () => {
  it('monta "(DEV 10h / QA 4h / UX 2h)" na ordem canônica dos papéis', () => {
    const text = formatEstimateCopy([
      { role: 'UX', value: '2' },
      { role: 'QA', value: '4' },
      { role: 'Developer', value: '10' },
    ]);
    expect(text).toBe('(DEV 10h / QA 4h / UX 2h)');
  });

  it('ignora vazios e N/A; skipZero também descarta zero', () => {
    const entries = [
      { role: 'Developer', value: '8' },
      { role: 'QA', value: '0' },
      { role: 'UX', value: 'N/A' },
      { role: 'Designer', value: '' },
    ];
    expect(formatEstimateCopy(entries)).toBe('(DEV 8h / QA 0h)');
    expect(formatEstimateCopy(entries, 'h', { skipZero: true })).toBe('(DEV 8h)');
  });

  it('usa o sufixo do baralho e devolve vazio sem papéis', () => {
    expect(formatEstimateCopy([{ role: 'Developer', value: '5' }, { role: 'QA', value: '3' }], ' SP')).toBe('(DEV 5 SP / QA 3 SP)');
    expect(formatEstimateCopy([])).toBe('');
  });

  it('papéis fora da lista canônica vão para o fim, na ordem recebida', () => {
    expect(formatEstimateCopy([{ role: 'Arquiteto', value: '3' }, { role: 'QA', value: '2' }])).toBe('(QA 2h / ARQUITETO 3h)');
  });
});

describe('buildDefaultSettingsPatch (Restaurar padrão)', () => {
  it('cobre os 22 ajustes e liga só o que nasce ligado', () => {
    expect(CEREMONY_TOGGLE_KEYS).toHaveLength(22);
    const patch = buildDefaultSettingsPatch();
    const defaults = DEFAULT_ROOM_SETTINGS as Record<string, boolean>;
    for (const key of CEREMONY_TOGGLE_KEYS) expect(patch[key]).toBe(!!defaults[key]);
    expect(patch.autoReveal).toBe(false);
    expect(patch.confidenceVote).toBe(true);
  });

  it('volta teto de rodadas, arredondamento e limites de divergência', () => {
    const patch = buildDefaultSettingsPatch();
    expect(patch.maxRounds).toBe(3);
    expect(patch.roundingMode).toBe('up');
    expect(patch.divergenceThresholds).toEqual({ warn: 2, high: 5 });
  });
});
