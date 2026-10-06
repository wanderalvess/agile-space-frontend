import type { Participant } from '@/lib/types';
import { getParticipantCategory } from '@/lib/poker-utils';

export type ChatMessageKind = 'text' | 'code';

// O chat é usado pelo Poker e pela Retro: cada tela adapta o seu participante
// para este formato mínimo.
export type ChatParticipant = Pick<Participant, 'id' | 'nickname' | 'role'> &
  Partial<Pick<Participant, 'globalRole' | 'lastSeen'>>;

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderCategory: string | null;
  text: string;
  kind: ChatMessageKind;
  ts: string;
  channelId?: string;
};

export type ChatCategory = NonNullable<ReturnType<typeof getParticipantCategory>>;

export const GENERAL_CHANNEL = 'geral';
export const MAX_MESSAGE_LENGTH = 8000;

const CATEGORY_LABELS: Record<ChatCategory, string> = {
  Developer: 'Devs',
  QA: 'QAs',
  UX: 'UX',
  Designer: 'Design',
  Management: 'Gestão',
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Espectador';
  return CATEGORY_LABELS[category as ChatCategory] ?? category;
}

export function roleChannelId(category: ChatCategory): string {
  return `role-${category}`;
}

export function dmChannelId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

export function dmPeerId(channelId: string, selfId: string): string | null {
  if (!channelId.startsWith('dm_')) return null;
  const [, a, b] = channelId.split('_');
  return a === selfId ? b : a;
}

export function participantCategory(p: ChatParticipant): ChatCategory | null {
  return getParticipantCategory(p);
}
