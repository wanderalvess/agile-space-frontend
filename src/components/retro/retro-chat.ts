import type { RetroParticipant } from '@/lib/types';
import {
  GENERAL_CHANNEL,
  dmChannelId,
  participantCategory,
  roleChannelId,
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
