'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify } from '@/lib/onboarding';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { BackButton, Caption, Spinner, StepCard, StepHeading, WIDE_CTA } from './ui';

interface Props {
  busy: boolean;
  onSubmit: (input: { name: string; key: string }) => void;
  /** Nome em branco: o aviso é do container (toast), a tela só avisa que não dá para enviar. */
  onEmptyName: () => void;
  onImport: () => void;
  onBack: () => void;
}

/** Passo 6: criar a squad sem o Jira. Uma pergunta só; a chave sai do nome e pode ser ajustada. */
export function CreateSquadStep({ busy, onSubmit, onEmptyName, onImport, onBack }: Props) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const finalKey = (key || slugify(trimmed)).trim();
    if (!trimmed || !finalKey) {
      onEmptyName();
      return;
    }
    onSubmit({ name: trimmed, key: finalKey });
  };

  return (
    <StepCard>
      <StepHeading title="Vamos criar o espaço da sua squad." subtitle="Uma pergunta só. O resto a gente monta para você." />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome-squad">
            <Caption>Nome da squad</Caption>
          </Label>
          <Input
            id="nome-squad"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!keyEdited) setKey(slugify(e.target.value));
            }}
            placeholder="Ex: Squad Fênix"
            autoComplete="off"
            autoFocus
            className="h-14 rounded-2xl border-primary/50 text-lg font-semibold"
          />
        </div>

        {!!key && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <CheckCircle2 aria-hidden="true" className={cn('h-4 w-4 shrink-0', TONES.success.text)} strokeWidth={1.5} />
            <span className="min-w-0 flex-1 basis-40 text-[13px] text-muted-foreground">
              Chave gerada: <strong className="font-code font-bold tracking-wider text-foreground">{key}</strong>
            </span>
            <Input
              aria-label="Chave da squad"
              value={key}
              onChange={(e) => {
                setKeyEdited(true);
                setKey(slugify(e.target.value));
              }}
              className="h-8 w-[120px] rounded-lg font-code text-xs uppercase tracking-wider"
            />
          </div>
        )}

        <Button type="submit" disabled={busy} className={WIDE_CTA}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              Criar e entrar <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Segmento, tribo e horas a gente pergunta lá dentro, quando fizer diferença. Você entra com o papel que já tem (Agile Master ou People Lead).
        </p>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-bold">Sua squad já existe no Jira?</span>
          <span className="text-[13px] text-muted-foreground">Importe e traga as pessoas e os papéis prontos.</span>
        </span>
        <Button type="button" variant="outline" onClick={onImport} className="h-10 shrink-0 gap-2 rounded-[10px] text-[13px] font-semibold">
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> Importar do Jira
        </Button>
      </div>

      <BackButton onClick={onBack} />
    </StepCard>
  );
}
