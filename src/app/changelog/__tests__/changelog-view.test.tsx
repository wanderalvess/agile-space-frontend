import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangelogView, type ChangelogViewProps } from '../ChangelogView';
import type { ChangelogEntry } from '../releases';

const entry = (tag: string, iso: string, over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  tag,
  iso,
  type: 'minor',
  title: `Título ${tag}`,
  description: `Descrição ${tag}`,
  changes: [
    { kind: 'novo', text: `novo em ${tag}` },
    { kind: 'melhoria', text: `melhoria em ${tag}` },
    { kind: 'correcao', text: `correção em ${tag}` },
  ],
  ...over,
});

const ENTRIES = [
  entry('v4.25.0', '2026-10-20'),
  entry('v4.24.0', '2026-10-14'),
  entry('v4.23.2', '2026-10-09', { type: 'patch' }),
  entry('v4.22.0', '2026-09-22'),
  entry('v3.28.0', '2025-11-15', { type: 'patch' }),
];

function setup(over: Partial<ChangelogViewProps> = {}) {
  const props: ChangelogViewProps = {
    entries: ENTRIES,
    state: 'pronto',
    serverError: false,
    onRetry: vi.fn(),
    runningTag: 'v4.24.0',
    signedIn: true,
    seenTag: 'v4.23.2',
    seenAt: '2026-10-09T10:00:00.000Z',
    serverAhead: null,
    onMarkAllRead: vi.fn(),
    onUndoRead: vi.fn(),
    justRead: false,
    onReload: vi.fn(),
    ...over,
  };
  render(<ChangelogView {...props} />);
  return props;
}

describe('ChangelogView', () => {
  it('estado normal: versão em uso, linha do tempo por mês, Navegar e legenda', () => {
    setup();
    expect(screen.getByText('Você está na v4.24.0')).toBeTruthy();
    expect(screen.getByText('Publicada em 14 de outubro de 2026')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Outubro de 2026/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Setembro de 2026/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Novembro de 2025/ })).toBeTruthy();
    const nav = screen.getByRole('complementary', { name: 'Navegar' });
    expect(within(nav).getByRole('button', { name: /Outubro/ })).toBeTruthy();
    expect(within(nav).getByText('Tipos de mudança')).toBeTruthy();
    expect(within(nav).getByText('Melhoria')).toBeTruthy();
    expect(screen.getByText('Versão atual')).toBeTruthy();
  });

  it('as três primeiras versões abrem com as mudanças em lista; "Ver mais" abre as antigas', () => {
    setup();
    expect(screen.getAllByText('novo em v4.25.0').length).toBeGreaterThan(0);
    expect(screen.queryByText('novo em v3.28.0')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /Ver mais \(3 mudanças\)/ })[0]);
    expect(screen.getByText('novo em v4.22.0')).toBeTruthy();
  });

  it('faixa de novidades desde a última visita e "Marcar tudo como lido"', () => {
    const p = setup();
    const strip = screen.getByRole('region', { name: 'Novidades desde a sua última visita' });
    expect(within(strip).getByText('v4.25.0')).toBeTruthy();
    expect(within(strip).getByText('v4.24.0')).toBeTruthy();
    expect(within(strip).queryByText('v4.23.2')).toBeNull();
    fireEvent.click(within(strip).getByRole('button', { name: 'Marcar tudo como lido' }));
    expect(p.onMarkAllRead).toHaveBeenCalled();
  });

  it('sem sessão (visitante) não há faixa de novidades', () => {
    setup({ signedIn: false });
    expect(screen.queryByRole('region', { name: 'Novidades desde a sua última visita' })).toBeNull();
  });

  it('em dia: mostra a confirmação com Desfazer', () => {
    const p = setup({ seenTag: 'v4.25.0', justRead: true });
    expect(screen.getByText(/Você está em dia/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(p.onUndoRead).toHaveBeenCalled();
  });

  it('versão mais nova no servidor: convida a recarregar a página', () => {
    const p = setup({ serverAhead: 'v4.26.0' });
    expect(screen.getByText(/A v4\.26\.0 já está disponível/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar a página' }));
    expect(p.onReload).toHaveBeenCalled();
  });

  it('carregando: mostra o esqueleto e não a lista', () => {
    setup({ state: 'carregando', entries: [] });
    expect(screen.getByText('Carregando o histórico de versões')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('erro do servidor: faixa âmbar com "Tentar de novo" e a lista local continua', () => {
    const p = setup({ serverError: true });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Mostrando só a lista local; não conseguimos falar com o servidor.');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
    expect(p.onRetry).toHaveBeenCalled();
  });

  it('vazio: avisa que não há versões e oferece verificar de novo', () => {
    const p = setup({ entries: [] });
    expect(screen.getByText('Ainda não há versões publicadas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar de novo' }));
    expect(p.onRetry).toHaveBeenCalled();
    expect(screen.getByText('Nenhum mês para mostrar.')).toBeTruthy();
  });

  it('busca e filtros: sem resultado mostra "Limpar filtros"; filtrar por tipo e ano reduz a lista', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Patch/ }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '2025' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nas versões' }), { target: { value: 'xyz inexistente' } });
    expect(screen.getByText('Nenhuma versão com esses filtros')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getAllByRole('article')).toHaveLength(ENTRIES.length);
  });
});

describe('Versões não usa o que foi proibido', () => {
  const dir = join(__dirname, '..');
  const files = ['page.tsx', 'ChangelogView.tsx', 'releases.ts'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');

  it('sem Rocket, fallback fixo, any, itálico, caixa-alta ou font-black', () => {
    expect(files).not.toMatch(/Rocket/);
    expect(files).not.toMatch(/v3\.117\.1/);
    expect(files).not.toMatch(/\bas any\b|: any\b|<any>|any\[\]/);
    expect(files).not.toMatch(/\bitalic\b|\bfont-black\b|\buppercase\b/);
    expect(files).not.toMatch(/console\.warn/);
  });
});
