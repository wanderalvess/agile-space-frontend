import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BentoDashboard } from '../BentoDashboard';

const old = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
const recent = new Date(Date.now() - 30 * 60_000).toISOString();

function renderWith(history: any[]) {
  return render(
    <BentoDashboard
      tasks={[]}
      history={history}
      notes={[]}
      userProfile={null}
      onNavigate={() => {}}
      onAddTask={() => {}}
      onAddNote={() => {}}
    />,
  );
}

describe('BentoDashboard — status das sessões recentes', () => {
  it('poker, retro e radar encerrados aparecem como Concluída, nunca "Ao vivo"', () => {
    renderWith([
      { id: 'p1', type: 'poker', title: 'Refinamento 41', createdAt: old, sessionStartedAt: old, sessionEndedAt: old },
      { id: 'r1', type: 'retro', title: 'Retro 41', createdAt: old, votingStatus: 'finished' },
      { id: 'h1', type: 'health', title: 'Radar 40', createdAt: old, status: 'finished' },
    ]);
    expect(screen.getAllByText('Concluída')).toHaveLength(3);
    expect(screen.queryByText(/ao vivo/i)).toBeNull();
  });

  it('só a sessão realmente em andamento aparece "Ao vivo"; radar coletando é Assíncrona', () => {
    renderWith([
      { id: 'p2', type: 'poker', title: 'Refinamento 42', createdAt: recent, sessionStartedAt: recent },
      { id: 'h2', type: 'health', title: 'Radar 41', createdAt: old, status: 'collecting' },
      { id: 'r2', type: 'retro', title: 'Retro antiga', createdAt: old, votingStatus: 'disabled' },
    ]);
    expect(screen.getAllByText('Ao vivo')).toHaveLength(1);
    expect(screen.getByText('Assíncrona')).toBeTruthy();
    expect(screen.getByText('Concluída')).toBeTruthy();
  });
});
