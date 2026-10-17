import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
// A aba de consultas tem teste próprio; aqui só importa que ela é montada na aba certa.
vi.mock('../jql/JqlPanelsSection', () => ({ JqlPanelsSection: () => <section aria-label="Consultas montadas">Painéis personalizados por JQL</section> }));
vi.mock('../../../ui/DashboardFilters', () => ({
  estimationUnitLabel: (u: string) => (u === 'HOURS' ? 'Horas (h)' : u === 'SP' ? 'Story Points (SP)' : u),
}));

import { resolveActivePanelTab, resolvePanelsAccess } from '../../../../lib/dashboard-roles';
import type { SquadDashboardData } from '../../../../hooks/useSquadDashboardData';
import type { SquadIssueSnapshot, SquadMember, SquadMetricsRollup } from '../../../../lib/types';
import { SquadPanelsView, type SquadPanelsViewProps } from '../SquadPanelsView';

let n = 0;
const issue = (o: Partial<SquadIssueSnapshot> = {}): SquadIssueSnapshot => {
  n += 1;
  return {
    key: `DDW-${n}`, jiraKey: `DDW-${n}`, title: `Tarefa ${n}`, type: 'Task', isBug: false, status: 'To Do', statusCategory: 'new',
    estimateSec: 3600 * 4, remainingSec: 0, loggedSec: 0, updatedAtJira: '', staleSinceDays: 0, dueDate: '', assigneeId: '', assigneeName: 'Ana Ribeiro',
    parentKey: '', parentTitle: '', sprintId: '42', sprintName: 'Sprint 42', syncedAt: '', ...o,
  };
};

const issues = [
  issue({ status: 'Done', statusCategory: 'done' }),
  issue({ status: 'In Progress', statusCategory: 'indeterminate', type: 'Bug', isBug: true }),
  issue({ status: 'Code Review', statusCategory: 'indeterminate', title: 'Refactor do fiscal' }),
  issue({ status: 'QA Testing', statusCategory: 'indeterminate', assigneeName: 'Bruno Teixeira' }),
  issue(),
];
const members: SquadMember[] = [
  { dbId: '1', squadId: 'S', jiraAccountId: 'a', displayName: 'Ana Ribeiro', role: 'Developer', capacityHoursPerDay: 6 },
  { dbId: '2', squadId: 'S', jiraAccountId: 'b', displayName: 'Bruno Teixeira', role: 'QA' },
];
const rollup = { squadId: 'S', sprintId: '42', sprintName: 'Sprint 42', totalIssues: 5, doneIssues: 1, inProgressIssues: 3, bugIssues: 1 } as SquadMetricsRollup;

function makeData(over: Partial<SquadDashboardData> = {}): SquadDashboardData {
  return {
    squadId: 'DDWMISSI', hasSquad: true, loading: false, error: null, rollup, issues, members, myIssues: issues.filter((i) => i.assigneeName === 'Ana Ribeiro'),
    sprintName: 'Sprint 42', sprintOptions: [{ label: 'Sprint 42 (Atual)', value: '42' }, { label: 'Sprint 41 (30/09)', value: '41' }], selectedSprint: '42',
    setSelectedSprint: vi.fn(), refresh: vi.fn(async () => undefined), ...over,
  };
}

const noopTribe = { rows: [], loading: false, error: null, reload: vi.fn() };

