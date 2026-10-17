'use client';

import React, { useEffect, useId, useState } from 'react';
import { KeyRound, Plus, Ban, Copy, Check, ShieldAlert, RefreshCw, RotateCw, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog, FIELD, IconButton, IconTile, ModalButton, SelectField, StatusChip, type Tone } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { cn } from '@/lib/utils';
import { describeExpiry, keysNeedingAttention, EXPIRY_CHOICES, EXPIRY_WARNING_DAYS } from '@/lib/api-key-expiry';
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

type PendingAction = { kind: 'revoke' | 'rotate'; id: string; name: string } | null;

const EXPIRY_TONE: Record<string, Tone> = { expired: 'danger', soon: 'warn', ok: 'neutral', none: 'neutral' };

/**
 * Self-service de API key: lista, cria e revoga só as chaves do usuário
 * logado (/api/api-keys). Escopo oferecido é limitado pelo papel — MEMBER só
 * vê KNOWLEDGE_READ/SQUAD_READ (ver scopesAllowedForRole); squad:read nunca
 * pede squadId, o backend trava na squad do próprio usuário.
 *
 * Usado em dois lugares: ConnectivitySettings.tsx (Meu espaço → Conta → Conectividade, seção completa) e
 * ModuleIntegrationDialog.tsx (botão "Gerar minha chave", dentro de um Dialog compact) — mesma lógica, sem duplicar.
 */
