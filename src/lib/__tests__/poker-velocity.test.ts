import { describe, expect, it } from 'vitest';
import { pickVelocityRoomIds } from '../poker-velocity';

describe('pickVelocityRoomIds', () => {
  it('a sala atual vem primeiro, seguida do histórico da squad na ordem do servidor', () => {
    expect(pickVelocityRoomIds('atual', [{ id: 'a' }, { id: 'b' }])).toEqual(['atual', 'a', 'b']);
  });
  it('não repete a sala atual que também aparece no histórico', () => {
    expect(pickVelocityRoomIds('atual', [{ id: 'a' }, { id: 'atual' }, { id: 'b' }])).toEqual(['atual', 'a', 'b']);
  });
  it('sem histórico (servidor antigo ou falha) mostra só a atual', () => {
    expect(pickVelocityRoomIds('atual', null)).toEqual(['atual']);
    expect(pickVelocityRoomIds('atual', undefined)).toEqual(['atual']);
    expect(pickVelocityRoomIds('atual', [])).toEqual(['atual']);
  });
  it('ignora itens sem id e respeita o limite', () => {
    const history = [{ id: '' }, { id: null }, {}, ...Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` }))];
    const out = pickVelocityRoomIds('atual', history, 4);
    expect(out).toEqual(['atual', 's0', 's1', 's2']);
  });
});
