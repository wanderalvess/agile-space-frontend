import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../feedback-widget', () => ({ FeedbackWidget: () => null }));
const getLatestRelease = vi.fn();
vi.mock('../../../services/changelogApi', () => ({ changelogApi: { getLatestRelease: (...a: unknown[]) => getLatestRelease(...a) } }));

import { AppFooter } from '../AppFooter';
import { clearAuthToken, setAuthToken } from '../../../lib/auth-client';
import { RUNNING_TAG, resetNewVersionForTests, seenKey } from '../../../lib/new-version';

const jwtFor = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;

beforeEach(() => {
  pathname = '/';
  localStorage.clear();
  sessionStorage.clear();
  resetNewVersionForTests();
  getLatestRelease.mockReset();
  getLatestRelease.mockResolvedValue({ tag: 'v999.0.0' });
});
afterEach(() => clearAuthToken());

describe('aviso de nova versão no rodapé', () => {
  it('visitante sem sessão: nem ponto nem aviso, e nada é consultado', async () => {
    render(<AppFooter />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('versions-dot')).toBeNull();
    expect(getLatestRelease).not.toHaveBeenCalled();
  });

  it('primeira visita da pessoa: só registra a versão, sem avisar', async () => {
    setAuthToken(jwtFor('u1'));
    render(<AppFooter />);
    await waitFor(() => expect(getLatestRelease).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('versions-dot')).toBeNull();
    expect(localStorage.getItem(seenKey('u1'))).toBe('v999.0.0');
  });

  it('já em dia: sem aviso', async () => {
    setAuthToken(jwtFor('u1'));
    localStorage.setItem(seenKey('u1'), 'v999.0.0');
    render(<AppFooter />);
    await waitFor(() => expect(getLatestRelease).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('versão nova', () => {
    beforeEach(() => {
      setAuthToken(jwtFor('u1'));
      localStorage.setItem(seenKey('u1'), RUNNING_TAG);
    });

    it('mostra o ponto no item Versões e o aviso curto', async () => {
      render(<AppFooter />);
      expect(await screen.findByText('Nova versão v999.0.0: veja o que mudou')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Versões, há uma versão nova' })).toBeTruthy();
      expect(screen.getByTestId('versions-dot')).toBeTruthy();
    });

    it('"Agora não" some com o aviso, mas o ponto fica; não volta na página seguinte', async () => {
      const { unmount } = render(<AppFooter />);
      await screen.findByText(/Nova versão v999\.0\.0/);
      fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
      expect(screen.queryByText(/Nova versão v999\.0\.0/)).toBeNull();
      expect(screen.getByTestId('versions-dot')).toBeTruthy();
      unmount();
      render(<AppFooter />);
      await waitFor(() => expect(screen.getByTestId('versions-dot')).toBeTruthy());
      expect(screen.queryByText(/Nova versão v999\.0\.0/)).toBeNull();
    });

    it('"Ver o que mudou" leva às Versões e marca como lido', async () => {
      render(<AppFooter />);
      const link = await screen.findByRole('link', { name: 'Ver o que mudou' });
      expect(link.getAttribute('href')).toBe('/changelog');
      fireEvent.click(link);
      expect(localStorage.getItem(seenKey('u1'))).toBe('v999.0.0');
      expect(screen.queryByTestId('versions-dot')).toBeNull();
      expect(screen.queryByText(/Nova versão v999\.0\.0/)).toBeNull();
    });

    it('na própria página Versões o aviso não aparece (o ponto sim)', async () => {
      pathname = '/changelog';
      render(<AppFooter />);
      await waitFor(() => expect(screen.getByTestId('versions-dot')).toBeTruthy());
      expect(screen.queryByText(/Nova versão v999\.0\.0/)).toBeNull();
    });

    it('falha do servidor não derruba o rodapé', async () => {
      getLatestRelease.mockRejectedValue(new Error('fora do ar'));
      render(<AppFooter />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole('link', { name: 'Versões' })).toBeTruthy();
    });
  });
});