export function MyApiKeysManager({ compact = false }: MyApiKeysManagerProps) {
  const uid = useId();
  const { toast } = useToast();
  const { session } = useAuth();
  const { squadId: activeSquadId } = useActiveSquad();

  const [keys, setKeys] = useState<MyApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('90');
  const [pending, setPending] = useState<PendingAction>(null);
  const isAdmin = session?.role?.toUpperCase() === 'ADMIN';

  const allowedScopes = scopesAllowedForRole(session?.role);
  const mySquadId = activeSquadId;
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
      const created = await myApiKeysApi.create(newKeyName.trim(), selectedScopes, expiresIn);
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

  const handleRevoke = async (id: string) => {
    try {
      await myApiKeysApi.revoke(id);
      await loadKeys();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao revogar chave', description: e?.message });
    }
  };

  const handleRenew = async (id: string, name: string) => {
    try {
      await myApiKeysApi.renew(id);
      toast({ title: 'Chave renovada', description: `"${name}" vale por mais 90 dias. Os escopos foram conferidos com o seu papel atual.` });
      await loadKeys();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao renovar chave', description: e?.message });
    }
  };

  const handleRotate = async (id: string) => {
    try {
      const created = await myApiKeysApi.rotate(id);
      setRevealedKey(created.rawKey);
      await loadKeys();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao rotacionar chave', description: e?.message });
    }
  };

  const copyRevealedKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const attention = keysNeedingAttention(keys);

  const body = (
    <div className="flex flex-col gap-5">
      {revealedKey && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Copie agora — essa chave não será mostrada de novo
          </p>
          <div className="flex items-center gap-2">
            <code className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-3 font-code text-xs text-foreground">
              <span className="truncate">{revealedKey}</span>
            </code>
            <ModalButton variant="primary" onClick={copyRevealedKey} aria-label="Copiar chave" className="h-10 shrink-0 px-3">
              {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
            </ModalButton>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4">
        <input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Nome da chave (ex: script de backup, bot do Slack)"
          aria-label="Nome da chave"
          autoComplete="off"
          className={cn(FIELD, 'h-[42px] text-sm')}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {API_KEY_SCOPES.filter(s => allowedScopes.includes(s.value)).map(scope => {
            const disabled = scope.value === 'SQUAD_READ' && !hasSquad;
            const on = selectedScopes.includes(scope.value);
            return (
              <label
                key={scope.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors duration-fast',
                  on ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border bg-card',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Checkbox checked={on} disabled={disabled} onCheckedChange={() => toggleScope(scope.value)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">{scope.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{scope.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {selectedScopes.includes('SQUAD_READ') && !hasSquad && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Você ainda não está vinculado a uma squad — entre em uma squad antes de gerar essa chave.
          </p>
        )}
        {selectedScopes.includes('SQUAD_READ') && hasSquad && (
          <p className="text-xs text-muted-foreground">
            Essa chave vai ler só a squad <strong className="text-foreground">{mySquadId}</strong> — não é escolhível.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${uid}-expiry`} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Validade</label>
          <SelectField
            id={`${uid}-expiry`}
            value={expiresIn}
            onChange={setExpiresIn}
            options={EXPIRY_CHOICES.filter(c => !c.adminOnly || isAdmin).map(c => ({ value: String(c.value), label: c.label }))}
            className="h-9 w-auto min-w-[180px]"
          />
        </div>

        <ModalButton
          variant="primary"
          onClick={handleCreate}
          disabled={creating || !newKeyName.trim() || selectedScopes.length === 0 || (selectedScopes.includes('SQUAD_READ') && !hasSquad)}
          className="w-full gap-2"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />} Gerar chave
        </ModalButton>
      </div>

      {attention.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[13px] leading-snug">
            {attention.length === 1 ? '1 chave vence' : `${attention.length} chaves vencem`} em menos de {EXPIRY_WARNING_DAYS} dias
            (ou já venceram). Renove antes do vencimento: a integração que usa a chave para de funcionar quando ela expira.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> Carregando as chaves
          </div>
        ) : keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma chave criada ainda</p>
        ) : (
          keys.map(k => {
            const exp = describeExpiry(k.expiresAt);
            return (
              <div
                key={k.id}
                className={cn('flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3.5', k.revokedAt && 'opacity-60')}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{k.name}</p>
                    {k.revokedAt ? <StatusChip tone="danger">Revogada</StatusChip> : <StatusChip tone="success">Ativa</StatusChip>}
                    {!k.revokedAt && <StatusChip tone={EXPIRY_TONE[exp.level] ?? 'neutral'}>{exp.label}</StatusChip>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {k.scopes.map(s => (
                      <span key={s} className="rounded border border-border bg-card px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {s}{s === 'SQUAD_READ' && k.squadId ? ` · ${k.squadId}` : ''}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Criada {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true, locale: ptBR })}
                    {k.lastUsedAt && ` · Último uso ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: ptBR })}`}
                  </p>
                </div>
                {!k.revokedAt && (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton size="sm" icon={RefreshCw} label={`Renovar a chave ${k.name}`} onClick={() => handleRenew(k.id, k.name)} />
                    <IconButton size="sm" icon={RotateCw} label={`Rotacionar a chave ${k.name}`} onClick={() => setPending({ kind: 'rotate', id: k.id, name: k.name })} />
                    <IconButton size="sm" icon={Ban} label={`Revogar a chave ${k.name}`} onClick={() => setPending({ kind: 'revoke', id: k.id, name: k.name })} className="hover:text-red-700 dark:hover:text-red-300" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        tone={pending?.kind === 'revoke' ? 'danger' : 'warn'}
        icon={pending?.kind === 'revoke' ? Ban : RotateCw}
        title={pending?.kind === 'revoke' ? `Revogar a chave "${pending?.name}"?` : `Rotacionar "${pending?.name}"?`}
        description={
          pending?.kind === 'revoke'
            ? 'Isso não pode ser desfeito.'
            : 'Uma chave nova é gerada e a atual deixa de valer na hora: atualize a integração com a nova.'
        }
        confirmLabel={pending?.kind === 'revoke' ? 'Revogar' : 'Rotacionar'}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === 'revoke') handleRevoke(pending.id);
          else handleRotate(pending.id);
        }}
      />
    </div>
  );

  if (compact) {
    return body;
  }

  return (
    <section className={cn(PAGE_CARD, 'flex flex-col gap-5 rounded-3xl p-6')}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={KeyRound} size="lg" />
          <div>
            <h3 className="text-base font-bold text-foreground">Minhas API Keys</h3>
            <p className="text-xs text-muted-foreground">Acesso programático (REST + MCP)</p>
          </div>
        </div>
        <StatusChip tone="neutral">Self-service</StatusChip>
      </header>
      {body}
    </section>
  );
}
