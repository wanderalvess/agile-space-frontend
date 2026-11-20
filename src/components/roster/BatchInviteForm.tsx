'use client';

import { Copy, Download, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { IconButton, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import { BATCH_VALIDATION_LABEL, MAX_BATCH_INVITES, type BatchValidation } from '@/lib/roster/invites';
import { cn } from '@/lib/utils';
import type { useBatchInvites } from './hooks/useBatchInvites';
import { ICON_STROKE } from './styles';

const VALIDATION_TONE: Record<BatchValidation, Tone> = {
  ready: 'success',
  'invalid-email': 'warn',
  'role-not-allowed': 'warn',
  duplicate: 'warn',
};

const ROW = 'grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 px-4';

interface BatchInviteFormProps {
  batch: ReturnType<typeof useBatchInvites>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCopy: (link: string) => void;
  onClose: () => void;
}

/** Convidar em lote: modelo CSV `e-mail;papel`, prévia validada por linha, geração com fila e resultado com links. */
export function BatchInviteForm({ batch, inputRef, onCopy, onClose }: BatchInviteFormProps) {
  const icon = { className: 'h-4 w-4', strokeWidth: ICON_STROKE, 'aria-hidden': true } as const;
  const input = <input ref={inputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={batch.onFileChange} data-testid="batch-file" />;

  if (batch.phase === 'pick') {
    return (
      <div className="flex flex-col gap-4">
        {input}
        <p className="text-[13px] text-muted-foreground">
          Um convite por linha, no formato abaixo. O convite guarda só e-mail e papel; liderança não é concedida por convite. Até {MAX_BATCH_INVITES} linhas por arquivo.
        </p>
        <pre className="overflow-x-auto rounded-xl border-[1.5px] border-dashed border-border px-4 py-3.5 font-mono text-[13px] leading-[1.7] text-muted-foreground">
{`e-mail;papel
carla.mendes@empresa.com;Developer
diego.alves@empresa.com;UX/Designer
hugo@parceiro.com;QA`}
        </pre>
        <div className="flex flex-wrap justify-end gap-2">
          <ModalButton onClick={batch.downloadTemplate}><Download {...icon} /> Baixar modelo CSV</ModalButton>
          <ModalButton variant="primary" onClick={batch.pickFile}><FileSpreadsheet {...icon} /> Escolher arquivo</ModalButton>
        </div>
      </div>
    );
  }

  if (batch.phase === 'preview') {
    return (
      <div className="flex flex-col gap-4">
        {input}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span className="truncate">{batch.fileName}</span>
          <ModalButton className="h-9 text-[13px]" onClick={batch.pickFile}>Trocar arquivo</ModalButton>
        </div>
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <div className="min-w-[520px]">
            <div className={cn(ROW, 'bg-muted/60 py-2.5 text-xs font-bold text-muted-foreground')}>
              <span>E-mail</span><span>Papel</span><span>Situação</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {batch.rows.map((r) => (
                <div key={r.line} className={cn(ROW, 'border-t border-border py-2.5')}>
                  <span className="truncate text-sm font-semibold text-foreground">{r.email || '(vazio)'}</span>
                  <span className="truncate text-[13px] text-foreground">{r.role ?? (r.roleRaw || '(vazio)')}</span>
                  <StatusChip tone={VALIDATION_TONE[r.validation]} className="w-fit font-bold">{BATCH_VALIDATION_LABEL[r.validation]}</StatusChip>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-muted-foreground">
            {batch.ready.length} {batch.ready.length === 1 ? 'pronto' : 'prontos'} · {batch.attention} com atenção
            {batch.attention > 0 && ' (ficam de fora)'}
          </span>
          <div className="flex gap-2">
            <ModalButton onClick={onClose}>Cancelar</ModalButton>
            <ModalButton variant="primary" disabled={batch.ready.length === 0} onClick={batch.run}>
              {batch.ready.length === 1 ? 'Gerar 1 link' : `Gerar ${batch.ready.length} links`}
            </ModalButton>
          </div>
        </div>
      </div>
    );
  }

  if (batch.phase === 'running') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Gerando links: {batch.progress.done} de {batch.progress.total}</span>
        <span className="text-xs text-muted-foreground">Três de cada vez, para não passar do limite de requisições do servidor.</span>
      </div>
    );
  }

  const okCount = batch.results.filter((r) => r.status === 'done').length;
  const failed = batch.results.length - okCount;
  return (
    <div className="flex flex-col gap-4">
      {input}
      <div role="status" className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
        <span className="text-[13px] font-bold text-foreground">
          {okCount} {okCount === 1 ? 'link gerado' : 'links gerados'}{failed > 0 && `, ${failed} com erro`}
        </span>
        <span className="text-xs text-muted-foreground">Copie cada link ou exporte o CSV para enviar às pessoas.</span>
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-border">
        <div className="min-w-[520px]">
          <div className={cn(ROW, 'grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] bg-muted/60 py-2.5 text-xs font-bold text-muted-foreground')}>
            <span>E-mail</span><span>Papel</span><span>Link</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {batch.results.map((r) => (
              <div key={r.email} className={cn(ROW, 'grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] border-t border-border py-2')}>
                <span className="truncate text-sm font-semibold text-foreground">{r.email}</span>
                <span className="truncate text-[13px] text-foreground">{r.role}</span>
                {r.status === 'done' && r.link ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.link}</code>
                    <IconButton size="sm" label={`Copiar link de ${r.email}`} icon={Copy} onClick={() => onCopy(r.link as string)} />
                  </span>
                ) : (
                  <StatusChip tone="danger" className="h-auto min-h-[22px] w-fit whitespace-normal py-0.5">{r.error || 'Erro'}</StatusChip>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {failed > 0 && (
          <ModalButton onClick={batch.retryFailed}><RefreshCw {...icon} /> Tentar de novo os {failed} com erro</ModalButton>
        )}
        <ModalButton disabled={okCount === 0} onClick={batch.exportLinks}><Download {...icon} /> Exportar CSV</ModalButton>
        <ModalButton variant="primary" onClick={onClose}>Fechar</ModalButton>
      </div>
    </div>
  );
}
