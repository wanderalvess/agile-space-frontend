'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { PREDEFINED_AVATARS } from '@/lib/types';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  Trash2, 
  Zap, 
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { UserProfile, GlobalRole, ROLES, AUTH_ROLES } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { userApi } from '@/app/users/api';
import { useUserContext } from '@/context/UserContext';
import { PasswordResetManager } from './PasswordResetManager';

export function UserExplorer() {
  const { userProfile: currentUser } = useUserContext();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(30);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userApi.getAllUsers();
      setUsers(data);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar usuários', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      // 'admin' filtra pelo tier de autorização real (u.role); os demais chips filtram
      // pelo cargo de negócio (u.jobTitle) — campos e vocabulários diferentes.
      const matchRole = selectedRole === 'all'
        || (selectedRole === 'admin' ? (u.role || '').toUpperCase() === 'ADMIN' : u.jobTitle === selectedRole);
      return matchSearch && matchRole;
    });
  }, [users, searchTerm, selectedRole]);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleLimit);
  }, [filteredUsers, visibleLimit]);

  const handleUpdateUser = async (userId: string, data: Partial<UserProfile>) => {
    setUpdatingId(userId);
    try {
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) return;
      const updated = await userApi.saveUser({ ...targetUser, ...data });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
      toast({ title: "Usuário atualizado", description: "Alterações sincronizadas no banco PostgreSQL." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na atualização" });
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) setSelectedIds([]);
    else setSelectedIds(paginatedUsers.map(u => u.id));
  };

  return (
    <div className="space-y-6">
      <PasswordResetManager />
      <Card className="border border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl shadow-slate-200/10 dark:shadow-slate-900/10 p-2 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-2">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            <Input 
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-slate-50/50 dark:bg-slate-800/50 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/20 rounded-xl font-medium transition-all"
            />
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar gap-1">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'admin', label: 'Admins' },
              { id: 'People Lead', label: 'Gestão/Liderança' },
              { id: 'Product Owner', label: 'PO/PM' },
              { id: 'Agile Master', label: 'Agile/Scrum' },
              { id: 'Tech Lead', label: 'Tech Leads' },
              { id: 'Developer', label: 'Devs' }
            ].map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  selectedRole === role.id ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {role.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon" onClick={() => fetchUsers()} disabled={loading} className="h-12 w-12 rounded-xl border-slate-200/60 dark:border-slate-700/60 hover:border-primary hover:text-primary transition-all shrink-0">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Exibindo {filteredUsers.length} de {users.length} Usuários (PostgreSQL)
        </p>
      </div>

      <Card className="border border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl shadow-slate-200/10 dark:shadow-slate-900/10 overflow-hidden min-h-[400px] flex flex-col relative">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <AgileSpinner size="lg" title="Buscando Usuários" subtitle="Sincronizando com PostgreSQL..." />
          </div>
        ) : null}
        
        <div className="flex-1 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-950/20">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800/50">
                <TableHead className="w-14 pl-8 py-4"><Checkbox checked={selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0} onCheckedChange={toggleSelectAll} className="border-slate-300 dark:border-slate-700" /></TableHead>
                <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Usuário / Identidade</TableHead>
                <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Cargo</TableHead>
                <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Nível de Acesso</TableHead>
                <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Equipe / Squad</TableHead>
                <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Jira Account ID</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody className="divide-y divide-slate-50 dark:divide-slate-800/30">
            <AnimatePresence mode="popLayout">
              {paginatedUsers.map((u, index) => {
                const avatarConfig = PREDEFINED_AVATARS[u.avatarSeed || ''] || genConfig(u.avatarSeed || u.email || u.name || 'Felix');

                return (
                  <motion.tr 
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn("group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors", selectedIds.includes(u.id) && "bg-primary/5 dark:bg-primary/10")}
                  >
                    <TableCell className="pl-8 py-2.5"><Checkbox checked={selectedIds.includes(u.id)} onCheckedChange={() => toggleSelect(u.id)} className="border-slate-300 dark:border-slate-600" /></TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <NiceAvatar className="w-9 h-9 border-2 border-white dark:border-slate-800 shadow-sm" {...avatarConfig} />
                          {(u.role || '').toUpperCase() === 'ADMIN' && <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full shadow-sm"><Zap className="h-2 w-2" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors text-xs">{u.name || 'Sem Nome'}</span>
                          <span className="text-[10px] font-medium text-slate-400 lowercase tracking-tight italic">{u.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {/* Cargo de negócio — auto-serviço, sem efeito de autorização */}
                      <Select
                        defaultValue={u.jobTitle || undefined}
                        onValueChange={(val) => handleUpdateUser(u.id, { jobTitle: val as GlobalRole })}
                        disabled={updatingId === u.id}
                      >
                        <SelectTrigger className="h-7 w-32 rounded-lg border-transparent font-black text-[9px] uppercase tracking-widest transition-all focus:ring-1 focus:ring-primary focus:ring-offset-0 bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50">
                          <SelectValue placeholder="Sem cargo" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                          {ROLES.map(role => (
                            <SelectItem key={role} value={role} className="text-[10px] font-black uppercase tracking-widest cursor-pointer">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {/* Nível de autorização real — controla acesso a /admin no backend */}
                      <Select
                        defaultValue={(u.role || 'MEMBER').toUpperCase()}
                        onValueChange={(val) => handleUpdateUser(u.id, { role: val } as Partial<UserProfile>)}
                        disabled={updatingId === u.id}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-28 rounded-lg border-transparent font-black text-[9px] uppercase tracking-widest transition-all focus:ring-1 focus:ring-primary focus:ring-offset-0",
                          (u.role || '').toUpperCase() === 'ADMIN' ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                          {AUTH_ROLES.map(role => (
                            <SelectItem key={role} value={role} className="text-[10px] font-black uppercase tracking-widest cursor-pointer">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2.5"><Badge variant="ghost" className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-slate-200/50 dark:border-slate-700/50 text-[9px] font-black uppercase tracking-widest rounded-lg px-2 py-1">{u.squadId || u.team || 'Sem Squad'}</Badge></TableCell>
                    <TableCell className="py-2.5 text-[10px] font-mono text-slate-500">{u.jiraAccountId || '—'}</TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
        </div>
        {filteredUsers.length > visibleLimit && (
           <div className="p-4 border-t border-slate-50 flex justify-center">
             <Button variant="ghost" onClick={() => setVisibleLimit(prev => prev + 30)} className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all gap-2">
               Carregar Mais Usuários <ArrowUpRight className="h-3 w-3 rotate-90" />
             </Button>
           </div>
        )}
      </Card>
    </div>
  );
}
