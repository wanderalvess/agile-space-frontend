import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddRetroCard } from '../AddRetroCard';

const base = { columnKey: 'good', isActionColumn: false, participants: [], variant: 'field' as const };

describe('AddRetroCard: rascunho', () => {
  beforeEach(() => window.localStorage.clear());

  it('o texto digitado e não enviado volta depois de recarregar (por retro e coluna)', () => {
    const first = render(<AddRetroCard {...base} onAddCard={vi.fn()} draftKey="r1:good" />);
    fireEvent.change(screen.getByLabelText('Escreva seu feedback'), { target: { value: 'rascunho' } });
    first.unmount();
    render(<AddRetroCard {...base} onAddCard={vi.fn()} draftKey="r1:good" />);
    expect((screen.getByLabelText('Escreva seu feedback') as HTMLTextAreaElement).value).toBe('rascunho');
  });

  it('outra coluna ou outra retro não herda o rascunho', () => {
    window.localStorage.setItem('retro-draft:r1:good', 'x');
    render(<AddRetroCard {...base} onAddCard={vi.fn()} draftKey="r1:bad" />);
    expect((screen.getByLabelText('Escreva seu feedback') as HTMLTextAreaElement).value).toBe('');
  });

  it('enviar limpa o rascunho', async () => {
    window.localStorage.setItem('retro-draft:r1:good', 'enviar');
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<AddRetroCard {...base} onAddCard={onAdd} draftKey="r1:good" />);
    fireEvent.click(screen.getByLabelText('Adicionar cartão'));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    await waitFor(() => expect(window.localStorage.getItem('retro-draft:r1:good')).toBeNull());
  });
});
