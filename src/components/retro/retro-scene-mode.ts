/**
 * Regras puras do cenário da sala da Retro: os três modos, a preferência guardada no navegador e o que realmente
 * vale a cada momento (tema Leitura, apresentação, "reduzir movimento"). Sem DOM, para serem testadas direto.
 */

/** Completo: camadas com paralaxe e movimento lento. Suave: o mesmo cenário, parado. Desligado: sem ilustração. */
export type RetroSceneMode = 'full' | 'soft' | 'off';

/** Chave da preferência pessoal no navegador (a mesma da visão e do som: não vai ao servidor). */
export const RETRO_SCENE_PREF_KEY = 'agile_retro_scenery';
export const DEFAULT_RETRO_SCENE_MODE: RetroSceneMode = 'soft';

export const RETRO_SCENE_OPTIONS: readonly { id: RetroSceneMode; label: string; desc: string }[] = [
  { id: 'full', label: 'Completo', desc: 'Camadas que se movem um pouco com o mouse e elementos que flutuam devagar.' },
  { id: 'soft', label: 'Suave', desc: 'O cenário do formato, parado. É o padrão.' },
  { id: 'off', label: 'Desligado', desc: 'Sem ilustração: só o fundo do tema.' },
];

export function parseSceneMode(raw: string): RetroSceneMode | undefined {
  return raw === 'full' || raw === 'soft' || raw === 'off' ? raw : undefined;
}

export interface SceneModeInputs {
  /** O que a pessoa escolheu. */
  preference: RetroSceneMode;
  /** Tema "Leitura confortável": decoração sempre desligada. */
  leitura: boolean;
  /** Apresentação em tela cheia: nunca passa de Suave. */
  presenting: boolean;
  /** `prefers-reduced-motion: reduce` no sistema: Completo vira Suave. */
  reducedMotion: boolean;
}

/**
 * Modo em vigor. Leitura desliga tudo; Apresentar e "reduzir movimento" limitam a Suave (e quem escolheu
 * Desligado continua sem cenário).
 */
export function resolveSceneMode({ preference, leitura, presenting, reducedMotion }: SceneModeInputs): RetroSceneMode {
  if (leitura || preference === 'off') return 'off';
  if (presenting || reducedMotion) return 'soft';
  return preference;
}
