import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendHealthGatekeeper } from '../BackendHealthGatekeeper';

describe('BackendHealthGatekeeper', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não mostra a tela de indisponível quando o backend responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<BackendHealthGatekeeper><p>conteudo</p></BackendHealthGatekeeper>);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('conteudo')).toBeTruthy();
    expect(screen.queryByText('Tentar Novamente')).toBeNull();
  });

  it('mostra a tela com tokens e refaz a checagem ao tentar novamente', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    render(<BackendHealthGatekeeper><p>conteudo</p></BackendHealthGatekeeper>);
    const btn = await screen.findByRole('button', { name: /Tentar Novamente/ });
    expect(btn.className).not.toMatch(/slate|font-black|uppercase/);
    const before = f.mock.calls.length;
    fireEvent.click(btn);
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThan(before));
  });
});
