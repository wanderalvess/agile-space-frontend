import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/UserContext', () => ({
  useUserContext: () => ({
    userProfile: { id: 'u1', name: 'Ana Ribeiro', email: 'ana@totvs.com.br', role: 'user', cargo: 'Developer', isGuest: false, squadId: 'S1' },
    updateProfile: vi.fn(),
    isEditProfileOpen: true,
    setIsEditProfileOpen: vi.fn(),
    mustOnboard: false,
    legacyOnly: false,
    isIdentityRequested: false,
    setIsIdentityRequested: vi.fn(),
    isPublicExploration: false,
  }),
}));
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useJiraSettings', () => ({ useJiraSettings: () => ({ settings: null, saveSettings: vi.fn(), removeSettings: vi.fn() }) }));
vi.mock('@/hooks/useProfilePhoto', () => ({
  useProfilePhoto: () => ({ photo: undefined, reportBroken: vi.fn(), available: false, photoOff: false, setPhotoOff: vi.fn(), hasUploaded: false }),
}));
vi.mock('@/app/users/api', () => ({ userApi: { getMyself: vi.fn() } }));
vi.mock('@/app/support/api', () => ({ supportApi: { createTicket: vi.fn() } }));
vi.mock('@/components/profile/useMyLinks', () => ({
  useMyLinks: () => ({ links: [], active: undefined, activate: vi.fn(), switchingTo: null, canSwitch: false }),
}));
vi.mock('@/components/layout/ChangePasswordSection', () => ({ ChangePasswordSection: () => <div>trocar senha</div> }));
vi.mock('@/components/profile/LinksSection', () => ({ LinksSection: () => <div>vínculos</div> }));

import { UserProfileModal } from '../UserProfileModal';

describe('UserProfileModal: rodapé por aba', () => {
  it('Perfil tem Cancelar, Salvar e o indicador de salvamento', () => {
    render(<UserProfileModal />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
    expect(screen.getByText('Tudo salvo')).toBeTruthy();
  });

  it.each(['Meus vínculos', 'Jira', 'Segurança'])('%s fica só com Fechar', (label) => {
    render(<UserProfileModal />);
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(label) }));
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.queryByText('Tudo salvo')).toBeNull();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    // além do "X" do cabeçalho, o rodapé traz "Fechar"
    expect(screen.getAllByRole('button', { name: 'Fechar' }).length).toBeGreaterThan(0);
  });
});
