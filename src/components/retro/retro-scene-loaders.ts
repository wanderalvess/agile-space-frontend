import type { RetroSceneKey } from '@/lib/retro-format-themes';

/**
 * Um import dinâmico por cenário: cada SVG vira o próprio pacote e só o do formato em uso é baixado
 * (a Home e as demais salas não pagam pelos 17). Novo cenário = novo arquivo em `scenes/` + uma linha aqui.
 */
export const RETRO_SCENE_LOADERS: Record<RetroSceneKey, () => Promise<{ default: string }>> = {
  classic: () => import('./scenes/classic'),
  start_stop_continue: () => import('./scenes/start_stop_continue'),
  plus_delta: () => import('./scenes/plus_delta'),
  starfish: () => import('./scenes/starfish'),
  four_ls: () => import('./scenes/four_ls'),
  daki: () => import('./scenes/daki'),
  mad_sad_glad: () => import('./scenes/mad_sad_glad'),
  rose_thorn_bud: () => import('./scenes/rose_thorn_bud'),
  kudos: () => import('./scenes/kudos'),
  sailboat: () => import('./scenes/sailboat'),
  hot_air_balloon: () => import('./scenes/hot_air_balloon'),
  three_little_pigs: () => import('./scenes/three_little_pigs'),
  speed_car: () => import('./scenes/speed_car'),
  lean_coffee: () => import('./scenes/lean_coffee'),
  sprint_goal: () => import('./scenes/sprint_goal'),
  workflow: () => import('./scenes/workflow'),
  incident: () => import('./scenes/incident'),
};

const cache = new Map<RetroSceneKey, string>();

/** O SVG do cenário (cada um é baixado uma vez). Rejeita se o pacote não carregar. */
export async function loadRetroScene(key: RetroSceneKey): Promise<string> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const markup = (await RETRO_SCENE_LOADERS[key]()).default;
  cache.set(key, markup);
  return markup;
}

/** Só para testes: esquece os cenários já baixados. */
export function clearRetroSceneCache() {
  cache.clear();
}
