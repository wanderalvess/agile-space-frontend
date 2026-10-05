import type { RetroParticipant } from '@/lib/types';
import {
  GENERAL_CHANNEL,
  dmChannelId,
  participantCategory,
  roleChannelId,
  type ChatMessage,
  type ChatParticipant,
} from '../poker/team-chat/chatChannels';

// Papel da retro -> papel que o chat entende. Quem não tem função mapeável vira
// "espectador" (sem canal por função), a não ser que o perfil global diga o cargo.
const CHAT_ROLE_BY_TEAM_ROLE: Partial<Record<NonNullable<RetroParticipant['role']>, ChatParticipant['role']>> = {
  DEV: 'dev',
  QA: 'qa',
  AM: 'organizador',
  PO: 'organizador',
  PL: 'organizador',
};

export function toChatParticipant(p: RetroParticipant): ChatParticipant {
  return {
    id: p.id,
    nickname: p.nickname,
    globalRole: p.globalRole,
    role: (p.role && CHAT_ROLE_BY_TEAM_ROLE[p.role]) || (p.globalRole ? 'dev' : 'spectator'),
  };
}

// Canais que o participante enxerga: geral, o da sua função e uma DM por colega.
export function chatChannelsFor(self: RetroParticipant, participants: RetroParticipant[]): string[] {
  const channels = [GENERAL_CHANNEL];
  const category = participantCategory(toChatParticipant(self));
  if (category) channels.push(roleChannelId(category));
  for (const p of participants) {
    if (p.id !== self.id) channels.push(dmChannelId(self.id, p.id));
  }
  return channels;
}

// Insere ou substitui (por id) uma mensagem no canal, mantendo a ordem de chegada.
export function upsertChatMessage(prev: Record<string, ChatMessage[]>, msg: ChatMessage): Record<string, ChatMessage[]> {
  const channel = msg.channelId as string;
  const list = prev[channel] || [];
  const exists = list.some(m => m.id === msg.id);
  return { ...prev, [channel]: exists ? list.map(m => (m.id === msg.id ? msg : m)) : [...list, msg] };
}

// Une o histórico carregado com o que já chegou pelo WebSocket enquanto a carga estava
// em voo (sem isso a resposta atrasada sobrescreveria mensagens recém-recebidas).
export function mergeChatHistory(current: ChatMessage[] | undefined, loaded: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of loaded) byId.set(m.id, m);
  for (const m of current || []) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}
