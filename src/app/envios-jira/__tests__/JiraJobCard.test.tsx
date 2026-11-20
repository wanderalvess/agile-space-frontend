import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JiraPublishJob, JiraVerifyResult } from '@/app/room/jira-publish-api';
import { JiraJobCard } from '../JiraJobCard';

const failedJob: JiraPublishJob = {
  id: 'j1', squadId: 'S', roomId: 'room-1', issueId: 'i1', parentKey: 'DDWMISSI-5909',
  parentSummary: 'DDWMISSI-5909 - Apoio Realizado Outubro', requestedBy: 'u1', requestedByName: 'Wanderson', roomTitle: 'Refinamento',
  status: 'ERROR', errorMessage: 'Passo 2 (comentar): sem permissão no Jira (403).', createdAt: '2026-10-31T04:17:46',
  steps: [
    { index: 0, kind: 'RENAME_PARENT', targetKey: 'DDWMISSI-5909', summary: 'DDWMISSI-5909 - Apoio Realizado Outubro (DEV 6h)', status: 'DONE', attempts: 1 },
    { index: 1, kind: 'ADD_COMMENT', targetKey: 'DDWMISSI-5909', comment: 'Apoio docker', status: 'ERROR', errorMessage: 'sem permissão (403)', attempts: 2 },
  ],
};

function setup(over: Partial<React.ComponentProps<typeof JiraJobCard>> = {}) {
  const handlers = { onRetry: vi.fn(), onVerify: vi.fn(), onDiscard: vi.fn(), onToggleLog: vi.fn() };
  render(<ul><JiraJobCard job={failedJob} jiraDomain="jiraproducao.totvs.com.br" logOpen={false} {...handlers} {...over} /></ul>);
  return handlers;
}

describe('JiraJobCard', () => {
  it('mostra o erro, o passo que falhou e as tentativas, e liga a issue ao Jira', () => {
    setup();
    expect(screen.getByText('Erro')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('403');
    expect(screen.getByText('sem permissão (403)')).toBeTruthy();
    expect(screen.getByText('2 tentativas')).toBeTruthy();
    expect(screen.getByText('1/2 passos')).toBeTruthy();
    const link = screen.getByRole('link', { name: /DDWMISSI-5909/ });
    expect(link.getAttribute('href')).toBe('https://jiraproducao.totvs.com.br/browse/DDWMISSI-5909');
    expect(screen.getByText(/por Wanderson/)).toBeTruthy();
  });

  it('dispara tentar novamente, conferir, log e descartar', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Conferir no Jira/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ver log/ }));
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    expect(h.onRetry).toHaveBeenCalledWith(failedJob);
    expect(h.onVerify).toHaveBeenCalledWith(failedJob);
    expect(h.onToggleLog).toHaveBeenCalledWith(failedJob);
    expect(h.onDiscard).toHaveBeenCalledWith(failedJob);
  });

  it('envio concluído não oferece tentar de novo nem descartar', () => {
    setup({ job: { ...failedJob, status: 'DONE', errorMessage: null, steps: failedJob.steps.map(s => ({ ...s, status: 'DONE' })) } });
    expect(screen.getByText('Enviado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Descartar/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Conferir no Jira/ })).toBeTruthy();
  });

  it('envio travado explica e libera tentar de novo', () => {
    setup({ job: { ...failedJob, status: 'RUNNING', stale: true, errorMessage: null } });
    expect(screen.getByText('Travado')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('parou de responder');
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
  });

  it('trava os botões enquanto uma ação está em andamento', () => {
    setup({ busy: 'retry' });
    expect((screen.getByRole('button', { name: /Tentar novamente/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Descartar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('mostra o resultado da conferência por passo', () => {
    const verify: JiraVerifyResult = {
      jobId: 'j1', checkedAt: '2026-10-31T05:00:00', allOk: false, confirmed: 1, total: 1,
      checks: [
        { index: 0, kind: 'RENAME_PARENT', status: 'OK', detail: 'ok' },
        { index: 1, kind: 'ADD_COMMENT', status: 'NOT_SENT', detail: 'Falhou e não foi enviado; use "Tentar novamente".' },
      ],
    };
    setup({ verify });
    expect(screen.getByText('Confirmado no Jira')).toBeTruthy();
    expect(screen.getByText('Não enviado')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1 de 1');
  });

  it('abre o log com horário, mensagem e quem agiu', () => {
    setup({
      logOpen: true,
      log: [{ id: 'e1', action: 'STEP_ERROR', stepPosition: 1, ok: false, message: 'sem permissão (403)', userName: 'Wanderson', createdAt: '2026-10-31T04:17:47' }],
    });
    const region = screen.getByRole('region', { name: 'Log do envio' });
    expect(region.textContent).toContain('Passo com erro (passo 2)');
    expect(region.textContent).toContain('por Wanderson');
  });
});
