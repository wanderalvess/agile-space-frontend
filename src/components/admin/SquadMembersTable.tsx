'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, UserPlus, Check, X, Shield, UserCog, Sliders, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SquadMember } from '@/lib/types';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { authFetch } from '@/lib/auth-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

const SQUAD_ROLES = [
  'Product Owner',
  'Agile Master',
  'Tech Lead',
  'SME',
  'Developer',
  'QA',
  'UX/Designer',
  'People Lead',
  'Tribe Lead',
  'Agile Coach',
];

interface SquadMembersTableProps {
  squadId: string;
}

export function SquadMembersTable({ squadId }: SquadMembersTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Developer');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncingJira, setSyncingJira] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/squads/${squadId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  const handleSyncFromJira = async () => {
    setSyncingJira(true);
    try {
      const savedDomain = localStorage.getItem('agileSpace_jiraSync_domain') || '';
      const savedToken = localStorage.getItem('agileSpace_jiraSync_token') || localStorage.getItem('agileSpace_jiraToken') || '';
      const savedUnit = localStorage.getItem('agileSpace_projectEstimationUnit') || 'SP';

      if (!savedToken) {
        toast({
          title: 'Token não encontrado',
          description: 'Por favor, informe seu token Jira no formulário acima para sincronizar.',
          variant: 'destructive',
        });
        return;
      }

      const res = await authFetch(`${API_BASE}/admin/jira/sync-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: squadId,
          jiraDomain: savedDomain,
          token: savedToken,
          estimationUnit: savedUnit,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erro ${res.status}`);
      }

      const result = await res.json();
      toast({
        title: 'Sincronização Jira concluída',
        description: `${result.memberCount} membros carregados diretamente do Jira.`,
      });

      await fetchMembers();
    } catch (err: any) {
      toast({
        title: 'Falha ao sincronizar do Jira',
        description: err?.message || 'Verifique o token e as permissões.',
        variant: 'destructive',
      });
    } finally {
      setSyncingJira(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (member: SquadMember, newRoleValue: string) => {
    const previousRole = member.role;
    // Atualização otimista
    setMembers((prev) =>
      prev.map((m) =>
        m.jiraAccountId === member.jiraAccountId ? { ...m, role: newRoleValue } : m
      )
    );

    try {
      const updatedMember = { ...member, role: newRoleValue };
      const res = await authFetch(
        `${API_BASE}/squads/${squadId}/members/${encodeURIComponent(member.jiraAccountId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedMember),
        }
      );

      if (!res.ok) throw new Error('Falha ao salvar cargo');

      toast({
        title: 'Cargo atualizado',
        description: `${member.displayName} agora é ${newRoleValue}.`,
      });
    } catch (err) {
      // Reverte em caso de falha
      setMembers((prev) =>
        prev.map((m) =>
          m.jiraAccountId === member.jiraAccountId ? { ...m, role: previousRole } : m
        )
      );
      toast({
        title: 'Erro ao atualizar cargo',
        description: 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMember = async (jiraAccountId: string, name: string) => {
    if (!confirm(`Deseja remover ${name} da Squad ${squadId}?`)) return;

    setActionLoading(jiraAccountId);
    try {
      const res = await authFetch(
        `${API_BASE}/squads/${squadId}/members/${encodeURIComponent(jiraAccountId)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Falha ao excluir membro');

      setMembers((prev) => prev.filter((m) => m.jiraAccountId !== jiraAccountId));
      toast({
        title: 'Membro removido',
        description: `${name} foi removido da Squad.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao remover membro',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const generatedAccountId = newEmail.trim()
      ? newEmail.trim().split('@')[0].toLowerCase()
      : newName.trim().toLowerCase().replace(/\s+/g, '.');

    const newMember: SquadMember = {
      dbId: `${squadId}_${generatedAccountId}`,
      squadId,
      jiraAccountId: generatedAccountId,
      displayName: newName.trim(),
      email: newEmail.trim() || undefined,
      role: newRole,
      capacityHoursPerDay: 8,
    };

    try {
      const res = await authFetch(
        `${API_BASE}/squads/${squadId}/members/${encodeURIComponent(generatedAccountId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMember),
        }
      );

      if (!res.ok) throw new Error('Falha ao adicionar membro');

      setMembers((prev) => [...prev, newMember]);
      setIsAddOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole('Developer');

      toast({
        title: 'Membro adicionado',
        description: `${newMember.displayName} foi incluído como ${newRole}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao adicionar membro',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm mt-6">
      <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20 rounded-t-[2rem] px-6 py-5">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Membros da Squad
            <Badge className="bg-primary/10 text-primary border-none px-2 rounded-md">{squadId}</Badge>
          </CardTitle>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Gerencie os integrantes importados, ajuste os cargos ou adicione novos membros
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/squad/roster?squadId=${encodeURIComponent(squadId)}`)}
            className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 border-indigo-200/50 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          >
            <UserCog className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Gestão do Time & Carga
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddOpen((prev) => !prev)}
            className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-800/50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar Membro
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMembers}
            disabled={loading}
            className="h-8 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 gap-1.5 bg-slate-100/50 dark:bg-slate-800/50"
            title="Recarregar dados do banco local"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isAddOpen && (
          <form
            onSubmit={handleAddMember}
            className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between border-b border-primary/10 pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Adicionar Novo Integrante à Squad
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="h-6 w-6 p-0 hover:bg-primary/10 rounded-full"
              >
                <X className="h-3.5 w-3.5 text-primary" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Nome Completo
                </Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do integrante"
                  required
                  className="h-9 rounded-xl text-xs bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-700/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  E-mail Corporativo
                </Label>
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@empresa.com.br"
                  className="h-9 rounded-xl text-xs bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-700/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Cargo / Função
                </Label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {SQUAD_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="h-8 rounded-xl text-[10px] font-bold"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white">
                Salvar Membro
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-100/50 dark:bg-slate-800/30 animate-pulse border border-slate-200/30 dark:border-slate-700/30" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-slate-50/30 dark:bg-slate-800/10 rounded-3xl border border-dashed border-slate-200/60 dark:border-slate-800/60">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-center space-y-1 max-w-sm">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Squad sem membros
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nenhum membro registrado no banco para a Squad <span className="font-bold text-primary">{squadId}</span>. Utilize a <strong>Sincronização Jira</strong> acima ou adicione manualmente.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar Manualmente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/60">
                  {['', 'Nome do Integrante', 'Contato', 'Papel na Squad', 'Capacidade', 'Ações'].map((h) => (
                    <th
                      key={h}
                      className="pb-3 px-3 text-[9px] font-black uppercase tracking-widest text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                {members.map((member) => (
                  <tr
                    key={member.dbId}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                  >
                    <td className="py-3 px-3 w-12">
                      <NiceAvatar
                        style={{ width: 36, height: 36 }}
                        {...genConfig(member.email || member.displayName)}
                        className="shadow-sm"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200">
                          {member.displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {member.jiraAccountId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-slate-500 truncate max-w-[150px] block">
                        {member.email || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={member.role || 'Developer'}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        className="h-8 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-800/50 px-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/30 transition-colors"
                      >
                        {SQUAD_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none text-[10px] font-medium">
                        {member.capacityHoursPerDay ?? 8}h/dia
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(member.jiraAccountId, member.displayName)}
                        disabled={actionLoading === member.jiraAccountId}
                        className="h-8 w-8 p-0 text-slate-300 group-hover:text-slate-400 hover:!text-rose-600 hover:!bg-rose-50 dark:hover:!bg-rose-950/40 rounded-xl transition-all"
                        title="Remover membro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
