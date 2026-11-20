import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UserLinksCell } from '../UserLinksCell';

afterEach(() => cleanup());

describe('UserLinksCell (coluna Squad)', () => {
  it('antes de carregar não mostra a squad ativa: oferece "Ver vínculos" e pede ao passar o mouse', () => {
    const onLoad = vi.fn();
    render(<UserLinksCell name="Ana" activeSquadId="DDW" state={undefined} onLoad={onLoad} />);
    expect(screen.getByText('Ver vínculos')).toBeTruthy();
    expect(screen.queryByText('DDW')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Vínculos de Ana' }));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('carregando: mostra o estado e não pede de novo', () => {
    const onLoad = vi.fn();
    render(<UserLinksCell name="Ana" state="loading" onLoad={onLoad} />);
    expect(screen.getByText('Carregando…')).toBeTruthy();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Vínculos de Ana' }));
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('com vínculos mostra squad · papel do principal e +N dos demais', () => {
    render(
      <UserLinksCell
        name="Ana"
        state={[{ squadId: 'DDW', role: 'Agile Master' }, { squadId: 'ATL', role: 'Developer' }, { squadId: 'XYZ' }]}
        onLoad={vi.fn()}
      />,
    );
    expect(screen.getByText('DDW · Agile Master')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('um vínculo só: sem contagem', () => {
    render(<UserLinksCell name="Ana" state={[{ squadId: 'DDW', role: 'QA' }]} onLoad={vi.fn()} />);
    expect(screen.getByText('DDW · QA')).toBeTruthy();
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it('lista vazia: "Sem vínculo" (não confunde com a squad ativa) e erro: "Tentar de novo"', () => {
    const { unmount } = render(<UserLinksCell name="Ana" activeSquadId="DDW" state={[]} onLoad={vi.fn()} />);
    expect(screen.getByText('Sem vínculo')).toBeTruthy();
    unmount();
    const onLoad = vi.fn();
    render(<UserLinksCell name="Ana" state={null} onLoad={onLoad} />);
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
