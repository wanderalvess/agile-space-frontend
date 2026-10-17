import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Users } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { accessibleProjects: [] }, switchProject: vi.fn() }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { role: 'user', name: 'Ana' } }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../feedback-widget', () => ({ FeedbackWidget: () => null }));

import {
  DataTable,
  DataToolbar,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiRow,
  LoadingSkeleton,
  PageColumns,
  PageHeader,
  PageShell,
  SidePanelSection,
} from '..';

describe('PageShell', () => {
  it('monta cabeçalho, miolo e rodapé, e põe o título da aba', () => {
    render(
      <PageShell documentTitle="Time da squad">
        <p>conteúdo</p>
      </PageShell>,
    );
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(document.getElementById('conteudo')?.textContent).toBe('conteúdo');
    expect(document.title).toBe('Time da squad | Portal Tech V&D');
  });

  it('não abre um segundo main (o layout raiz já tem um)', () => {
    const { container } = render(<PageShell>x</PageShell>);
    expect(container.querySelector('main')).toBeNull();
  });

  it('largura padrão é a da Home (1680 px); rodapé pode ser trocado ou escondido', () => {
    const { rerender } = render(<PageShell>x</PageShell>);
    expect(document.getElementById('conteudo')?.className).toContain('max-w-[1680px]');
    rerender(<PageShell width="narrow" footer={<footer>meu rodapé</footer>}>x</PageShell>);
    expect(document.getElementById('conteudo')?.className).toContain('max-w-[1120px]');
    expect(screen.getByText('meu rodapé')).toBeTruthy();
    rerender(<PageShell footer={false}>x</PageShell>);
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });
});

describe('PageHeader', () => {
  it('migalha com link até o penúltimo item, página atual marcada e título h1', () => {
    render(<PageHeader title="Time da squad" subtitle="Quem está no time" breadcrumb={[{ label: 'Squad', href: '/squad' }, { label: 'Time da squad' }]} actions={<button>Ação</button>} />);
    const nav = screen.getByRole('navigation', { name: 'Caminho' });
    expect(within(nav).getByRole('link', { name: 'Squad' }).getAttribute('href')).toBe('/squad');
    expect(within(nav).getByText('Time da squad').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 1, name: 'Time da squad' })).toBeTruthy();
    expect(screen.getByText('Quem está no time')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ação' })).toBeTruthy();
  });

  it('sem migalha não desenha o caminho', () => {
    render(<PageHeader title="Só título" />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('KpiRow', () => {
  it('cada KpiCard mostra rótulo, valor e dica', () => {
    render(
      <KpiRow columns={3}>
        <KpiCard label="Pessoas" value="8" hint="Ativas" icon={Users} />
        <KpiCard label="Horas" value="38h" />
      </KpiRow>,
    );
    expect(screen.getByText('Pessoas')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Ativas')).toBeTruthy();
    expect(screen.getByText('38h')).toBeTruthy();
  });
});

describe('DataToolbar', () => {
  it('busca devolve o texto, contador avisa por aria-live e ações ficam à direita', () => {
    const onChange = vi.fn();
    render(<DataToolbar search={{ value: '', onChange, placeholder: 'Buscar pessoa' }} count={{ shown: 2, total: 5, noun: 'pessoas' }} actions={<button>Exportar</button>} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar pessoa' }), { target: { value: 'ana' } });
    expect(onChange).toHaveBeenCalledWith('ana');
    expect(screen.getByText('2 de 5 pessoas').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeTruthy();
  });
});

const ROWS = [
  { id: 'a', name: 'Ana', role: 'QA' },
  { id: 'b', name: 'Bruno', role: 'Developer' },
];
const COLUMNS = [
  { id: 'n', header: 'Pessoa', primary: true, cell: (r: (typeof ROWS)[number]) => <b>{r.name}</b> },
  { id: 'r', header: 'Cargo', width: '120px', cell: (r: (typeof ROWS)[number]) => r.role },
];

describe('DataTable', () => {
  it('desenha cabeçalho com colunas e uma linha por item, com o rótulo de cada valor', () => {
    render(<DataTable ariaLabel="Pessoas" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} />);
    const table = screen.getByRole('table', { name: 'Pessoas' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Pessoa', 'Cargo']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(table.getAttribute('aria-rowcount')).toBe('3');
    expect(table.style.getPropertyValue('--cols')).toBe('minmax(0,1fr) 120px');
  });

  it('linha expansível: abre e fecha um painel com aria-expanded', () => {
    render(<DataTable ariaLabel="Pessoas" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} renderExpanded={(r) => <p>detalhe de {r.name}</p>} />);
    const [first] = screen.getAllByRole('button', { name: 'Mostrar detalhes' });
    expect(first.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(first);
    expect(screen.getByText('detalhe de Ana')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ocultar detalhes' })[0].getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getAllByRole('button', { name: 'Ocultar detalhes' })[0]);
    expect(screen.queryByText('detalhe de Ana')).toBeNull();
  });

  it('expansão controlada pela página', () => {
    const onChange = vi.fn();
    render(<DataTable ariaLabel="Pessoas" columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} expandedId="b" onExpandedChange={onChange} renderExpanded={(r) => <p>detalhe de {r.name}</p>} />);
    expect(screen.getByText('detalhe de Bruno')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /detalhes/ })[0]);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('sem linhas mostra o estado vazio e o rodapé', () => {
    render(<DataTable ariaLabel="Pessoas" columns={COLUMNS} rows={[]} getRowId={(r: (typeof ROWS)[number]) => r.id} empty={<p>nada aqui</p>} footer={<p>rodapé</p>} />);
    expect(screen.getByText('nada aqui')).toBeTruthy();
    expect(screen.getByText('rodapé')).toBeTruthy();
  });
});

describe('estados', () => {
  it('EmptyState mostra título, texto e ação', () => {
    render(<EmptyState title="Nenhum integrante ainda" description="Sincronize com o Jira." actions={<button>Adicionar</button>} />);
    expect(screen.getByRole('heading', { name: 'Nenhum integrante ainda' })).toBeTruthy();
    expect(screen.getByText('Sincronize com o Jira.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeTruthy();
  });

  it('ErrorState é um alerta e "Tentar de novo" chama onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('LoadingSkeleton anuncia o que carrega e marca a região como ocupada', () => {
    const { container } = render(<LoadingSkeleton label="Carregando o time da squad" />);
    expect(screen.getByRole('status').textContent).toContain('Carregando o time da squad');
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

describe('SidePanelSection e PageColumns', () => {
  it('bloco lateral com título, apoio e ação; a coluna lateral fica depois do conteúdo', () => {
    render(
      <PageColumns aside={<SidePanelSection title="Regras" description="Como calcula" action={<button>Editar</button>}>corpo</SidePanelSection>}>
        <p>principal</p>
      </PageColumns>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Regras' })).toBeTruthy();
    expect(screen.getByText('Como calcula')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.getByRole('complementary').textContent).toContain('corpo');
  });
});
