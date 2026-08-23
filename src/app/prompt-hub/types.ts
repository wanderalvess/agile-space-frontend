export type PromptVisibility = 'private' | 'public' | 'role' | 'squad';
export type PromptType = 'prompt' | 'gem' | 'agent' | 'instruction' | 'skill' | 'workflow' | 'mcp' | 'resource';
export type InitiativeStatus = 'ideacao' | 'planejamento' | 'desenvolvimento' | 'producao' | 'arquivado';
export type InitiativeImpact = 'baixo' | 'medio' | 'alto';

export interface PromptItem {
  id: string;
  title: string;
  content?: string;
  description?: string;
  type: PromptType;
  gemLink?: string;
  visibility: PromptVisibility;
  
  // Initiative Metadata
  status?: InitiativeStatus;
  impact?: InitiativeImpact;
  businessGoal?: string;
  targetAudience?: string;
  architectureLink?: string;
  
  // Author Info (Snapshot at creation)
  authorId: string;
  authorName: string;
  authorRole: string;
  authorSquad: string;
  authorAvatar?: string;
  
  // Stats
  useCount: number;
  forkCount: number;
  tags: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;

  // UI Helpers (Client-side)
  isFavorited?: boolean;
}

/**
 * Coleção: um conjunto ordenado de itens do Hub, para montar trilhas como
 * "Onboarding de dev" ou "Fechamento de sprint". Tags são planas e não têm
 * ordem; coleção resolve isso.
 */
export interface PromptCollection {
  id: string;
  name: string;
  description?: string;
  /** IDs dos itens, na ordem em que devem ser percorridos. */
  itemIds: string[];
  visibility: 'private' | 'public';

  ownerId: string;
  ownerName: string;
  ownerSquad?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PromptFilters {
  search: string;
  type: PromptType | 'all';
  visibility: PromptVisibility | 'all';
  tags: string[];
  onlyFavorites: boolean;
}
