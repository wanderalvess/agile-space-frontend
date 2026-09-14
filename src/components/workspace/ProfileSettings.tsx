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
  Camera
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
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <WorkspaceSectionHeader
        kicker="Perfil"
        accent="orange"
        title="Configuração do"
        titleAccent="Perfil"
        subtitle="Informações básicas visíveis na squad"
        action={
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !role}
            className="h-10 px-8 bg-slate-900 text-white dark:!bg-white dark:!text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-slate-900/10 dark:!shadow-black/30 active:scale-95 transition-all"
          >
            <Save className="h-3.5 w-3.5 text-primary" />
            Salvar Perfil
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dados da Conta */}
        <Card className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/5 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <NiceAvatar
                  className="h-12 w-12 rounded-2xl shadow-lg"
                  {...(PREDEFINED_AVATARS[avatarSeed] || genConfig(avatarSeed))}
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-md flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-md">
                  <Camera className="h-2.5 w-2.5" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Dados da Conta</h3>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Sincronização Ativa
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <UserIcon className="h-3 w-3" /> Nome Completo
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-primary/20"
                  placeholder="Ex: Francisco Alves"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <Mail className="h-3 w-3" /> E-mail Profissional
                </Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-primary/20"
                  placeholder="email@suaempresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <Briefcase className="h-3 w-3" /> Cargo / Papel
                </Label>
                <Select value={role} onValueChange={(v: GlobalRole) => setRole(v)}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r} className="font-bold text-xs py-3 pl-8 rounded-lg focus:bg-primary/5 uppercase tracking-tight">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                  <Users className="h-3 w-3" /> Squad Principal
                </Label>
                <div className="flex flex-col gap-2">
                  <Select
                    value={dynamicSquads.some(s => s.id === team) ? team : (team ? 'other' : '')}
                    onValueChange={(v) => { if (v !== 'other') setTeam(v); else setTeam(''); }}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold text-sm">
                      <SelectValue placeholder="Selecione o projeto..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px]">
                      {!isSquadsLoaded && (
                        <SelectItem value="loading" disabled className="text-xs text-slate-400 font-bold">
                          Carregando projetos...
                        </SelectItem>
                      )}
                      {isSquadsLoaded && dynamicSquads.map(sq => (
                        <SelectItem key={sq.id} value={sq.id} className="font-bold text-xs py-3 pl-8 rounded-lg focus:bg-primary/5 uppercase tracking-tight">{sq.name}</SelectItem>
                      ))}
                      <SelectItem value="other" className="text-[9px] font-black text-primary py-3 pl-8 rounded-lg focus:bg-primary/5 uppercase border-t border-slate-100 mt-1">+ Digitar Novo</SelectItem>
                    </SelectContent>
                  </Select>

                  {(!dynamicSquads.some(s => s.id === team) || team === 'other' || team === '') && (
                    <Input
                      value={team === 'other' ? '' : team}
                      onChange={(e) => setTeam(e.target.value)}
                      className="h-10 rounded-lg border-primary/20 bg-primary/5 font-black uppercase text-[10px] tracking-widest text-primary"
                      placeholder="Nome da Squad"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personalização */}
        <Card className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/5 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />

          <div className="space-y-6 relative z-10">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Personalização</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Escolha seu avatar de alta performance</p>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
              {AVATAR_SEEDS.map((seed) => (
                <button
                  key={seed}
                  onClick={() => setAvatarSeed(seed)}
                  className={cn(
                    "relative aspect-square transition-all outline-none rounded-2xl border-4",
                    avatarSeed === seed
                      ? "border-primary bg-white shadow-2xl scale-110 z-10 shadow-primary/20"
                      : "border-transparent opacity-40 hover:opacity-100 hover:scale-105 bg-slate-50/50"
                  )}
                >
                  <NiceAvatar className="w-full h-full rounded-lg" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
                  {avatarSeed === seed && (
                    <div className="absolute -top-2 -right-2 bg-primary text-white p-1 rounded-full shadow-lg">
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
