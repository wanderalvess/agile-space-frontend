import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantList } from '../ParticipantList';
import type { Participant } from '@/lib/types';

const p = (id: string, over: Partial<Participant> = {}): Participant =>
  ({ id, roomId: 'r1', nickname: id, role: 'dev', isFacilitator: false, ...over }) as Participant;

const base = {
  votes: [],
  currentUserId: 'b',
  isFacilitator: false,
  onRemoveParticipant: vi.fn(),
  onUpdateParticipantRole: vi.fn(),
  onClaimFacilitator: vi.fn(),
};

afterEach(cleanup);

describe('ParticipantList: assumir o controle', () => {
  const people = [p('a', { isFacilitator: true, role: 'organizador' }), p('b')];

  it('com o organizador online o botão não aparece', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['a', 'b'])} />);
    expect(screen.queryByLabelText('Assumir o controle da sala')).toBeNull();
  });

  it('com o organizador ausente o botão aparece', () => {
    render(<ParticipantList {...base} participants={people} onlineIds={new Set(['b'])} />);
    expect(screen.getByLabelText('Assumir o controle da sala')).toBeTruthy();
  });
});
