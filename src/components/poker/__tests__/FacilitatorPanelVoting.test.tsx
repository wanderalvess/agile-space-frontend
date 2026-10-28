import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FacilitatorPanel } from '../FacilitatorPanel';
import { DEFAULT_VOTING_CARGOS, votingCargosOf } from '@/lib/poker-utils';

afterEach(cleanup);

function renderPanel(props: Partial<React.ComponentProps<typeof FacilitatorPanel>> = {}) {
  const onUpdateSettings = vi.fn();
  render(<FacilitatorPanel deck="fibonacci" onUpdateSettings={onUpdateSettings} {...props} />);
  return onUpdateSettings;
}

describe('FacilitatorPanel: "Quem vota"', () => {
  it('troca o interruptor "Gestão pode votar" por "Quem vota", na aba Votação', () => {
    renderPanel();
    expect(screen.queryByText('Gestão pode votar')).toBeNull();
    expect(screen.getByText('Quem vota')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'QA' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Tech Lead' }) as HTMLInputElement).checked).toBe(false);
  });

  it('marcar um cargo aplica na sala em andamento (settings.votingCargos) e não escreve o campo antigo', () => {
    const onUpdateSettings = renderPanel({ votingCargos: DEFAULT_VOTING_CARGOS });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tech Lead' }));
    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    expect(onUpdateSettings).toHaveBeenCalledWith({ votingCargos: [...DEFAULT_VOTING_CARGOS, 'Tech Lead'] });
    expect(JSON.stringify(onUpdateSettings.mock.calls)).not.toContain('allowManagementToVote');
  });

  it('desmarcar um cargo o retira da lista', () => {
    const onUpdateSettings = renderPanel({ votingCargos: ['Developer', 'QA', 'Tech Lead'] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tech Lead' }));
    expect(onUpdateSettings).toHaveBeenCalledWith({ votingCargos: ['Developer', 'QA'] });
  });

  it('sala antiga com "Gestão pode votar" aparece com os cargos de gestão já marcados', () => {
    renderPanel({ votingCargos: votingCargosOf({ allowManagementToVote: true }) });
    expect((screen.getByRole('checkbox', { name: 'Scrum Master' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Product Owner' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Designer' }) as HTMLInputElement).checked).toBe(false);
  });

  it('a busca de ajustes encontra "Quem vota"', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Buscar ajuste'), { target: { value: 'cargo' } });
    expect(screen.getByText('Quem vota')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'QA' })).toBeTruthy();
  });
});
