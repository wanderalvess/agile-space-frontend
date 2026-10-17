'use client';

import React from 'react';
import { Crown, Link2, Save, UserRound } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ModalButton, RoleChip, StatusChip } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import { useMyLinks } from '@/components/profile/useMyLinks';
import { originSummary } from '@/lib/my-links';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { useUserContext } from '@/context/UserContext';
import type { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FIELD_LABEL, Field, TEXT_INPUT, WorkspaceSectionHeader } from './workspace-ui';

interface ProfileSettingsProps {
  profile: UserProfile | null;
  onUpdate: (data: Partial<UserProfile>) => void;
}

/**
 * Perfil no "Meu espaço": só o que é da pessoa (nome editável, e-mail da conta). Projeto, squad e papel
 * não se escolhem aqui: vêm dos vínculos (Jira, convite ou pedido aprovado), listados abaixo em leitura.
 */
export function ProfileSettings({ profile, onUpdate }: ProfileSettingsProps) {
  const [name, setName] = React.useState(profile?.name || '');
  const email = profile?.email || '';
  const { photo, reportBroken } = useProfilePhoto();
  const { links } = useMyLinks();
  const { setIsEditProfileOpen } = useUserContext();
  const changed = name.trim() !== (profile?.name || '');

  const handleSave = () => {
    onUpdate({ name: name.trim() });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Configuração do perfil"
        subtitle="Informações básicas e identidade que aparecem para a sua squad"
        action={
          <ModalButton variant="primary" onClick={handleSave} disabled={!name.trim() || !changed}>
            <Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Salvar perfil
          </ModalButton>
        }
      />

      <section className={cn(PAGE_CARD, 'flex flex-col gap-6 rounded-3xl p-6 md:p-7')}>
        <div className="flex items-center gap-4">
          <InitialsAvatar name={name} email={email} src={photo} onPhotoError={reportBroken} className="h-14 w-14 border border-border text-lg" />
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-foreground">{name || 'Seu nome'}</h3>
            <p className="truncate text-sm text-muted-foreground">{email || 'email@exemplo.com'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 md:grid-cols-2">
          <Field label="Nome completo" htmlFor="ws-profile-name">
            <input id="ws-profile-name" value={name} onChange={(e) => setName(e.target.value)} className={TEXT_INPUT} placeholder="Como você quer ser chamado?" autoComplete="name" />
          </Field>
          <Field label="E-mail profissional" htmlFor="ws-profile-email">
            <input id="ws-profile-email" value={email} disabled className={cn(TEXT_INPUT, 'cursor-not-allowed')} />
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn(FIELD_LABEL, 'flex items-center gap-2')}>
              <UserRound className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Meus vínculos
            </span>
            <ModalButton className="h-9 gap-2 px-3 text-[13px]" onClick={() => setIsEditProfileOpen(true)}>
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Ver e gerenciar
            </ModalButton>
          </div>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não tem vínculos.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {links.map((l) => {
                const derived = l.scope !== 'SQUAD' && !!l.scopeLabel;
                const origin = derived ? null : originSummary(l);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <span className="text-[13px] font-semibold text-foreground">{l.name}</span>
                    {derived ? (
                      <StatusChip tone="warn">{l.scopeLabel}</StatusChip>
                    ) : l.roles.length > 0 ? (
                      l.roles.map((r, i) => <RoleChip key={`${r.name}-${i}`} category={r.name} label={r.name} />)
                    ) : (
                      l.role && <RoleChip category={l.role} label={l.role} />
                    )}
                    {l.leadership && !derived && <Crown aria-label="Liderança" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" strokeWidth={1.5} />}
                    {origin && <span className="text-xs text-muted-foreground">{origin}</span>}
                    {l.active && <StatusChip tone="success">Ativa</StatusChip>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
