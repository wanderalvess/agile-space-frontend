import { describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  favoritesKey,
  readFavorites,
  readRecents,
  recentsKey,
  relativeWhen,
  toggleId,
  withRecent,
  writeFavorites,
  writeRecents,
} from '../preferences';
import { buildHubView, networkTools, parseHubTab, searchTools, tabCounts } from '../hub';
import { DEVTOOLS } from '../registry';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

const broken = {
  getItem: () => { throw new Error('bloqueado'); },
  setItem: () => { throw new Error('cheio'); },
};

describe('favoritas e recentes', () => {
  it('guardam por usuário, em chaves separadas', () => {
    const s = fakeStorage();
    expect(writeFavorites('u1', ['jwt-inspector'], s)).toBe(true);
    expect(writeFavorites('u2', ['cep'], s)).toBe(true);
    expect(readFavorites('u1', s)).toEqual(['jwt-inspector']);
    expect(readFavorites('u2', s)).toEqual(['cep']);
    expect(favoritesKey('u1')).not.toBe(favoritesKey('u2'));
    expect(recentsKey('u1')).not.toBe(favoritesKey('u1'));
  });

  it('o toggle liga e desliga', () => {
    expect(toggleId([], 'cep')).toEqual(['cep']);
    expect(toggleId(['cep', 'diff'], 'cep')).toEqual(['diff']);
  });

  it('descarta ids que não existem mais (ferramentas fundidas ou removidas) e lixo no storage', () => {
    const s = fakeStorage({
      [favoritesKey('u')]: JSON.stringify(['json', 'mocks', 'cep', 'cep', 42]),
      [recentsKey('u')]: JSON.stringify([{ id: 'base64', at: 1 }, { id: 'cep', at: 'x' }, { id: 'cep', at: 5 }, null]),
    });
    expect(readFavorites('u', s)).toEqual(['cep']);
    expect(readRecents('u', s)).toEqual([{ id: 'cep', at: 5 }]);
    expect(readFavorites('u', fakeStorage({ [favoritesKey('u')]: '{quebrado' }))).toEqual([]);
  });

  it('recentes: a mais nova vai ao topo, sem repetir, no limite', () => {
    let list = withRecent([], 'cep', 1);
    list = withRecent(list, 'diff', 2);
    list = withRecent(list, 'cep', 3);
    expect(list).toEqual([{ id: 'cep', at: 3 }, { id: 'diff', at: 2 }]);
    let big = [] as ReturnType<typeof withRecent>;
    DEVTOOLS.slice(0, MAX_RECENTS + 4).forEach((t, i) => { big = withRecent(big, t.id, i); });
    expect(big).toHaveLength(MAX_RECENTS);
  });

  it('com o localStorage falhando nada quebra', () => {
    expect(readFavorites('u', broken)).toEqual([]);
    expect(readRecents('u', broken)).toEqual([]);
    expect(writeFavorites('u', ['cep'], broken)).toBe(false);
    expect(writeRecents('u', [{ id: 'cep', at: 1 }], broken)).toBe(false);
    expect(readFavorites('u', null)).toEqual([]);
    expect(writeFavorites('u', ['cep'], null)).toBe(false);
  });

  it('relativeWhen: hoje com hora, ontem e há N dias', () => {
    const now = new Date(2026, 9, 20, 15, 0).getTime();
    expect(relativeWhen(new Date(2026, 9, 20, 9, 12).getTime(), now)).toBe('hoje, 09:12');
    expect(relativeWhen(new Date(2026, 9, 19, 23, 50).getTime(), now)).toBe('ontem');
    expect(relativeWhen(new Date(2026, 9, 17, 10, 0).getTime(), now)).toBe('há 3 dias');
  });
});

