import { describe, expect, it } from 'vitest';
import { PALETTE_ITEMS, paletteItemsOf, paletteSearchValue } from '../palette-items';
import { paletteFilter, searchWorkspace } from '../CommandPalette';
import { parseWorkspaceLocation, workspaceHref } from '../workspace-nav';

describe('itens da paleta', () => {
  it('não tem "Daily Helper" (abria uma aba que não existe)', () => {
    expect(PALETTE_ITEMS.some((i) => /daily/i.test(i.label))).toBe(false);
  });

  it('todo item de navegação leva a uma aba que existe', () => {
    for (const item of PALETTE_ITEMS) {
      if (item.run.type !== 'nav') continue;
      const url = new URL(workspaceHref(item.run.loc), 'http://x');
      const parsed = parseWorkspaceLocation(url.searchParams);
      expect(parsed.aba).toBe(item.run.loc.aba);
      if (item.run.loc.sub) expect(parsed.sub).toBe(item.run.loc.sub);
    }
  });

  it('traz os itens do board e o Painel da squad aponta para /squad', () => {
    const labels = PALETTE_ITEMS.map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['Meus Atalhos', 'Conectividade e chaves de API', 'Novo Atalho', 'Buscar tarefas e notas', 'Painel da squad']));
    const squad = PALETTE_ITEMS.find((i) => i.label === 'Painel da squad');
    expect(squad?.run).toEqual({ type: 'href', href: '/squad' });
  });

  it('agrupa em Navegação, Ações rápidas e Portal Tech V&D', () => {
    expect(paletteItemsOf('Navegação').length).toBeGreaterThanOrEqual(6);
    expect(paletteItemsOf('Ações rápidas')).toHaveLength(5);
    expect(paletteItemsOf('Portal Tech V&D').length).toBeGreaterThanOrEqual(2);
  });

  it('o valor de busca junta rótulo e palavras extras', () => {
    expect(paletteSearchValue({ label: 'Meus Atalhos', keywords: ['links'] })).toBe('Meus Atalhos links');
  });
});

describe('busca de tarefas e notas', () => {
  const tasks = [
    { id: '1', title: 'Revisar glossário do Jolt', description: 'termos em inglês', status: 'todo', priority: 'media', tag: 'Manual', updatedAt: '' },
    { id: '2', title: 'Preparar review', status: 'todo', priority: 'alta', tag: 'Manual', updatedAt: '' },
  ] as never[];
  const notes = [{ id: 'n1', content: 'Checklist de deploy', color: '', updatedAt: '' }] as never[];

  it('exige 2 letras e ignora acento e caixa', () => {
    expect(searchWorkspace('r', tasks, notes)).toEqual({ tasks: [], notes: [] });
    expect(searchWorkspace('GLOSSARIO', tasks, notes).tasks).toHaveLength(1);
    expect(searchWorkspace('ingles', tasks, notes).tasks).toHaveLength(1);
    expect(searchWorkspace('deploy', tasks, notes).notes).toHaveLength(1);
    expect(searchWorkspace('zzz', tasks, notes)).toEqual({ tasks: [], notes: [] });
  });
});

describe('filtro da paleta', () => {
  it('acha sem acento e sem caixa, com várias palavras em qualquer ordem', () => {
    expect(paletteFilter('Histórico de Sessões', 'historico')).toBe(1);
    expect(paletteFilter('Histórico de Sessões', 'sessoes hist')).toBe(1);
    expect(paletteFilter('Histórico de Sessões', 'kanban')).toBe(0);
    expect(paletteFilter('Meus Atalhos', 'links', ['links'])).toBe(1);
    expect(paletteFilter('Quadro Kanban', '')).toBe(1);
  });
});
