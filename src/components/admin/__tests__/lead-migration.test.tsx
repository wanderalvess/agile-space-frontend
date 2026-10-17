import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { LeadDemotionReport, LeadUser } from '../../../lib/lead-demotion-api';

const runLeadDemotion = vi.fn();
const restoreLeadLevel = vi.fn();

vi.mock('../../../lib/lead-demotion-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/lead-demotion-api')>('../../../lib/lead-demotion-api');
  return { ...actual, runLeadDemotion: (...a: unknown[]) => runLeadDemotion(...a), restoreLeadLevel: (...a: unknown[]) => restoreLeadLevel(...a) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LeadDemotionApiError } from '../../../lib/lead-demotion-api';
import { LeadMigrationPanel } from '../LeadMigrationPanel';
import { actionLabel, appliedMessage, restoredMessage, rosterHref, safeToDemote, withoutLeadership } from '../lead-migration';

const ana: LeadUser = {
  userId: 'uid-1', email: 'ana@totvs.com.br', name: 'Ana', active: true, classification: 'HAS_LEADERSHIP_LINK',
  leadershipSquads: ['DDWMISSI'], action: 'WOULD_DEMOTE', activeApiKeys: 2, apiKeysNote: null,
};
const bia: LeadUser = {
  userId: 'uid-2', email: 'bia@totvs.com.br', name: 'Bia', active: true, classification: 'NO_LEADERSHIP_LINK',
  leadershipSquads: [], action: 'KEPT_NO_LEADERSHIP_LINK', activeApiKeys: 0, apiKeysNote: null,
};

function report(over: Partial<LeadDemotionReport> = {}, users: LeadUser[] = [ana, bia]): LeadDemotionReport {
  const has = users.filter((u) => u.classification === 'HAS_LEADERSHIP_LINK').length;
  return {
    mode: 'DRY_RUN', leadLevel: 'off', limit: 20, warnings: [], users,
    summary: { leadUsers: users.length, hasLeadershipLink: has, noLeadershipLink: users.length - has, wouldDemote: has, demoted: 0, keptNoLeadershipLink: users.length - has, overLimit: 0 },
    ...over,
  };
}

beforeEach(() => {
  runLeadDemotion.mockReset();
  restoreLeadLevel.mockReset();
});
afterEach(() => cleanup());

describe('helpers da migração', () => {
  it('separa quem pode rebaixar de quem ficaria sem liderança', () => {
    const r = report();
    expect(safeToDemote(r).map((u) => u.userId)).toEqual(['uid-1']);
    expect(withoutLeadership(r).map((u) => u.userId)).toEqual(['uid-2']);
    expect(safeToDemote(null)).toEqual([]);
  });

  it('rótulos de ação e mensagens', () => {
    expect(actionLabel('WOULD_DEMOTE')?.label).toBe('Pode rebaixar');
    expect(actionLabel('DEMOTED_FORCED')?.tone).toBe('warn');
    expect(actionLabel('ALGO_NOVO')).toBeNull();
    expect(appliedMessage(report({ summary: { ...report().summary, demoted: 1 } }))).toBe('1 conta virou Membro.');
    expect(appliedMessage(report({ summary: { ...report().summary, demoted: 3, overLimit: 2 } }))).toBe('3 contas viraram Membro. 2 contas ficaram para o próximo lote.');
    expect(appliedMessage(report())).toBe('Nenhuma conta foi rebaixada.');
    expect(restoredMessage({ restored: 2, skipped: 1, users: [] })).toBe('2 contas voltaram ao nível LEAD. 1 conta ignorada.');
    expect(restoredMessage({ restored: 0, skipped: 0, users: [] })).toBe('Nada para restaurar.');
    expect(rosterHref('DDW X')).toBe('/squad/roster?squadId=DDW%20X');
    expect(rosterHref('')).toBeNull();
  });
});

