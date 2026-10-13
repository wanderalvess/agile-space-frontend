'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminApi, ApiKeyData } from '@/app/admin/api';
import { KeyRound, Plus, Ban, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit';
import { AgileSpinner } from '../ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { describeExpiry, keysNeedingAttention, EXPIRY_CHOICES, EXPIRY_WARNING_DAYS } from '@/lib/api-key-expiry';

export function ApiKeysManager() {
  const { session } = useAuth();
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('90');

  const loadKeys = async () => {
    try {
      setKeys(await adminApi.getApiKeys());
    } catch (e) {
      console.error('Erro ao carregar API keys:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const created = await adminApi.createApiKey(newKeyName.trim(), expiresIn);

      await logSystemEvent({
        content: `NOVA API KEY CRIADA: "${newKeyName.trim()}" (acesso à Base de Conhecimento via API).`,
        type: 'admin',
        severity: 'warning',
        userEmail: session?.email,
        module: 'ApiKeys',
      });

      setRevealedKey(created.rawKey);
      setNewKeyName('');
      await loadKeys();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao gerar chave' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revogar a chave "${name}"? Isso não pode ser desfeito.`)) return;
    try {
      await adminApi.revokeApiKey(id);
      await logSystemEvent({
        content: `API KEY REVOGADA: "${name}".`,
        type: 'admin',
        severity: 'warning',
        userEmail: session?.email,
        module: 'ApiKeys',
      });
      await loadKeys();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao revogar chave' });
    }
  };

  const handleRenew = async (id: string, name: string) => {
    try {
      await adminApi.renewApiKey(id);
      toast({ title: 'Chave renovada', description: `"${name}" vale por mais 90 dias. O papel e os escopos foram reavaliados com o papel atual do dono.` });
      await loadKeys();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao renovar chave' });
    }
  };

  const copyRevealedKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando API Keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {keysNeedingAttention(keys).length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-[11px] font-bold leading-snug">
            {keysNeedingAttention(keys).length === 1 ? '1 chave vence' : `${keysNeedingAttention(keys).length} chaves vencem`} em menos de {EXPIRY_WARNING_DAYS} dias
            (ou já venceram). Renove antes do vencimento: a integração que usa a chave para de funcionar quando ela expira.
          </p>
        </div>
      )}
      {revealedKey && (
        <Card className="border-emerald-200 rounded-[2rem] bg-emerald-50/50 shadow-xl shadow-emerald-100/50 overflow-hidden">
          <CardContent className="p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Copie agora — essa chave não será mostrada de novo
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 h-11 flex items-center px-4 bg-white border border-emerald-200 rounded-xl text-xs font-code truncate">
                {revealedKey}
              </code>
              <Button onClick={copyRevealedKey} className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200/60 rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-50 flex items-center gap-4">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><KeyRound className="h-5 w-5" /></div>
          <div>
            <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900">API Keys</CardTitle>
            <CardDescription className="text-[9px] font-black italic text-slate-400 uppercase tracking-widest mt-0.5">Acesso programático à Base de Conhecimento (/api/v1/knowledge)</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="flex gap-3">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Nome da chave (ex: MCP Server, Integração X)"
              className="h-11 bg-slate-50 border-slate-200 rounded-xl font-bold flex-1"
            />
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              aria-label="Validade da chave"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold"
            >
              {EXPIRY_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-primary text-white font-black uppercase text-[10px] tracking-widest gap-2"
            >
              <Plus className="h-4 w-4" /> Gerar
            </Button>
          </div>

          {expiresIn === 'never' && (
            <p role="note" className="text-[10px] font-bold text-amber-700">
              Chave sem expiração continua valendo para sempre se vazar. Prefira 90 dias e renove.
            </p>
          )}

          <div className="space-y-2">
            {keys.length === 0 && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-6">Nenhuma chave criada ainda</p>
            )}
            {keys.map((k) => (
              <div
                key={k.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border",
                  k.revokedAt ? "border-slate-100 bg-slate-50/50 opacity-60" : "border-slate-100 bg-slate-50/50"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black uppercase text-slate-900 truncate">{k.name}</p>
                    {k.revokedAt ? (
                      <Badge className="bg-rose-100 text-rose-600 border-none text-[8px] font-black uppercase">Revogada</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] font-black uppercase">Ativa</Badge>
                    )}
                    {!k.revokedAt && (() => {
                      const exp = describeExpiry(k.expiresAt);
                      return (
                        <Badge className={cn(
                          'border-none text-[8px] font-black uppercase',
                          exp.level === 'expired' && 'bg-rose-100 text-rose-600',
                          exp.level === 'soon' && 'bg-amber-100 text-amber-700',
                          exp.level === 'ok' && 'bg-slate-100 text-slate-500',
                          exp.level === 'none' && 'bg-slate-100 text-slate-400',
                        )}>{exp.label}</Badge>
                      );
                    })()}
                  </div>
                  <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                    Criada {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true, locale: ptBR })}
                    {k.lastUsedAt && ` · Último uso ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: ptBR })}`}
                  </p>
                </div>
                {!k.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Renovar a chave ${k.name}`}
                    onClick={() => handleRenew(k.id, k.name)}
                    className="h-9 w-9 rounded-lg text-slate-300 hover:text-primary hover:bg-primary/5 shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {!k.revokedAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Revogar a chave ${k.name}`}
                    onClick={() => handleRevoke(k.id, k.name)}
                    className="h-9 w-9 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
