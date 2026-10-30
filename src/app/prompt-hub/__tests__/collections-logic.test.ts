import { describe, expect, it } from 'vitest';
import type { PromptCollectionDTO } from '../api';
import { collectionSaveBlock, filterCollections, moveInList, toCollectionView } from '../collections-logic';
import type { PromptItem } from '../types';

const item = (id: string, over: Partial<PromptItem> = {}): PromptItem => ({
  id,
  title: id,
  type: 'prompt',
  visibility: 'public',
  authorId: 'a',
  authorName: 'Ana',
  authorRole: '',
  authorSquad: '',
  useCount: 0,
  forkCount: 0,
  tags: [],
  createdAt: '',
  ...over,
});

const dto = (over: Partial<PromptCollectionDTO> = {}): PromptCollectionDTO => ({
  id: 'c1',
  name: 'Trilha',
  visibility: 'public',
  ownerId: 'dona',
  ownerName: 'Dona',
  createdAt: '2026-01-01T00:00:00Z',
  items: [item('1'), item('2', { visibility: 'private', authorId: 'b' }), item('3', { visibility: 'private', authorId: 'me' })],
  ...over,
});

describe('coleções', () => {
  it('conta os itens que a pessoa não pode ver e mostra só os visíveis', () => {
    const v = toCollectionView(dto(), 'me');
    expect(v.visible.map(i => i.id)).toEqual(['1', '3']);
    expect(v.hidden).toBe(1);
    expect(v.total).toBe(3);
    expect(v.canManage).toBe(false);
  });

  it('não inventa data de atualização', () => {
    expect(toCollectionView(dto(), 'me').collection.updatedAt).toBeUndefined();
    expect(toCollectionView(dto({ updatedAt: '2026-02-02T00:00:00Z' }), 'me').collection.updatedAt).toBe('2026-02-02T00:00:00Z');
  });

  it('dona gerencia; administradora (canEdit) gerencia e mostra o selo; outra pessoa não', () => {
    expect(toCollectionView(dto(), 'dona')).toMatchObject({ canManage: true, adminOverride: false });
    expect(toCollectionView(dto({ canEdit: true }), 'me')).toMatchObject({ canManage: true, adminOverride: true });
    expect(toCollectionView(dto({ canEdit: false }), 'dona').canManage).toBe(false);
  });

  it('usa hiddenCount e itemCount do servidor quando vêm', () => {
    const v = toCollectionView(dto({ hiddenCount: 4, itemCount: 9 }), 'me');
    expect(v.hidden).toBe(4);
    expect(v.total).toBe(9);
  });

  it('reordena sem alterar a lista original', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveInList(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInList(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveInList(list, 1, 1)).toEqual(list);
    expect(moveInList(list, 0, 9)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('exige nome e ao menos um item para salvar', () => {
    expect(collectionSaveBlock('', ['1'])).toMatch(/nome/);
    expect(collectionSaveBlock('Trilha', [])).toMatch(/pelo menos 1 item/);
    expect(collectionSaveBlock('Trilha', ['1'])).toBe('');
  });

  it('filtra por texto e por Minhas / Públicas / Privadas', () => {
    const views = [
      toCollectionView(dto({ id: 'c1', name: 'Refinamento', ownerId: 'me' }), 'me'),
      toCollectionView(dto({ id: 'c2', name: 'Testes', visibility: 'private', ownerId: 'me' }), 'me'),
      toCollectionView(dto({ id: 'c3', name: 'Suporte', ownerId: 'outra' }), 'me'),
    ];
    expect(filterCollections(views, 'refinamento', 'todas', 'me').map(v => v.collection.id)).toEqual(['c1']);
    expect(filterCollections(views, '', 'minhas', 'me').map(v => v.collection.id)).toEqual(['c1', 'c2']);
    expect(filterCollections(views, '', 'privadas', 'me').map(v => v.collection.id)).toEqual(['c2']);
    expect(filterCollections(views, '', 'publicas', 'me').map(v => v.collection.id)).toEqual(['c1', 'c3']);
  });
});
