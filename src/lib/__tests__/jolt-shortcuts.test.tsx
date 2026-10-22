import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchShortcut, SHORTCUT_LABEL } from '../jolt-shortcuts';
import { useJoltShortcuts } from '../../components/jolt/useJoltShortcuts';

const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

describe('matchShortcut', () => {
  it('Ctrl+Enter executa e Ctrl+S salva (também com Cmd)', () => {
    expect(matchShortcut(key('Enter', { ctrlKey: true }))).toBe('executar');
    expect(matchShortcut(key('Enter', { metaKey: true }))).toBe('executar');
    expect(matchShortcut(key('s', { ctrlKey: true }))).toBe('salvar');
    expect(matchShortcut(key('S', { ctrlKey: true }))).toBe('salvar');
  });

  it('sem Ctrl/Cmd, ou com Alt/Shift junto, não é atalho', () => {
    expect(matchShortcut(key('Enter'))).toBeNull();
    expect(matchShortcut(key('s'))).toBeNull();
    expect(matchShortcut(key('s', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchShortcut(key('Enter', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(matchShortcut(key('a', { ctrlKey: true }))).toBeNull();
  });

  it('os rótulos mostrados nos botões são os atalhos reais', () => {
    expect(SHORTCUT_LABEL).toEqual({ executar: 'Ctrl+Enter', salvar: 'Ctrl+S' });
  });
});

describe('useJoltShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Ctrl+Enter executa, Ctrl+S salva e impede o "Salvar página" do navegador', () => {
    const executar = vi.fn();
    const salvar = vi.fn();
    renderHook(() => useJoltShortcuts({ executar, salvar }));

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(executar).toHaveBeenCalledTimes(1);

    const notPrevented = fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false); // preventDefault foi chamado
  });

  it('usa sempre a função mais recente (sem ficar com a antiga)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useJoltShortcuts({ executar: fn, salvar: vi.fn() }), { initialProps: { fn: first } });
    rerender({ fn: second });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('com uma janela aberta por cima, os atalhos ficam quietos (mas o Ctrl+S continua sem salvar a página)', () => {
    const executar = vi.fn();
    const salvar = vi.fn();
    renderHook(() => useJoltShortcuts({ executar, salvar }));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    const notPrevented = fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(executar).not.toHaveBeenCalled();
    expect(salvar).not.toHaveBeenCalled();
    expect(notPrevented).toBe(false);
  });

  it('tecla segurada (repeat) não executa de novo', () => {
    const executar = vi.fn();
    renderHook(() => useJoltShortcuts({ executar, salvar: vi.fn() }));
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, repeat: true });
    expect(executar).toHaveBeenCalledTimes(1);
  });
});
