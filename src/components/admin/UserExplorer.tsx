'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  limit,
  writeBatch
} from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirebase } from '@/firebase';
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
  ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserProfile, GlobalRole, ROLES } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { logSystemEvent } from '@/lib/audit';
import { useAdminCacheStore } from '@/store/adminCacheStore';

export function UserExplorer() {
  const { firestore, user: currentUser } = useFirebase();
  const { toast } = useToast();
  const { 
    users: cachedUsers, 
    totalUsersCount, 
    fetchUsers, 
    isFetchingUsers 
  } = useAdminCacheStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(30);

  useEffect(() => {
    if (firestore) {
      fetchUsers(firestore);
    }
  }, [firestore]);

  // Filtros em Memória (Definição Única)
  const filteredUsers = useMemo(() => {
    return cachedUsers.filter(u => {
      const matchSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchRole = selectedRole === 'all' || u.role === selectedRole;
      return matchSearch && matchRole;
    });
  }, [cachedUsers, searchTerm, selectedRole]);

  const paginatedUsers = filteredUsers.slice(0, visibleLimit);

  const handleUpdateUser = async (userId: string, data: Partial<UserProfile>) => {
    if (!firestore) return;
    setUpdatingId(userId);
    try {
      const userRef = doc(firestore, 'users', userId);
      const targetUser = cachedUsers.find(u => u.id === userId);
      await updateDoc(userRef, data);
      
      await logSystemEvent(firestore, {
        content: `Perfil de usuário atualizado [${targetUser?.name || userId}]: ${Object.keys(data).join(', ')}`,
        type: 'admin',
        severity: 'info',
        userEmail: currentUser?.email,
        module: 'UserExplorer',
        metadata: { targetId: userId, ...data }
      });

      await fetchUsers(firestore, true);
      toast({ title: "Usuário atualizado", description: "Alterações sincronizadas no banco." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na atualização" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!firestore || !confirm(`Excluir usuário ${userName}? Esta ação é irreversível.`)) return;
    try {
      await deleteDoc(doc(firestore, 'users', userId));
      await fetchUsers(firestore, true);
      toast({ title: "Usuário removido", description: "O registro foi deletado com sucesso." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na exclusão" });
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.length === 0) return;
    if (!confirm(`Deseja remover os ${selectedIds.length} usuários selecionados?`)) return;
    try {
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => batch.delete(doc(firestore, 'users', id)));
      await batch.commit();
      await fetchUsers(firestore, true);
      setSelectedIds([]);
      toast({ title: "Exclusão concluída", description: "Operação em massa realizada com sucesso." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro na operação em massa" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) setSelectedIds([]);
    else setSelectedIds(paginatedUsers.map(u => u.id));
  };

  if (isFetchingUsers && cachedUsers.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Diretório de Usuários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/10 p-2 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-2">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            <Input 
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-slate-50/50 border-transparent focus:bg-white focus:border-primary/20 rounded-xl font-medium transition-all"
            />
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            {[{ id: 'all', label: 'Todos' }, { id: 'admin', label: 'Admins' }, { id: 'member', label: 'Membros' }].map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedRole === role.id ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {role.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon" onClick={() => fetchUsers(firestore, true)} className="h-12 w-12 rounded-xl border-slate-200 hover:border-primary hover:text-primary transition-all shrink-0">
            <Zap className={cn("h-4 w-4", isFetchingUsers && "animate-pulse")} />
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Exibindo {filteredUsers.length} de {totalUsersCount} Usuários
        </p>
        
        {selectedIds.length > 0 && (
           <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">{selectedIds.length} Selecionados</span>
             <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest gap-2">Excluir <Trash2 className="h-3.5 w-3.5" /></Button>
           </motion.div>
        )}
      </div>

      <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="w-14 pl-8 py-4"><Checkbox checked={selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0} onCheckedChange={toggleSelectAll} className="border-slate-300" /></TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Usuário / Identidade</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Cargo / Nível</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Equipe / Squad</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 py-4">Último Acesso</TableHead>
              <TableHead className="font-black uppercase text-[9px] tracking-widest text-slate-500 text-right pr-8 py-4">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {paginatedUsers.map((u, index) => {
                const avatarConfig = PREDEFINED_AVATARS[u.avatarSeed || ''] || genConfig(u.avatarSeed || u.email || u.name || 'Felix');
                const lastActiveDate = u.updatedAt ? (typeof u.updatedAt === 'string' ? new Date(u.updatedAt) : u.updatedAt.toDate?.() || new Date(u.updatedAt)) : null;

                return (
                  <motion.tr 
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn("group hover:bg-slate-50/50 border-slate-100 transition-colors", selectedIds.includes(u.id) && "bg-primary/5")}
                  >
                    <TableCell className="pl-8 py-2.5"><Checkbox checked={selectedIds.includes(u.id)} onCheckedChange={() => toggleSelect(u.id)} className="border-slate-300" /></TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <NiceAvatar className="w-9 h-9 border-2 border-white shadow-md" {...avatarConfig} />
                          {u.role === 'admin' && <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full shadow-sm"><Zap className="h-2 w-2" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-primary transition-colors text-xs">{u.name || 'Sem Nome'}</span>
                          <span className="text-[10px] font-medium text-slate-400 lowercase tracking-tight italic">{u.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Select 
                        defaultValue={u.role || 'member'} 
                        onValueChange={(val) => handleUpdateUser(u.id, { role: val as GlobalRole })} 
                        disabled={updatingId === u.id || u.id === currentUser?.uid}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-28 rounded-lg border-transparent font-black text-[9px] uppercase tracking-widest transition-all", 
                          u.role === 'admin' ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          {ROLES.map(role => (
                            <SelectItem key={role} value={role} className="text-[10px] font-black uppercase tracking-widest">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2.5"><Badge variant="ghost" className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-black uppercase tracking-widest rounded-lg px-2 py-1">{u.squadId || u.team || 'Sem Squad'}</Badge></TableCell>
                    <TableCell className="py-2.5 text-[10px] font-bold text-slate-700">{lastActiveDate ? lastActiveDate.toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                    <TableCell className="py-2.5 text-right pr-8">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => handleDeleteUser(u.id, u.name || 'N/A')} 
                         disabled={u.id === currentUser?.uid} 
                         className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
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
