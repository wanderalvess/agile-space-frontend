'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Lock, LockOpen, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DevToolPage } from '@/components/devtools/DevToolPage';

/*
 * Cofre LOCAL, zero-knowledge:
 *  - A senha mestra nunca é armazenada. Dela deriva-se (PBKDF2-SHA256, 310k iterações, salt aleatório)
 *    uma chave AES-GCM 256 NÃO extraível, que só vive na memória da aba.
 *  - Cada segredo (rótulo + valor) é cifrado com AES-GCM e IV próprio; em localStorage só há texto cifrado.
 *  - Um "verificador" cifrado permite saber se a senha está correta sem guardá-la.
 *  - Nada é enviado a servidor nem registrado em console.
 * Mudança vs. legado: o legado gerava um link de uso único guardando o cifrado no Firestore;
 * isso exige backend e login, então aqui o cofre é pessoal e fica no navegador.
 */
const STORE_KEY = 'devtools.secret-vault.v1';
const ITERATIONS = 310_000;
const VERIFIER_TEXT = 'agile-space-vault-ok';

interface EncItem { id: string; iv: string; ct: string; createdAt: number }
interface Store { salt: string; verifierIv: string; verifier: string; items: EncItem[] }
interface PlainItem { id: string; label: string; secret: string; createdAt: number }

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

function loadStore(): Store | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Store) : null;
  } catch { return null; }
}

