'use client';

import React, { useState, useEffect } from 'react';
import { adminApi, PasswordResetRequest } from '@/app/admin/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyRound, CheckCircle2, Copy, ShieldAlert, Clock, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PasswordResetManager() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPasswordResets();
      setRequests(data || []);
    } catch (e: any) {
      console.error('Erro ao carregar solicitações de reset:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (req: PasswordResetRequest) => {
    setApprovingId(req.id);
    try {
      const updated = await adminApi.approvePasswordReset(req.id);
      toast({
        title: 'Senha temporária gerada!',
        description: `Reset aprovado para ${req.userEmail}.`,
      });
      if (updated.tempPassword) {
        setGeneratedPassword({ email: req.userEmail, pass: updated.tempPassword });
      }
      loadRequests();
    } catch (e: any) {
      toast({
        title: 'Erro ao aprovar reset',
        description: e.message || 'Falha ao aprovar a solicitação.',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Copiado!', description: 'Senha copiada para a área de transferência.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const pastRequests = requests.filter((r) => r.status !== 'PENDING');

  return (
    <Card className="border border-amber-500/20 bg-amber-500/5 dark:bg-slate-900/60 shadow-sm rounded-2xl overflow-hidden mb-6">
      <CardHeader className="pb-3 border-b border-amber-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                Solicitações de Redefinição de Senha
                {pendingRequests.length > 0 && (
                  <Badge className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                    {pendingRequests.length} PENDENTE{pendingRequests.length > 1 ? 'S' : ''}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500">
                Aprovação manual por Admin, Agile Master ou Tribe Lead (sem SSO oficial)
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={loading}
            className="h-8 rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* MODAL / BANNER DE SENHA GERADA COM SUCESSO */}
        {generatedPassword && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 animate-in fade-in zoom-in duration-300">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Senha Temporária Criada para {generatedPassword.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGeneratedPassword(null)}
                className="h-6 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                Fechar
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="px-4 py-2 bg-emerald-950 text-emerald-300 font-mono text-lg font-black tracking-wider rounded-xl border border-emerald-500/40 select-all">
                {generatedPassword.pass}
              </div>
              <Button
                onClick={() => copyToClipboard(generatedPassword.pass)}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-2 shadow-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar Senha'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Repasse esta senha ao usuário (pessoalmente ou via chat corporativo seguro). Ela já está ativa para login.
            </p>
          </div>
        )}

        {loading && requests.length === 0 ? (
          <div className="py-6 flex items-center justify-center">
            <AgileSpinner />
          </div>
        ) : pendingRequests.length === 0 && pastRequests.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            Nenhuma solicitação de redefinição de senha registrada no momento.
          </p>
        ) : (
          <div className="space-y-3">
            {/* SOLICITAÇÕES PENDENTES */}
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{req.userName || req.userEmail}</span>
                    <span className="text-xs text-slate-400 font-mono">({req.userEmail})</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      Solicitado em:{' '}
                      {req.requestedAt ? format(new Date(req.requestedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Desconhecido'}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleApprove(req)}
                  disabled={approvingId === req.id}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl h-9 px-4 shadow-sm shrink-0 gap-2"
                >
                  {approvingId === req.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  Aprovar & Gerar Senha
                </Button>
              </div>
            ))}

            {/* HISTÓRICO DE SOLICITAÇÕES APROVADAS */}
            {pastRequests.length > 0 && (
              <div className="pt-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Histórico Recente</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pastRequests.slice(0, 5).map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{req.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Aprovado por: <strong>{req.approvedBy || 'Admin'}</strong></span>
                        <span>•</span>
                        <span>
                          {req.approvedAt ? format(new Date(req.approvedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
