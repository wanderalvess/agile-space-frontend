import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { IdeaCard, type IdeaCardProps } from '../IdeaCard';
import { IdeaViewProvider, type IdeaViewValue } from '../brainstorm-context';
import type { BrainstormingIdea } from '../../../lib/types';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
});
afterEach(cleanup);

const idea = (over: Partial<BrainstormingIdea> = {}): BrainstormingIdea => ({
  id: 'i1', boardId: 'b1', content: 'Checklist interativo no primeiro acesso', authorId: 'ana', votes: [], position: { x: 0, y: 0 },
  parentId: null, groupId: null, createdAt: '2026-10-13T00:00:00Z', ...over,
});

const names = new Map([['ana', 'Ana Ribeiro'], ['me', 'Wanderson Silva']]);

function setup(card: BrainstormingIdea, ctx: Partial<IdeaViewValue> = {}, props: Partial<IdeaCardProps> = {}) {
  const handlers = { onVote: vi.fn(), onUpdate: vi.fn(async () => true), onDelete: vi.fn(), onStartMerge: vi.fn(), onMerge: vi.fn() };
  const value: IdeaViewValue = { currentUserId: 'me', isFacilitator: false, anonymous: false, revealed: true, names, ...ctx };
  const view = render(
    <IdeaViewProvider value={value}>
      <IdeaCard idea={card} {...handlers} {...props} />
    </IdeaViewProvider>
  );
  return { ...view, handlers };
}

describe('cartão de ideia: autor', () => {
  it('mostra o primeiro nome de quem lançou', () => {
    setup(idea());
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('as próprias ideias são "Você"', () => {
    setup(idea({ authorId: 'me' }));
    expect(screen.getByText('Você')).toBeTruthy();
  });

  it('com autores anônimos aparece "Anônimo", e a própria ideia continua "Você"', () => {
    const { unmount } = setup(idea({ authorId: null }), { anonymous: true });
    expect(screen.getByText('Anônimo')).toBeTruthy();
    unmount();
    setup(idea({ authorId: 'me' }), { anonymous: true });
    expect(screen.getByText('Você')).toBeTruthy();
  });

  it('"Participante" só quando o nome não é conhecido', () => {
    setup(idea({ authorId: 'saiu-da-sala' }));
    expect(screen.getByText('Participante')).toBeTruthy();
  });
});

describe('cartão de ideia: voto e destaque', () => {
  it('vota e marca "Remover meu voto" quando já votou', () => {
    const { handlers, rerender } = setup(idea({ votes: ['x'] }));
    const vote = screen.getByRole('button', { name: 'Votar nesta ideia' });
    expect(vote.getAttribute('aria-pressed')).toBe('false');
    expect(vote.textContent).toBe('1');
    fireEvent.click(vote);
    expect(handlers.onVote).toHaveBeenCalledWith('i1');
    rerender(
      <IdeaViewProvider value={{ currentUserId: 'me', isFacilitator: false, anonymous: false, revealed: true, names }}>
        <IdeaCard idea={idea({ votes: ['x', 'me'] })} onVote={handlers.onVote} />
      </IdeaViewProvider>
    );
    expect(screen.getByRole('button', { name: 'Remover meu voto' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('"Em alta" a partir de três votos', () => {
    const { unmount } = setup(idea({ votes: ['a', 'b'] }));
    expect(screen.queryByText('Em alta')).toBeNull();
    unmount();
    setup(idea({ votes: ['a', 'b', 'c'] }));
    expect(screen.getByText('Em alta')).toBeTruthy();
  });

  it('texto longo corta em três linhas e abre com "Ver mais"', () => {
    setup(idea({ content: 'palavra '.repeat(40) }));
    const more = screen.getByRole('button', { name: 'Ver mais' });
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: 'Ver menos' })).toBeTruthy();
  });
});

describe('cartão de ideia: ações', () => {
  it('qualquer pessoa edita qualquer ideia; o cartão só sai da edição se salvou', async () => {
    const { handlers } = setup(idea());
    fireEvent.click(screen.getByRole('button', { name: 'Editar a ideia' }));
    const box = screen.getByLabelText('Texto da ideia') as HTMLTextAreaElement;
    expect(box.value).toBe('Checklist interativo no primeiro acesso');
    fireEvent.change(box, { target: { value: 'Checklist com progresso salvo' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(handlers.onUpdate).toHaveBeenCalledWith('i1', 'Checklist com progresso salvo'));
    await waitFor(() => expect(screen.queryByLabelText('Texto da ideia')).toBeNull());
  });

  it('se não salvou, o cartão continua em edição e o texto digitado não se perde', async () => {
    const onUpdate = vi.fn(async () => false);
    setup(idea(), {}, { onUpdate });
    fireEvent.click(screen.getByRole('button', { name: 'Editar a ideia' }));
    fireEvent.change(screen.getByLabelText('Texto da ideia'), { target: { value: 'novo texto' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect((screen.getByLabelText('Texto da ideia') as HTMLTextAreaElement).value).toBe('novo texto');
  });

  it('cancelar a edição volta ao texto', () => {
    setup(idea());
    fireEvent.click(screen.getByRole('button', { name: 'Editar a ideia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Texto da ideia')).toBeNull();
    expect(screen.getByText('Checklist interativo no primeiro acesso')).toBeTruthy();
  });

  it('só o autor e o facilitador veem o botão de excluir', () => {
    const { unmount } = setup(idea({ authorId: 'ana' }));
    expect(screen.queryByRole('button', { name: 'Excluir a ideia' })).toBeNull();
    unmount();

    const own = setup(idea({ authorId: 'me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a ideia' }));
    expect(own.handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
    own.unmount();

    setup(idea({ authorId: 'ana' }), { isFacilitator: true });
    expect(screen.getByRole('button', { name: 'Excluir a ideia' })).toBeTruthy();
  });

  it('a etapa decide quais ações existem: sem onUpdate e sem juntar não há editar nem juntar', () => {
    setup(idea(), {}, { onUpdate: undefined, onStartMerge: undefined, onDelete: undefined });
    expect(screen.queryByRole('button', { name: 'Editar a ideia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Juntar com outra ideia' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Votar nesta ideia' })).toBeTruthy();
  });

  it('fusão: escolhe a origem e depois o destino', () => {
    const { handlers, unmount } = setup(idea());
    fireEvent.click(screen.getByRole('button', { name: 'Juntar com outra ideia' }));
    expect(handlers.onStartMerge).toHaveBeenCalledWith('i1');
    unmount();

    const target = setup(idea({ id: 'i2' }), {}, { canMerge: true });
    expect(screen.getByText('Juntar aqui')).toBeTruthy();
    fireEvent.click(screen.getByText('Checklist interativo no primeiro acesso'));
    expect(target.handlers.onMerge).toHaveBeenCalledWith('i2');
    target.unmount();

    setup(idea(), {}, { isMergingSource: true });
    expect(screen.getByText('Será juntada')).toBeTruthy();
  });

  it('ideia coberta não tem voto, edição, fusão nem exclusão', () => {
    setup(idea({ hidden: true, content: '', authorId: null }), { isFacilitator: false });
    expect(screen.getByText('Ideia oculta')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
