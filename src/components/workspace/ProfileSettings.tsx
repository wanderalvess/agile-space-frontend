'use client';

import React from 'react';
import { Check, Crown, Link2, Save, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { RoleChip, StatusChip } from '@/components/room-kit';
import { useMyLinks } from '@/components/profile/useMyLinks';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { useUserContext } from '@/context/UserContext';
import type { UserProfile } from '@/lib/types';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

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
    <div className="w-full space-y-6 animate-in fade-in duration-700">
      <WorkspaceSectionHeader
        kicker="Perfil"
        accent="orange"
        title="Configuração do"
        titleAccent="Perfil"
        subtitle="Informações básicas e identidade visíveis na sua squad"
        action={
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !changed}
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 active:scale-95 transition-all"
          >
            <Save className="h-4 w-4" />
            Salvar Perfil
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Dados da Conta */}
        <Card className="col-span-1 xl:col-span-8 rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <InitialsAvatar
                  name={name}
                  email={email}
                  src={photo}
                  onPhotoError={reportBroken}
                  className="h-14 w-14 border border-border/80 text-lg shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-md flex items-center justify-center text-primary-foreground border-2 border-background shadow-xs">
                  <Check className="h-3 w-3" />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-foreground uppercase tracking-tight">{name || 'Seu Nome'}</h3>
                <p className="truncate text-xs text-muted-foreground font-mono mt-0.5">{email || 'email@exemplo.com'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div className="space-y-1.5">
                <Label htmlFor="ws-profile-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome Completo</Label>
                <Input
                  id="ws-profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl font-medium border-border/80 bg-background text-foreground"
                  placeholder="Como você quer ser chamado?"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ws-profile-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail Profissional</Label>
                <Input
                  id="ws-profile-email"
                  value={email}
                  disabled
                  className="h-11 rounded-xl font-medium border-border/80 bg-muted text-muted-foreground cursor-not-allowed opacity-75"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5" /> Meus vínculos
                </Label>
                <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(true)} className="h-9 gap-2 rounded-xl text-xs font-semibold">
                  <Link2 className="h-3.5 w-3.5" />
                  Ver e gerenciar
                </Button>
              </div>
              {links.length === 0 ? (
                <p className="ml-1 text-xs text-muted-foreground">Você ainda não tem vínculos.</p>
              ) : (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs font-semibold text-foreground">{l.name}</span>
                      {l.role && <RoleChip category={l.role} label={l.role} />}
                      {l.leadership && <Crown aria-label="Liderança" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" strokeWidth={1.5} />}
                      {l.active && <StatusChip tone="success">Ativa</StatusChip>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
