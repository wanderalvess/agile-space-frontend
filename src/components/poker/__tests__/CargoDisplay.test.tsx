import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { OutlierPrompt } from '../OutlierPrompt';
import { RoundReportDialog } from '../RoundReportDialog';
import type { Participant, Vote, VotingRound } from '@/lib/types';

afterEach(cleanup);

const person = (id: string, role: Participant['role'], globalRole?: string): Participant =>
  ({ id, roomId: 'r', nickname: id, role, globalRole, isFacilitator: false }) as unknown as Participant;
const vote = (participantId: string, value: string, extra: Partial<Vote> = {}): Vote =>
  ({ id: participantId, participantId, roomId: 'r', value, timestamp: '', ...extra }) as Vote;

describe('OutlierPrompt: cargo por extenso', () => {
  const people = [person('Ana', 'dev', 'Developer'), person('Caio', 'dev', 'Desenvolvedor(a)'), person('Tati', 'organizador', 'Tech Lead')];

  it('mostra o cargo de quem votou mais baixo e mais alto', () => {
    render(<OutlierPrompt votes={[vote('Ana', '2'), vote('Caio', '13')]} participants={people} deck="hours" />);
    expect(screen.getByText('Votou mais baixo · Desenvolvedor(a)')).toBeTruthy();
    expect(screen.getByText('Votou mais alto · Desenvolvedor(a)')).toBeTruthy();
  });

  it('quem não vota na sala não vira extremo', () => {
    render(<OutlierPrompt votes={[vote('Ana', '2'), vote('Caio', '3'), vote('Tati', '40')]} participants={people} deck="hours" />);
    expect(screen.queryByText(/Tati/)).toBeNull();
    expect(screen.getByText('Votou mais alto · Desenvolvedor(a)')).toBeTruthy();
  });
});

describe('RoundReportDialog: cargo por extenso', () => {
  const round = {
    topic: 'Login',
    deckType: 'fibonacci',
    stats: { avg: '5', min: '3', max: '8', consensus: false },
    votes: [vote('Ana', '3'), vote('Sam', '8'), vote('gone', '5', { participantNickname: 'Gui', participantGlobalRole: 'Analista de QA' })],
  } as unknown as VotingRound;

  it('lista o cargo da administração ou "Sem cargo", não a categoria', () => {
    render(<RoundReportDialog round={round} onClose={vi.fn()} participants={[person('Ana', 'dev', 'Developer'), person('Sam', 'dev')]} />);
    expect(screen.getByText('Desenvolvedor(a)')).toBeTruthy();
    expect(screen.getAllByText('Sem cargo').length).toBeGreaterThan(0);
    expect(screen.queryByText('DEV')).toBeNull();
    // Quem já saiu da sala mostra o cargo congelado no voto.
    expect(screen.getByText('Analista de QA')).toBeTruthy();
  });
});
