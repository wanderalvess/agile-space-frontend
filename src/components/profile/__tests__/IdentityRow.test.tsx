import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Plug } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { IdentityRow } from '../IdentityRow';

function Harness() {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((c) => (c === id ? null : id));
  return (
    <div>
      {['a', 'b'].map((id) => (
        <IdentityRow key={id} id={id} icon={Plug} label={`Linha ${id}`} value="valor" actionLabel="Abrir" open={open === id} onToggle={() => toggle(id)}>
          <button type="button">dentro {id}</button>
        </IdentityRow>
      ))}
    </div>
  );
}

describe('IdentityRow', () => {
  it('fechada: botão com aria-expanded=false e sem conteúdo', () => {
    render(<Harness />);
    const btn = screen.getByRole('button', { name: 'Abrir, Linha a' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBeNull();
    expect(screen.queryByText('dentro a')).toBeNull();
  });

  it('abrir expande a linha, liga aria-controls, vira "Fechar" e leva o foco ao painel', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir, Linha a' }));
    const btn = screen.getByRole('button', { name: 'Fechar, Linha a' });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const region = screen.getByRole('region', { name: 'Linha a' });
    expect(btn.getAttribute('aria-controls')).toBe(region.id);
    expect(document.activeElement).toBe(region);
    expect(screen.getByText('dentro a')).toBeTruthy();
  });

  it('uma linha aberta por vez', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir, Linha a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir, Linha b' }));
    expect(screen.queryByText('dentro a')).toBeNull();
    expect(screen.getByText('dentro b')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir, Linha a' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('fechar com o foco dentro devolve o foco ao botão da linha', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir, Linha a' }));
    screen.getByText('dentro a').focus();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar, Linha a' }));
    expect(screen.queryByText('dentro a')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir, Linha a' }));
  });
});
