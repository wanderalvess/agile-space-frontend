import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResponseProgress } from '../HealthResponseProgress';

afterEach(cleanup);

const counts = (responded: number, participants: number) => ({ responded, participants, completed: null });

describe('ResponseProgress: aviso de quem falta', () => {
  it('lista vazia com 0 de 2 respondidas não diz que todos votaram', () => {
    render(<ResponseProgress counts={counts(0, 2)} pending={[]} />);
    expect(screen.queryByText(/já votaram/)).toBeNull();
    expect(screen.getByText('Ninguém respondeu ainda.')).toBeTruthy();
  });

  it('com resposta e ninguém pendente diz que todos votaram', () => {
    render(<ResponseProgress counts={counts(2, 2)} pending={[]} />);
    expect(screen.getByText('Todas as pessoas da sala já votaram.')).toBeTruthy();
  });
});
