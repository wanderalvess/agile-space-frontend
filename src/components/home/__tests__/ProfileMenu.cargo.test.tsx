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

  it('admin sem cargo mostra o nível de acesso "Administrador"', () => {
    h.profile = { id: 'u2', name: 'Ana', role: 'admin', cargo: '' };
    render(<ProfileMenu />);
    expect(screen.getByText('Administrador')).toBeTruthy();
  });

  it('admin com cargo mostra o cargo', () => {
    h.profile = { id: 'u3', name: 'Ana', role: 'admin', cargo: 'Tech Lead' };
    render(<ProfileMenu />);
    expect(screen.getByText('Tech Lead')).toBeTruthy();
    expect(screen.queryByText('Administrador')).toBeNull();
  });

  it('sem cargo e sem ser admin não mostra nada além do nome', () => {
    h.profile = { id: 'u4', name: 'Rui', role: 'user', cargo: '' };
    render(<ProfileMenu />);
    expect(screen.getByText('Rui')).toBeTruthy();
  });
});
