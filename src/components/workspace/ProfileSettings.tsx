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
    <div className="w-full space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg rounded-3xl overflow-hidden flex flex-col">
        {/* Header - Compact Full Width */}
        <div className="bg-slate-900 dark:bg-slate-950 p-6 md:p-8 border-b border-slate-800 relative overflow-hidden shrink-0">
           <div className="absolute top-0 right-0 w-[50%] h-full bg-primary/10 blur-[120px] rounded-full translate-x-1/2" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full -translate-x-1/4" />
           
           <div className="relative z-10 flex items-center justify-between">
             <div className="flex items-center gap-5">
               <div className="relative group shrink-0">
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <NiceAvatar 
                    className="h-14 w-14 md:h-16 md:w-16 rounded-2xl border-2 border-white shadow-xl" 
                    {...(PREDEFINED_AVATARS[avatarSeed] || genConfig(avatarSeed))} 
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-white border-2 border-slate-900 shadow-md">
                     <Camera className="h-3 w-3" />
                  </div>
               </div>
               <div className="space-y-1">
                 <h2 className="text-xl md:text-2xl font-black font-headline uppercase tracking-tight italic text-white leading-none">
                   Configuração do <span className="text-primary not-italic">Perfil</span>
                 </h2>
                 <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/50">
                   <ShieldCheck className="h-3 w-3 text-emerald-500" />
                   Sincronização Ativa
                 </div>
               </div>
             </div>
             
             <Button 
               onClick={handleSave} 
               disabled={!name.trim() || !role}
               className="hidden md:flex h-10 px-8 font-black uppercase tracking-[0.2em] text-[9px] rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 gap-2 border-none transition-all active:scale-95"
             >
               <Save className="h-3.5 w-3.5" />
               Salvar Perfil
             </Button>
           </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left Side: Information */}
          <div className="flex-[1.2] p-6 md:p-8 border-r border-slate-100 overflow-y-auto">
             <div className="max-w-2xl space-y-8">
               <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Dados da Conta</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Informações básicas visíveis na squad</p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                     <UserIcon className="h-3 w-3" /> Nome Completo
                   </Label>
                   <Input 
                     value={name} 
                     onChange={(e) => setName(e.target.value)} 
                     className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-primary/20" 
                     placeholder="Ex: Francisco Alves"
                   />
                 </div>
                 
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                     <Mail className="h-3 w-3" /> E-mail Profissional
                   </Label>
                   <Input 
                     value={email} 
                     onChange={(e) => setEmail(e.target.value)} 
                     className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-primary/20" 
                     placeholder="email@suaempresa.com"
                   />
                 </div>

                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                     <Briefcase className="h-3 w-3" /> Cargo / Papel
                   </Label>
                   <Select value={role} onValueChange={(v: GlobalRole) => setRole(v)}>
                     <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-sm">
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
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-sm">
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
          </div>

          {/* Right Side: Avatar Selection */}
          <div className="flex-1 p-6 md:p-8 bg-slate-50/30 overflow-y-auto">
             <div className="space-y-8">
               <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Personalização</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Escolha seu avatar de alta performance</p>
               </div>
               
               <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                 {AVATAR_SEEDS.map((seed) => (
                    <button
                      key={seed}
                      onClick={() => setAvatarSeed(seed)}
                      className={cn(
                        "relative aspect-square transition-all outline-none rounded-3xl border-4",
                        avatarSeed === seed 
                          ? "border-primary bg-white shadow-2xl scale-110 z-10 shadow-primary/20" 
                          : "border-transparent opacity-40 hover:opacity-100 hover:scale-105 bg-white/50"
                      )}
                    >
                      <NiceAvatar className="w-full h-full rounded-2xl" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
                      {avatarSeed === seed && (
                        <div className="absolute -top-2 -right-2 bg-primary text-white p-1 rounded-full shadow-lg">
                           <Sparkles className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                 ))}
               </div>

             </div>
          </div>
        </div>

        <div className="md:hidden p-6 bg-slate-50 border-t border-slate-100 shrink-0">
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || !role}
            className="w-full h-14 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl bg-slate-900 text-white gap-3"
          >
            <Save className="h-4 w-4 text-primary" />
            Salvar Alterações
          </Button>
        </div>
      </Card>
    </div>
  );
}
