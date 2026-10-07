import { describe, expect, it } from 'vitest';
import type { RetroParticipant } from '@/lib/types';
import type { ChatMessage } from '../../poker/team-chat/chatChannels';
import { chatChannelsFor, mergeChatHistory, toChatParticipant, upsertChatMessage } from '../retro-chat';

const p = (id: string, extra: Partial<RetroParticipant> = {}): RetroParticipant => ({
  id, boardId: 'b1', nickname: id, isCreator: false, ...extra,
});

const msg = (id: string, channelId: string, ts: string, text = id): ChatMessage => ({
  id, channelId, ts, text, senderId: 'x', senderName: 'X', senderCategory: null, kind: 'text',
});

describe('toChatParticipant', () => {
  it('mapeia o papel da retro para o do chat', () => {
    expect(toChatParticipant(p('a', { role: 'DEV' })).role).toBe('dev');
    expect(toChatParticipant(p('a', { role: 'QA' })).role).toBe('qa');
    expect(toChatParticipant(p('a', { role: 'PO' })).role).toBe('organizador');
  });

  it('sem papel mapeável vira espectador, salvo se o perfil global diz o cargo', () => {
    expect(toChatParticipant(p('a', { role: 'OUTRO' })).role).toBe('spectator');
    expect(toChatParticipant(p('a')).role).toBe('spectator');
    expect(toChatParticipant(p('a', { role: 'UX', globalRole: 'UX' })).role).toBe('dev');
  });
});

describe('chatChannelsFor', () => {
  it('inclui geral, o canal da função e uma DM por colega (ordenada, sem DM consigo)', () => {
    const me = p('bia', { role: 'DEV' });
    const channels = chatChannelsFor(me, [me, p('ana'), p('cid')]);
    expect(channels).toEqual(['geral', 'role-Developer', 'dm_ana_bia', 'dm_bia_cid']);
  });

  it('espectador sem cargo só tem geral e DMs', () => {
    const me = p('bia', { role: 'OUTRO' });
    expect(chatChannelsFor(me, [me, p('ana')])).toEqual(['geral', 'dm_ana_bia']);
  });
});

describe('upsertChatMessage', () => {
  it('acrescenta mensagem nova ao canal', () => {
    const next = upsertChatMessage({}, msg('m1', 'geral', '2026-01-01T00:00:00.000Z'));
    expect(next.geral.map(m => m.id)).toEqual(['m1']);
  });

  it('substitui por id em vez de duplicar', () => {
    const first = upsertChatMessage({}, msg('m1', 'geral', '2026-01-01T00:00:00.000Z', 'antes'));
    const next = upsertChatMessage(first, msg('m1', 'geral', '2026-01-01T00:00:00.000Z', 'depois'));
    expect(next.geral).toHaveLength(1);
    expect(next.geral[0].text).toBe('depois');
  });
});

describe('mergeChatHistory', () => {
  it('mantém a mensagem que chegou pelo WS durante a carga e ordena por ts', () => {
    const live = [msg('m3', 'geral', '2026-01-01T00:00:03.000Z')];
    const loaded = [msg('m1', 'geral', '2026-01-01T00:00:01.000Z'), msg('m2', 'geral', '2026-01-01T00:00:02.000Z')];
    expect(mergeChatHistory(live, loaded).map(m => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('não duplica quando a mesma mensagem veio dos dois lados', () => {
    const both = msg('m1', 'geral', '2026-01-01T00:00:01.000Z');
    expect(mergeChatHistory([both], [both])).toHaveLength(1);
  });

  it('aceita canal ainda vazio', () => {
    expect(mergeChatHistory(undefined, [])).toEqual([]);
  });
});
