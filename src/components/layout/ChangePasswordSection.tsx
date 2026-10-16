'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { changeOwnPassword, validateNewPassword } from '@/lib/password-api';
import { ModalButton } from '@/components/room-kit';
import { FIELD_INPUT, Field, FieldError } from '@/components/profile/fields';

/** Troca da própria senha, no perfil. Quem trocou continua logado; as outras sessões caem. */
export function ChangePasswordSection() {
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) {
      setError('Informe a senha atual.');
      return;
    }
    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changeOwnPassword(current, password);
      setCurrent('');
      setPassword('');
      setConfirmation('');
      toast({ title: 'Senha alterada', description: 'As outras sessões abertas da sua conta foram encerradas.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setSaving(false);
    }
  };

  const describedBy = error ? 'cp-error' : undefined;

  return (
    <form onSubmit={submit} noValidate aria-labelledby="cp-title" className="flex flex-col gap-3.5 rounded-xl border border-border p-3.5">
      <h3 id="cp-title" className="text-sm font-semibold text-foreground">
        Trocar senha
      </h3>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field htmlFor="cp-current" label="Senha atual" className="sm:col-span-2">
          <input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={!!error && !current}
            aria-describedby={describedBy}
            className={FIELD_INPUT}
          />
        </Field>
        <Field htmlFor="cp-new" label="Nova senha">
          <input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={describedBy}
            className={FIELD_INPUT}
          />
        </Field>
        <Field htmlFor="cp-confirm" label="Confirmar nova senha">
          <input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-describedby={describedBy}
            className={FIELD_INPUT}
          />
        </Field>
      </div>
      <FieldError id="cp-error">{error}</FieldError>
      <div className="flex justify-end">
        <ModalButton type="submit" variant="primary" disabled={saving} className="max-sm:h-11 max-sm:w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-label="Trocando senha" /> : 'Trocar senha'}
        </ModalButton>
      </div>
    </form>
  );
}
