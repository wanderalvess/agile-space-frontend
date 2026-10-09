'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  KeyRound,
  Zap,
  ArrowUpRight,
  RefreshCw,
  Info,
  Copy
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { UserProfile, ROLES, AUTH_ROLES } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { userApi } from '@/app/users/api';
import { adminApi } from '@/app/admin/api';
import { useUserContext } from '@/context/UserContext';
import { PasswordResetManager } from './PasswordResetManager';
import {
  activeAdminCount,
  apiErrorMessage,
  describeLastAccess,
  filterUsers,
  isActiveUser,
  isAdminUser,
  type StatusFilter,
} from './user-admin';

const HEAD = 'font-black uppercase text-[9px] tracking-widest text-slate-500 py-4';

export function UserExplorer() {
  const { userProfile: currentUser } = useUserContext();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [detailSquads, setDetailSquads] = useState<Array<{ squadId: string; role?: string }> | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserProfile | null>(null);
  const [confirmReset, setConfirmReset] = useState<UserProfile | null>(null);
  const [tempPassword, setTempPassword] = useState<{ email: string; pass: string } | null>(null);

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

  const filteredUsers = useMemo(
    () => filterUsers(users, { search: searchTerm, status: statusFilter, role: selectedRole }),
    [users, searchTerm, statusFilter, selectedRole],
  );

  const paginatedUsers = useMemo(() => filteredUsers.slice(0, visibleLimit), [filteredUsers, visibleLimit]);
  const adminCount = useMemo(() => activeAdminCount(users), [users]);

  const handleUpdateUser = async (
    userId: string,
    patch: { role?: string; active?: boolean; jobTitle?: string },
    okMessage = 'Usuário atualizado',
  ) => {
    setUpdatingId(userId);
    try {
      const updated = await userApi.adminPatchUser(userId, patch);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
      toast({ title: okMessage });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível alterar', description: apiErrorMessage(error) });
      // Recarrega para os seletores voltarem ao valor real do servidor.
      fetchUsers();
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetails = async (u: UserProfile) => {
    setDetailUser(u);
    setDetailSquads(null);
    try {
      setDetailSquads(await userApi.getUserSquads(u.id));
    } catch {
      setDetailSquads([]);
    }
  };

  const handleResetPassword = async (u: UserProfile) => {
    setUpdatingId(u.id);
    try {
      const result = await adminApi.resetUserPassword(u.id);
      if (result.tempPassword) setTempPassword({ email: u.email || u.name, pass: result.tempPassword });
      toast({ title: 'Senha temporária gerada', description: 'Repasse à pessoa fora do sistema. Ela fica visível por 1 hora.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Não foi possível redefinir a senha', description: apiErrorMessage(error) });
    } finally {
      setUpdatingId(null);
      setConfirmReset(null);
    }
  };

  const isSelf = (u: UserProfile) => u.id === currentUser?.id;
  const isLastAdmin = (u: UserProfile) => isAdminUser(u) && isActiveUser(u) && adminCount <= 1;

  return (
    <div className="space-y-6">
      <PasswordResetManager />
      <Card className="border border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl shadow-slate-200/10 dark:shadow-slate-900/10 p-2 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-2">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            <Input
              placeholder="Buscar por nome, e-mail ou id do Jira..."
              aria-label="Buscar usuários"
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

          <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl shrink-0 gap-1" role="group" aria-label="Filtrar por status">
            {([['all', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                aria-pressed={statusFilter === id}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  statusFilter === id ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon" aria-label="Recarregar usuários" onClick={() => fetchUsers()} disabled={loading} className="h-12 w-12 rounded-xl border-slate-200/60 dark:border-slate-700/60 hover:border-primary hover:text-primary transition-all shrink-0">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Exibindo {filteredUsers.length} de {users.length} usuários
        </p>
      </div>

      <Card className="border border-slate-200/50 dark:border-slate-800/50 rounded-[2rem] bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl shadow-slate-200/10 dark:shadow-slate-900/10 overflow-hidden min-h-[400px] flex flex-col relative">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <AgileSpinner size="lg" title="Buscando usuários" subtitle="Carregando a lista..." />
          </div>
        ) : null}

        <div className="flex-1 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-950/20">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800/50">
                <TableHead className={cn(HEAD, 'pl-8')}>Usuário / Identidade</TableHead>
                <TableHead className={HEAD}>Status</TableHead>
                <TableHead className={HEAD}>Último acesso</TableHead>
                <TableHead className={HEAD}>Cargo</TableHead>
                <TableHead className={HEAD}>Nível de acesso</TableHead>
                <TableHead className={HEAD}>Equipe / Squad</TableHead>
                <TableHead className={HEAD}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50 dark:divide-slate-800/30">
              <AnimatePresence mode="popLayout">
                {paginatedUsers.map((u, index) => {
                  const avatarConfig = PREDEFINED_AVATARS[u.avatarSeed || ''] || genConfig(u.avatarSeed || u.email || u.name || 'Felix');
                  const label = u.name || u.email || 'usuário';

                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn("group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors", !isActiveUser(u) && "opacity-60")}
                    >
                      <TableCell className="py-2.5 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <NiceAvatar className="w-9 h-9 border-2 border-white dark:border-slate-800 shadow-sm" {...avatarConfig} />
                            {isAdminUser(u) && <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full shadow-sm"><Zap className="h-2 w-2" /></div>}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors text-xs">{u.name || 'Sem nome'}</span>
                            <span className="text-[10px] font-medium text-slate-400 lowercase tracking-tight italic">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActiveUser(u)}
                            disabled={updatingId === u.id || isSelf(u) || isLastAdmin(u)}
                            aria-label={`${isActiveUser(u) ? 'Desativar' : 'Ativar'} ${label}`}
                            onCheckedChange={(checked) => (checked
                              ? handleUpdateUser(u.id, { active: true }, 'Conta ativada')
                              : setConfirmDeactivate(u))}
                          />
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", isActiveUser(u) ? "text-emerald-600" : "text-slate-400")}>
                            {isActiveUser(u) ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="py-2.5 text-[10px] font-medium text-slate-500"
                        title={u.createdAt ? `Conta criada em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}` : undefined}
                      >
                        {describeLastAccess(u.lastLoginAt)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {/* Cargo de negócio: só o admin grava; reconhece liderança de squad em algumas telas */}
                        <Select
                          key={`${u.id}-${u.jobTitle}`}
                          defaultValue={u.jobTitle || undefined}
                          onValueChange={(val) => handleUpdateUser(u.id, { jobTitle: val }, 'Cargo atualizado')}
                          disabled={updatingId === u.id}
                        >
                          <SelectTrigger aria-label={`Cargo de ${label}`} className="h-7 w-32 rounded-lg border-transparent font-black text-[9px] uppercase tracking-widest transition-all focus:ring-1 focus:ring-primary focus:ring-offset-0 bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50">
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
                        {/* Nível de autorização real: controla o acesso a /admin no servidor */}
                        <Select
                          key={`${u.id}-${u.role}`}
                          defaultValue={(u.role || 'MEMBER').toUpperCase()}
                          onValueChange={(val) => handleUpdateUser(u.id, { role: val }, 'Nível de acesso alterado')}
                          disabled={updatingId === u.id || (isAdminUser(u) && (isSelf(u) || isLastAdmin(u)))}
                        >
                          <SelectTrigger aria-label={`Nível de acesso de ${label}`} className={cn(
                            "h-7 w-28 rounded-lg border-transparent font-black text-[9px] uppercase tracking-widest transition-all focus:ring-1 focus:ring-primary focus:ring-offset-0",
                            isAdminUser(u) ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50"
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
                      <TableCell className="py-2.5"><Badge variant="ghost" className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-slate-200/50 dark:border-slate-700/50 text-[9px] font-black uppercase tracking-widest rounded-lg px-2 py-1">{u.squadId || u.team || 'Sem squad'}</Badge></TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Detalhes de ${label}`} onClick={() => openDetails(u)}>
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Redefinir a senha de ${label}`} disabled={updatingId === u.id} onClick={() => setConfirmReset(u)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
        {filteredUsers.length === 0 && !loading && (
          <p className="p-8 text-center text-xs font-bold text-slate-400">Nenhum usuário encontrado com esses filtros.</p>
        )}
        {filteredUsers.length > visibleLimit && (
          <div className="p-4 border-t border-slate-50 flex justify-center">
            <Button variant="ghost" onClick={() => setVisibleLimit(prev => prev + 30)} className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all gap-2">
              Carregar mais usuários <ArrowUpRight className="h-3 w-3 rotate-90" />
            </Button>
          </div>
        )}
      </Card>

      <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {confirmDeactivate?.name || confirmDeactivate?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa perde a sessão em até 30 segundos, não consegue entrar e as chaves de API dela deixam de valer.
              Nada é apagado; você pode reativar a conta quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeactivate) handleUpdateUser(confirmDeactivate.id, { active: false }, 'Conta desativada');
                setConfirmDeactivate(null);
              }}
            >
              Desativar conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmReset} onOpenChange={(open) => !open && setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir a senha de {confirmReset?.name || confirmReset?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual deixa de valer e será gerada uma senha temporária, que você repassa à pessoa fora do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmReset && handleResetPassword(confirmReset)}>Gerar senha temporária</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!tempPassword} onOpenChange={(open) => !open && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha temporária de {tempPassword?.email}</DialogTitle>
            <DialogDescription>Copie agora e repasse à pessoa. Ela fica visível por 1 hora e depois é apagada.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-bold tracking-wider">{tempPassword?.pass}</code>
            <Button variant="outline" size="icon" aria-label="Copiar senha" onClick={() => tempPassword && navigator.clipboard.writeText(tempPassword.pass)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailUser?.name || 'Sem nome'}</DialogTitle>
            <DialogDescription>{detailUser?.email}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="font-bold text-slate-500">Status</dt>
            <dd>{detailUser && isActiveUser(detailUser) ? 'Ativo' : 'Inativo'}</dd>
            <dt className="font-bold text-slate-500">Nível de acesso</dt>
            <dd>{(detailUser?.role || 'MEMBER').toUpperCase()}</dd>
            <dt className="font-bold text-slate-500">Cargo</dt>
            <dd>{detailUser?.jobTitle || 'Sem cargo'}</dd>
            <dt className="font-bold text-slate-500">Conta criada em</dt>
            <dd>{detailUser?.createdAt ? new Date(detailUser.createdAt).toLocaleDateString('pt-BR') : 'Sem registro'}</dd>
            <dt className="font-bold text-slate-500">Último acesso</dt>
            <dd>{describeLastAccess(detailUser?.lastLoginAt)}</dd>
            <dt className="font-bold text-slate-500">Id do Jira</dt>
            <dd className="font-code">{detailUser?.jiraAccountId || '—'}</dd>
            <dt className="font-bold text-slate-500">Equipes</dt>
            <dd>
              {detailSquads === null
                ? 'Carregando…'
                : detailSquads.length === 0
                  ? (detailUser?.squadId ? `Equipe ativa: ${detailUser.squadId}` : 'Sem vínculo com equipes')
                  : detailSquads.map(s => `${s.squadId}${s.role ? ` (${s.role})` : ''}`).join(', ')}
            </dd>
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
