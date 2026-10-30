import { describe, expect, it } from 'vitest';
import { rememberOpenedRoom, type RoomMeta } from '../useToolHistory';

const meta: RoomMeta = { roomId: 'ABC123', type: 'poker', title: 'Sprint 12', team: 'Squad A', createdAt: '2026-10-01T10:00:00Z' };

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial) data.set('agileSpace_rooms_meta', initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('rememberOpenedRoom', () => {
  it('registra a sala aberta por link (mesmo encerrada) no atalho local', () => {
    const st = fakeStorage();
    rememberOpenedRoom(meta, st);
    expect(JSON.parse(st.data.get('agileSpace_rooms_meta')!)).toEqual([meta]);
  });

  it('não repete a sala que já está lá e preserva as outras', () => {
    const other = { ...meta, roomId: 'ZZZ', type: 'retro' };
    const st = fakeStorage(JSON.stringify([other, meta]));
    rememberOpenedRoom(meta, st);
    expect(JSON.parse(st.data.get('agileSpace_rooms_meta')!)).toHaveLength(2);
  });

  it('armazenamento quebrado ou ausente não lança', () => {
    expect(() => rememberOpenedRoom(meta, fakeStorage('{quebrado'))).not.toThrow();
    expect(() => rememberOpenedRoom(meta, undefined)).not.toThrow();
  });
});
