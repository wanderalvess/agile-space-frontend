import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PokerTable } from '../PokerTable';
import type { Participant, Vote } from '@/lib/types';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
afterEach(cleanup);

const person = (id: string, role: Participant['role'], globalRole?: string): Participant =>
  ({ id, roomId: 'r', nickname: id, role, globalRole, isFacilitator: false }) as unknown as Participant;
const vote = (participantId: string, value: string): Vote => ({ id: participantId, participantId, roomId: 'r', value, timestamp: '' }) as Vote;

const people = [
  person('Ana', 'dev', 'Developer'),
  person('Beto', 'qa', 'Analista de QA'),
  person('Tati', 'organizador', 'Tech Lead'),
  person('Sam', 'dev'),
];

function renderTable(extra: Partial<React.ComponentProps<typeof PokerTable>> = {}) {
  return render(<PokerTable participants={people} votes={[vote('Ana', '5')]} votesRevealed={false} deck="fibonacci" currentUserId="Ana" {...extra} />);
}

describe('PokerTable: cargo por extenso e observadores', () => {
  it('rotula cada lugar com o cargo da administração, ou "Sem cargo"', () => {
    renderTable();
    expect(screen.getByText('Developer')).toBeTruthy();
    expect(screen.getByText('Analista de QA')).toBeTruthy();
    expect(screen.getByText('Tech Lead')).toBeTruthy();
    expect(screen.getByText('Sem cargo')).toBeTruthy();
    expect(screen.queryByText('DEV')).toBeNull();
    expect(screen.queryByText('QA')).toBeNull();
  });

  it('cargo fora da lista e sem cargo ficam observando, com a dica; só dev e QA entram na conta', () => {
    renderTable();
    expect(screen.getAllByText('Observando')).toHaveLength(2);
    expect(screen.getByLabelText('Tati, Tech Lead, observando: cargo não vota nesta sala')).toBeTruthy();
    expect(screen.getByLabelText('Sam, Sem cargo, observando: sem cargo na administração')).toBeTruthy();
    // 2 votantes (Ana e Beto), 1 voto.
    expect(screen.getByText('1 de 2 votaram')).toBeTruthy();
  });

  it('incluir Tech Lead em "Quem vota" o põe na mesa e no denominador', () => {
    renderTable({ votingCargos: ['Developer', 'Analista de QA', 'Tech Lead'] });
    expect(screen.getAllByText('Observando')).toHaveLength(1);
    expect(screen.getByText('1 de 3 votaram')).toBeTruthy();
  });
});
