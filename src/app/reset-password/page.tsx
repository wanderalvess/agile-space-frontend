'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordWithToken, validateNewPassword, MIN_PASSWORD_LENGTH } from '@/lib/password-api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token')?.trim() || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-slate-50 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight">Redefinir senha</h1>
          <p className="text-xs text-slate-400">Portal Tech V&amp;D</p>
        </div>
      </div>

      {done ? (
        <div className="space-y-4" role="status">
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Senha redefinida. Entre com a nova senha.</span>
          </div>
          <Button asChild className="w-full rounded-xl font-bold">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Link incompleto. Peça um novo link ao seu administrador, Agile Master ou Tribe Lead.</span>
          </div>
          <Button asChild variant="outline" className="w-full rounded-xl font-bold">
            <Link href="/login">Voltar ao login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-300">Defina a sua nova senha. O link vale uma vez só.</p>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Nova senha
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Confirmar nova senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl font-bold uppercase tracking-wider">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redefinir senha'}
          </Button>
          <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-slate-200">
            Voltar ao login
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-slate-950 p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-slate-400" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
