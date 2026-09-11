'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, Ban, Copy, Check, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  API_KEY_SCOPES,
  myApiKeysApi,
  scopesAllowedForRole,
  type MyApiKeyData,
} from '@/lib/my-api-keys-client';

interface MyApiKeysManagerProps {
  /** compact = sem o card wrapper (pro dialog de integração, que já tem o dele). */
  compact?: boolean;
}

/**
 * Self-service de API key: lista, cria e revoga só as chaves do usuário
 * logado (/api/api-keys). Escopo oferecido é limitado pelo papel — MEMBER só
 * vê KNOWLEDGE_READ/SQUAD_READ (ver scopesAllowedForRole); squad:read nunca
 * pede squadId, o backend trava na squad do próprio usuário.
 *
 * Usado em dois lugares: ConnectivitySettings.tsx (Workspace → Conexões e
 * Integrações, seção completa) e ModuleIntegrationDialog.tsx (botão "Gerar
 * minha chave", dentro de um Dialog compact) — mesma lógica, sem duplicar.
 */
export function MyApiKeysManager({ compact = false }: MyApiKeysManagerProps) {
  const { toast } = useToast();
  const { session } = useAuth();
  const { userProfile } = useUserContext();

  const [keys, setKeys] = useState<MyApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const allowedScopes = scopesAllowedForRole(session?.role);
  const mySquadId = session?.activeProjectId || userProfile?.squadId || '';
  const hasSquad = !!mySquadId;

  const loadKeys = async () => {
    try {
      setKeys(await myApiKeysApi.list());
    } catch (e) {
      console.error('Erro ao carregar minhas API keys:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const toggleScope = (value: string) => {
    setSelectedScopes(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]);
  };

  const handleCreate = async () => {
    if (!newKeyName.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    try {
      const created = await myApiKeysApi.create(newKeyName.trim(), selectedScopes);
      setRevealedKey(created.rawKey);
      setNewKeyName('');
      setSelectedScopes([]);
      await loadKeys();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar chave', description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revogar a chave "${name}"? Isso não pode ser desfeito.`)) return;
    try {
      await myApiKeysApi.revoke(id);
      await loadKeys();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao revogar chave', description: e?.message });
    }
  };

  const copyRevealedKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const body = (
    <div className="space-y-5">
      {revealedKey && (
        <Card className="border-emerald-200 rounded-2xl bg-emerald-50/50 shadow-lg shadow-emerald-100/50 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Copie agora — essa chave não será mostrada de novo
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 h-10 flex items-center px-3 bg-white border border-emerald-200 rounded-xl text-[11px] font-code truncate">
                {revealedKey}
              </code>
              <Button onClick={copyRevealedKey} size="sm" className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2 shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Nome da chave (ex: script de backup, bot do Slack)"
          className="h-10 bg-white border-slate-200 rounded-xl font-bold text-sm"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {API_KEY_SCOPES.filter(s => allowedScopes.includes(s.value)).map(scope => {
            const disabled = scope.value === 'SQUAD_READ' && !hasSquad;
            return (
              <label
                key={scope.value}
                className={cn(
                  "flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors",
                  selectedScopes.includes(scope.value) ? "border-primary bg-primary/5" : "border-slate-100 bg-white",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Checkbox
                  checked={selectedScopes.includes(scope.value)}
                  disabled={disabled}
                  onCheckedChange={() => toggleScope(scope.value)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-slate-700 leading-tight">{scope.label}</p>
                  <p className="text-[9px] font-medium text-slate-400 leading-tight mt-0.5">{scope.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {selectedScopes.includes('SQUAD_READ') && !hasSquad && (
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
            <ShieldAlert className="h-3.5 w-3.5" /> Você ainda não está vinculado a uma squad — entre em uma squad antes de gerar essa chave.
          </p>
        )}
        {selectedScopes.includes('SQUAD_READ') && hasSquad && (
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Essa chave vai ler só a squad <span className="text-slate-600">{mySquadId}</span> — não é escolhível.
          </p>
        )}

        <Button
          onClick={handleCreate}
          disabled={creating || !newKeyName.trim() || selectedScopes.length === 0 || (selectedScopes.includes('SQUAD_READ') && !hasSquad)}
          className="w-full h-10 rounded-xl bg-slate-900 hover:bg-primary text-white font-black uppercase text-[10px] tracking-widest gap-2"
        >
          {creating ? <AgileSpinner size="xs" /> : <Plus className="h-4 w-4" />} Gerar Chave
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-8 flex justify-center"><AgileSpinner size="md" /></div>
        ) : keys.length === 0 ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-6">Nenhuma chave criada ainda</p>
        ) : (
          keys.map(k => (
            <div
              key={k.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50",
                k.revokedAt && "opacity-60"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] font-black uppercase text-slate-900 truncate">{k.name}</p>
                  {k.revokedAt ? (
                    <Badge className="bg-rose-100 text-rose-600 border-none text-[8px] font-black uppercase">Revogada</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] font-black uppercase">Ativa</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {k.scopes.map(s => (
                    <span key={s} className="text-[8px] font-black uppercase text-slate-400 bg-white border border-slate-100 rounded px-1.5 py-0.5">
                      {s}{s === 'SQUAD_READ' && k.squadId ? ` · ${k.squadId}` : ''}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                  Criada {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true, locale: ptBR })}
                  {k.lastUsedAt && ` · Último uso ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: ptBR })}`}
                </p>
              </div>
              {!k.revokedAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevoke(k.id, k.name)}
                  className="h-8 w-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (compact) {
    return body;
  }

  return (
    <Card className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/5 p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Minhas API Keys</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Acesso programático (REST + MCP)</p>
            </div>
          </div>
          <Badge className="bg-amber-50 text-amber-600 border-none font-black text-[8px] tracking-widest">Self-service</Badge>
        </div>
        {body}
      </div>
    </Card>
  );
}
