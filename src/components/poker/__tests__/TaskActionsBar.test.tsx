import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskActionsBar } from '../TaskActionsBar';

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

describe('TaskActionsBar: ações do facilitador à vista', () => {
  it('antes de revelar mostra as três ações com texto, sem menu escondido', () => {
    mk();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Encerrar sessão' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mais ações/i })).toBeNull();
  });

  it('sem adiar o botão continua "Pular", com a dica de pular a tarefa', () => {
    mk({ canPark: false });
    expect(screen.getByRole('button', { name: 'Pular' }).getAttribute('title')).toContain('Pular tarefa');
  });

  it('depois de revelar só resta "Encerrar sessão"', () => {
    mk({ canTakeOffTable: false, canCancel: false });
    expect(screen.getByRole('button', { name: 'Encerrar sessão' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('cancelar desligado esconde só "Cancelar"', () => {
    mk({ canCancel: false });
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeTruthy();
  });

  it('sem nenhuma ação possível não renderiza nada', () => {
    mk({ canTakeOffTable: false, canCancel: false, canFinish: false });
    expect(screen.queryByRole('region', { name: 'Ações do facilitador' })).toBeNull();
  });

  it('cada clique chama o callback certo (abre o diálogo correspondente)', () => {
    const p = mk();
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sessão' }));
    expect(p.onTakeOffTable).toHaveBeenCalledTimes(1);
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(p.onFinish).toHaveBeenCalledTimes(1);
  });

  it('ordem de tab: pular, cancelar e por último encerrar; todos botões reais e focáveis', () => {
    mk();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Pular', 'Cancelar', 'Encerrar sessão']);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('tabindex')).not.toBe('-1');
      expect(b.className).toContain('focus-visible');
    }
  });

  it('mobile: mantém rótulos de texto, quebra em linha e alvo de 44px', () => {
    mk();
    const region = screen.getByRole('region', { name: 'Ações do facilitador' });
    expect(region.className).toContain('flex-wrap');
    for (const name of ['Pular', 'Cancelar', 'Encerrar sessão']) {
      const b = screen.getByRole('button', { name });
      expect(b.textContent?.trim()).toBe(name);
      expect(b.className).toContain('max-sm:h-11');
    }
  });

  it('"Encerrar sessão" fica em grupo próprio, separado de pular e cancelar', () => {
    mk();
    const finish = screen.getByRole('button', { name: 'Encerrar sessão' });
    const group = finish.parentElement as HTMLElement;
    expect(group.contains(screen.getByRole('button', { name: 'Pular' }))).toBe(false);
  });
});
