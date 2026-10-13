import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IdeaCard } from '../IdeaCard';
import { HIDDEN_IDEA_TEXT, ideaSignature, ideaText } from '../../../lib/brainstorming-utils';
import type { BrainstormingIdea } from '../../../lib/types';

function idea(over: Partial<BrainstormingIdea> = {}): BrainstormingIdea {
  return {
    id: 'i1', boardId: 'b1', content: '', authorId: null, hidden: true, votes: [],
    position: { x: 0, y: 0 }, parentId: null, groupId: null, createdAt: '2026-10-13T00:00:00Z', ...over,
  };
}

describe('ideia redigida pelo servidor (ideias ocultas)', () => {
  it('o card mostra o placeholder borrado e nenhum texto real', () => {
    const html = renderToString(<IdeaCard idea={idea()} isRevealed currentUserId="outro" />);
    expect(html).toContain('Uma ideia anônima está sendo escrita');
    expect(html).toContain('blur-sm');
  });

  it('o autor continua vendo o texto da própria ideia (o servidor não a redige)', () => {
    const html = renderToString(
      <IdeaCard idea={idea({ hidden: undefined, content: 'minha ideia secreta', authorId: 'eu' })} isRevealed={false} currentUserId="eu" />,
    );
    expect(html).toContain('minha ideia secreta');
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
