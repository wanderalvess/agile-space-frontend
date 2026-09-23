import React from 'react';
import { PokerTopic } from './PokerTopic';
import { BrainstormingTopic } from './BrainstormingTopic';
import { RetroTopic } from './RetroTopic';
import { PlannerTopic } from './PlannerTopic';
import { HealthTopic } from './HealthTopic';
import { DailyFlowTopic } from './DailyFlowTopic';
import { WorkspaceTopic } from './WorkspaceTopic';
import { JoltTopic } from './JoltTopic';
import { KnowledgeTopic } from './KnowledgeTopic';
import { PromptHubTopic } from './PromptHubTopic';
import { ShowcaseTopic } from './ShowcaseTopic';
import { ManifestoTopic } from './ManifestoTopic';
import { GovernanceTopic } from './GovernanceTopic';
import { IntegracoesTopic } from './IntegracoesTopic';

export const TOPIC_COMPONENTS: Record<string, React.ComponentType> = {
  'poker': PokerTopic,
  'brainstorming': BrainstormingTopic,
  'retro': RetroTopic,
  'planner': PlannerTopic,
  'health': HealthTopic,
  'daily-flow': DailyFlowTopic,
  'workspace': WorkspaceTopic,
  'jolt': JoltTopic,
  'knowledge': KnowledgeTopic,
  'prompt-hub': PromptHubTopic,
  'showcase': ShowcaseTopic,
  'manifesto': ManifestoTopic,
  'governance': GovernanceTopic,
  'integracoes': IntegracoesTopic,
};
