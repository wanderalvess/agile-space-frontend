import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  search: '',
  role: 'Agile Master',
  access: { loaded: true, access: { canApprove: false, canApproveLeadership: false } },
  requests: { pendingCount: 0 },
}));
const replace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ session: { activeProjectId: 'DDWMISSI' } }) }));
vi.mock('../../../../context/UserContext', () => ({
  useUserContext: () => ({ isInitializing: false, userProfile: { id: 'u-me', role: state.role, squadId: 'DDWMISSI', email: 'me@totvs.com.br' } }),
}));
vi.mock('../../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../../hooks/useJiraSettings', () => ({ getJiraCredentials: vi.fn() }));
vi.mock('../../../../store/useSquadStore', () => ({ useSquadStore: (sel: (s: unknown) => unknown) => sel({ isSyncing: false, syncSquad: vi.fn(), deleteMember: vi.fn() }) }));

// Esqueleto e peças do Time ficam como marcadores: aqui vale qual aba abre.
vi.mock('../../../../components/page', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../../../../components/roster/RosterHeader', () => ({ RosterHeader: () => <h1>Time da squad</h1> }));
vi.mock('../../../../components/roster/RosterKpis', () => ({ RosterKpis: () => <div>KPIS_DO_TIME</div> }));
vi.mock('../../../../components/roster/RosterToolbar', () => ({ RosterToolbar: () => null }));
vi.mock('../../../../components/roster/RosterTable', () => ({ RosterTable: () => <div>TABELA_DO_TIME</div> }));
vi.mock('../../../../components/roster/PendingInvites', () => ({ PendingInvites: () => null }));
vi.mock('../../../../components/roster/OnboardingBanner', () => ({ OnboardingBanner: () => null }));
vi.mock('../../../../components/roster/RuleSheet', () => ({ RuleSheet: () => null }));
vi.mock('../../../../components/roster/ImportDialog', () => ({ ImportDialog: () => null }));
vi.mock('../../../../components/roster/AddMemberDialog', () => ({ AddMemberDialog: () => null }));
vi.mock('../../../../components/roster/InviteDialog', () => ({ InviteDialog: () => null }));
vi.mock('../../../../components/roster/RosterStates', () => ({
  EmptyTeam: () => null,
  NoAccess: () => <div>ACESSO_RESTRITO</div>,
  NoResults: () => null,
  RosterLoadError: () => null,
  RosterSkeleton: () => <div>ESQUELETO</div>,
}));
vi.mock('../../../../components/roster/hooks/useAddMember', () => ({ useAddMember: () => ({ setOpen: vi.fn() }) }));
vi.mock('../../../../components/roster/hooks/useMemberEdits', () => ({ useMemberEdits: () => ({ draftOf: vi.fn() }) }));
vi.mock('../../../../components/roster/hooks/usePersonConfig', () => ({ usePersonConfig: () => ({}) }));
vi.mock('../../../../components/roster/hooks/useRosterData', () => ({
  useRosterData: () => ({ config: null, members: [{ jiraAccountId: 'x' }], phase: 'ready', reload: vi.fn(), refreshMembers: vi.fn() }),
  useCanManageTeam: () => ({ canManageTeam: false, permissionLoaded: true }),
}));
vi.mock('../../../../components/roster/hooks/useRosterExport', () => ({ useRosterExport: () => vi.fn() }));
vi.mock('../../../../components/roster/hooks/useRosterImport', () => ({ useRosterImport: () => ({ pickFile: vi.fn(), onFileChange: vi.fn() }) }));
vi.mock('../../../../components/roster/hooks/useRosterInvites', () => ({ useRosterInvites: () => ({ canInvite: false, state: 'ready', pending: [], error: null }) }));
vi.mock('../../../../components/roster/hooks/useRosterRule', () => ({ useRosterRule: () => ({ rule: { baseHours: 8 }, method: 'x' }) }));
vi.mock('../../../../lib/roster/calc', () => ({ filterMembers: (m: unknown[]) => m, rosterKpis: () => ({}) }));

vi.mock('../../../../components/approvals/useSquadLinkRequests', () => ({
  useApprovalAccess: () => state.access,
  useSquadLinkRequests: () => state.requests,
}));
vi.mock('../../../../components/approvals/SquadRequestsPanel', () => ({ SquadRequestsPanel: () => <div>PAINEL_DE_PEDIDOS</div> }));

import RosterPage from '../page';

function setAccess(canApprove: boolean, loaded = true, pending = 0) {
  state.access = { loaded, access: { canApprove, canApproveLeadership: false } };
  state.requests = { pendingCount: pending };
}

beforeEach(() => {
  state.search = '';
  state.role = 'Agile Master';
  setAccess(false);
  replace.mockReset();
});
afterEach(cleanup);

describe('Time da squad: aba Pedidos', () => {
  it('sem permissão de aprovar a aba não existe e o Time abre como sempre', () => {
    render(<RosterPage />);
    expect(screen.queryByRole('tab', { name: /Pedidos/ })).toBeNull();
    expect(screen.getByText('TABELA_DO_TIME')).toBeTruthy();
  });

  it('com permissão: abas Time e Pedidos com o contador de pendentes no rótulo; o Time abre por padrão', () => {
    setAccess(true, true, 3);
    render(<RosterPage />);
    expect(screen.getByRole('tab', { name: 'Time' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Pedidos\s*3/ })).toBeTruthy();
    expect(screen.queryByText('PAINEL_DE_PEDIDOS')).toBeNull();
  });

  it('?tab=pedidos abre direto a aba Pedidos', () => {
    setAccess(true, true, 1);
    state.search = 'tab=pedidos&squadId=DDWMISSI';
    render(<RosterPage />);
    expect(screen.getByRole('tab', { name: /Pedidos/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('PAINEL_DE_PEDIDOS')).toBeTruthy();
    expect(screen.queryByText('TABELA_DO_TIME')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('clicar em Pedidos coloca ?tab=pedidos na URL, mantendo a squad', () => {
    setAccess(true, true, 1);
    state.search = 'squadId=DDWMISSI';
    render(<RosterPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Pedidos/ }));
    expect(replace).toHaveBeenCalledWith('/squad/roster?squadId=DDWMISSI&tab=pedidos', { scroll: false });
  });

  it('?tab=pedidos enquanto a permissão carrega mostra o esqueleto, não o Time', () => {
    setAccess(false, false);
    state.search = 'tab=pedidos';
    render(<RosterPage />);
    expect(screen.getByText('ESQUELETO')).toBeTruthy();
    expect(screen.queryByText('TABELA_DO_TIME')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('?tab=pedidos sem poder aprovar cai no Time e solta o parâmetro, sem erro', () => {
    setAccess(false, true);
    state.search = 'tab=pedidos&squadId=DDWMISSI';
    render(<RosterPage />);
    expect(screen.getByText('TABELA_DO_TIME')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/squad/roster?squadId=DDWMISSI', { scroll: false });
  });

  it('quem aprova sem estar na lista de papéis de pessoas vê só os Pedidos (não o Time)', () => {
    state.role = 'Developer';
    setAccess(true, true, 2);
    render(<RosterPage />);
    expect(screen.getByText('PAINEL_DE_PEDIDOS')).toBeTruthy();
    expect(screen.queryByText('TABELA_DO_TIME')).toBeNull();
    expect(screen.queryByText('ACESSO_RESTRITO')).toBeNull();
  });

  it('quem não aprova e não está na lista segue sem acesso', () => {
    state.role = 'Developer';
    setAccess(false, true);
    render(<RosterPage />);
    expect(screen.getByText('ACESSO_RESTRITO')).toBeTruthy();
  });
});
