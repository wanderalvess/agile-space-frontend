'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { resetPasswordWithToken, validateNewPassword } from '@/lib/password-api';
import { ResetPasswordView } from '@/components/access/ResetPasswordView';

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
    <ResetPasswordView
      hasToken={!!token}
      done={done}
      password={password}
      confirmation={confirmation}
      onPasswordChange={setPassword}
      onConfirmationChange={setConfirmation}
      error={error}
      saving={saving}
      onSubmit={submit}
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" strokeWidth={1.5} aria-label="Carregando" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
