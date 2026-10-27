import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyLink } from '@/lib/my-links';

const link = (over: Partial<MyLink>): MyLink => ({
  id: 'FLUXOTST',
  name: 'Fluxo Teste',
  role: 'Developer',
  roles: [],
  scope: 'SQUAD',
  scopeLabel: null,
  origin: null,
  leadership: false,
  direct: true,
  active: false,
  ...over,
});

const h = vi.hoisted(() => ({
  profile: null as null | Record<string, unknown>,
  updateProfile: vi.fn(),
  setIsEditProfileOpen: vi.fn(),
  setIsIdentityRequested: vi.fn(),
  isIdentityRequested: false,
  isEditProfileOpen: true,
  isPublicExploration: false,
  push: vi.fn(),
  setMode: vi.fn(),
  setVariant: vi.fn(),
  toast: vi.fn(),
  createTicket: vi.fn(),
  getMyself: vi.fn(),
  saveSettings: vi.fn(),
  removeSettings: vi.fn(),
  jiraSettings: null as null | { domain: string; token: string },
  activate: vi.fn(),
  links: [] as unknown[],
  setPhotoOff: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/painel', useRouter: () => ({ push: h.push }) }));
vi.mock('@/context/UserContext', () => ({
  useUserContext: () => ({
    userProfile: h.profile,
    updateProfile: h.updateProfile,
    isEditProfileOpen: h.isEditProfileOpen,
    setIsEditProfileOpen: h.setIsEditProfileOpen,
    mustOnboard: false,
    legacyOnly: false,
    isIdentityRequested: h.isIdentityRequested,
    setIsIdentityRequested: h.setIsIdentityRequested,
    isPublicExploration: h.isPublicExploration,
  }),
}));
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', resolvedMode: 'light', variant: 'default', setMode: h.setMode, setVariant: h.setVariant }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('@/hooks/useJiraSettings', () => ({
  useJiraSettings: () => ({ settings: h.jiraSettings, saveSettings: h.saveSettings, removeSettings: h.removeSettings }),
}));
vi.mock('@/hooks/useProfilePhoto', () => ({
  useProfilePhoto: () => ({ photo: undefined, reportBroken: vi.fn(), available: false, photoOff: false, setPhotoOff: h.setPhotoOff, hasUploaded: false }),
}));
vi.mock('@/hooks/useMyLinkRequests', () => ({ useMyLinkRequests: () => ({ requests: [], reload: vi.fn() }) }));
vi.mock('@/app/users/api', () => ({ userApi: { getMyself: h.getMyself } }));
vi.mock('@/app/support/api', () => ({ supportApi: { createTicket: h.createTicket } }));
vi.mock('@/components/profile/useMyLinks', () => ({
  useMyLinks: () => {
    const links = h.links as MyLink[];
    return { links, active: links.find((l) => l.active), activate: h.activate, switchingTo: null, canSwitch: links.length > 1 };
  },
}));
vi.mock('@/components/layout/ChangePasswordSection', () => ({ ChangePasswordSection: () => <div>formulário de senha</div> }));

import { UserProfileModal } from '../UserProfileModal';

const ana = { id: 'u1', name: 'Ana Ribeiro', email: 'ana@totvs.com.br', role: 'user', cargo: 'Developer', isGuest: false, squadId: 'FLUXOTST' };

beforeEach(() => {
  Object.values(h).forEach((v) => typeof v === 'function' && 'mockReset' in v && (v as ReturnType<typeof vi.fn>).mockReset());
  h.profile = { ...ana };
  h.isEditProfileOpen = true;
  h.isIdentityRequested = false;
  h.isPublicExploration = false;
  h.jiraSettings = null;
  h.links = [link({ active: true }), link({ id: 'DDWMISSI', name: 'Squad Missões', role: 'Desenvolvedor(a)' })];
});

const rowButton = (name: RegExp | string) => screen.getByRole('button', { name });

