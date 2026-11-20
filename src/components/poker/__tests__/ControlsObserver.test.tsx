import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Controls } from '../Controls';
import type { Participant } from '@/lib/types';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
afterEach(cleanup);

const user = (role: Participant['role'], globalRole?: string) =>
  ({ id: 'u', roomId: 'r', nickname: 'Eu', role, globalRole, isFacilitator: true }) as unknown as Participant;

function renderControls(currentUser: Participant, extra: Partial<React.ComponentProps<typeof Controls>> = {}) {
  return render(<Controls deck="fibonacci" onVote={vi.fn()} currentUserVote={null} votesRevealed={false} currentUser={currentUser} {...extra} />);
}

describe('Controls: baralho só para quem vota', () => {
  it('cargo de desenvolvimento recebe o baralho', () => {
    renderControls(user('dev', 'Developer'));
    expect(screen.getByRole('region', { name: 'Seu voto' })).toBeTruthy();
  });

  it('cargo que não vota: sem baralho, aviso de observador com o motivo', () => {
    renderControls(user('organizador', 'Tech Lead'));
    expect(screen.queryByRole('region', { name: 'Seu voto' })).toBeNull();
    expect(screen.getByText('Você acompanha como observador')).toBeTruthy();
    expect(screen.getByText('O cargo Tech Lead não vota nesta sala.')).toBeTruthy();
  });

  it('sem cargo: observador, sem botão para votar', () => {
    renderControls(user('dev'), { onAllowMyCargoVote: vi.fn() });
    expect(screen.getByText('Você está sem cargo na administração, por isso entra como observador.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Votar também/ })).toBeNull();
  });

  it('facilitador pode incluir o próprio cargo em "Quem vota" pelo atalho', () => {
    const onAllow = vi.fn();
    renderControls(user('organizador', 'Tech Lead'), { onAllowMyCargoVote: onAllow });
    fireEvent.click(screen.getByRole('button', { name: 'Votar também (Tech Lead)' }));
    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it('cargo incluído em "Quem vota" recebe o baralho', () => {
    renderControls(user('organizador', 'Tech Lead'), { votingCargos: ['Developer', 'Tech Lead'] });
    expect(screen.getByRole('region', { name: 'Seu voto' })).toBeTruthy();
  });

  it('espectador marcado pelo facilitador não vota nem com o cargo na lista', () => {
    renderControls(user('spectator', 'Developer'), { onAllowMyCargoVote: vi.fn() });
    expect(screen.queryByRole('region', { name: 'Seu voto' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Votar também/ })).toBeNull();
  });
});