describe('LeadMigrationPanel', () => {
  it('backend antigo (404): o painel não aparece', async () => {
    runLeadDemotion.mockRejectedValue(new LeadDemotionApiError('Not Found', 404));
    const { container } = render(<LeadMigrationPanel />);
    expect(screen.getByText(/Verificando o nível LEAD/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Verificando o nível LEAD/)).toBeNull());
    expect(container.textContent).toBe('');
  });

  it('sem contas LEAD: o painel não aparece', async () => {
    runLeadDemotion.mockResolvedValue(report({}, []));
    const { container } = render(<LeadMigrationPanel />);
    await waitFor(() => expect(screen.queryByText(/Verificando o nível LEAD/)).toBeNull());
    expect(container.textContent).toBe('');
  });

  it('erro (não 404): mostra o erro e deixa tentar de novo', async () => {
    runLeadDemotion.mockRejectedValueOnce(new LeadDemotionApiError('Você não tem permissão para esta ação.', 403));
    runLeadDemotion.mockResolvedValueOnce(report());
    render(<LeadMigrationPanel />);
    expect(await screen.findByText('Você não tem permissão para esta ação.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText('Migração do nível LEAD')).toBeTruthy();
  });

  it('lista com a classificação, explica quem ficaria sem liderança e usa a simulação (nunca apply) ao abrir', async () => {
    runLeadDemotion.mockResolvedValue(report());
    render(<LeadMigrationPanel squadOfUser={(id) => (id === 'uid-2' ? 'DDWPRIME' : undefined)} />);
    expect(await screen.findByText('Migração do nível LEAD')).toBeTruthy();
    expect(runLeadDemotion).toHaveBeenCalledTimes(1);
    expect(runLeadDemotion.mock.calls[0]).toEqual([]);
    expect(screen.getByText('Tem vínculo de liderança')).toBeTruthy();
    expect(screen.getByText('Sem liderança por vínculo')).toBeTruthy();
    expect(screen.getByText(/Ficaria sem liderança em nenhuma squad/)).toBeTruthy();
    expect(screen.getByText(/Lidera DDWMISSI/)).toBeTruthy();
    expect(screen.getByText(/2 chaves de API ativas/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Adicionar vínculo' }).getAttribute('href')).toBe('/squad/roster?squadId=DDWPRIME');
    expect(screen.getByRole('button', { name: /Rebaixar os seguros \(1\)/ })).toBeTruthy();
  });

  it('Simular roda o dry-run de novo sem gravar', async () => {
    runLeadDemotion.mockResolvedValue(report());
    render(<LeadMigrationPanel />);
    await screen.findByText('Migração do nível LEAD');
    fireEvent.click(screen.getByRole('button', { name: /Simular/ }));
    await waitFor(() => expect(runLeadDemotion).toHaveBeenCalledTimes(2));
    expect(runLeadDemotion.mock.calls[1]).toEqual([]);
  });

  it('Rebaixar os seguros pede confirmação, avisa das chaves de API e aplica o lote (apply=true)', async () => {
    const onChanged = vi.fn();
    runLeadDemotion.mockResolvedValueOnce(report());
    render(<LeadMigrationPanel onChanged={onChanged} />);
    await screen.findByText('Migração do nível LEAD');

    fireEvent.click(screen.getByRole('button', { name: /Rebaixar os seguros/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Rebaixar 1 conta para Membro?')).toBeTruthy();
    expect(within(dialog).getByText(/continuam válidas até serem renovadas/)).toBeTruthy();
    expect(within(dialog).getByText('Ana')).toBeTruthy();
    expect(runLeadDemotion).toHaveBeenCalledTimes(1); // nada aplicado antes de confirmar

    runLeadDemotion.mockResolvedValueOnce(report({ mode: 'APPLIED', summary: { ...report().summary, demoted: 1, wouldDemote: 0 } }));
    runLeadDemotion.mockResolvedValueOnce(report({}, [bia]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rebaixar 1 conta' }));

    await waitFor(() => expect(runLeadDemotion).toHaveBeenCalledTimes(3));
    expect(runLeadDemotion.mock.calls[1][0]).toEqual({ apply: true, limit: 20 });
    expect(runLeadDemotion.mock.calls[2]).toEqual([]); // recarrega a simulação depois
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByText('1 conta virou Membro.')).toBeTruthy();
  });

  it('Rebaixar mesmo assim exige confirmação reforçada e manda userId + forceDemote', async () => {
    runLeadDemotion.mockResolvedValueOnce(report());
    render(<LeadMigrationPanel />);
    await screen.findByText('Migração do nível LEAD');

    fireEvent.click(screen.getByRole('button', { name: 'Rebaixar mesmo assim' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/não tem liderança em nenhuma squad/)).toBeTruthy();
    const confirm = within(dialog).getByRole('button', { name: 'Rebaixar mesmo assim' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(confirm.disabled).toBe(false);

    runLeadDemotion.mockResolvedValueOnce(report({ mode: 'APPLIED', summary: { ...report().summary, demoted: 1 } }, [bia]));
    runLeadDemotion.mockResolvedValueOnce(report({}, [ana]));
    fireEvent.click(confirm);
    await waitFor(() => expect(runLeadDemotion).toHaveBeenCalledTimes(3));
    expect(runLeadDemotion.mock.calls[1][0]).toEqual({ apply: true, limit: undefined, userId: 'uid-2', forceDemote: true });
  });

  it('Restaurar pede confirmação e chama lead-restore', async () => {
    runLeadDemotion.mockResolvedValue(report());
    restoreLeadLevel.mockResolvedValue({ restored: 1, skipped: 0, users: [] });
    render(<LeadMigrationPanel />);
    await screen.findByText('Migração do nível LEAD');
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(restoreLeadLevel).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(restoreLeadLevel).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('1 conta voltou ao nível LEAD.')).toBeTruthy();
  });

  it('depois de rebaixar tudo o painel continua (para Restaurar) com o estado vazio', async () => {
    runLeadDemotion.mockResolvedValueOnce(report({}, [ana]));
    render(<LeadMigrationPanel />);
    await screen.findByText('Migração do nível LEAD');
    fireEvent.click(screen.getByRole('button', { name: /Rebaixar os seguros/ }));
    const dialog = await screen.findByRole('alertdialog');
    runLeadDemotion.mockResolvedValueOnce(report({ mode: 'APPLIED', summary: { ...report().summary, demoted: 1 } }, [ana]));
    runLeadDemotion.mockResolvedValueOnce(report({}, []));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rebaixar 1 conta' }));
    expect(await screen.findByText('Nenhuma conta com o nível LEAD.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rebaixar os seguros/ })?.hasAttribute('disabled')).toBe(true);
  });

  it('lead-level=legacy: mostra o aviso do servidor', async () => {
    runLeadDemotion.mockResolvedValue(report({ leadLevel: 'legacy', warnings: ['app.membership.lead-level=legacy: rebaixar agora REMOVE o acesso global destas contas.'] }));
    render(<LeadMigrationPanel />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/REMOVE o acesso global/)).toBeTruthy();
  });
});
