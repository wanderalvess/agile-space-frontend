import { ACTION_PLAN_CONTENT } from './action-plan';
import { ADMIN_CONTENT } from './admin';
import { BRAINSTORMING_CONTENT } from './brainstorming';
import { DEVTOOLS_CONTENT } from './devtools';
import { GOVERNANCE_CONTENT } from './governance';
import { HEALTH_CONTENT } from './health';
import { INTEGRACOES_CONTENT } from './integracoes';
import { JOLT_CONTENT } from './jolt';
import { KNOWLEDGE_CONTENT } from './knowledge';
import { MANIFESTO_CONTENT } from './manifesto';
import { PAINEL_CONTENT } from './painel';
import { PLANNER_CONTENT } from './planner';
import { POKER_CONTENT } from './poker';
import { PRIMEIROS_PASSOS_CONTENT } from './primeiros-passos';
import { PROMPT_HUB_CONTENT } from './prompt-hub';
import { QUALIDADE_CONTENT } from './qualidade';
import { RETRO_CONTENT } from './retro';
import { SHOWCASE_CONTENT } from './showcase';
import { SUPORTE_CONTENT } from './suporte';
import type { ManualBlock } from './types';
import { VERSOES_CONTENT } from './versoes';
import { WORKSPACE_CONTENT } from './workspace';

/** Conteúdo de cada tópico, pelo id de `data/topics.ts`. Um tópico novo precisa dos dois. */
export const TOPIC_CONTENT: Record<string, ManualBlock[]> = {
  poker: POKER_CONTENT,
  retro: RETRO_CONTENT,
  showcase: SHOWCASE_CONTENT,
  health: HEALTH_CONTENT,
  brainstorming: BRAINSTORMING_CONTENT,
  planner: PLANNER_CONTENT,
  'action-plan': ACTION_PLAN_CONTENT,
  painel: PAINEL_CONTENT,
  workspace: WORKSPACE_CONTENT,
  qualidade: QUALIDADE_CONTENT,
  knowledge: KNOWLEDGE_CONTENT,
  'prompt-hub': PROMPT_HUB_CONTENT,
  jolt: JOLT_CONTENT,
  devtools: DEVTOOLS_CONTENT,
  integracoes: INTEGRACOES_CONTENT,
  'primeiros-passos': PRIMEIROS_PASSOS_CONTENT,
  governance: GOVERNANCE_CONTENT,
  suporte: SUPORTE_CONTENT,
  versoes: VERSOES_CONTENT,
  admin: ADMIN_CONTENT,
  manifesto: MANIFESTO_CONTENT,
};
