import { describe, expect, it } from 'vitest';
import { locationFromLegacyId, parseWorkspaceLocation, workspaceHref } from '../workspace-nav';

const q = (s: string) => new URLSearchParams(s);

describe('parseWorkspaceLocation', () => {
  it('sem parâmetros cai em Início', () => {
    expect(parseWorkspaceLocation(q(''))).toEqual({ aba: 'inicio' });
    expect(parseWorkspaceLocation(null)).toEqual({ aba: 'inicio' });
  });

  it('lê as 6 abas novas por ?aba=', () => {
    for (const aba of ['inicio', 'kanban', 'notas', 'historico']) {
      expect(parseWorkspaceLocation(q(`aba=${aba}`))).toEqual({ aba });
    }
    expect(parseWorkspaceLocation(q('aba=biblioteca'))).toEqual({ aba: 'biblioteca', sub: 'atalhos' });
    expect(parseWorkspaceLocation(q('aba=conta'))).toEqual({ aba: 'conta', sub: 'perfil' });
  });

  it('aceita subabas válidas e ignora as que não pertencem à aba', () => {
    expect(parseWorkspaceLocation(q('aba=biblioteca&sub=snippets'))).toEqual({ aba: 'biblioteca', sub: 'snippets' });
    expect(parseWorkspaceLocation(q('aba=conta&sub=conectividade'))).toEqual({ aba: 'conta', sub: 'conectividade' });
    expect(parseWorkspaceLocation(q('aba=biblioteca&sub=perfil'))).toEqual({ aba: 'biblioteca', sub: 'atalhos' });
    expect(parseWorkspaceLocation(q('aba=kanban&sub=prompts'))).toEqual({ aba: 'kanban' });
  });

  it('links antigos ?tab= levam ao mesmo conteúdo nas abas novas', () => {
    expect(parseWorkspaceLocation(q('tab=atalhos'))).toEqual({ aba: 'biblioteca', sub: 'atalhos' });
    expect(parseWorkspaceLocation(q('tab=links'))).toEqual({ aba: 'biblioteca', sub: 'atalhos' });
    expect(parseWorkspaceLocation(q('tab=prompts'))).toEqual({ aba: 'biblioteca', sub: 'prompts' });
    expect(parseWorkspaceLocation(q('tab=snippets'))).toEqual({ aba: 'biblioteca', sub: 'snippets' });
    expect(parseWorkspaceLocation(q('tab=perfil'))).toEqual({ aba: 'conta', sub: 'perfil' });
    expect(parseWorkspaceLocation(q('tab=profile'))).toEqual({ aba: 'conta', sub: 'perfil' });
    expect(parseWorkspaceLocation(q('tab=conectividade'))).toEqual({ aba: 'conta', sub: 'conectividade' });
    expect(parseWorkspaceLocation(q('tab=connectivity'))).toEqual({ aba: 'conta', sub: 'conectividade' });
    expect(parseWorkspaceLocation(q('tab=home'))).toEqual({ aba: 'inicio' });
    expect(parseWorkspaceLocation(q('tab=notes'))).toEqual({ aba: 'notas' });
    expect(parseWorkspaceLocation(q('tab=history'))).toEqual({ aba: 'historico' });
    expect(parseWorkspaceLocation(q('tab=kanban'))).toEqual({ aba: 'kanban' });
  });

  it('?aba= vence ?tab= e valores desconhecidos caem em Início', () => {
    expect(parseWorkspaceLocation(q('aba=notas&tab=kanban'))).toEqual({ aba: 'notas' });
    expect(parseWorkspaceLocation(q('aba=nada'))).toEqual({ aba: 'inicio' });
    expect(parseWorkspaceLocation(q('tab=daily'))).toEqual({ aba: 'inicio' });
  });

  it('ignora caixa e acento (Histórico, HISTORICO)', () => {
    expect(parseWorkspaceLocation(q('aba=Histórico'))).toEqual({ aba: 'historico' });
    expect(parseWorkspaceLocation(q('aba=KANBAN'))).toEqual({ aba: 'kanban' });
  });
});

describe('workspaceHref', () => {
  it('Início fica no endereço puro', () => {
    expect(workspaceHref('inicio')).toBe('/workspace');
  });
  it('monta aba e subaba, com padrão quando falta', () => {
    expect(workspaceHref('kanban')).toBe('/workspace?aba=kanban');
    expect(workspaceHref('biblioteca')).toBe('/workspace?aba=biblioteca&sub=atalhos');
    expect(workspaceHref({ aba: 'biblioteca', sub: 'prompts' })).toBe('/workspace?aba=biblioteca&sub=prompts');
    expect(workspaceHref({ aba: 'conta', sub: 'conectividade' })).toBe('/workspace?aba=conta&sub=conectividade');
  });
  it('o endereço gerado volta à mesma localização', () => {
    const loc = { aba: 'biblioteca', sub: 'snippets' } as const;
    const url = new URL(workspaceHref(loc), 'http://x');
    expect(parseWorkspaceLocation(url.searchParams)).toEqual(loc);
  });
});

describe('locationFromLegacyId', () => {
  it('traduz os ids que a tela e a paleta usavam', () => {
    expect(locationFromLegacyId('home')).toEqual({ aba: 'inicio' });
    expect(locationFromLegacyId('snippets')).toEqual({ aba: 'biblioteca', sub: 'snippets' });
    expect(locationFromLegacyId('daily')).toBeNull();
  });
});
