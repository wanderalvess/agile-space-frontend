import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmTrashDialog, type TrashTarget } from '../ConfirmTrashDialog';

afterEach(() => cleanup());

function setup(target: TrashTarget | null, loading = false) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<ConfirmTrashDialog target={target} loading={loading} onCancel={onCancel} onConfirm={onConfirm} />);
  return { onCancel, onConfirm };
}

describe('ConfirmTrashDialog', () => {
  it('fechado quando não há alvo', () => {
    setup(null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('um artigo: mostra o título e a frase de restauração, sem window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    setup({ kind: 'single', id: 'a1', title: 'API de Pedidos' });
    const dialog = screen.getByRole('alertdialog');
    expect(screen.getByText('Mover para a lixeira?')).toBeTruthy();
    expect(dialog.textContent).toContain('“API de Pedidos” vai para a lixeira.');
    expect(dialog.textContent).toContain('Você pode restaurar depois na lixeira.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mover para a lixeira' })).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('em lote: diz quantos artigos', () => {
    setup({ kind: 'batch', ids: ['a', 'b', 'c'] });
    expect(screen.getByRole('alertdialog').textContent).toContain('3 artigos vão para a lixeira.');
  });

  it('Mover chama onConfirm; Cancelar chama onCancel', () => {
    const { onConfirm, onCancel } = setup({ kind: 'single', id: 'a1', title: 'X' });
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc cancela', () => {
    const { onCancel } = setup({ kind: 'single', id: 'a1', title: 'X' });
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('carregando: trava os dois botões, troca o rótulo e Esc não fecha', () => {
    const { onCancel, onConfirm } = setup({ kind: 'single', id: 'a1', title: 'X' }, true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    const confirm = screen.getByRole('button', { name: 'Movendo…' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
