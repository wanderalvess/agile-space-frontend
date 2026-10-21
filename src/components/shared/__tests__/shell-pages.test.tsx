import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Smoke do invólucro das telas migradas para o PageShell: um cabeçalho do portal, um rodapé, um h1 certo.
const push = vi.fn();
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ token: 'abc' }),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: { id: 'u1', name: 'Ana', accessibleProjects: [] }, isAuthenticated: true, isLoading: false, switchProject: vi.fn(), acceptInvite: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({ userProfile: { role: 'user', name: 'Ana' }, isInitializing: false, requestIdentity: vi.fn() }),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../components/home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../../components/home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../components/layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../../components/feedback-widget', () => ({ FeedbackWidget: () => null }));
vi.mock('../../../hooks/useToolHistory', () => ({ useToolHistory: () => ({ history: [], loading: false, removeRoom: vi.fn() }) }));
vi.mock('../../../services/changelogApi', () => ({ changelogApi: { getPublishedReleases: async () => [] } }));
vi.mock('../../../app/support/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../app/support/api')>()), supportApi: { listMine: async () => [], getReplies: async () => [], createTicket: vi.fn() } }));
vi.mock('../../../components/devtools/DevToolsHub', () => ({ DevToolsHub: () => <div>hub de ferramentas</div> }));
vi.mock('../../../components/knowledge/GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('../../../components/onboarding/OnboardingFlow', () => ({ OnboardingFlow: () => <div>fluxo de entrada</div> }));
vi.mock('../../../components/invite/InviteAcceptView', () => ({ InviteAcceptView: () => <div>tela do convite</div> }));
vi.mock('../../../lib/invite-api', () => ({ inviteApi: { getInvite: () => new Promise(() => {}) } }));
vi.mock('../../../components/knowledge/KnowledgeGuide', () => ({ KnowledgeGuide: () => null }));
vi.mock('../../../app/manual/components/ManualSidebar', () => ({ ManualSidebar: () => <nav aria-label="Tópicos do manual" /> }));

import { ToolHubLayout } from '../ToolHubLayout';
import { DevToolsHubPage } from '../../../components/devtools/DevToolsHubPage';
import { DevToolPage } from '../../../components/devtools/DevToolPage';
import ChangelogPage from '../../../app/changelog/page';
import GovernancePage from '../../../app/governance/page';
import SupportPage from '../../../app/support/page';
import JoltHubPage from '../../../app/jolt/page';
import ConfiguracoesPage from '../../../app/configuracoes/page';
import SkillTutorialPage from '../../../app/prompt-hub/tutorial/page';
import ManualLayout from '../../../app/manual/layout';
import KnowledgeLayout from '../../../app/knowledge/layout';
import OnboardingPage from '../../../app/onboarding/page';
import InvitePage from '../../../app/invite/[token]/page';

function expectShell(h1: string | RegExp) {
  // Um cabeçalho do portal (AppHeader), um rodapé e um único h1.
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1, name: h1 })).toBeTruthy();
}

beforeEach(() => {
  pathname = '/';
  push.mockClear();
});

describe('telas no PageShell', () => {
  it('hub de cerimônia (ToolHubLayout): título do registro, ações e entrar com o código', () => {
    const onNew = vi.fn();
    const onJoin = vi.fn();
    render(
      <ToolHubLayout
        module="retro"
        title="Título antigo"
        description="Feedbacks colaborativos."
        tips={[]}
        onNewSession={onNew}
        onJoinSession={onJoin}
      />,
    );
    expectShell('Retrospectiva');
    expect(document.title).toBe('Retrospectiva | Portal Tech V&D');
    fireEvent.click(screen.getByRole('button', { name: /Nova sessão/ }));
    expect(onNew).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Entrar com o código da sala'), { target: { value: 'ab12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
    expect(onJoin).toHaveBeenCalledWith('AB12');
  });

  it('hub só com children (Review): sem os cartões do hub', () => {
    render(
      <ToolHubLayout module="showcase" title="x" description="Apresente entregas." tips={[]} onlyChildren>
        <p>lista de reviews</p>
      </ToolHubLayout>,
    );
    expectShell('Review');
    expect(screen.getByText('lista de reviews')).toBeTruthy();
    expect(screen.queryByText('Sessões recentes')).toBeNull();
  });

  it('DevTools e Central de qualidade usam o nome do registro', () => {
    const { unmount } = render(<DevToolsHubPage module="devtools" subtitle="Ferramentas." />);
    expectShell('DevTools');
    unmount();
    render(<DevToolsHubPage module="qa" subtitle="Testes." collection="qa" />);
    expectShell('Central de qualidade');
  });

  it('ferramenta do DevTools: trilha, ações do corpo e a gaveta "Como usar"', () => {
    render(
      <DevToolPage toolId="json" actions={<button>Limpar</button>}>
        <div>área da ferramenta</div>
      </DevToolPage>,
    );
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Caminho' })).toBeTruthy();
    expect(screen.getByText('área da ferramenta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Como usar/ })).toBeTruthy();
  });

  it('Versões', async () => {
    render(<ChangelogPage />);
    expectShell('Versões');
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Buscar nas versões' })).toBeTruthy());
  });

  it('Segurança e dados', () => {
    render(<GovernancePage />);
    expectShell('Segurança e dados');
    expect(screen.getByRole('button', { name: /Guia/ })).toBeTruthy();
  });

  it('Suporte', async () => {
    render(<SupportPage />);
    expectShell('Suporte');
    await waitFor(() => expect(screen.getByRole('button', { name: /Nova solicitação/ })).toBeTruthy());
  });

  it('Jolt (hub dos dois modos)', () => {
    render(<JoltHubPage />);
    expectShell('Jolt');
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/jolt/sandbox')).toBe(true);
  });

  it('Configurações', () => {
    render(<ConfiguracoesPage />);
    expectShell('Configurações');
  });

  it('Prompt Hub: tutorial de skill', () => {
    render(<SkillTutorialPage />);
    expectShell('Como criar uma skill');
  });

  it('Manual: layout com índice e conteúdo, sem fixar o título da aba (cada tópico tem o seu)', () => {
    document.title = 'Poker | Manual';
    render(
      <ManualLayout>
        <p>conteúdo do tópico</p>
      </ManualLayout>,
    );
    expectShell('Manual');
    expect(screen.getByText('conteúdo do tópico')).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Tópicos do manual' }).length).toBeGreaterThan(0);
    expect(document.title).toBe('Poker | Manual');
  });
});

describe('Base de conhecimento', () => {
  it('layout: AppHeader do portal, sub-barra do módulo e rodapé, sem o cabeçalho "Wiki Space" próprio', () => {
    render(
      <KnowledgeLayout>
        <p>página da base</p>
      </KnowledgeLayout>,
    );
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Base de conhecimento' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Base de conhecimento', 'Assistente virtual', 'Ajustes']);
    expect(screen.getByText('página da base')).toBeTruthy();
    expect(screen.queryByText(/Wiki Space/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(push).toHaveBeenCalledWith('/knowledge/admin/new-asset');
  });
});

describe('telas de entrada (/onboarding e /invite)', () => {
  it('/onboarding: um cabeçalho do portal sem seletor de squad, o fluxo e o rodapé', () => {
    render(<OnboardingPage />);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByText('fluxo de entrada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Trocar de squad/i })).toBeNull();
    expect(document.title).toBe('Entrar na squad | Portal Tech V&D');
  });

  it('/invite/[token]: um cabeçalho do portal, a tela do convite e o rodapé', () => {
    render(<InvitePage />);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByText('tela do convite')).toBeTruthy();
  });
});