describe('hub', () => {
  const now = new Date(2026, 9, 20, 15, 0).getTime();
  const base = { query: '', favorites: [] as string[], recents: [] as { id: string; at: number }[], now };

  it('parseHubTab aceita só valores conhecidos', () => {
    expect(parseHubTab('qualidade')).toBe('qualidade');
    expect(parseHubTab('texto')).toBe('texto');
    expect(parseHubTab('nada')).toBe('todas');
    expect(parseHubTab(null)).toBe('todas');
  });

  it('aba Todas: uma seção por grupo e a dica de favoritar quando não há favoritas', () => {
    const v = buildHubView({ ...base, tab: 'todas' });
    expect(v.sections.map((s) => s.id)).toEqual(['dados', 'codificacao', 'texto', 'rede', 'testes']);
    expect(v.hintFavorite).toBe(true);
    expect(v.sections.reduce((n, s) => n + s.cards.length, 0)).toBe(25);
  });

  it('aba Todas: Favoritas e Recentes (limite de 4) no topo', () => {
    const recents = ['cep', 'diff', 'jwt-inspector', 'regex-lab', 'uuid-generator', 'fuzz'].map((id, i) => ({ id, at: now - i * 3_600_000 }));
    const v = buildHubView({ ...base, tab: 'todas', favorites: ['cep'], recents });
    expect(v.sections.slice(0, 2).map((s) => s.id)).toEqual(['favoritas', 'recentes']);
    expect(v.sections[1].cards).toHaveLength(4);
    expect(v.sections[1].cards[0].foot).toMatch(/^hoje, /);
    expect(v.hintFavorite).toBe(false);
  });

  it('o filtro Qualidade lista as 12 ferramentas com o grupo no rodapé', () => {
    const v = buildHubView({ ...base, tab: 'qualidade' });
    expect(v.sections).toHaveLength(1);
    expect(v.sections[0].cards).toHaveLength(12);
    expect(v.sections[0].cards[0].foot).not.toBe('');
  });

  it('Favoritas e Recentes vazias mostram o estado vazio; com dados, só a seção', () => {
    expect(buildHubView({ ...base, tab: 'favoritas' }).empty).toBe('favoritas');
    expect(buildHubView({ ...base, tab: 'recentes' }).empty).toBe('recentes');
    expect(buildHubView({ ...base, tab: 'favoritas', favorites: ['cep'] }).sections[0].cards).toHaveLength(1);
    expect(buildHubView({ ...base, tab: 'recentes', recents: [{ id: 'cep', at: now }] }).sections[0].cards).toHaveLength(1);
  });

  it('a busca ignora acento e caixa, cruza nome, descrição e palavras-chave e vence a aba', () => {
    expect(searchTools('JSON').map((t) => t.id)).toContain('data-studio');
    expect(searchTools('endereco').map((t) => t.id)).toContain('cep');
    expect(searchTools('planilha 3d')).toEqual([]);
    const v = buildHubView({ ...base, tab: 'rede', query: 'jwt' });
    expect(v.sections).toHaveLength(1);
    expect(v.sections[0].cards.map((c) => c.tool.id)).toEqual(['jwt-inspector']);
    expect(buildHubView({ ...base, tab: 'todas', query: 'planilha 3d' }).empty).toBe('busca');
  });

  it('as rotas antigas ainda acham a ferramenta nova pela busca (json, base64, mocks)', () => {
    expect(searchTools('base64').map((t) => t.id)).toContain('encoding');
    expect(searchTools('contrato').map((t) => t.id)).toContain('diff');
    expect(searchTools('cnpj').map((t) => t.id)).toContain('test-data');
  });

  it('contagens das pílulas', () => {
    const c = tabCounts(['cep', 'fantasma'], [{ id: 'diff', at: 1 }]);
    expect(c).toMatchObject({ todas: 25, dados: 3, codificacao: 4, texto: 8, rede: 4, testes: 6, qualidade: 12, favoritas: 1, recentes: 1 });
  });

  it('o Guia lista as ferramentas que usam rede', () => {
    expect(networkTools().map((t) => t.id).sort()).toEqual(['api-client', 'cep', 'ip-analyzer', 'junit-generator', 'zephyr']);
  });
});
