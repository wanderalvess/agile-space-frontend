'use client';

import React, { useState } from 'react';
import { FileInput, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface LoadLayoutResult {
  ok: boolean;
  error?: string;
}

interface ExistingLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tenta carregar o texto como layout existente; devolve o erro em português se não der. */
  onLoad: (text: string) => LoadLayoutResult;
}

export function ExistingLayoutDialog({ open, onOpenChange, onLoad }: ExistingLayoutDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const res = onLoad(text);
    if (res.ok) {
      setText('');
      setError(null);
      onOpenChange(false);
    } else {
      setError(res.error ?? 'Não foi possível carregar este layout.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) setError(null); }}>
      <DialogContent className="flex max-h-[88dvh] max-w-2xl flex-col rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle className="flex items-center gap-2 font-headline text-base font-black uppercase tracking-tight">
            <FileInput className="h-4 w-4 text-primary" aria-hidden /> Partir de um layout existente
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Cole o layout que já está em uso: a lista de operações Jolt ou o arquivo completo (com <span className="font-code">tabela.campos</span>).
            O mapa mostra as ligações que ele já tem (tracejadas). Você liga só o que é novo, ou apaga o que não vale mais, e o
            que mudou é aplicado no layout. Modify, default e mapeamentos condicionais ficam exatamente como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 py-2">
          <label htmlFor="layout-existente" className="text-[11px] font-bold text-foreground">Layout</label>
          <Textarea
            id="layout-existente"
            value={text}
            onChange={e => { setText(e.target.value); setError(null); }}
            placeholder={'[ { "operation": "shift", "spec": { ... } } ]'}
            spellCheck={false}
            className="h-[300px] resize-none rounded-xl font-code text-[11px]"
          />
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            O JSON de entrada atual do mapeador é usado para saber quais campos existem. Cole a entrada antes, se ainda não colou.
          </p>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold">Cancelar</Button>
          <Button onClick={submit} disabled={!text.trim()} className="rounded-xl text-xs font-black uppercase tracking-wider">
            Carregar layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
