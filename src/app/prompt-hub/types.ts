/** Quem pode ver um item: só a pessoa que criou ou toda a empresa (inclusive sem login). */
export type PromptVisibility = 'private' | 'public';
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

  // Detalhes de iniciativa
  status?: InitiativeStatus;
  impact?: InitiativeImpact;
  businessGoal?: string;
  targetAudience?: string;
  architectureLink?: string;

  // Autoria (foto do momento em que o item foi criado)
  authorId: string;
  authorName: string;
  authorRole: string;
  /** Vem gravada no item, mas a tela não a mostra: o nome da squad aparece só no cabeçalho do portal. */
  authorSquad: string;
  authorAvatar?: string;

  // Números
  useCount: number;
  forkCount: number;
  tags: string[];

  // Datas
  createdAt: string;
  updatedAt?: string;

  // Calculados pelo servidor para quem está vendo (ausentes no backend antigo)
  /** Esta pessoa favoritou o item. */
  favorite?: boolean;
  /** Esta pessoa pode editar e excluir o item (dona do item ou administradora). */
  canEdit?: boolean;
  /** Esta pessoa pode remover comentários do item (dona do item ou administradora). */
  canModerate?: boolean;
}

/**
 * Coleção: um conjunto ordenado de itens do Hub, para montar trilhas como
 * "Onboarding de dev" ou "Fechamento de sprint". Etiquetas são planas e não têm
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

  createdAt: string;
  /** Só existe quando o servidor informa; nunca é inventada a partir de outra data. */
  updatedAt?: string;
}

/** Espelha a entity Postgres PromptComment (prompt_comments). */
export interface PromptComment {
  id: string;
  content: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  authorSquad?: string;
  authorAvatar?: string;
  createdAt: string;
}

/** Filtro de situação: `active` esconde os arquivados (padrão); `all` mostra tudo. */
export type StatusFilter = 'active' | 'all' | InitiativeStatus;

export interface CatalogFilters {
  search: string;
  type: PromptType | 'all';
  status: StatusFilter;
  impact: 'all' | InitiativeImpact;
  visibility: 'all' | PromptVisibility;
  tag: string | null;
}

export interface UsageWeek {
  /** Segunda-feira da semana (data ISO). */
  weekStart: string;
  uses: number;
  clones: number;
}

export interface PromptVersionSummary {
  versionNumber: number;
  title: string;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
  current: boolean;
}

/** Conteúdo completo de uma versão antiga (o servidor devolve os campos do item naquele momento). */
export interface PromptVersionDetail extends PromptVersionSummary {
  description?: string;
  content?: string;
  type?: PromptType;
  gemLink?: string;
  tags?: string[];
}
