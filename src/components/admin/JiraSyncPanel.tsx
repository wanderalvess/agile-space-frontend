'use client';

import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Check, 
  X, 
  Trash2, 
  ShieldCheck, 
  Sparkles, 
  Building2, 
  HelpCircle,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { ROLES, GlobalRole } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

const SQUAD_ROLES = [
  'Product Owner',
  'People Lead',
  'Agile Master',
  'Tech Lead',
  'Tribe Lead',
  'Agile Coach',
  'Developer',
  'QA',
  'UX/Designer',
  'SME',
  'Stakeholder / Observador',
];

interface JiraSyncPanelProps {
  onSyncSuccess?: (squadId: string) => void;
}

interface MemberCandidate {
  jiraAccountId: string;
  displayName: string;
  email: string | null;
  role: string;
  score: number;
  selected: boolean;
  capacityHoursPerDay: number;
}

interface PreviewData {
  squadId: string;
  squadName: string;
  jiraDomain: string;
  totalCandidates: number;
  members: MemberCandidate[];
}

interface SyncResult {
  squadId: string;
  squadName: string;
  memberCount: number;
}

export function JiraSyncPanel({ onSyncSuccess }: JiraSyncPanelProps) {
  const { toast } = useToast();
  const [projectKey, setProjectKey] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [token, setToken] = useState('');
  const [estimationUnit, setEstimationUnit] = useState('SP');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados da camada de validação e confirmação
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [syncUsers, setSyncUsers] = useState(true);

  // Carrega configurações salvas no localStorage ao montar o componente
  React.useEffect(() => {
    try {
      const savedKey = localStorage.getItem('agileSpace_jiraSync_projectKey') || 'DDWMISSI';
      const savedDomain = localStorage.getItem('agileSpace_jiraSync_domain') || 'jiraproducao.totvs.com.br';
      const savedToken = localStorage.getItem('agileSpace_jiraSync_token') || localStorage.getItem('agileSpace_jiraToken') || '';
      const savedUnit = localStorage.getItem('agileSpace_projectEstimationUnit') || 'SP';

      setProjectKey(savedKey);
      setJiraDomain(savedDomain);
      setToken(savedToken);
      setEstimationUnit(savedUnit);
    } catch {}
  }, []);

  const handleKeyChange = (val: string) => {
    const upper = val.toUpperCase();
    setProjectKey(upper);
    try { localStorage.setItem('agileSpace_jiraSync_projectKey', upper); } catch {}
  };

  const handleDomainChange = (val: string) => {
    setJiraDomain(val);
    try { localStorage.setItem('agileSpace_jiraSync_domain', val); } catch {}
  };

  const handleTokenChange = (val: string) => {
    setToken(val);
    try { 
      localStorage.setItem('agileSpace_jiraSync_token', val); 
      localStorage.setItem('agileSpace_jiraToken', val);
    } catch {}
  };

  // Passo 1: Consulta a API do Jira e abre o modal de validação prévia
  const handlePreviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSyncResult(null);

    // Salvar configurações
    try {
      localStorage.setItem('agileSpace_jiraSync_projectKey', projectKey);
      localStorage.setItem('agileSpace_jiraSync_domain', jiraDomain);
      localStorage.setItem('agileSpace_jiraSync_token', token);
      localStorage.setItem('agileSpace_jiraToken', token);
      localStorage.setItem('agileSpace_projectEstimationUnit', estimationUnit);
      if (projectKey) {
        localStorage.setItem(`agileSpace_estimationUnit_${projectKey}`, estimationUnit);
      }
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/admin/jira/preview-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey, jiraDomain, token, estimationUnit }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Erro ${res.status}`);
      }

      const data: PreviewData = await res.json();
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (err: any) {
      setError(err.message || 'Falha ao consultar o Jira.');
    } finally {
      setLoading(false);
    }
  };

  // Funções de manipulação dentro do Modal de Preview
  const toggleSelectMember = (accountId: string) => {
    if (!previewData) return;
    setPreviewData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        members: prev.members.map(m =>
          m.jiraAccountId === accountId ? { ...m, selected: !m.selected } : m
        )
      };
    });
  };

  const toggleSelectAll = () => {
    if (!previewData) return;
    const allSelected = previewData.members.every(m => m.selected);
    setPreviewData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        members: prev.members.map(m => ({ ...m, selected: !allSelected }))
      };
    });
  };

  const updateCandidateRole = (accountId: string, newRole: string) => {
    if (!previewData) return;
    setPreviewData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        members: prev.members.map(m =>
          m.jiraAccountId === accountId ? { ...m, role: newRole } : m
        )
      };
    });
  };

  const removeCandidate = (accountId: string) => {
    if (!previewData) return;
    setPreviewData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        members: prev.members.filter(m => m.jiraAccountId !== accountId)
      };
    });
  };

  // Passo 2: Confirmação e gravação atômica no banco de dados
  const handleConfirmSync = async () => {
    if (!previewData) return;
    setConfirming(true);
    try {
      const payload = {
        squadId: previewData.squadId,
        squadName: previewData.squadName,
        jiraDomain: previewData.jiraDomain,
        estimationUnit: estimationUnit,
        replaceExisting: replaceExisting,
        syncUsers: syncUsers,
        members: previewData.members.filter(m => m.selected)
      };

      const res = await fetch(`${API_BASE}/admin/jira/confirm-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Erro ${res.status}`);
      }

      const result: SyncResult = await res.json();
      setSyncResult(result);
      setIsPreviewOpen(false);

      toast({
        title: 'Importação validada e salva!',
        description: `${result.memberCount} membros sincronizados com sucesso na Squad "${result.squadName}" e na base de usuários.`,
      });

      onSyncSuccess?.(result.squadId);
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar importação',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  };

  const selectedCount = previewData?.members.filter(m => m.selected).length || 0;

  return (
    <>
      <Card className="rounded-xl border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>Sincronização com o Jira</span>
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider border-primary/30 text-primary">
              Com Validação Prévia
            </Badge>
          </CardTitle>
          <CardDescription className="text-[11px] text-slate-500">
            Consulte os integrantes e cargos do Jira, revise e ajuste antes de gravar no PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePreviewSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Chave do Projeto (Project Key)
                </Label>
                <Input
                  value={projectKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="Ex: DDWMISSI"
                  required
                  className="rounded-xl text-sm h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Domínio Jira
                </Label>
                <Input
                  value={jiraDomain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  placeholder="Ex: jiraproducao.totvs.com.br"
                  required
                  className="rounded-xl text-sm h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Unidade de Estimativa
                </Label>
                <select
                  value={estimationUnit}
                  onChange={(e) => setEstimationUnit(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="HOURS">Horas de Engenharia (h)</option>
                  <option value="SP">Story Points (Fibonacci: 1, 2, 3, 5, 8, 13...)</option>
                  <option value="TSHIRT">Tamanhos T-Shirt (PP, P, M, G, GG)</option>
                  <option value="COUNT">Contagem de Histórias (Throughput)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Token de Acesso Jira (PAT)
                </Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  placeholder="Cole o Personal Access Token"
                  required
                  className="rounded-xl text-sm h-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-10 gap-2 shadow-sm bg-primary hover:bg-primary/90 text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Consultando API do Jira...' : 'Consultar e Pré-visualizar Integrantes'}
            </Button>
          </form>

          {syncResult && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="flex flex-wrap gap-1.5 items-center">
                <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-black uppercase">
                  {syncResult.memberCount} membros sincronizados
                </Badge>
                <span className="text-[11px] text-emerald-700 font-bold">{syncResult.squadName}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 font-medium">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE VALIDAÇÃO E CONFIRMAÇÃO PRÉVIA */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden font-body">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Validação da Importação Jira
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Revise os integrantes detectados no projeto <strong>{previewData?.squadName}</strong> ({previewData?.squadId}), ajuste os cargos ou remova quem não deve fazer parte da squad.
                </DialogDescription>
              </div>
              <Badge className="bg-primary/10 text-primary border-none text-xs font-black uppercase tracking-wider px-3 py-1 rounded-xl">
                {selectedCount} de {previewData?.members.length || 0} Selecionados
              </Badge>
            </div>
          </DialogHeader>

          {/* TABELA DE REVISÃO DE INTEGRANTES */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={previewData ? previewData.members.every(m => m.selected) : false}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                  Selecionar Todos
                </label>
              </div>
              <span className="text-[10px] text-slate-400">
                Dica: você pode alterar o cargo diretamente no dropdown de cada pessoa.
              </span>
            </div>

            <div className="space-y-2">
              {previewData?.members.map((member) => (
                <div
                  key={member.jiraAccountId}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-2xl border transition-all gap-4",
                    member.selected
                      ? "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/40 opacity-50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={member.selected}
                      onCheckedChange={() => toggleSelectMember(member.jiraAccountId)}
                    />
                    <NiceAvatar
                      style={{ width: 34, height: 34 }}
                      {...genConfig(member.email || member.displayName)}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {member.displayName}
                        </span>
                        {member.score >= 90 && (
                          <Badge className="bg-amber-500/10 text-amber-600 border-none text-[8px] font-black uppercase px-1.5 py-0.2 rounded">
                            Liderança
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {member.email || member.jiraAccountId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => updateCandidateRole(member.jiraAccountId, e.target.value)}
                      disabled={!member.selected}
                      className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                    >
                      {SQUAD_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCandidate(member.jiraAccountId)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                      title="Excluir da lista"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OPÇÕES E FOOTER */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={replaceExisting}
                  onCheckedChange={(c) => setReplaceExisting(Boolean(c))}
                />
                <span>Limpar membros anteriores que não estão na lista selecionada</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={syncUsers}
                  onCheckedChange={(c) => setSyncUsers(Boolean(c))}
                />
                <span>Atualizar/sincronizar os cargos na base global de Usuários</span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Total a gravar: <strong>{selectedCount}</strong> integrantes
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewOpen(false)}
                  disabled={confirming}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmSync}
                  disabled={confirming || selectedCount === 0}
                  className="rounded-xl text-xs font-bold uppercase tracking-wider gap-2 bg-primary hover:bg-primary/90 text-white"
                >
                  {confirming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {confirming ? 'Gravando no PostgreSQL...' : 'Confirmar e Salvar no Banco'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