function view(role: string, isLeadership: boolean, papel: string | null, over: Partial<SquadPanelsViewProps> = {}) {
  const access = resolvePanelsAccess(role, isLeadership);
  const props: SquadPanelsViewProps = {
    roleLabel: role, userId: 'u-1', userName: 'Ana Ribeiro', initializing: false, access, active: resolveActivePanelTab(papel, access),
    data: makeData(), config: { estimationUnit: 'HOURS', ceremonyMode: 'manual', ceremonies: [{ id: 'c1', title: 'Daily', daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'], startTime: '09:30', durationMinutes: 15 }] } as never,
    configLoading: false, tribe: noopTribe, onSelectTab: vi.fn(), onBackToHub: vi.fn(), ...over,
  };
  return { props, ...render(<SquadPanelsView {...props} />) };
}

const tabLabels = () => screen.getAllByRole('tab').map((t) => t.textContent);

// Cada painel de papel, com os cartões que ele tinha na aba "Meu painel" e nas páginas /squad/dashboards/*.
const WIDGETS: Record<string, { papel: string; role: string; lead: boolean; titles: string[] }> = {
  execução: { papel: 'member', role: 'Developer', lead: false, titles: ['Meu progresso na sprint', 'Minhas tarefas por status', 'Bugs em aberto', 'Minhas tarefas na sprint (Jira)', 'Rituais da squad'] },
  po: { papel: 'product-owner', role: 'Product Owner', lead: false, titles: ['Entrega do escopo combinado (Say/Do)', 'Escopo por tipo de issue (Jira)', 'Itens em andamento', 'Itens pendentes (podem passar para a próxima sprint)'] },
  am: { papel: 'agile-master', role: 'Agile Master', lead: true, titles: ['Itens entregues na sprint', 'Status das histórias (Jira)', 'Bugs na sprint', 'Plano de ação das retrospectivas'] },
  pl: { papel: 'people-lead', role: 'People Lead', lead: false, titles: ['Carga de trabalho e capacidade', 'Pessoas ativas no time', 'Papéis do time'] },
  tl: { papel: 'tech-lead', role: 'Tech Lead', lead: false, titles: ['Onde o esforço está', 'Onde as entregas estão travando', 'Bugs na sprint', 'Carga de cada pessoa'] },
};

describe('matriz papel x painel: cada papel abre os cartões do seu painel', () => {
  it.each(Object.entries(WIDGETS))('%s', (_nome, w) => {
    view(w.role, w.lead, w.papel);
    for (const title of w.titles) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
  });

  it('inclui o que só existia nas páginas: rosca do Agile Master, papéis do People Lead, travando e carga por pessoa do Tech Lead', () => {
    view('Tech Lead', false, 'tech-lead');
    expect(screen.getByText('Esperando Code Review')).toBeTruthy();
    expect(screen.getByText('Em QA ou homologação')).toBeTruthy();
    expect(screen.getByText('Bruno Teixeira')).toBeTruthy();
  });

  it('a Tribo e as Consultas JQL são abas próprias', () => {
    const { unmount } = view('Tribe Lead', true, 'tribe-level');
    expect(screen.getByRole('heading', { name: 'Comparação entre squads' })).toBeTruthy();
    unmount();
    view('Developer', false, 'custom');
    expect(screen.getByLabelText('Consultas montadas')).toBeTruthy();
  });
});

describe('barra de papéis', () => {
  it('Developer vê só Consultas JQL e Execução, sem a etiqueta de liderança', () => {
    view('Developer', false, null);
    expect(tabLabels()).toEqual(['Consultas do Jira (JQL)', 'Execução (Dev, QA e UX)']);
    expect(screen.queryByText('Visão de liderança')).toBeNull();
  });

  it('liderança vê as 7 abas, com "Visão de liderança" e o aviso "Só de interface"', () => {
    view('Agile Master', true, null);
    expect(tabLabels()).toHaveLength(7);
    expect(screen.getByText('Visão de liderança')).toBeTruthy();
    expect(screen.getByText('Só de interface')).toBeTruthy();
    expect((screen.getByRole('tab', { name: 'Agile Master' })).getAttribute('aria-selected')).toBe('true');
  });

  it('trocar de aba avisa quem montou o painel', () => {
    const { props } = view('Agile Master', true, null);
    fireEvent.click(screen.getByRole('tab', { name: 'Tech Lead' }));
    expect(props.onSelectTab).toHaveBeenCalledWith('tech-lead');
  });

  it('a Tribo e as Consultas não têm filtro de sprint; as outras têm', () => {
    const { unmount } = view('Agile Master', true, 'tribe-level');
    expect(screen.queryByLabelText('Sprint')).toBeNull();
    unmount();
    view('Agile Master', true, 'agile-master');
    expect(screen.getByText('Sprint')).toBeTruthy();
  });
});

describe('acesso negado (só de interface)', () => {
  it('papel que não pode abrir a aba pedida vê a explicação e as duas saídas', () => {
    const { props } = view('Developer', false, 'tribe-level');
    expect(screen.getByRole('heading', { name: 'Este painel é de outro papel' })).toBeTruthy();
    expect(screen.getByText(/Controle só de interface: o servidor libera os dados a qualquer membro da squad/)).toBeTruthy();
    // nenhum número do painel pedido aparece
    expect(screen.queryByRole('heading', { name: 'Comparação entre squads' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Voltar ao Squad Hub/ }));
    expect(props.onBackToHub).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Abrir o painel do meu papel/ }));
    expect(props.onSelectTab).toHaveBeenCalledWith('member');
    // nenhuma aba fica marcada como aberta
    screen.getAllByRole('tab').forEach((t) => expect((t).getAttribute('aria-selected')).toBe('false'));
  });
});

