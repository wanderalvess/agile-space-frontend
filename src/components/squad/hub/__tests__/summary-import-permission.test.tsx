import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../home/LinkedTeamWelcome', () => ({ LinkedTeamWelcome: () => null }));
vi.mock('../../../jira/JiraProfieldsImport', () => ({ JiraProfieldsImport: () => null }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('../../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: null }) }));
vi.mock('../../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../../hooks/useTeamAvatars', () => ({
  invalidateTeamAvatars: vi.fn(),
  useTeamAvatars: () => ({ avatarFor: () => undefined, members: [] }),
}));
vi.mock('../NextCeremonyCard', () => ({ NextCeremonyCard: () => null }));
vi.mock('../SprintBoard', () => ({ SprintBoard: () => null }));
vi.mock('../SprintCard', () => ({ SprintCard: () => null }));
vi.mock('../SummaryAside', () => ({ AttentionSection: () => null, ExploreSection: () => null, MovementsSection: () => null, TeamSection: () => null }));
vi.mock('../SummaryWelcome', () => ({ SummaryWelcome: () => null }));

import { SummaryTab } from '../SummaryTab';

function renderTab(canImportJira: boolean) {
  const data = {
    squadId: 'MISSI', hasSquad: true, loading: false, error: null, rollup: null, issues: [], members: [], myIssues: [],
    sprintName: '', refresh: vi.fn(async () => {}),
  } as never;
  return render(
    <SummaryTab
      data={data}
      userKey="a@b.c"
      sync={{ syncState: 'idle', syncError: null, runJiraSync: vi.fn(async () => {}) } as never}
      canManageTeam={false}
      canImportJira={canImportJira}
      canOpenPeople={false}
      canSyncNow
      onSyncNow={vi.fn()}
    />
  );
}

describe('Resumo: Importar do Jira', () => {
  it('esconde o botão de quem o servidor recusaria (membro comum)', () => {
    renderTab(false);
    expect(screen.queryByRole('button', { name: /Importar do Jira/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Atualizar/ })).toBeTruthy();
  });

  it('mostra o botão para quem pode reimportar o time', () => {
    renderTab(true);
    expect(screen.getByRole('button', { name: /Importar do Jira/ })).toBeTruthy();
  });
});
