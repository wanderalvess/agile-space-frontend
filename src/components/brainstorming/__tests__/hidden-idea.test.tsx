import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IdeaCard } from '../IdeaCard';
import { IdeaViewProvider, type IdeaViewValue } from '../brainstorm-context';
import { HIDDEN_IDEA_TEXT, ideaSignature, ideaText } from '../../../lib/brainstorming-utils';
import type { BrainstormingIdea } from '../../../lib/types';

function idea(over: Partial<BrainstormingIdea> = {}): BrainstormingIdea {
  return {
    id: 'i1', boardId: 'b1', content: '', authorId: null, hidden: true, votes: [], position: { x: 0, y: 0 },
    parentId: null, groupId: null, createdAt: '2026-10-13T00:00:00Z', ...over,
  };
}

const view = (over: Partial<IdeaViewValue> = {}): IdeaViewValue => ({
  currentUserId: 'outro', isFacilitator: false, anonymous: false, revealed: true, names: new Map([['eu', 'Wanderson Silva']]), ...over,
});

const render = (card: BrainstormingIdea, ctx: IdeaViewValue) =>
  renderToString(<IdeaViewProvider value={ctx}><IdeaCard idea={card} onVote={() => {}} /></IdeaViewProvider>);

describe('ideia redigida pelo servidor (ideias ocultas)', () => {
  it('o cartão diz "Ideia oculta" e quando ela aparece, sem texto real e sem voto', () => {
    const html = render(idea(), view());
    expect(html).toContain('Ideia oculta');
    expect(html).toContain('O facilitador revela as ideias no fim da escrita.');
    expect(html).not.toContain('Uma ideia anônima está sendo escrita');
    expect(html).not.toContain('Votar nesta ideia');
  });

  it('o autor continua vendo o texto da própria ideia (o servidor não a redige)', () => {
    const html = render(idea({ hidden: undefined, content: 'minha ideia secreta', authorId: 'eu' }), view({ currentUserId: 'eu', revealed: false }));
    expect(html).toContain('minha ideia secreta');
    expect(html).toContain('Você');
  });

  it('o facilitador lê tudo mesmo com as ideias ocultas para a sala', () => {
    const html = render(idea({ hidden: undefined, content: 'ideia de outra pessoa', authorId: 'eu' }), view({ currentUserId: 'fac', isFacilitator: true, revealed: false }));
    expect(html).toContain('ideia de outra pessoa');
    expect(html).toContain('Wanderson');
  });

  it('no intervalo entre o facilitador ocultar e a lista nova chegar, as ideias dos outros já aparecem cobertas', () => {
    const html = render(idea({ hidden: undefined, content: 'ainda não redigida', authorId: 'eu' }), view({ currentUserId: 'outro', revealed: false }));
    expect(html).toContain('Ideia oculta');
    expect(html).not.toContain('ainda não redigida');
  });

  it('ideaText troca o texto vazio pelo aviso só quando a ideia está redigida', () => {
    expect(ideaText(idea())).toBe(HIDDEN_IDEA_TEXT);
    expect(ideaText(idea({ hidden: undefined, content: 'texto' }))).toBe('texto');
  });

  it('a assinatura da teia muda quando a ideia passa de oculta para revelada (atualiza sem recarregar a página)', () => {
    const before = ideaSignature([idea()]);
    const after = ideaSignature([idea({ hidden: undefined, content: 'agora visível' })]);
    expect(before).not.toBe(after);
  });
});
