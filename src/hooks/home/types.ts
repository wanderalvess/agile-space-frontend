/**
 * Tipos da Home, independentes do formato dos endpoints. Os hooks e componentes só conhecem estes tipos;
 * quem traduz a resposta do backend para eles é `sources.ts` (único arquivo que fala com a API).
 */

export type AnnouncementKind = 'info' | 'important' | 'maintenance';

export interface HomeAnnouncement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  text: string;
  publishedBy?: string;
  /** ISO. */
  publishedAt?: string;
  /** ISO. Depois disso o aviso some. Ausente = vale pela janela padrão (ver ANNOUNCEMENT_DEFAULT_TTL_MS). */
  validUntil?: string;
  /** Ex.: "para todas as squads". */
  audienceLabel?: string;
  /** Só http(s) ou caminho interno. */
  learnMoreUrl?: string;
  /** Vem do contrato v2: vigência e público já foram resolvidos pelo servidor (sem validade = não expira). */
  serverManaged?: boolean;
}

export type NotificationTab = 'foryou' | 'messages' | 'announcements';

export type NotificationKind = 'INVITE' | 'REMINDER' | 'ACTION_ASSIGNED' | 'MESSAGE' | 'ANNOUNCEMENT' | 'LINK_REQUEST' | 'SUPPORT_REPLY';

export interface HomeNotification {
  id: string;
  tab: NotificationTab;
  kind?: NotificationKind;
  /** Quem enviou, ou o título quando não é uma pessoa. */
  who: string;
  text: string;
  /** Presente quando `who` é uma pessoa: vira o avatar de iniciais. */
  personName?: string;
  icon?: 'megaphone' | 'wrench' | 'alert' | 'calendar' | 'list' | 'message';
  createdAt?: string;
  unread: boolean;
  cta?: { label: string; href: string };
}

export type RitualKey = 'poker' | 'retro' | 'showcase' | 'health' | 'brainstorming';

export const RITUAL_KEYS: RitualKey[] = ['poker', 'retro', 'showcase', 'health', 'brainstorming'];

export type SessionStatus = 'live' | 'async' | 'planning' | 'in_progress' | 'done';

export interface SquadRef {
  id: string;
  name: string;
}

/** Uma sessão de qualquer ritual, já normalizada. */
export interface ToolSession {
  id: string;
  tool: RitualKey;
  squadId: string;
  squadName: string;
  title: string;
  /** ISO. */
  createdAt?: string;
  participants?: number;
  /** Resultado curto, quando existe ("9 tarefas"). */
  result?: string;
  status: SessionStatus;
  href: string;
}

export interface SquadSummary extends SquadRef {
  roleName?: string;
  isActive: boolean;
  sprintName?: string;
  /** 0-100, ou null quando não há dado de sprint sincronizado. */
  sprintPercent: number | null;
  daysLeft: number | null;
  nextCeremony?: { title: string; start: Date };
}

export interface HomeResource<T> {
  data: T;
  loading: boolean;
  /** true quando a última tentativa falhou; `data` fica no estado vazio. */
  failed: boolean;
  /** Refaz a busca agora ("Tentar de novo"): volta a `loading` até chegar a resposta. */
  refetch: () => void;
}

export interface UnreadCounts {
  foryou: number;
  messages: number;
  announcements: number;
  total: number;
}

export const NO_UNREAD: UnreadCounts = { foryou: 0, messages: 0, announcements: 0, total: 0 };

/** Notificações do servidor (contrato v2) já separadas por aba, com os contadores de não lidas dele. */
export interface NotificationFeed {
  items: HomeNotification[];
  unread: UnreadCounts;
}

export interface Contact {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  other: Contact;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

/** Dados de sprint e cerimônia de uma squad, já no formato da Home. */
export interface SquadInfo {
  sprintName?: string;
  sprintPercent: number | null;
  daysLeft: number | null;
  nextCeremony?: { title: string; start: Date };
}
