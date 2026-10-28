import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VotingCargosField, isDefaultVotingCargos } from '../VotingCargosField';
import { DEFAULT_VOTING_CARGOS } from '@/lib/poker-utils';

afterEach(cleanup);

/** Campo controlado como as telas o usam: o valor volta pelo onChange. */
function Harness({ initial = [...DEFAULT_VOTING_CARGOS], spy }: { initial?: string[]; spy?: (v: string[]) => void }) {
  const [value, setValue] = useState<string[]>(initial);
  return <VotingCargosField value={value} onChange={(v) => { spy?.(v); setValue(v); }} idPrefix="t" />;
}

describe('VotingCargosField: "Quem vota"', () => {
  it('nasce com o padrão marcado (dev e QA) e os demais cargos desmarcados', () => {
    render(<Harness />);
    for (const c of ['Developer', 'Desenvolvedor(a)', 'QA', 'Analista de QA']) {
      expect((screen.getByRole('checkbox', { name: c }) as HTMLInputElement).checked).toBe(true);
    }
    for (const c of ['Tech Lead', 'Product Owner', 'Scrum Master', 'Designer', 'UX']) {
      expect((screen.getByRole('checkbox', { name: c }) as HTMLInputElement).checked).toBe(false);
    }
  });

  it('usa os cargos da administração, sem o cargo que sempre entra como espectador', () => {
    render(<Harness />);
    expect(screen.queryByRole('checkbox', { name: 'Stakeholder / Observador' })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(14);
  });

  it('explica o que acontece com os demais e com quem está sem cargo', () => {
    render(<Harness />);
    expect(screen.getByText('Os demais cargos entram como observadores. Quem está sem cargo na administração também entra como observador.')).toBeTruthy();
  });

  it('marca e desmarca um cargo', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tech Lead' }));
    expect(spy).toHaveBeenLastCalledWith([...DEFAULT_VOTING_CARGOS, 'Tech Lead']);
    expect((screen.getByRole('checkbox', { name: 'Tech Lead' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tech Lead' }));
    expect(spy).toHaveBeenLastCalledWith([...DEFAULT_VOTING_CARGOS]);
    expect((screen.getByRole('checkbox', { name: 'Tech Lead' }) as HTMLInputElement).checked).toBe(false);
  });

  it('nunca deixa a sala sem nenhum cargo votando', () => {
    const spy = vi.fn();
    render(<Harness initial={['QA']} spy={spy} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'QA' }));
    expect(spy).not.toHaveBeenCalled();
    expect((screen.getByRole('checkbox', { name: 'QA' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Deixe ao menos um cargo votando.');
  });

  it('"Restaurar padrão" só aparece quando a lista foge do padrão e volta a ele', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.queryByRole('button', { name: 'Restaurar padrão' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Designer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }));
    expect(spy).toHaveBeenLastCalledWith([...DEFAULT_VOTING_CARGOS]);
    expect(screen.queryByRole('button', { name: 'Restaurar padrão' })).toBeNull();
  });

  it('alvos de 44 px no celular', () => {
    render(<Harness />);
    const chip = screen.getByRole('checkbox', { name: 'QA' }).closest('label')!;
    expect(chip.className).toContain('min-h-11');
  });

  it('isDefaultVotingCargos ignora ordem e caixa', () => {
    expect(isDefaultVotingCargos(['analista de qa', 'QA', 'Desenvolvedor(a)', 'Developer'])).toBe(true);
    expect(isDefaultVotingCargos(['QA'])).toBe(false);
    expect(isDefaultVotingCargos([...DEFAULT_VOTING_CARGOS, 'Tech Lead'])).toBe(false);
  });
});
