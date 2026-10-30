import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '@/lib/types';
import { FinishSessionDialog } from '../PokerDialogs';

afterEach(cleanup);

const issue = (over: Partial<Issue>): Issue => ({ id: Math.random().toString(36), title: 'Tarefa', status: 'pending', ...over } as Issue);

const issues = [
  issue({ id: 'a', key: 'DDW-1', status: 'completed' }),
  issue({ id: 'b', key: 'DDW-2', status: 'completed' }),
  issue({ id: 'c', key: 'DDW-3', title: 'Sobrou na fila' }),
];

describe('Encerrar a sessão', () => {
  it('com estimadas fora do Jira, a escolha é explícita: sem enviar ou enviar N', () => {
    const onConfirm = vi.fn();
    const onConfirmAndSend = vi.fn();
    render(<FinishSessionDialog open onOpenChange={() => {}} issues={issues} rounds={[]} onConfirm={onConfirm} jira={{ sent: 0, pending: 2, onConfirmAndSend }} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sem enviar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirmAndSend).not.toHaveBeenCalled();
  });

  it('"Encerrar e enviar" chama o envio (que também encerra)', () => {
    const onConfirmAndSend = vi.fn();
    render(<FinishSessionDialog open onOpenChange={() => {}} issues={issues} rounds={[]} onConfirm={vi.fn()} jira={{ sent: 1, pending: 2, onConfirmAndSend }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e enviar 2 ao Jira' }));
    expect(onConfirmAndSend).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/1 de 3 estimadas já estão no Jira/)).toBeTruthy();
  });

  it('sem nada para o Jira fica só "Encerrar e gerar relatório", e mostra o que não foi abordado', () => {
    render(<FinishSessionDialog open onOpenChange={() => {}} issues={issues} rounds={[]} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Encerrar e gerar relatório' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /enviar/i })).toBeNull();
    expect(screen.getByText('Sobrou na fila')).toBeTruthy();
  });
});
