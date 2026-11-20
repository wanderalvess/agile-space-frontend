import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ profile: null as Record<string, unknown> | null }));

vi.mock('@/context/UserContext', () => ({
  useUserContext: () => ({ userProfile: h.profile, logout: vi.fn(), setIsEditProfileOpen: vi.fn(), requestIdentity: vi.fn() }),
}));
vi.mock('@/components/common/ProfileAvatar', () => ({ ProfileAvatar: () => <span data-testid="avatar" /> }));
vi.mock('@/components/brand/ModuleIcon', () => ({ ModuleIcon: () => null }));

import { ProfileMenu } from '../ProfileMenu';

describe('ProfileMenu: cargo no cabeçalho', () => {
  beforeEach(() => {
    h.profile = null;
  });

  it('mostra o cargo unificado (o mesmo de Minha identidade), não o papel bruto da sessão', () => {
    h.profile = { id: 'u1', name: 'Marina Duarte', role: 'Developer', cargo: 'Analista de QA' };
    render(<ProfileMenu />);
    expect(screen.getByText('Analista de QA')).toBeTruthy();
    expect(screen.queryByText('Developer')).toBeNull();
  });

  it('sem cargo definido na administração mostra "Sem cargo", nem para admin se inventa outro rótulo', () => {
    h.profile = { id: 'u2', name: 'Ana', role: 'admin', cargo: '' };
    render(<ProfileMenu />);
    expect(screen.getByText('Sem cargo')).toBeTruthy();
    expect(screen.queryByText('Administrador')).toBeNull();
  });

  it('admin com cargo mostra o cargo', () => {
    h.profile = { id: 'u3', name: 'Ana', role: 'admin', cargo: 'Tech Lead' };
    render(<ProfileMenu />);
    expect(screen.getByText('Tech Lead')).toBeTruthy();
  });

  it('quem não é admin e não tem cargo também mostra "Sem cargo"', () => {
    h.profile = { id: 'u4', name: 'Rui', role: 'user', cargo: '' };
    render(<ProfileMenu />);
    expect(screen.getByText('Rui')).toBeTruthy();
    expect(screen.getByText('Sem cargo')).toBeTruthy();
  });
});