describe('UserProfileModal: ficha única', () => {
  it('sem abas, sem barra lateral e sem Salvar/Cancelar; rodapé fixo com a nota de salvamento', () => {
    render(<UserProfileModal />);
    expect(screen.getByRole('dialog', { name: 'Minha identidade' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    const note = screen.getByText('As alterações são salvas na hora.');
    expect(note.closest('[role="status"]')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1);
  });

  it('mostra o cabeçalho (foto, nome, e-mail) e as cinco linhas com seus valores e ações', () => {
    render(<UserProfileModal />);
    expect(screen.getByRole('button', { name: 'Trocar foto' })).toBeTruthy();
    expect(screen.getByText('Ana Ribeiro')).toBeTruthy();
    expect(screen.getByText('ana@totvs.com.br')).toBeTruthy();
    expect(screen.getByText('Developer')).toBeTruthy();
    expect(screen.getByText(/Fluxo Teste/).textContent).toContain('(ativa) e mais 1');
    expect(screen.getByText('Não conectado')).toBeTruthy();
    expect(screen.getByText('••••••••')).toBeTruthy();
    expect(screen.getByText('Claro · Espaço Clássico')).toBeTruthy();
    for (const name of [/Pedir ajuste, Cargo/, /Gerenciar, Squads/, /Conectar, Jira/, /Trocar, Senha/, /Mudar, Aparência/]) {
      expect(rowButton(name).getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('só uma linha fica aberta por vez', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Pedir ajuste, Cargo/));
    expect(screen.getByRole('form', { name: 'Pedir ajuste do cargo' })).toBeTruthy();
    fireEvent.click(rowButton(/Conectar, Jira/));
    expect(screen.queryByRole('form', { name: 'Pedir ajuste do cargo' })).toBeNull();
    expect(screen.getByLabelText('Domínio')).toBeTruthy();
    expect(rowButton(/Pedir ajuste, Cargo/).getAttribute('aria-expanded')).toBe('false');
    expect(rowButton(/Fechar, Jira/).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(rowButton(/Fechar, Jira/));
    expect(screen.queryByLabelText('Domínio')).toBeNull();
  });

  it('Fechar fecha a janela', () => {
    render(<UserProfileModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(h.setIsEditProfileOpen).toHaveBeenCalledWith(false);
    expect(h.setIsIdentityRequested).toHaveBeenCalledWith(false);
  });

  it('abre também pelo pedido de identidade', () => {
    h.isEditProfileOpen = false;
    h.isIdentityRequested = true;
    render(<UserProfileModal />);
    expect(screen.getByRole('dialog', { name: 'Minha identidade' })).toBeTruthy();
  });

  it('não abre na exploração pública mesmo com o pedido de identidade', () => {
    h.isEditProfileOpen = false;
    h.isIdentityRequested = true;
    h.isPublicExploration = true;
    render(<UserProfileModal />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('UserProfileModal: visitante', () => {
  it('sem sessão: só o convite para entrar, sem linhas nem rodapé', () => {
    h.profile = null;
    render(<UserProfileModal />);
    expect(screen.getByText('Você está como visitante')).toBeTruthy();
    expect(screen.queryByText('As alterações são salvas na hora.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trocar foto' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(h.push).toHaveBeenCalledWith('/login?returnUrl=%2Fpainel');
  });

  it('convidado (isGuest) também é visitante', () => {
    h.profile = { ...ana, isGuest: true };
    render(<UserProfileModal />);
    expect(screen.getByText('Você está como visitante')).toBeTruthy();
    expect(screen.queryByText('••••••••')).toBeNull();
  });
});

describe('UserProfileModal: nome no lugar', () => {
  it('Enter salva só o nome com updateProfile, sem fechar a janela', async () => {
    render(<UserProfileModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
    const input = screen.getByRole('textbox', { name: 'Nome' });
    fireEvent.change(input, { target: { value: 'Ana Maria' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledWith({ name: 'Ana Maria' }, { keepOpen: true }));
    await screen.findByText('Nome salvo');
    expect(h.setIsEditProfileOpen).not.toHaveBeenCalled();
  });

  it('nome vazio mostra o erro e não salva', () => {
    render(<UserProfileModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
    const input = screen.getByRole('textbox', { name: 'Nome' });
    fireEvent.change(input, { target: { value: ' ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Informe seu nome.')).toBeTruthy();
    expect(h.updateProfile).not.toHaveBeenCalled();
  });

  it('Esc dentro do campo cancela a edição e não fecha a janela', () => {
    render(<UserProfileModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
    const input = screen.getByRole('textbox', { name: 'Nome' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Nome' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Minha identidade' })).toBeTruthy();
    expect(h.setIsEditProfileOpen).not.toHaveBeenCalled();
  });
});

describe('UserProfileModal: linha Cargo', () => {
  it('envia o pedido de ajuste ao Suporte com a squad ativa', async () => {
    h.createTicket.mockResolvedValue({ id: 't1' });
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Pedir ajuste, Cargo/));
    fireEvent.change(screen.getByLabelText('Cargo desejado'), { target: { value: 'QA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByText('Pedido enviado ao Suporte');
    const payload = h.createTicket.mock.calls[0][0];
    expect(payload.subject).toBe('Ajuste de cargo');
    expect(payload.message).toContain('Cargo atual: Developer');
    expect(payload.message).toContain('Cargo desejado: QA');
    expect(payload.message).toContain('Squad ativa: FLUXOTST');
  });

  it('Cancelar fecha a linha', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Pedir ajuste, Cargo/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Cargo desejado')).toBeNull();
    expect(rowButton(/Pedir ajuste, Cargo/).getAttribute('aria-expanded')).toBe('false');
  });

  it('sem cargo mostra "Sem cargo definido"', () => {
    h.profile = { ...ana, cargo: undefined };
    h.links = [];
    render(<UserProfileModal />);
    expect(screen.getByText('Sem cargo definido')).toBeTruthy();
  });
});

describe('UserProfileModal: linha Squads', () => {
  it('lista os vínculos, troca a squad ativa e oferece pedir vínculo e usar convite', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Gerenciar, Squads/));
    const region = screen.getByRole('region', { name: 'Squads' });
    expect(within(region).getByText('Squad Missões')).toBeTruthy();
    fireEvent.click(within(region).getByRole('button', { name: /Tornar Squad Missões a squad ativa/ }));
    expect(h.activate).toHaveBeenCalledWith(expect.objectContaining({ id: 'DDWMISSI' }));
    expect(within(region).getByRole('button', { name: /Pedir vínculo/ })).toBeTruthy();
    expect(within(region).getByRole('button', { name: /Usar convite/ })).toBeTruthy();
    expect(within(region).getByText('A squad e o papel vêm do Jira, de um convite ou de um pedido aprovado por quem lidera.')).toBeTruthy();
  });

  it('com um vínculo só, o resumo não tem "e mais"', () => {
    h.links = [link({ active: true })];
    render(<UserProfileModal />);
    expect(screen.getByText(/Fluxo Teste/).textContent).toBe('Fluxo Teste (ativa)');
  });

  it('sem vínculos o resumo diz "Sem vínculos"', () => {
    h.links = [];
    render(<UserProfileModal />);
    expect(screen.getByText('Sem vínculos')).toBeTruthy();
  });
});

describe('UserProfileModal: linha Jira', () => {
  it('não conectado: preenche domínio e token, sincroniza e guarda as credenciais', async () => {
    h.getMyself.mockResolvedValue({ displayName: 'Ana R. Jira', accountId: 'acc1', emailAddress: 'ana@x.com', avatarUrls: {} });
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Conectar, Jira/));
    fireEvent.change(screen.getByLabelText('Domínio'), { target: { value: 'totvs.atlassian.net' } });
    fireEvent.change(screen.getByLabelText('Token pessoal (PAT)'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar com o Jira' }));
    await waitFor(() => expect(h.getMyself).toHaveBeenCalledWith('totvs.atlassian.net', 'segredo'));
    await waitFor(() => expect(h.saveSettings).toHaveBeenCalledWith({ domain: 'totvs.atlassian.net', token: 'segredo' }));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Jira sincronizado' }));
    expect(await screen.findByText('Conta do Jira sincronizada')).toBeTruthy();
  });

  it('sem "Lembrar credenciais" não grava o token', async () => {
    h.getMyself.mockResolvedValue({ displayName: 'Ana', accountId: 'a' });
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Conectar, Jira/));
    fireEvent.change(screen.getByLabelText('Domínio'), { target: { value: 'd.net' } });
    fireEvent.change(screen.getByLabelText('Token pessoal (PAT)'), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Lembrar credenciais/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar com o Jira' }));
    await waitFor(() => expect(h.getMyself).toHaveBeenCalled());
    expect(h.saveSettings).not.toHaveBeenCalled();
  });

  it('sem token avisa e não chama o Jira', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Conectar, Jira/));
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar com o Jira' }));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Token do Jira necessário' }));
    expect(h.getMyself).not.toHaveBeenCalled();
  });

  it('erro do Jira vira aviso, sem derrubar a janela', async () => {
    h.getMyself.mockRejectedValue(new Error('401'));
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Conectar, Jira/));
    fireEvent.change(screen.getByLabelText('Domínio'), { target: { value: 'd.net' } });
    fireEvent.change(screen.getByLabelText('Token pessoal (PAT)'), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar com o Jira' }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao conectar ao Jira', variant: 'destructive' })));
    expect(screen.getByRole('dialog', { name: 'Minha identidade' })).toBeTruthy();
  });

  it('conectado: mostra "Conectado", "Gerenciar", o token salvo e remove o token', async () => {
    h.jiraSettings = { domain: 'totvs.atlassian.net', token: 'tok' };
    render(<UserProfileModal />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    fireEvent.click(rowButton(/Gerenciar, Jira/));
    expect(screen.getByText('Token salvo')).toBeTruthy();
    expect((screen.getByLabelText('Domínio') as HTMLInputElement).value).toBe('totvs.atlassian.net');
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(h.removeSettings).toHaveBeenCalled());
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Token do Jira removido' }));
  });

  it('depois de sincronizar, "Usar o nome do Jira" salva o nome que veio de lá', async () => {
    h.jiraSettings = { domain: 'd.net', token: 'tok' };
    h.getMyself.mockResolvedValue({ displayName: 'Ana Ribeiro Silva', accountId: 'a' });
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Gerenciar, Jira/));
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar com o Jira' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Usar o nome do Jira' }));
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledWith({ name: 'Ana Ribeiro Silva' }, { keepOpen: true }));
  });
});

describe('UserProfileModal: linhas Senha e Aparência', () => {
  it('Senha abre o formulário de troca de senha', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Trocar, Senha/));
    expect(screen.getByText('formulário de senha')).toBeTruthy();
  });

  it('Aparência abre modo e temas e aplica na hora', () => {
    render(<UserProfileModal />);
    fireEvent.click(rowButton(/Mudar, Aparência/));
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }));
    expect(h.setMode).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByRole('radio', { name: /Corporativo/ }));
    expect(h.setVariant).toHaveBeenCalledWith('totvs');
    expect(document.querySelector('a[href="/configuracoes"]')).toBeNull();
  });
});
