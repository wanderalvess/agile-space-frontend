'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Check, Copy, KeyRound, Plus, RefreshCw, UserRound } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { adminApi, type ApiKeyData } from '@/app/admin/api';
import { userApi } from '@/app/users/api';
import { toast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';
import { describeExpiry, keysNeedingAttention, EXPIRY_CHOICES, EXPIRY_WARNING_DAYS } from '@/lib/api-key-expiry';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, FOCUS_RING, IconButton, IconTile, ModalButton, SelectField, StatusChip, type Tone } from '@/components/room-kit';
import { FIELD_LABEL } from './AdminOpsParts';
import { RENEW_TERMS, buildNameIndex, ownerLabel, renewMessage, type NameIndex } from './admin-ops-utils';

const EXPIRY_TONES: Record<string, Tone> = { expired: 'danger', soon: 'warn', ok: 'neutral', none: 'neutral' };

function ago(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

export function ApiKeysManager() {
  const { session } = useAuth();
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [names, setNames] = useState<NameIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('90');

  const [renewTarget, setRenewTarget] = useState<ApiKeyData | null>(null);
  const [renewTerm, setRenewTerm] = useState('90');
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyData | null>(null);
  const [busy, setBusy] = useState(false);

  const loadKeys = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      setKeys(await adminApi.getApiKeys());
      setLoadError(false);
    } catch (e) {
      console.error('Erro ao carregar API keys:', e);
      if (initial) setLoadError(true);
      else toast({ variant: 'destructive', title: 'Não foi possível carregar as chaves' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys(true);
  }, [loadKeys]);

  // Dono da chave: nome pelo cadastro de usuários; sem a lista, aparece o ID.
  useEffect(() => {
    let cancelled = false;
    userApi
      .getAllUsers()
      .then((users) => {
        if (!cancelled) setNames(buildNameIndex(users));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const attention = useMemo(() => keysNeedingAttention(keys), [keys]);

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
      setCopied(false);
      setNewKeyName('');
      await loadKeys();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao gerar chave' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    const target = revokeTarget;
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.revokeApiKey(target.id);
      await logSystemEvent({
        content: `API KEY REVOGADA: "${target.name}".`,
        type: 'admin',
        severity: 'warning',
        userEmail: session?.email,
        module: 'ApiKeys',
      });
      await loadKeys();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao revogar chave' });
    } finally {
      setBusy(false);
      setRevokeTarget(null);
    }
  };

  const handleRenew = async () => {
    const target = renewTarget;
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.renewApiKey(target.id, renewTerm);
      const termLabel = RENEW_TERMS.find((t) => t.value === renewTerm)?.label ?? renewTerm;
      toast({ title: 'Chave renovada', description: renewMessage(target.name, renewTerm) });
      await logSystemEvent({
        content: `API KEY RENOVADA: "${target.name}" (${termLabel.toLowerCase()}).`,
        type: 'admin',
        severity: 'warning',
        userEmail: session?.email,
        module: 'ApiKeys',
      });
      await loadKeys();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao renovar chave' });
    } finally {
      setBusy(false);
      setRenewTarget(null);
    }
  };

  const copyRevealedKey = async () => {
    if (!revealedKey) return;
    try {
      if (!(await copyToClipboard(revealedKey))) throw new Error('clipboard');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar', description: 'Selecione a chave e copie manualmente.' });
    }
  };

  const openRenew = (k: ApiKeyData) => {
    setRenewTerm('90');
    setRenewTarget(k);
  };

  if (loading) return <LoadingSkeleton variant="table" rows={4} label="Carregando API Keys" />;

  return (
    <div className="flex flex-col gap-4">
      {attention.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[13px] font-medium leading-snug">
            {attention.length === 1 ? '1 chave vence' : `${attention.length} chaves vencem`} em menos de {EXPIRY_WARNING_DAYS} dias (ou já venceram). Renove antes do
            vencimento: a integração que usa a chave para de funcionar quando ela expira.
          </p>
        </div>
      )}

      {revealedKey && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5" role="status">
          <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200">Copie agora: essa chave não será mostrada de novo</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex min-h-11 min-w-0 flex-1 items-center rounded-[10px] border border-border bg-card px-3.5 font-mono text-xs text-foreground">
              <span className="truncate" title={revealedKey}>{revealedKey}</span>
            </code>
            <ModalButton variant="primary" onClick={copyRevealedKey} className="h-11 gap-2">
              {copied ? <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar'}
            </ModalButton>
          </div>
        </div>
      )}

      <section className={cn(PAGE_CARD, 'overflow-clip')} aria-label="Chaves de acesso">
        <header className="flex items-center gap-3.5 border-b border-border px-6 py-4">
          <IconTile icon={KeyRound} />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Chaves de acesso</h2>
            <p className="text-[13px] text-muted-foreground">Acesso por programa à Base de Conhecimento, Prompt Hub, Squad e Poker</p>
          </div>
        </header>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label htmlFor="api-key-name" className={FIELD_LABEL}>Nome da chave</label>
              <input
                id="api-key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Ex.: MCP Server, Integração X"
                className={cn(FIELD, 'h-11')}
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-[260px]">
              <label htmlFor="api-key-expiry" className={FIELD_LABEL}>Validade</label>
              <SelectField
                id="api-key-expiry"
                aria-label="Validade da chave"
                value={expiresIn}
                onChange={setExpiresIn}
                options={EXPIRY_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
                className="h-11"
              />
            </div>
            <ModalButton variant="primary" onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="h-11 gap-2 max-sm:w-full">
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> {creating ? 'Gerando…' : 'Gerar'}
            </ModalButton>
          </div>

          {expiresIn === 'never' && (
            <p role="note" className="text-[13px] font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.5} aria-hidden="true" />
              Chave sem expiração continua valendo para sempre se vazar. Prefira 90 dias e renove.
            </p>
          )}

          {loadError ? (
            <ErrorState embedded title="Não foi possível carregar as chaves" onRetry={() => loadKeys(true)} />
          ) : keys.length === 0 ? (
            <EmptyState embedded icon={KeyRound} title="Nenhuma chave criada ainda" description="Crie a primeira para liberar uma integração." />
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Chaves ({keys.length})</h3>
              <ul className="flex flex-col gap-2">
                {keys.map((k) => {
                  const exp = describeExpiry(k.expiresAt);
                  const owner = ownerLabel(names, k.ownerUserId);
                  const revoked = !!k.revokedAt;
                  return (
                    <li
                      key={k.id}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3.5',
                        revoked && 'opacity-60',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-bold text-foreground">{k.name}</p>
                          <StatusChip tone={revoked ? 'danger' : 'success'}>{revoked ? 'Revogada' : 'Ativa'}</StatusChip>
                          {!revoked && <StatusChip tone={EXPIRY_TONES[exp.level]}>{exp.label}</StatusChip>}
                        </div>
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Criada {ago(k.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{k.lastUsedAt ? `Último uso ${ago(k.lastUsedAt)}` : 'Sem uso ainda'}</span>
                          {k.ownerUserId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1" title={owner ? k.ownerUserId : undefined}>
                                <UserRound className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                                Dono: {owner ?? <span className="font-mono">{k.ownerUserId}</span>}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {!revoked && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <IconButton size="sm" label={`Renovar a chave ${k.name}`} icon={RefreshCw} onClick={() => openRenew(k)} />
                          <IconButton
                            size="sm"
                            label={`Revogar a chave ${k.name}`}
                            icon={Ban}
                            onClick={() => setRevokeTarget(k)}
                            className="hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!renewTarget}
        onOpenChange={(open) => { if (!open) setRenewTarget(null); }}
        tone="brand"
        icon={RefreshCw}
        size="md"
        title={`Renovar a chave “${renewTarget?.name ?? ''}”?`}
        cancelLabel="Cancelar"
        confirmLabel="Renovar chave"
        loading={busy}
        loadingLabel="Renovando…"
        keepOpenOnConfirm
        onConfirm={handleRenew}
      >
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL} id="renew-term-label">Novo prazo</span>
          <div role="radiogroup" aria-labelledby="renew-term-label" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RENEW_TERMS.map((t) => {
              const on = renewTerm === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRenewTerm(t.value)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    FOCUS_RING,
                    on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent',
                  )}
                >
                  <span aria-hidden="true" className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]', on ? 'border-primary' : 'border-muted-foreground/70')}>
                    {on && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground">{t.label}</span>
                  {t.hint && <span className="text-xs text-muted-foreground">{t.hint}</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-muted-foreground">O papel e os escopos são reavaliados com o papel atual do dono.</p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        tone="danger"
        icon={Ban}
        title={`Revogar a chave “${revokeTarget?.name ?? ''}”?`}
        description="Quem usa essa chave perde o acesso na hora. Isso não pode ser desfeito."
        cancelLabel="Manter"
        confirmLabel="Revogar chave"
        loading={busy}
        loadingLabel="Revogando…"
        keepOpenOnConfirm
        onConfirm={handleRevoke}
      />
    </div>
  );
}
