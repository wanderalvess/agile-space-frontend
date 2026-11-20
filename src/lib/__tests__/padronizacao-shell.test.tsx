import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix', roleName: '' }) }));
vi.mock('../team-welcome', async (orig) => ({ ...(await orig<typeof import('../team-welcome')>()), isJustSignedUp: () => true, clearJustSignedUp: vi.fn() }));

import { LinkedTeamWelcome } from '../../components/home/LinkedTeamWelcome';
import { RosterHeader } from '../../components/roster/RosterHeader';
import { MANUAL_TOPICS } from '../../app/manual/data/topics';
import { moduleIcon, moduleLabel } from '../modules-registry';

const src = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(src, rel), 'utf8');

describe('padronização da casca', () => {
  it('Time da squad leva o ícone do módulo no título', () => {
    const { container } = render(
      <RosterHeader canManageTeam canInvite onExport={vi.fn()} onImport={vi.fn()} onAddMember={vi.fn()} onInvite={vi.fn()} />
    );
    expect(screen.getByRole('heading', { name: 'Time da squad' })).toBeTruthy();
    expect(container.querySelector('.lucide-users')).toBeTruthy();
  });

  it('o boas-vindas do vínculo não repete o nome da squad', () => {
    render(<LinkedTeamWelcome />);
    expect(screen.getByText('Você já está vinculado a esta squad.')).toBeTruthy();
    expect(screen.queryByText(/Phoenix/)).toBeNull();
  });

  it('tópicos do manual que são módulos usam o ícone do registro', () => {
    const byTopic: Record<string, Parameters<typeof moduleIcon>[0]> = {
      poker: 'poker', retro: 'retro', showcase: 'showcase', jolt: 'jolt', workspace: 'workspace',
      knowledge: 'knowledge', 'prompt-hub': 'prompt-hub', governance: 'governance', health: 'health', brainstorming: 'brainstorming', planner: 'sprint-planner',
    };
    for (const [topic, key] of Object.entries(byTopic)) {
      expect(MANUAL_TOPICS.find((t) => t.id === topic)?.icon, topic).toBe(moduleIcon(key));
    }
  });

  it('nomes vêm do registro', () => {
    expect(moduleLabel('retro')).toBe('Retrospectiva');
    expect(moduleLabel('sprint-planner')).toBe('Planejamento');
    expect(moduleLabel('showcase')).toBe('Review');
  });

  it('Scrum Poker e Base de conhecimento não importam o ícone de outro módulo direto', () => {
    for (const f of ['components/poker/PokerRoomBar.tsx', 'components/poker/AsyncPokerRoom.tsx', 'components/poker/CreateSessionModal.tsx', 'components/poker/RoomWelcome.tsx', 'app/room/page.tsx']) {
      expect(read(f), f).not.toContain('WalletCards');
    }
    const nav = read('app/knowledge/layout.tsx');
    expect(nav).not.toContain('BookOpen');
    expect(nav).toContain("moduleIcon('knowledge')");
    expect(nav).not.toMatch(/icon: Settings\b/);
  });
});
