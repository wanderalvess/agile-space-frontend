'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { MODAL_OVERLAY, MODAL_SURFACE, FOCUS_RING } from '@/components/room-kit';
import { useUserContext } from '@/context/UserContext';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { cn } from '@/lib/utils';
import { resolveCargo } from '@/lib/cargo';
import { isUserLeadershipOrAdmin } from '@/lib/dashboard-roles';
import { NAME_EDITOR_ATTR } from '@/components/profile/EditableName';
import { IdentityHero } from '@/components/profile/IdentityHero';
import { RowAppearance } from '@/components/profile/RowAppearance';
import { RowCargo } from '@/components/profile/RowCargo';
import { RowJira } from '@/components/profile/RowJira';
import { RowPassword } from '@/components/profile/RowPassword';
import { RowSquads } from '@/components/profile/RowSquads';
import { VisitorPanel } from '@/components/profile/VisitorPanel';
import { useJiraConnection } from '@/components/profile/useJiraConnection';
import { useMyLinks } from '@/components/profile/useMyLinks';
import { useRestoreFocus } from '@/components/profile/useRestoreFocus';

type RowId = 'cargo' | 'squads' | 'jira' | 'senha' | 'aparencia';

/**
 * "Minha identidade": uma ficha única. Avatar (menu da foto), nome editável no lugar e e-mail no topo; abaixo,
 * as linhas Cargo, Squads, Jira, Senha e Aparência, que expandem ali mesmo (uma aberta por vez). Tudo salva na hora,
 * sem abas nem botões Salvar/Cancelar. Projeto, squad e papel não se escolhem aqui: o vínculo nasce por Jira,
 * convite ou pedido aprovado.
 */
export function UserProfileModal() {
  const { userProfile, updateProfile, isEditProfileOpen, setIsEditProfileOpen, mustOnboard, legacyOnly, isIdentityRequested, setIsIdentityRequested, isPublicExploration } =
    useUserContext();

  const router = useRouter();
  const pathname = usePathname();
  const [openRow, setOpenRow] = useState<RowId | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);

  const isOpen = isEditProfileOpen || (isIdentityRequested && !isPublicExploration);
  // Sem sessão não há perfil para editar: o caminho é entrar.
  const isVisitor = !userProfile || userProfile.isGuest;
  const canChangePassword = !isVisitor;
  const email = userProfile?.email || '';
  const name = userProfile?.name || '';
  const userStoreId = userProfile?.id || userProfile?.email;

  const restoreFocus = useRestoreFocus(isOpen);
  const { links, active: activeLink, activate, switchingTo, canSwitch } = useMyLinks();
  const jira = useJiraConnection({ isOpen, userStoreId });

  // Foto do Jira: da importação do time, da última sincronização ou da sincronização feita agora, no modal.
  const { photo, reportBroken, available: photoAvailable, photoOff, setPhotoOff, hasUploaded } = useProfilePhoto({
    jiraAvatarUrls: jira.account?.avatarUrls,
    jiraAccountId: jira.account?.accountId,
  });

  // Ao fechar, a próxima abertura volta com tudo recolhido.
  useEffect(() => {
    if (!isOpen) setOpenRow(null);
  }, [isOpen]);

  /** Operações em andamento (foto, nome, sincronização do Jira) seguram o fechamento da janela. */
  const preventClose = heroBusy || jira.syncing;

  const toggle = (id: RowId) => setOpenRow((cur) => (cur === id ? null : id));

  const closeModal = () => {
    setIsEditProfileOpen(false);
    setIsIdentityRequested(false);
  };

  const goLogin = () => {
    closeModal();
    const here = typeof window !== 'undefined' ? `${pathname}${window.location.search}` : pathname;
    router.push(`/login?returnUrl=${encodeURIComponent(here)}`);
  };

  // Só o nome é da pessoa: papel e squad seguem os do vínculo (o contexto reenvia os valores atuais).
  const saveName = async (next: string) => {
    await updateProfile({ name: next });
  };

  // Mesmo cargo da administração, do Poker e da Retro (lib/cargo.ts); sem ele, o papel do vínculo ativo.
  const roleOfPerson = userProfile?.cargo || resolveCargo(undefined, activeLink?.role);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !preventClose) closeModal();
      }}
    >
      <DialogPortal>
        <DialogOverlay className={MODAL_OVERLAY} />
        <DialogPrimitive.Content
          className={cn(
            MODAL_SURFACE,
            'sm:max-h-[min(92vh,760px)] sm:max-w-[560px]',
            'max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0',
          )}
          onOpenAutoFocus={(e) => {
            // Foco na própria janela (não no primeiro botão): o anel só aparece quando a pessoa usa Tab.
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={restoreFocus}
          // Esc dentro do campo do nome só cancela a edição.
          onEscapeKeyDown={(e) => {
            if (e.target instanceof Element && e.target.closest(`[${NAME_EDITOR_ATTR}]`)) e.preventDefault();
          }}
        >
          <header className="flex h-14 shrink-0 items-center pl-6 pr-2 max-sm:pl-4">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">Minha identidade</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Seu nome, foto, cargo, squads, Jira, senha e aparência.</DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
            </DialogPrimitive.Close>
          </header>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {isVisitor ? (
              <VisitorPanel onLogin={goLogin} />
            ) : (
              <>
                <IdentityHero
                  userId={userProfile?.id}
                  name={name}
                  email={email}
                  photo={photo}
                  onPhotoError={reportBroken}
                  hasUploaded={hasUploaded}
                  photoAvailable={photoAvailable}
                  photoOff={photoOff}
                  onPhotoOff={setPhotoOff}
                  onSaveName={saveName}
                  onBusyChange={setHeroBusy}
                />
                <div>
                  <RowCargo
                    open={openRow === 'cargo'}
                    onToggle={() => toggle('cargo')}
                    cargo={roleOfPerson}
                    email={email}
                    name={name}
                    squad={activeLink?.id}
                    leadership={!!activeLink?.leadership || isUserLeadershipOrAdmin(roleOfPerson)}
                    onNavigate={closeModal}
                  />
                  <RowSquads
                    open={openRow === 'squads'}
                    onToggle={() => toggle('squads')}
                    links={links}
                    active={activeLink}
                    canSwitch={canSwitch}
                    switchingTo={switchingTo}
                    onActivate={(link) => void activate(link)}
                    email={email}
                    mustOnboard={mustOnboard}
                    legacyOnly={legacyOnly}
                    onNavigate={closeModal}
                  />
                  <RowJira open={openRow === 'jira'} onToggle={() => toggle('jira')} jira={jira} currentName={name} onUseJiraName={(n) => void saveName(n)} />
                  {canChangePassword && <RowPassword open={openRow === 'senha'} onToggle={() => toggle('senha')} />}
                  <RowAppearance open={openRow === 'aparencia'} onToggle={() => toggle('aparencia')} />
                </div>
              </>
            )}
          </div>

          {!isVisitor && (
            <footer role="status" className="flex h-14 shrink-0 items-center gap-2 border-t border-border px-6 text-[13px] text-muted-foreground max-sm:px-4">
              <Check aria-hidden="true" className="h-4 w-4 text-emerald-700 dark:text-emerald-400" strokeWidth={1.5} />
              As alterações são salvas na hora.
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