function saveStore(store: Store): boolean {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function encrypt(key: CryptoKey, text: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function decrypt(key: CryptoKey, iv: string, ct: string): Promise<string> {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(buf);
}

export default function SecretVaultPage() {
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [ready, setReady] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<PlainItem[]>([]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { setStore(loadStore()); setReady(true); }, []);

  // Descriptografa todos os itens com a chave em memória.
  const decryptAll = useCallback(async (k: CryptoKey, s: Store): Promise<PlainItem[]> => {
    const out: PlainItem[] = [];
    for (const it of s.items) {
      try {
        const { label: l, secret: v } = JSON.parse(await decrypt(k, it.iv, it.ct)) as { label: string; secret: string };
        out.push({ id: it.id, label: l, secret: v, createdAt: it.createdAt });
      } catch { /* item corrompido: ignora */ }
    }
    return out;
  }, []);

  const lock = useCallback(() => {
    setKey(null); setItems([]); setRevealed({}); setPassword(''); setConfirm(''); setAuthError(null);
  }, []);

  const create = async () => {
    setAuthError(null);
    if (password.length < 8) return setAuthError('Use uma senha mestra com pelo menos 8 caracteres.');
    if (password !== confirm) return setAuthError('As senhas não conferem.');
    setBusy(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const k = await deriveKey(password, salt);
      const v = await encrypt(k, VERIFIER_TEXT);
      const s: Store = { salt: toB64(salt), verifierIv: v.iv, verifier: v.ct, items: [] };
      if (!saveStore(s)) return setAuthError('O navegador bloqueou o armazenamento local; o cofre não pode ser criado.');
      setStore(s); setKey(k); setItems([]); setPassword(''); setConfirm('');
    } catch { setAuthError('Falha ao criar o cofre neste navegador.'); } finally { setBusy(false); }
  };

  const unlock = async () => {
    if (!store) return;
    setAuthError(null); setBusy(true);
    try {
      const k = await deriveKey(password, fromB64(store.salt));
      // AES-GCM autentica: senha errada faz decrypt lançar erro
      if ((await decrypt(k, store.verifierIv, store.verifier)) !== VERIFIER_TEXT) throw new Error('bad');
      setItems(await decryptAll(k, store));
      setKey(k); setPassword('');
    } catch { setAuthError('Senha mestra incorreta.'); } finally { setBusy(false); }
  };

  const addItem = async () => {
    if (!key || !store || !secret.trim()) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      const label_ = label.trim() || 'Sem rótulo';
      const { iv, ct } = await encrypt(key, JSON.stringify({ label: label_, secret }));
      const next: Store = { ...store, items: [{ id, iv, ct, createdAt }, ...store.items] };
      if (!saveStore(next)) throw new Error('storage');
      setStore(next);
      setItems(prev => [{ id, label: label_, secret, createdAt }, ...prev]);
      setLabel(''); setSecret('');
    } catch { toast({ title: 'Não foi possível salvar', description: 'O armazenamento local do navegador falhou.', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const removeItem = (id: string) => {
    if (!store) return;
    const next: Store = { ...store, items: store.items.filter(i => i.id !== id) };
    if (saveStore(next)) { setStore(next); setItems(prev => prev.filter(i => i.id !== id)); }
  };

  const copy = async (it: PlainItem) => {
    try { await navigator.clipboard.writeText(it.secret); setCopiedId(it.id); setTimeout(() => setCopiedId(null), 1400); }
    catch { toast({ title: 'Não foi possível copiar', variant: 'destructive' }); }
  };

  const destroy = () => {
    if (!window.confirm('Apagar o cofre e todos os segredos deste navegador? Não há como recuperar.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignora */ }
    setStore(null); lock();
  };

  const unlocked = key !== null;
  const card = 'rounded-2xl border border-border bg-card shadow-sm';

  return (
    <DevToolPage
      toolId="secret-vault"
      scrollBody
      actions={unlocked ? (
        <Button variant="outline" size="sm" onClick={lock} className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
          <Lock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Bloquear</span>
        </Button>
      ) : undefined}
    >
      {!ready ? null : !unlocked ? (
        /* ── Criar / desbloquear ── */
        <div className={`${card} mx-auto mt-6 max-w-md space-y-4 p-5`}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-headline text-lg font-black uppercase tracking-tight">{store ? 'Desbloquear cofre' : 'Criar cofre'}</h2>
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {store
              ? 'Digite a senha mestra para ler seus segredos.'
              : 'Defina uma senha mestra. Ela não é guardada em lugar nenhum: se for esquecida, os segredos não podem ser recuperados.'}
          </p>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void (store ? unlock() : create()); }}>
            <Input type="password" autoComplete="off" placeholder="Senha mestra" value={password} onChange={e => setPassword(e.target.value)} aria-label="Senha mestra" />
            {!store && <Input type="password" autoComplete="off" placeholder="Confirme a senha" value={confirm} onChange={e => setConfirm(e.target.value)} aria-label="Confirmar senha" />}
            {authError && <p className="text-xs font-semibold text-destructive">{authError}</p>}
            <Button type="submit" disabled={busy || !password} className="w-full gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider">
              <LockOpen className="h-4 w-4" /> {busy ? 'Derivando chave…' : store ? 'Desbloquear' : 'Criar cofre'}
            </Button>
          </form>
          {store && (
            <button type="button" onClick={destroy} className="text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
              Esqueci a senha: apagar cofre
            </button>
          )}
        </div>
      ) : (
        /* ── Cofre aberto ── */
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-4">
          <section className={`${card} space-y-3 p-4 md:self-start`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Novo segredo</h2>
              <Badge variant="secondary" className="gap-1 text-[10px] font-black uppercase"><ShieldCheck className="h-3 w-3" /> AES-GCM 256</Badge>
            </div>
            <Input placeholder="Rótulo (ex.: Token do Jira)" value={label} onChange={e => setLabel(e.target.value)} aria-label="Rótulo" />
            <Textarea placeholder="Valor secreto…" value={secret} onChange={e => setSecret(e.target.value)} spellCheck={false} aria-label="Segredo" className="min-h-32 resize-none font-code text-[13px]" />
            <Button onClick={() => void addItem()} disabled={busy || !secret.trim()} className="w-full gap-2 rounded-xl text-[11px] font-black uppercase tracking-wider">
              <Plus className="h-4 w-4" /> Cifrar e guardar
            </Button>
            <p className="text-[11px] font-medium text-muted-foreground">Cifrado no navegador; o servidor nunca vê o conteúdo. Os dados ficam só neste navegador.</p>
          </section>

          <section className={`${card} p-4`}>
            <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Segredos guardados ({items.length})</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum segredo ainda.</p>
            ) : (
              <ul className="space-y-2">
                {items.map(it => (
                  <li key={it.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{it.label}</span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={revealed[it.id] ? 'Ocultar' : 'Revelar'} onClick={() => setRevealed(r => ({ ...r, [it.id]: !r[it.id] }))}>
                          {revealed[it.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Copiar" onClick={() => void copy(it)}>
                          {copiedId === it.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label="Excluir" onClick={() => removeItem(it.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 break-all font-code text-xs text-muted-foreground">{revealed[it.id] ? it.secret : '•'.repeat(Math.min(it.secret.length, 24))}</p>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground/70">{new Date(it.createdAt).toLocaleString('pt-BR')}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </DevToolPage>
  );
}
