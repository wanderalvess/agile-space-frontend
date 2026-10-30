import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JiraCredentialsForm } from '../JiraCredentialsForm';

const props = {
  domain: 'jiraproducao.totvs.com.br',
  keys: 'DDWMISSI',
  token: '',
  errors: {},
  busy: false,
  keyCount: 1,
  onDomainChange: vi.fn(),
  onKeysChange: vi.fn(),
  onTokenChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe('JiraCredentialsForm: layout', () => {
  it('só usa duas colunas a partir de xl: abaixo disso o formulário e a caixa do token ficam empilhados', () => {
    // O formulário fica dentro de um cartão ao lado da barra de passos. Em lg (1024 px) a coluna dele
    // encolhia para ~190 px e cortava o texto do botão e os placeholders (achado na conferência visual).
    const { container } = render(<JiraCredentialsForm {...props} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain('xl:grid-cols-[minmax(0,1fr)_300px]');
    expect(grid.className).not.toMatch(/(^|\s)(sm|md|lg):grid-cols-\[/);
    expect(grid.className).toContain('grid-cols-1');
  });

  it('mostra o botão com o texto completo e a caixa de ajuda do token', () => {
    render(<JiraCredentialsForm {...props} />);
    expect(screen.getByRole('button', { name: /Ver o que vai ser importado/ })).toBeTruthy();
    expect(screen.getByLabelText('Como gerar o token')).toBeTruthy();
  });

  it('com mais de uma squad, o botão diz quantas', () => {
    render(<JiraCredentialsForm {...props} keys="DDWMISSI, DDWPRIME" keyCount={2} />);
    expect(screen.getByRole('button', { name: /Começar com 2 squads/ })).toBeTruthy();
  });
});
