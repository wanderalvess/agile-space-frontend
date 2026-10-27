import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_VARIANTS } from '@/lib/theme-options';

const h = vi.hoisted(() => ({ setMode: vi.fn(), setVariant: vi.fn(), mode: 'light', variant: 'default' }));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: h.mode, resolvedMode: 'light', variant: h.variant, setMode: h.setMode, setVariant: h.setVariant }),
}));

import { ThemeSettings } from '../ThemeSettings';

describe('ThemeSettings compact', () => {
  beforeEach(() => {
    h.setMode.mockClear();
    h.setVariant.mockClear();
    h.mode = 'light';
    h.variant = 'default';
  });

  it('modo: três opções, a atual marcada, e aplica na hora', () => {
    render(<ThemeSettings idPrefix="t" compact />);
    const group = screen.getByRole('radiogroup', { name: 'Modo' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Claro', 'Escuro', 'Sistema']);
    expect(within(group).getByRole('radio', { name: 'Claro' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Escuro' }));
    expect(h.setMode).toHaveBeenCalledWith('dark');
  });

  it('tema: um chip por tema com o nome real, o atual marcado, e aplica na hora', () => {
    render(<ThemeSettings idPrefix="t" compact />);
    const group = screen.getByRole('radiogroup', { name: 'Tema' });
    expect(within(group).getAllByRole('radio')).toHaveLength(THEME_VARIANTS.length);
    expect(within(group).getByRole('radio', { name: 'Espaço Clássico' }).getAttribute('aria-checked')).toBe('true');
    expect(within(group).getByRole('radio', { name: 'Corporativo' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(within(group).getByRole('radio', { name: 'Corporativo' }));
    expect(h.setVariant).toHaveBeenCalledWith('totvs');
  });

  it('com quantidade ímpar de temas, o último ocupa as duas colunas', () => {
    render(<ThemeSettings idPrefix="t" compact />);
    const radios = within(screen.getByRole('radiogroup', { name: 'Tema' })).getAllByRole('radio');
    expect(radios[radios.length - 1].className).toContain('col-span-2');
    expect(radios[0].className).not.toContain('col-span-2');
  });

  it('sem compact mantém os cartões com pré-visualização', () => {
    const { container } = render(<ThemeSettings idPrefix="t" />);
    expect(container.querySelectorAll('[class*="h-[76px]"]').length).toBe(THEME_VARIANTS.length);
  });
});
