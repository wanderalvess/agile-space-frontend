import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskActionsBar } from '../TaskActionsBar';

// Menu simulado (padrão do projeto): o Radix não abre de forma confiável no jsdom; aqui os itens já ficam à mostra.
vi.mock('@/components/ui/dropdown-menu', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-menu>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button role="menuitem" onClick={() => onClick?.()}>{children}</button>
    ),
  };
});

afterEach(cleanup);

const mk = (over: Partial<React.ComponentProps<typeof TaskActionsBar>> = {}) => {
  const props = {
    canTakeOffTable: true,
    canPark: true,
    onTakeOffTable: vi.fn(),
    canCancel: true,
    onCancel: vi.fn(),
    canFinish: true,
    onFinish: vi.fn(),
    ...over,
  };
  render(<TaskActionsBar {...props} />);
  return props;
};

describe('TaskActionsBar: Pular à vista, cancelar e encerrar no menu "Rodada"', () => {
  it('antes de revelar mostra "Pular" e o menu "Rodada"', () => {
    mk();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Rodada/ })).toBeTruthy();
    // Cancelar e encerrar não ficam soltos na barra.
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Encerrar sessão' })).toBeNull();
  });

  it('sem adiar o botão continua "Pular", com a dica de pular a tarefa', () => {
    mk({ canPark: false });
    expect(screen.getByRole('button', { name: 'Pular' }).getAttribute('title')).toContain('Pular tarefa');
  });

  it('o menu traz cancelar a tarefa e encerrar a sessão, e cada um chama o callback certo', () => {
    const p = mk();
    fireEvent.click(screen.getByRole('menuitem', { name: /Cancelar tarefa/ }));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar sessão/ }));
    expect(p.onFinish).toHaveBeenCalledTimes(1);
  });

  it('depois de revelar some o "Pular" e o menu só encerra', () => {
    mk({ canTakeOffTable: false, canCancel: false });
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Encerrar sessão/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Cancelar tarefa/ })).toBeNull();
  });

  it('sem nenhuma ação possível não renderiza nada', () => {
    mk({ canTakeOffTable: false, canCancel: false, canFinish: false });
    expect(screen.queryByRole('region', { name: 'Ações do facilitador' })).toBeNull();
  });

  it('"Pular" chama o callback de tirar da mesa', () => {
    const p = mk();
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(p.onTakeOffTable).toHaveBeenCalledTimes(1);
  });

  it('botões reais e focáveis, com alvo de 44px no celular', () => {
    mk();
    for (const b of [screen.getByRole('button', { name: 'Pular' }), screen.getByRole('button', { name: /^Rodada/ })]) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('tabindex')).not.toBe('-1');
      expect(b.className).toContain('max-sm:h-11');
    }
  });
});
