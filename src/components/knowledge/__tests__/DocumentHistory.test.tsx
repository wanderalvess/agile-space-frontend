import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../app/knowledge/api', () => ({
  knowledgeApi: {
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    restoreVersion: vi.fn(),
  },
}));

import { DocumentHistory } from '../DocumentHistory';
import { knowledgeApi } from '../../../app/knowledge/api';

const api = knowledgeApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const versions = [
  { versionNumber: 2, title: 'Guia', changedBy: 'u1', changedByName: 'Ana', changedAt: '2026-10-10T12:00:00Z', current: true },
  { versionNumber: 1, title: 'Guia', changedBy: 'u2', changedByName: 'Bruno', changedAt: '2026-10-09T12:00:00Z', current: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.listVersions.mockResolvedValue(versions);
  api.getVersion.mockImplementation(async (_id: string, n: number) => ({
    ...versions.find(v => v.versionNumber === n), content: n === 1 ? '<p>antigo</p><img src=x onerror=alert(1)>' : '<p>atual</p>',
  }));
});

describe('DocumentHistory', () => {
  it('lista quem alterou e marca a versão atual', async () => {
    render(<DocumentHistory documentId="d1" canEdit onRestored={() => {}} />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('Bruno')).toBeTruthy();
    expect(screen.getByText('Atual')).toBeTruthy();
  });

  it('sem permissão não mostra o botão de restaurar', async () => {
    render(<DocumentHistory documentId="d1" canEdit={false} onRestored={() => {}} />);
    fireEvent.click(await screen.findByText('Bruno'));
    await screen.findByText(/Versão 1 ·/);
    expect(screen.queryByText(/Restaurar esta versão/)).toBeNull();
  });

  it('restaurar pede confirmação e só chama o servidor depois', async () => {
    const restored = { id: 'd1', title: 'Guia', content: 'antigo' };
    api.restoreVersion.mockResolvedValue(restored);
    const onRestored = vi.fn();
    render(<DocumentHistory documentId="d1" canEdit onRestored={onRestored} />);
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(await screen.findByText(/Restaurar esta versão/));
    expect(api.restoreVersion).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(api.restoreVersion).toHaveBeenCalledWith('d1', 1));
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(restored));
  });

  it('mostra erro com opção de tentar de novo quando o histórico não carrega', async () => {
    api.listVersions.mockRejectedValueOnce(new Error('Falha ao carregar o histórico'));
    render(<DocumentHistory documentId="d1" canEdit onRestored={() => {}} />);
    expect(await screen.findByText('Falha ao carregar o histórico')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });

  it('o conteúdo da versão é sanitizado (sem onerror)', async () => {
    const { container } = render(<DocumentHistory documentId="d1" canEdit onRestored={() => {}} />);
    fireEvent.click(await screen.findByText('Bruno'));
    await screen.findByText('antigo');
    expect(container.innerHTML).not.toContain('onerror');
  });
});
