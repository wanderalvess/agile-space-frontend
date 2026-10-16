'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, UserRound } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { userApi } from '@/app/users/api';
import { normalizeRole } from '@/lib/types';
import type { GlobalRole } from '@/lib/types';
import { bestJiraAvatar, writeStoredProfilePhoto } from '@/lib/profile-photo';
import { Modal, ModalButton, RoleChip, StatusChip, TabBar, useBelowBreakpoint } from '@/components/room-kit';
import { ChangePasswordSection } from '@/components/layout/ChangePasswordSection';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { JiraPanel, type JiraAccount } from '@/components/profile/JiraPanel';
import { ProfileFields, type ProfileErrors } from '@/components/profile/ProfileFields';
import { useRestoreFocus } from '@/components/profile/useRestoreFocus';
import { useSquadOptions } from '@/components/profile/useSquadOptions';

type TabId = 'profile' | 'jira' | 'security';

const TAB_LABELS: Record<TabId, string> = { profile: 'Perfil', jira: 'Jira', security: 'Segurança' };

/**
 * "Minha identidade": nome, papel, projeto/squad, conexão com o Jira e troca de senha. No topo, a foto do Jira
 * (quando há) ou um círculo com as iniciais do nome.
 */
export function UserProfileModal() {
  const { settings: jiraSettingsStore, saveSettings: saveJiraSettings, removeSettings: removeJiraSettings } = useJiraSettings();
  const {
    userProfile,
    userSquads,
    setGuestProfile,
    updateProfile,
    isEditProfileOpen,
    setIsEditProfileOpen,
    mustOnboard,
    isIdentityRequested,
    setIsIdentityRequested,
    isPublicExploration,
  } = useUserContext();

  const { toast } = useToast();
  const compact = useBelowBreakpoint(768);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});

  const [name, setName] = useState('');
  const [role, setRole] = useState<GlobalRole | ''>('');

  // Projeto e Squad separados
  const [projectId, setProjectId] = useState('');
  const [customProject, setCustomProject] = useState('');
  const [isCustomProject, setIsCustomProject] = useState(false);

  const [squadId, setSquadId] = useState('');
  const [customSquad, setCustomSquad] = useState('');
  const [isCustomSquad, setIsCustomSquad] = useState(false);

  const [email, setEmail] = useState('');

  // Jira PAT Token & Domain
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [rememberJira, setRememberJira] = useState(true);
  // O PAT guardado não volta para o campo: a tela mostra "salvo" e só pede o valor de novo ao trocar.
  const [replacingToken, setReplacingToken] = useState(false);
  const hasSavedToken = !!jiraSettingsStore?.token && !replacingToken;
  const [jiraAccountDetails, setJiraAccountDetails] = useState<JiraAccount | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLButtonElement>(null);
  const projectRef = useRef<HTMLButtonElement>(null);

  const isOpen = isEditProfileOpen || (isIdentityRequested && !isPublicExploration);
  const isNewUser = !userProfile || userProfile.isGuest || !userProfile.name;
  // Projeto/Squad de conta real já onboardada só troca pelo seletor do header
  // (useAuth().switchProject — autorizado, persiste no backend). Esse campo
  // aqui grava só localmente via updateProfile() e é sobrescrito no próximo
  // refresh de sessão, então deixar editável fingia uma troca que não pegava.
  const squadEditLocked = !isNewUser;
  // O e-mail vem da sessão autenticada: updateProfile() o descarta, então editá-lo não adiantava.
  const emailReadOnly = !!userProfile?.email;
  const canChangePassword = !!userProfile && !userProfile.isGuest;

  const restoreFocus = useRestoreFocus(isOpen);

  const { rawSquads, isSquadsLoaded, availableProjects, squadsForProject } = useSquadOptions({ isOpen, userProfile, userSquads });
  const availableSquadsForProject = squadsForProject(projectId);

  // Foto do Jira: da importação do time, da última sincronização ou da sincronização feita agora, no modal.
  const { photo, reportBroken } = useProfilePhoto({
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

  useEffect(() => {
    if (userProfile && isOpen && isSquadsLoaded) {
      setName(userProfile.name || '');
      const initialRole = userProfile.role ? normalizeRole(userProfile.role) : '';
      setRole(initialRole);
      setEmail(userProfile.email || '');

      const activeSquadOrProject = userProfile.squadId || '';
      const foundSquad = rawSquads.find((s) => s.id === activeSquadOrProject);
      if (foundSquad) {
        setProjectId(foundSquad.jiraProjectKey || foundSquad.id);
        setIsCustomProject(false);
        setIsCustomSquad(false);
        if (foundSquad.id !== foundSquad.jiraProjectKey) {
          setSquadId(foundSquad.id);
        } else {
          setSquadId('none');
        }
      } else if (availableProjects.some((p) => p.id === activeSquadOrProject)) {
        setProjectId(activeSquadOrProject);
        setIsCustomProject(false);
        setIsCustomSquad(false);
        setSquadId('none');
      } else if (activeSquadOrProject) {
        setProjectId('other');
        setCustomProject(activeSquadOrProject);
        setIsCustomProject(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, isOpen, isSquadsLoaded, rawSquads]);

  // Ao abrir: volta para a aba Perfil, limpa erros e põe o foco no nome (só com mouse/teclado;
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
        // Conta com e-mail da sessão não troca de e-mail (ele é descartado ao salvar).
        if (!emailReadOnly) {
          const resolvedEmail = jiraUser.emailAddress || email || '';
          if (resolvedEmail) setEmail(resolvedEmail);
        }

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

  const finalProject = isCustomProject ? customProject.trim() : projectId;
  const finalSquad = isCustomSquad ? customSquad.trim() : squadId && squadId !== 'none' ? squadId : finalProject;

  const dirty =
    !!userProfile &&
    (name.trim() !== (userProfile.name || '') ||
      role !== (userProfile.role ? normalizeRole(userProfile.role) : '') ||
      finalSquad !== (userProfile.squadId || ''));
  // Quem ainda não tem perfil completo precisa poder concluir mesmo sem mexer em nada.
  const canSave = !saving && (!userProfile || isSquadsLoaded) && (isNewUser || dirty);

  const handleSave = async () => {
    const next: ProfileErrors = {};
    if (!name.trim()) next.name = 'Informe seu nome.';
    if (!role) next.role = 'Selecione o papel.';
    if (!finalProject && !finalSquad) next.project = 'Selecione o projeto.';

    if (next.name || next.role || next.project) {
      setErrors(next);
      setActiveTab('profile');
      toast({
        title: next.name ? 'Nome obrigatório' : next.role ? 'Função obrigatória' : 'Projeto obrigatório',
        variant: 'destructive',
      });
      window.setTimeout(() => {
        (next.name ? nameRef.current : next.role ? roleRef.current : projectRef.current)?.focus();
      }, 0);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      if (!userProfile || userProfile.isGuest) {
        await setGuestProfile(name.trim(), role as GlobalRole, finalSquad, email.trim());
      } else {
        await updateProfile({
          name: name.trim(),
          role: role as GlobalRole,
          squadId: finalSquad,
          email: email.trim(),
        });
      }

      toast({ title: 'Perfil atualizado' });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: TAB_LABELS.profile },
    { id: 'jira' as const, label: TAB_LABELS.jira },
    ...(canChangePassword ? [{ id: 'security' as const, label: TAB_LABELS.security }] : []),
  ];
  const tab: TabId = tabs.some((t) => t.id === activeTab) ? activeTab : 'profile';

  const displayName = name.trim() || 'Seu nome';

  const summary = (
    <div className={compact ? 'flex items-center gap-4' : 'flex flex-col items-center gap-3 text-center'}>
      <InitialsAvatar
        name={name.trim()}
        email={email}
        src={photo}
        onPhotoError={reportBroken}
        title={name.trim() || undefined}
        className={cn('border border-border ring-2 ring-primary/25', compact ? 'h-16 w-16 text-xl' : 'h-24 w-24 text-3xl')}
      />
      <div className={compact ? 'flex min-w-0 flex-col items-start gap-1.5' : 'flex min-w-0 flex-col items-center gap-2'}>
        <p className="max-w-full break-words text-base font-semibold leading-tight text-foreground">{displayName}</p>
        {role && <RoleChip category={role} label={role} className="max-w-full truncate" />}
        <div className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap justify-center gap-1.5'}>
          {photo && <StatusChip tone="neutral">Foto do Jira</StatusChip>}
          {connected && <StatusChip tone="success">Jira conectado</StatusChip>}
        </div>
      </div>
    </div>
  );

  const profileFields = (
    <ProfileFields
      name={name}
      onName={(v) => {
        setName(v);
        if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
      }}
      nameInput={nameRef}
      email={email}
      onEmail={setEmail}
      emailReadOnly={emailReadOnly}
      role={role}
      onRole={(v) => {
        setRole(v);
        if (errors.role) setErrors((e) => ({ ...e, role: undefined }));
      }}
      roleTrigger={roleRef}
      projectId={projectId}
      onProject={(v) => {
        setProjectId(v);
        setIsCustomProject(v === 'other');
        setSquadId('none');
        setIsCustomSquad(false);
        if (errors.project) setErrors((e) => ({ ...e, project: undefined }));
      }}
      projectTrigger={projectRef}
      customProject={customProject}
      onCustomProject={setCustomProject}
      isCustomProject={isCustomProject}
      squadId={squadId}
      onSquad={(v) => {
        setSquadId(v);
        setIsCustomSquad(v === 'other');
      }}
      customSquad={customSquad}
      onCustomSquad={setCustomSquad}
      isCustomSquad={isCustomSquad}
      projects={availableProjects}
      squads={availableSquadsForProject}
      isSquadsLoaded={isSquadsLoaded}
      locked={squadEditLocked}
      errors={errors}
    />
  );

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
      size="lg"
      icon={UserRound}
      title="Minha identidade"
      bodyClassName="p-0"
      closeClassName="max-sm:h-11 max-sm:w-11"
      onCloseAutoFocus={restoreFocus}
      className="max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
      footer={
        <>
          <ModalButton onClick={closeModal} className="max-sm:h-11">
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={!canSave} className="min-w-24 gap-2 max-sm:h-11">
            {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />}
            {mustOnboard ? 'Finalizar acesso' : 'Salvar'}
          </ModalButton>
        </>
      }
    >
      <div className="flex min-h-full flex-col md:min-h-[500px] md:flex-row">
        <aside
          aria-label="Resumo da identidade"
          className={compact ? 'border-b border-border px-6 py-4' : 'flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-muted/30 p-5'}
        >
          {summary}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar tabs={tabs} value={tab} onChange={setActiveTab} label="Seções da identidade" idPrefix="identity" tabClassName="max-sm:h-11" />
          <div
            role="tabpanel"
            id={`identity-panel-${tab}`}
            aria-labelledby={`identity-tab-${tab}`}
            className="flex flex-col gap-5 p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          >
            {tab === 'profile' && profileFields}
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
            {tab === 'security' && canChangePassword && <ChangePasswordSection />}
          </div>
        </div>
      </div>
    </Modal>
  );
}
