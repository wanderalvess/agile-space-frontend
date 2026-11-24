import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RevoteControl } from '../RevoteMenu';

// O menu do Radix não abre no jsdom: o mesmo menu simulado dos outros testes do projeto.
vi.mock('@/components/ui/dropdown-menu', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-menu>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button role="menuitem" onClick={() => onClick?.()}>{children}</button>
    ),
  };
});

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
afterEach(cleanup);

const handlers = () => ({ onRevoteAll: vi.fn(), onSelectiveRevote: vi.fn() });

describe('RevoteControl: Revotar junto do Salvar, no cabeçalho', () => {
  it('antes de revelar o botão fica desligado e diz por quê', () => {
    const h = handlers();
    render(<RevoteControl mode="disabled" presentCategories={['Developer', 'QA']} {...h} />);
    const button = screen.getByRole('button', { name: /Revotar/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toBe('Disponível depois de revelar os votos');
    fireEvent.click(button);
    expect(h.onRevoteAll).not.toHaveBeenCalled();
  });

  it('com resultado, o botão grande revota todos', () => {
    const h = handlers();
    render(<RevoteControl mode="enabled" presentCategories={['Developer', 'QA']} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revotar' }));
    expect(h.onRevoteAll).toHaveBeenCalledTimes(1);
    expect(h.onSelectiveRevote).not.toHaveBeenCalled();
  });

  it('a seta abre as opções e "só um papel" revota aquela categoria', () => {
    const h = handlers();
    render(<RevoteControl mode="enabled" presentCategories={['Developer', 'QA']} {...h} />);
    expect(screen.getByText('O que revotar')).toBeTruthy();
    expect(screen.getByText('Todos os papéis')).toBeTruthy();
    const onlyRole = screen.getAllByRole('menuitem', { name: /^Só / });
    expect(onlyRole).toHaveLength(2);
    fireEvent.click(onlyRole[0]);
    expect(h.onSelectiveRevote).toHaveBeenLastCalledWith('Developer');
    fireEvent.click(onlyRole[1]);
    expect(h.onSelectiveRevote).toHaveBeenLastCalledWith('QA');
    fireEvent.click(screen.getByRole('menuitem', { name: /Todos os papéis/ }));
    expect(h.onRevoteAll).toHaveBeenCalledTimes(1);
  });

  it('sem papel técnico presente o menu avisa em vez de ficar vazio', () => {
    render(<RevoteControl mode="enabled" presentCategories={[]} {...handlers()} />);
    expect(screen.getByText('Nenhum papel técnico presente')).toBeTruthy();
  });
});