describe('estados', () => {
  it('sem squad: diz isso e aponta Primeiros passos', () => {
    view('Developer', false, 'member', { data: makeData({ hasSquad: false, squadId: '', rollup: null, issues: [], myIssues: [], members: [] }) });
    expect(screen.getByText(/Você ainda não está em uma squad/)).toBeTruthy();
    expect((screen.getByRole('link', { name: 'Primeiros passos' })).getAttribute('href')).toBe('/onboarding');
  });

  it('sem dados: aviso azul e cada cartão diz que não há dado em vez de mostrar zero', () => {
    view('Developer', false, 'member', { data: makeData({ rollup: null, issues: [], myIssues: [], members: [] }) });
    expect(screen.getByText(/Sem dados desta squad ainda\. Sincronize a sprint/)).toBeTruthy();
    expect(screen.getAllByText('Sem tarefas suas nesta sprint.').length).toBeGreaterThan(0);
  });

  it('squad que nunca conectou o Jira: pede para conectar', () => {
    view('Developer', false, 'member', { data: makeData({ rollup: null, issues: [], myIssues: [], members: [] }), config: null });
    expect(screen.getByText(/ainda não está ligada ao Jira/)).toBeTruthy();
  });

  it('sprint antiga sem itens: avisa da sprint, não da squad', () => {
    view('Developer', false, 'member', { data: makeData({ rollup: null, issues: [], myIssues: [], members: [], selectedSprint: '41' }) });
    expect(screen.getByText(/Não há itens sincronizados nesta sprint/)).toBeTruthy();
  });

  it('erro: alerta com a causa e "Tentar de novo"', () => {
    const refresh = vi.fn(async () => undefined);
    view('Developer', false, 'member', { data: makeData({ error: 'O Jira demorou demais para responder.', refresh }) });
    expect(screen.getByRole('alert').textContent).toContain('O Jira demorou demais para responder.');
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(refresh).toHaveBeenCalled();
  });

  it('carregando pela primeira vez: esqueleto, não "sem dados"', () => {
    view('Developer', false, 'member', { data: makeData({ loading: true, rollup: null, issues: [], myIssues: [], members: [] }) });
    expect(screen.getByText('Carregando o painel')).toBeTruthy();
    expect(screen.queryByText(/Sem dados desta squad ainda/)).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('perfil ainda carregando: esqueleto', () => {
    view('Developer', false, 'member', { initializing: true });
    expect(screen.getByText('Carregando o painel')).toBeTruthy();
  });
});

describe('textos corrigidos', () => {
  it('Execução: "Bugs em aberto" (os impedimentos do título antigo não vêm do Jira)', () => {
    view('Developer', false, 'member');
    const card = screen.getByRole('heading', { name: 'Bugs em aberto' }).closest('section')!;
    expect(within(card).getByText('1 bug seu está aguardando resolução.')).toBeTruthy();
    expect(screen.queryByText(/impedimentos em aberto/i)).toBeNull();
  });

  it('Agile Master: avisa que impedimentos não são lidos do Jira', () => {
    view('Agile Master', true, 'agile-master');
    expect(screen.getByText(/Impedimentos não são lidos do Jira/)).toBeTruthy();
  });

  it('Tech Lead: débito técnico e filas aparecem como estimativa, com a regra na dica', () => {
    view('Tech Lead', false, 'tech-lead');
    expect(screen.getByText('Débito técnico estimado pelo título')).toBeTruthy();
    expect(screen.getByText(/Débito técnico \(pelo título\)/)).toBeTruthy();
    const tags = screen.getAllByLabelText(/estimado/i);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.some((t) => /texto do status/.test(t.getAttribute('title') || ''))).toBe(true);
  });

  it('Product Owner: mostra a unidade de estimativa da squad', () => {
    view('Product Owner', false, 'product-owner');
    expect(screen.getAllByText('Horas (h)').length).toBeGreaterThan(0);
  });

  it('unidade não definida vira link para configurar', () => {
    view('Developer', false, 'member', { config: { estimationUnit: undefined } as never });
    expect((screen.getByRole('link', { name: /Não definida · Configurar/ })).getAttribute('href')).toBe('/painel');
  });

  it('Rituais: cadastrados aparecem; sem cadastro mostra como configurar', () => {
    const { unmount } = view('Developer', false, 'member');
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText(/Seg a Sex às 09:30 · 15 min/)).toBeTruthy();
    unmount();
    view('Developer', false, 'member', { config: { ceremonyMode: 'manual', ceremonies: [] } as never });
    expect(screen.getByText('Nenhum ritual cadastrado para esta squad.')).toBeTruthy();
    expect((screen.getByRole('link', { name: 'Configurar rituais no Painel' })).getAttribute('href')).toBe('/painel');
  });
});
