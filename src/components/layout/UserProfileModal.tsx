'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Link2, Loader2, Plug, ShieldCheck, UserRound } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { userApi } from '@/app/users/api';
import { bestJiraAvatar, writeStoredProfilePhoto } from '@/lib/profile-photo';
import { Modal, ModalButton } from '@/components/room-kit';
import { ChangePasswordSection } from '@/components/layout/ChangePasswordSection';
import { IdentityHeader } from '@/components/profile/IdentityHeader';
import { IdentityNav, type IdentityNavItem } from '@/components/profile/IdentityNav';
import { JiraPanel, type JiraAccount } from '@/components/profile/JiraPanel';
import { LinksSection } from '@/components/profile/LinksSection';
import { ProfileSection, type ProfileErrors } from '@/components/profile/ProfileSection';
import { VisitorPanel } from '@/components/profile/VisitorPanel';
import { useMyLinks } from '@/components/profile/useMyLinks';
import { resolveCargo } from '@/lib/cargo';
import { isUserLeadershipOrAdmin } from '@/lib/dashboard-roles';
import { useRestoreFocus } from '@/components/profile/useRestoreFocus';

type TabId = 'profile' | 'links' | 'jira' | 'security';

/**
 * "Minha identidade": quem a pessoa é (nome, foto), as squads a que ela está vinculada (somente leitura),
 * a conexão com o Jira e a troca de senha. Projeto, squad e papel não se escolhem aqui: o vínculo nasce
 * por Jira, convite ou pedido aprovado (ver "Meus vínculos").
 */
