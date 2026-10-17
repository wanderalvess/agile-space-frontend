import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSystemConfig: vi.fn() }));
vi.mock('../../app/admin/api', () => ({ publicApi: { getSystemConfig: mocks.getSystemConfig } }));

import { SystemConfigProvider, useSystemConfig } from '../SystemConfigContext';

function Probe() {
  const { config, isLoading } = useSystemConfig();
  return <output data-loading={isLoading}>{JSON.stringify(config)}</output>;
}

const renderProvider = () =>
  render(
    <SystemConfigProvider>
      <Probe />
    </SystemConfigProvider>,
  );

const loaded = async () => {
  await waitFor(() => expect(screen.getByRole('status').getAttribute('data-loading')).toBe('false'));
  return JSON.parse(screen.getByRole('status').textContent ?? '');
};

beforeEach(() => {
  mocks.getSystemConfig.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(cleanup);

describe('SystemConfigProvider', () => {
  it('guarda só nome da empresa e cor primária; chaves antigas do servidor são ignoradas', async () => {
    mocks.getSystemConfig.mockResolvedValue({
      companyName: 'TOTVS Tech',
      primaryColor: '#123456',
      logoUrl: 'https://x/logo.png',
      allowAnonymous: 'false',
      maintenanceMode: 'true',
    });
    renderProvider();
    expect(await loaded()).toEqual({ companyName: 'TOTVS Tech', primaryColor: '#123456' });
  });

  it('sem resposta do servidor, usa os padrões', async () => {
    mocks.getSystemConfig.mockRejectedValue(new Error('offline'));
    renderProvider();
    expect(await loaded()).toEqual({ companyName: 'Portal Tech V&D', primaryColor: '' });
  });
});
