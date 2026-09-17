'use client';

import React from 'react';
import { 
  User as UserIcon, 
  ShieldCheck, 
  Mail, 
  Briefcase, 
  Users, 
  Save, 
  Sparkles,
  Camera,
  Check
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { ROLES, SQUADS, AVATAR_SEEDS, PREDEFINED_AVATARS, GlobalRole } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

interface ProfileSettingsProps {
  profile: any;
  onUpdate: (data: any) => void;
}

export function ProfileSettings({ profile, onUpdate }: ProfileSettingsProps) {
  const [name, setName] = React.useState(profile?.name || '');
  const [role, setRole] = React.useState<GlobalRole | ''>(profile?.role || '');
  const [team, setTeam] = React.useState(profile?.squadId || profile?.team || '');
  const [email, setEmail] = React.useState(profile?.email || '');
  const [avatarSeed, setAvatarSeed] = React.useState(profile?.avatarSeed || AVATAR_SEEDS[0]);

  interface SquadOption {
    id: string;
    name: string;
  }
  const [dynamicSquads, setDynamicSquads] = React.useState<SquadOption[]>([]);
  const [isSquadsLoaded, setIsSquadsLoaded] = React.useState(false);

  React.useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    
    Promise.all([
      authFetch(`${apiUrl}/projects`).then(r => r.ok ? r.json() : []),
      authFetch(`${apiUrl}/squads`).then(r => r.ok ? r.json() : [])
    ])
    .then(([projectsData, squadsData]) => {
      const optionsMap = new Map<string, string>();
      
      if (Array.isArray(projectsData)) {
        projectsData.forEach((p: any) => {
          const id = String(p.id || p.jiraProjectKey || '').trim();
          const name = String(p.name || p.id || '').trim();
          if (id) optionsMap.set(id, name);
        });
      }

      if (Array.isArray(squadsData)) {
        squadsData.forEach((s: any) => {
          const id = String(s.id || s.jiraProjectKey || '').trim();
          const name = String(s.name || s.jiraProjectKey || s.id || '').trim();
          if (id && !optionsMap.has(id)) optionsMap.set(id, name);
        });
      }

      const mapped: SquadOption[] = Array.from(optionsMap.entries()).map(([id, name]) => ({ id, name }));
      setDynamicSquads(mapped);
    })
    .catch(err => console.warn('Erro ao carregar tabela projects/squads:', err))
    .finally(() => setIsSquadsLoaded(true));
  }, []);

  const handleSave = () => {
    onUpdate({
      name: name.trim(),
      role: role as GlobalRole,
      squadId: team.trim(),
      email: email.trim(),
      avatarSeed,
    });
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
            disabled={!name.trim() || !role}
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 active:scale-95 transition-all"
          >
            <Save className="h-4 w-4" />
            Salvar Perfil
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Dados da Conta */}
        <Card className="col-span-1 xl:col-span-7 rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <NiceAvatar
                  className="h-14 w-14 rounded-2xl shadow-sm border border-border/80"
                  {...(PREDEFINED_AVATARS[avatarSeed] || genConfig(avatarSeed))}
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-md flex items-center justify-center text-primary-foreground border-2 border-background shadow-xs">
                  <Check className="h-3 w-3" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">{name || 'Seu Nome'}</h3>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">{role || 'Função'}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{email || 'email@exemplo.com'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome Completo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl font-medium border-border/80 bg-background text-foreground"
                  placeholder="Como você quer ser chamado?"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail Profissional</Label>
                <Input
                  value={email}
                  disabled
                  className="h-11 rounded-xl font-medium border-border/80 bg-muted text-muted-foreground cursor-not-allowed opacity-75"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Papel na Squad</Label>
                <Select value={role} onValueChange={(v: GlobalRole) => setRole(v)}>
                  <SelectTrigger className="h-11 rounded-xl font-medium border-border/80 bg-background text-foreground">
                    <SelectValue placeholder="Selecione seu papel" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border bg-popover shadow-xl p-1.5">
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r} className="font-semibold text-xs py-2 rounded-lg">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Squad Principal
                </Label>
                <div className="flex flex-col gap-2">
                  <Select
                    value={dynamicSquads.some(s => s.id === team) ? team : (team ? 'other' : '')}
                    onValueChange={(v) => { if (v !== 'other') setTeam(v); else setTeam(''); }}
                  >
                    <SelectTrigger className="h-11 rounded-xl font-medium border-border/80 bg-background text-foreground">
                      <SelectValue placeholder="Selecione sua Squad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border bg-popover shadow-xl p-1.5 max-h-56">
                      {!isSquadsLoaded && (
                        <SelectItem value="loading" disabled className="text-xs text-muted-foreground">
                          Carregando projetos...
                        </SelectItem>
                      )}
                      {isSquadsLoaded && dynamicSquads.map((sq) => (
                        <SelectItem key={sq.id} value={sq.id} className="font-semibold text-xs py-2 rounded-lg">
                          {sq.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="other" className="font-semibold text-xs py-2 rounded-lg text-primary">
                        + Outra Squad (Digitar)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {(team === 'other' || (!dynamicSquads.some(s => s.id === team) && team !== '')) && (
                    <Input
                      value={team === 'other' ? '' : team}
                      onChange={(e) => setTeam(e.target.value)}
                      className="h-10 rounded-xl border-primary/30 bg-primary/5 font-bold uppercase text-xs tracking-wider text-primary"
                      placeholder="Nome da Squad"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personalização de Avatar */}
        <Card className="col-span-1 xl:col-span-5 rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Identidade & Avatar</h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Selecione seu avatar para cerimônias e votações no Espaço Ágil</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {AVATAR_SEEDS.map((seed) => (
                <button
                  key={seed}
                  onClick={() => setAvatarSeed(seed)}
                  className={cn(
                    "relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 transition-all outline-none rounded-2xl border-2 p-1",
                    avatarSeed === seed
                      ? "border-primary bg-background shadow-md scale-105 z-10 ring-2 ring-primary/20"
                      : "border-transparent opacity-50 hover:opacity-100 hover:scale-105 bg-muted/30"
                  )}
                >
                  <NiceAvatar className="w-full h-full rounded-xl" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
                  {avatarSeed === seed && (
                    <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground p-1 rounded-full shadow-xs">
                      <Sparkles className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