export function UserProfileModal() {
  const { settings: jiraSettingsStore, saveSettings: saveJiraSettings, removeSettings: removeJiraSettings } = useJiraSettings();
  const { userProfile, updateProfile, isEditProfileOpen, setIsEditProfileOpen, mustOnboard, legacyOnly, isIdentityRequested, setIsIdentityRequested, isPublicExploration } =
    useUserContext();

  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [name, setName] = useState('');

  // Jira PAT Token & Domain
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [rememberJira, setRememberJira] = useState(true);
  // O PAT guardado não volta para o campo: a tela mostra "salvo" e só pede o valor de novo ao trocar.
  const [replacingToken, setReplacingToken] = useState(false);
  const hasSavedToken = !!jiraSettingsStore?.token && !replacingToken;
  const [jiraAccountDetails, setJiraAccountDetails] = useState<JiraAccount | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  const isOpen = isEditProfileOpen || (isIdentityRequested && !isPublicExploration);
  // Sem sessão não há perfil para editar: o caminho é entrar.
  const isVisitor = !userProfile || userProfile.isGuest;
  const canChangePassword = !isVisitor;
  const email = userProfile?.email || '';
  const isAdmin = userProfile?.role === 'admin';

  const restoreFocus = useRestoreFocus(isOpen);
  const { links, active: activeLink, activate, switchingTo, canSwitch } = useMyLinks();

  // Foto do Jira: da importação do time, da última sincronização ou da sincronização feita agora, no modal.
  const { photo, reportBroken, available: photoAvailable, photoOff, setPhotoOff, hasUploaded } = useProfilePhoto({
    jiraAvatarUrls: jiraAccountDetails?.avatarUrls,
    jiraAccountId: jiraAccountDetails?.accountId,
  });
  const connected = !!jiraSettingsStore?.token || !!jiraAccountDetails;

  // Carrega configurações de Jira salvas — fonte única é useJiraSettings (mesma
  // usada em ConnectivitySettings/JiraImportDialog), sem slots de localStorage próprios.
  useEffect(() => {
    if (isOpen && jiraSettingsStore) {
      setJiraDomain(jiraSettingsStore.domain || '');
      setJiraToken('');
      setReplacingToken(false);
    }
  }, [isOpen, jiraSettingsStore]);

  // O nome em edição parte do nome da conta ao abrir (e acompanha o nome salvo).
  useEffect(() => {
    if (isOpen) setName(userProfile?.name || '');
  }, [isOpen, userProfile?.name]);

  // Ao abrir: volta para a seção Perfil, limpa erros e põe o foco no nome (só com mouse/teclado;
  // no celular o teclado não deve abrir sozinho). Ao fechar: esquece a conta sincronizada.
  useEffect(() => {
    if (!isOpen) {
      setJiraAccountDetails(null);
      return;
    }
    setActiveTab('profile');
    setErrors({});
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) {
      const t = window.setTimeout(() => nameRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  const userStoreId = userProfile?.id || userProfile?.email;

  const handleSyncFromJira = async (customToken?: string, customDomain?: string) => {
    const tokenToUse = (customToken || jiraToken || jiraSettingsStore?.token || '').trim();
    const domainToUse = (customDomain || jiraDomain || jiraSettingsStore?.domain || '').trim();

    if (!tokenToUse) {
      toast({ title: 'Token do Jira necessário', variant: 'destructive' });
      setActiveTab('jira');
      return;
    }

    if (!domainToUse) {
      toast({ title: 'Domínio do Jira necessário', variant: 'destructive' });
      setActiveTab('jira');
      return;
    }

    setIsSyncingJira(true);
    try {
      const jiraUser: JiraAccount | null = await userApi.getMyself(domainToUse, tokenToUse);
      if (jiraUser) {
        if (jiraUser.displayName) setName(jiraUser.displayName);

        if (rememberJira) {
          // Salva credenciais na fonte única (useJiraSettings): localStorage escopado por
          // usuário + backend, mesmo slot usado em ConnectivitySettings/JiraImportDialog.
          saveJiraSettings({ domain: domainToUse, token: tokenToUse });
          setJiraToken('');
          setReplacingToken(false);
        }
        setJiraDomain(domainToUse);
        setJiraAccountDetails(jiraUser);
        // A foto fica guardada para os cabeçalhos mostrarem a mesma imagem.
        writeStoredProfilePhoto(userStoreId, bestJiraAvatar(jiraUser.avatarUrls) ?? null);
        setErrors((e) => ({ ...e, name: undefined }));

        toast({
          title: 'Jira sincronizado',
          description: `Identidade carregada: ${jiraUser.displayName || jiraUser.name}.`,
        });
      }
    } catch (err) {
      toast({
        title: 'Erro ao conectar ao Jira',
        description: (err instanceof Error && err.message) || 'Verifique o token e o domínio.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingJira(false);
    }
  };

  const handleRemoveToken = async () => {
    await removeJiraSettings();
    setJiraToken('');
    setJiraAccountDetails(null);
    // Sem token, a foto sincronizada some e voltam as iniciais (se o time não tiver foto).
    writeStoredProfilePhoto(userStoreId, null);
    toast({ title: 'Token do Jira removido', description: 'Ele saiu deste navegador e da sua conta.' });
  };

  const closeModal = () => {
    setIsEditProfileOpen(false);
    setIsIdentityRequested(false);
  };

  const goLogin = () => {
    closeModal();
    const here = typeof window !== 'undefined' ? `${pathname}${window.location.search}` : pathname;
    router.push(`/login?returnUrl=${encodeURIComponent(here)}`);
  };

  const dirty = !!userProfile && name.trim() !== (userProfile.name || '');
  const canSave = !saving && dirty;

  const handleSave = async () => {
    if (!name.trim()) {
      setErrors({ name: 'Informe seu nome.' });
      setActiveTab('profile');
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      window.setTimeout(() => nameRef.current?.focus(), 0);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      // Só o nome é da pessoa: papel e squad seguem os do vínculo (o contexto reenvia os valores atuais).
      await updateProfile({ name: name.trim() });
      toast({ title: 'Perfil atualizado' });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const items: IdentityNavItem<TabId>[] = [
    { id: 'profile', label: 'Perfil', icon: UserRound },
    { id: 'links', label: 'Meus vínculos', icon: Link2, count: links.length },
    { id: 'jira', label: 'Jira', icon: Plug, dot: connected },
    ...(canChangePassword ? [{ id: 'security' as const, label: 'Segurança', icon: ShieldCheck }] : []),
  ];
  const tab: TabId = items.some((t) => t.id === activeTab) ? activeTab : 'profile';

  // Mesmo cargo da administração, do Poker e da Retro (lib/cargo.ts); sem ele, o papel do vínculo ativo.
  const roleOfPerson = userProfile?.cargo || resolveCargo(undefined, activeLink?.role);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
      size="lg"
      icon={UserRound}
      title="Minha identidade"
      preventClose={saving}
      bodyClassName="p-0"
      closeClassName="max-sm:h-11 max-sm:w-11"
      onCloseAutoFocus={restoreFocus}
      className="sm:h-[min(88vh,720px)] sm:max-w-[960px] max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
      headerExtra={
        isVisitor ? undefined : (
          <IdentityHeader
            name={name}
            email={email}
            photo={photo}
            onPhotoError={reportBroken}
            jiraConnected={connected}
            isAdmin={isAdmin}
            role={roleOfPerson}
            activeSquad={activeLink}
          />
        )
      }
      footerStart={
        isVisitor || tab !== 'profile' ? undefined : (
          <span role="status" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {dirty ? (
              <>
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
                Alterações não salvas
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                Tudo salvo
              </>
            )}
          </span>
        )
      }
      footer={
        isVisitor || tab !== 'profile' ? (
          <ModalButton onClick={closeModal} className="max-sm:h-11">
            Fechar
          </ModalButton>
        ) : (
          <>
            <ModalButton onClick={closeModal} disabled={saving} className="max-sm:h-11">
              Cancelar
            </ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={!canSave} className="min-w-24 gap-2 max-sm:h-11">
              {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />}
              Salvar
            </ModalButton>
          </>
        )
      }
    >
      {isVisitor ? (
        <VisitorPanel onLogin={goLogin} />
      ) : (
        <div className="flex min-h-full flex-col md:flex-row">
          <aside aria-label="Seções da identidade" className="shrink-0 border-b border-border bg-card max-md:sticky max-md:top-0 max-md:z-10 md:w-56 md:border-b-0 md:border-r">
            <IdentityNav items={items} value={tab} onChange={setActiveTab} label="Seções da identidade" idPrefix="identity" />
          </aside>

          <div
            role="tabpanel"
            id={`identity-panel-${tab}`}
            aria-labelledby={`identity-tab-${tab}`}
            className={cn('min-w-0 flex-1 bg-background p-5 max-sm:p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200')}
          >
            {tab === 'profile' && (
              <ProfileSection
                name={name}
                onName={(v) => {
                  setName(v);
                  if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
                }}
                nameInput={nameRef}
                email={email}
                errors={errors}
                userId={userProfile?.id}
                cargo={roleOfPerson}
                leadership={!!activeLink?.leadership || isUserLeadershipOrAdmin(roleOfPerson)}
                squad={activeLink?.id}
                photo={photo}
                hasUploaded={hasUploaded}
                onPhotoError={reportBroken}
                photoAvailable={photoAvailable}
                photoOff={photoOff}
                onPhotoOff={setPhotoOff}
                onGoJira={() => setActiveTab('jira')}
                onNavigate={closeModal}
              />
            )}
            {tab === 'links' && (
              <LinksSection
                links={links}
                canSwitch={canSwitch}
                switchingTo={switchingTo}
                onActivate={(link) => void activate(link)}
                email={email}
                mustOnboard={mustOnboard}
                legacyOnly={legacyOnly}
                onNavigate={closeModal}
              />
            )}
            {tab === 'jira' && (
              <JiraPanel
                connected={connected}
                domain={jiraDomain}
                onDomain={setJiraDomain}
                token={jiraToken}
                onToken={setJiraToken}
                hasSavedToken={hasSavedToken}
                onReplaceToken={() => setReplacingToken(true)}
                onRemoveToken={handleRemoveToken}
                remember={rememberJira}
                onRemember={setRememberJira}
                syncing={isSyncingJira}
                onSync={() => handleSyncFromJira(jiraToken, jiraDomain)}
                account={jiraAccountDetails}
              />
            )}
            {tab === 'security' && canChangePassword && (
              <div className="[&>form]:gap-4 [&>form]:rounded-2xl [&>form]:bg-card [&>form]:p-4 sm:[&>form]:p-5">
                <ChangePasswordSection />
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
