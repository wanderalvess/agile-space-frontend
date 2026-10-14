'use client';

import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { changeOwnPassword, validateNewPassword, MIN_PASSWORD_LENGTH } from '@/lib/password-api';

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

  return (
    <form onSubmit={submit} className="space-y-3.5 rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5" noValidate>
      <div>
        <h4 className="flex items-center gap-2 font-headline text-sm font-extrabold uppercase tracking-wide text-foreground">
          <KeyRound className="h-4 w-4 text-primary" /> Trocar minha senha
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Use uma senha só sua, com pelo menos {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cp-current" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Senha atual
          </Label>
          <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-new" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nova senha
          </Label>
          <Input id="cp-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-confirm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Confirmar
          </Label>
          <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="h-10 rounded-xl" />
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="h-10 rounded-xl px-6 text-xs font-bold uppercase tracking-wider">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trocar senha'}
        </Button>
      </div>
    </form>
  );
}
