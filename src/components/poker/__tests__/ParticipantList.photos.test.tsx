import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchUserBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { fetchUserBlob, fetchBlob: vi.fn() } }));

import { ParticipantList } from '../ParticipantList';
import { PresenceList } from '@/components/room-kit';
import { RoomTopBar } from '@/components/room-kit/RoomTopBar';
import { resetUserPhotoCache } from '@/lib/user-photo-cache';
import { resetUploadedPhotoOverrides } from '@/lib/uploaded-photo-store';
import type { Participant } from '@/lib/types';
import { Users } from 'lucide-react';

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));

const p = (id: string, over: Partial<Participant> = {}): Participant =>
  ({ id, roomId: 'r1', nickname: `Pessoa ${id}`, role: 'dev', isFacilitator: false, ...over }) as Participant;

const base = {
  votes: [],
  currentUserId: 'a',
  isFacilitator: false,
  onRemoveParticipant: vi.fn(),
  onUpdateParticipantRole: vi.fn(),
  onClaimFacilitator: vi.fn(),
};

beforeEach(() => {
  fetchUserBlob.mockReset();
  resetUserPhotoCache();
  resetUploadedPhotoOverrides();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:colega-${++n}`);
  URL.revokeObjectURL = vi.fn();
  // jsdom não tem matchMedia (o cabeçalho da sala consulta a largura).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

describe('fotos dos colegas nas salas', () => {
  it('ParticipantList: quem enviou foto aparece com ela; quem não enviou, com as iniciais', async () => {
    fetchUserBlob.mockImplementation(async (id: string) => (id === 'b' ? new Blob(['x']) : null));
    const { container } = render(<ParticipantList {...base} participants={[p('a'), p('b'), p('c')]} onlineIds={new Set(['a', 'b', 'c'])} />);

    await waitFor(() => expect(container.querySelectorAll('img').length).toBe(1));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:colega-1');
    expect(fetchUserBlob.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b', 'c']);
    // Os outros dois seguem com iniciais ("Pessoa a" = PA, "Pessoa c" = PC): nada de imagem quebrada.
    expect(container.textContent).toContain('PA');
    expect(container.textContent).toContain('PC');
  });

  it('ParticipantList: voto de quem já saiu busca pelo id da pessoa, não pelo id sintético do item', async () => {
    fetchUserBlob.mockResolvedValue(null);
    render(
      <ParticipantList
        {...base}
        participants={[p('a')]}
        votes={[{ participantId: 'saiu', participantNickname: 'Saiu', value: '3' } as never]}
        onlineIds={new Set(['a'])}
      />
    );
    await act(async () => {});
    expect(fetchUserBlob.mock.calls.map((c) => c[0])).toEqual(['a', 'saiu']);
  });

  it('PresenceList: usa o id do item para buscar', async () => {
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const { container } = render(<PresenceList items={[{ id: 'u9', name: 'Zé', roleLabel: 'DEV' }]} />);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:colega-1'));
    expect(fetchUserBlob).toHaveBeenCalledWith('u9');
  });

  it('pilha de presença do topo da sala mostra a foto de quem está na sala', async () => {
    fetchUserBlob.mockImplementation(async (id: string) => (id === 'u1' ? new Blob(['x']) : null));
    const { container } = render(
      <RoomTopBar
        toolName="Scrum Poker"
        toolIcon={Users}
        title="Sala"
        userMenu={<span />}
        presence={{ people: [{ id: 'u1', name: 'Ana Souza', online: true }, { id: 'u2', name: 'Beto Lima', online: true }], onClick: vi.fn() }}
      />
    );
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:colega-1'));
    expect(container.querySelectorAll('img').length).toBe(1);
  });
});
