import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/governance', useRouter: () => ({ push: vi.fn() }) }));

import { GovernanceContent } from '../GovernanceContent';
import {
  DATA_REQUEST_HREF,
  DATA_ROWS,
  INTEGRATIONS,
  LIMITATIONS,
  MATRIX_ROWS,
  NO_RETENTION,
  ROLE_COLUMNS,
  SECTIONS,
  SECURITY_REVIEW,
  SESSION_CARDS,
  resolveRole,
} from '../content';

describe('GovernanceContent', () => {
  it('mostra as seis seções do índice com um h2 em cada', () => {
    render(<GovernanceContent role="membro" />);
    const nav = screen.getByRole('navigation', { name: 'Nesta página' });
    expect(within(nav).getAllByRole('button')).toHaveLength(SECTIONS.length);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(SECTIONS.length);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0); // o h1 é do PageHeader
  });

  it('a sessão traz os cinco cartões (24 h renovável até 7 dias, Sair, link de 2 horas)', () => {
    render(<GovernanceContent role="membro" />);
    expect(SESSION_CARDS).toHaveLength(5);
    expect(screen.getByText(/por até 7 dias desde a entrada/)).toBeTruthy();
    expect(screen.getByText(/link de uso único, válido por 2 horas/)).toBeTruthy();
    expect(screen.getByText(/termina em todos os aparelhos/)).toBeTruthy();
  });

  it('a tabela "O que o portal guarda" tem todas as linhas e diz "sem prazo" em vez de inventar', () => {
    render(<GovernanceContent role="membro" />);
    const table = screen.getByRole('table', { name: 'Dados que o portal guarda' });
    // 1 linha de cabeçalho + uma por dado.
    expect(within(table).getAllByRole('row')).toHaveLength(DATA_ROWS.length + 1);
    for (const row of DATA_ROWS) expect(within(table).getByText(row.name)).toBeTruthy();
    expect(within(table).getAllByText(NO_RETENTION).length).toBeGreaterThanOrEqual(DATA_ROWS.length - 3);
  });

  it('tokens do Jira e TDN: nem o admin vê o valor', () => {
    render(<GovernanceContent role="admin" />);
    expect(screen.getByText(/nunca o token/)).toBeTruthy();
    const row = MATRIX_ROWS.find((r) => r.id === 'tokens')!;
    expect(Object.values(row.cells)).toEqual(['Só o seu', 'Só o seu', 'Só o seu']);
  });

  it('a matriz tem uma linha por item e uma coluna por perfil', () => {
    render(<GovernanceContent role="membro" />);
    const table = screen.getByRole('table', { name: /O que cada perfil vê/ });
    expect(within(table).getAllByRole('row')).toHaveLength(MATRIX_ROWS.length + 1);
    expect(within(table).getAllByRole('columnheader')).toHaveLength(ROLE_COLUMNS.length + 1);
  });

  it.each([
    ['membro', 'Membro'],
    ['lideranca', 'Liderança da squad'],
    ['admin', 'Admin'],
  ] as const)('destaca a coluna do perfil %s', (role, label) => {
    render(<GovernanceContent role={role} />);
    const table = screen.getByRole('table', { name: /O que cada perfil vê/ });
    const current = within(table)
      .getAllByRole('columnheader')
      .filter((h) => h.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(label);
    expect(screen.getByText('Você')).toBeTruthy();
  });

  it('só o admin vê a trilha de auditoria e os feedbacks', () => {
    const audit = MATRIX_ROWS.find((r) => r.id === 'auditoria')!;
    const feedbacks = MATRIX_ROWS.find((r) => r.id === 'feedbacks')!;
    for (const r of [audit, feedbacks]) expect([r.cells.membro, r.cells.lideranca, r.cells.admin]).toEqual(['Não', 'Não', 'Sim']);
  });

  it('as integrações listam Jira, TDN, assistente de IA e DevTools', () => {
    render(<GovernanceContent role="membro" />);
    expect(INTEGRATIONS.map((i) => i.id)).toEqual(expect.arrayContaining(['jira', 'tdn', 'ia', 'devtools', 'junit']));
    expect(screen.getByText('Assistente de IA')).toBeTruthy();
    expect(screen.getByText(/ViaCEP/)).toBeTruthy();
  });

  it('as limitações aparecem e o pedido de dados leva ao Suporte com o tipo escolhido', () => {
    render(<GovernanceContent role="membro" />);
    for (const l of LIMITATIONS) expect(screen.getByText(l.text)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Pedir exportação ou exclusão' });
    expect(link.getAttribute('href')).toBe(DATA_REQUEST_HREF);
    expect(DATA_REQUEST_HREF).toMatch(/^\/support\?novo=1&tipo=suporte&assunto=/);
  });

  it('não existe botão "Editar texto"', () => {
    render(<GovernanceContent role="admin" />);
    expect(screen.queryByRole('button', { name: /Editar texto/ })).toBeNull();
  });

  it('o índice marca a seção clicada', () => {
    render(<GovernanceContent role="membro" />);
    const nav = screen.getByRole('navigation', { name: 'Nesta página' });
    const btn = within(nav).getByRole('button', { name: 'Integrações' });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-current')).toBe('true');
  });
});

describe('resolveRole', () => {
  it('admin vence liderança, que vence membro', () => {
    expect(resolveRole({ role: 'ADMIN', accessibleProjects: [] })).toBe('admin');
    expect(resolveRole({ role: 'MEMBER', accessibleProjects: [{ leadership: true }] })).toBe('lideranca');
    expect(resolveRole({ role: 'MEMBER', accessibleProjects: [{ leadership: false }] })).toBe('membro');
    expect(resolveRole({})).toBe('membro');
  });
});

describe('metadado da revisão', () => {
  it('traz data dd/mm/aaaa e nome completo', () => {
    expect(SECURITY_REVIEW.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(SECURITY_REVIEW.by.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });
});
