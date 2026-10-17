import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRO_SCENE_MODE,
  RETRO_SCENE_OPTIONS,
  RETRO_SCENE_PREF_KEY,
  parseSceneMode,
  resolveSceneMode,
  type RetroSceneMode,
} from '../retro-scene-mode';

const base = { preference: 'full' as RetroSceneMode, leitura: false, presenting: false, reducedMotion: false };

describe('modo do cenário em vigor', () => {
  it('o padrão é Suave, com as três opções na ordem Completo, Suave, Desligado', () => {
    expect(DEFAULT_RETRO_SCENE_MODE).toBe('soft');
    expect(RETRO_SCENE_OPTIONS.map((o) => o.id)).toEqual(['full', 'soft', 'off']);
    expect(RETRO_SCENE_PREF_KEY).toBe('agile_retro_scenery');
  });

  it('sem nenhuma restrição, vale o que a pessoa escolheu', () => {
    for (const preference of ['full', 'soft', 'off'] as const) expect(resolveSceneMode({ ...base, preference })).toBe(preference);
  });

  it('o tema Leitura desliga tudo, em qualquer escolha', () => {
    for (const preference of ['full', 'soft', 'off'] as const) expect(resolveSceneMode({ ...base, preference, leitura: true })).toBe('off');
  });

  it('apresentar nunca passa de Suave (e quem desligou continua sem cenário)', () => {
    expect(resolveSceneMode({ ...base, presenting: true })).toBe('soft');
    expect(resolveSceneMode({ ...base, preference: 'soft', presenting: true })).toBe('soft');
    expect(resolveSceneMode({ ...base, preference: 'off', presenting: true })).toBe('off');
  });

  it('"reduzir movimento" do sistema faz o Completo se comportar como Suave', () => {
    expect(resolveSceneMode({ ...base, reducedMotion: true })).toBe('soft');
    expect(resolveSceneMode({ ...base, preference: 'off', reducedMotion: true })).toBe('off');
  });

  it('Leitura vence apresentação e movimento reduzido', () => {
    expect(resolveSceneMode({ preference: 'full', leitura: true, presenting: true, reducedMotion: true })).toBe('off');
  });

  it('só aceita os três valores guardados no navegador', () => {
    expect(parseSceneMode('full')).toBe('full');
    expect(parseSceneMode('soft')).toBe('soft');
    expect(parseSceneMode('off')).toBe('off');
    for (const bad of ['', 'FULL', 'true', 'suave', '1', 'null']) expect(parseSceneMode(bad)).toBeUndefined();
  });
});
