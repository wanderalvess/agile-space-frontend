'use client';

import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { IconTile, Modal, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import type { ImportRow } from '@/lib/roster/import';
import { formatHours } from '@/lib/roster/numbers';
import { cn } from '@/lib/utils';
import type { ImportFilter, useRosterImport } from './hooks/useRosterImport';
import { ICON_STROKE } from './styles';

const GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_88px_104px_minmax(0,140px)] items-center gap-3 px-4';

function StatusCell({ row }: { row: ImportRow }) {
  const view: { label: string; tone: Tone } =
    row.status === 'new'
      ? { label: 'Novo integrante', tone: 'success' }
      : row.status === 'changed'
        ? { label: 'Alterado', tone: 'warn' }
        : { label: 'Sem mudança', tone: 'neutral' };
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusChip tone={view.tone} className="font-bold">{view.label}</StatusChip>
      {row.matchedBy === 'name' && (
        <StatusChip tone="warn" className="font-bold" >
          <span title="Casou só pelo nome: confira se é a mesma pessoa antes de importar.">Conferir</span>
        </StatusChip>
      )}
    </span>
  );
}

function FilterPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent'
      )}
    >
      {label} <span className="tabular-nums">{count}</span>
    </button>
  );
}

/** Prévia da importação: arquivo, regras de casamento, contagem por status e o que muda em cada linha. */
export function ImportDialog({ importer }: { importer: ReturnType<typeof useRosterImport> }) {
  const { summary, filter } = importer;
  const toggle = (f: Exclude<ImportFilter, null>) => importer.setFilter(filter === f ? null : f);
  const lineCount = importer.rows.length + importer.skipped;

  return (
    <Modal
      open={importer.open}
      onOpenChange={(o) => { if (!o) importer.close(); }}
      size="lg"
      icon={Upload}
      title="Prévia da importação de carga horária"
      preventClose={importer.applying}
      footerStart={<ModalButton variant="ghost" onClick={importer.downloadTemplate}>Baixar modelo</ModalButton>}
      footer={
        <>
          <ModalButton disabled={importer.applying} onClick={importer.close}>Cancelar</ModalButton>
          <ModalButton variant="primary" disabled={importer.applying || importer.rows.length === 0} onClick={importer.confirm}>
            <CheckCircle2 className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
            {importer.applying ? 'Aplicando…' : `Confirmar e importar (${importer.rows.length})`}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
          <IconTile icon={FileSpreadsheet} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{importer.fileName}</span>
            <span className="text-xs text-muted-foreground">
              {lineCount} {lineCount === 1 ? 'linha' : 'linhas'}
              {importer.skipped > 0 && ` (${importer.skipped} ignoradas: sem nome, e-mail nem ID, ou com e-mail inválido)`} · aceita .csv e .txt
            </span>
          </span>
          <ModalButton className="h-9 text-[13px]" disabled={importer.applying} onClick={importer.pickFile}>Trocar arquivo</ModalButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Casa a pessoa por</span>
          <StatusChip tone="brand" className="h-[26px] px-3"><b className="tabular-nums opacity-80">{summary.matchedById}</b> ID da conta</StatusChip>
          <StatusChip tone="brand" className="h-[26px] px-3"><b className="tabular-nums opacity-80">{summary.matchedByEmail}</b> E-mail</StatusChip>
          <StatusChip tone="brand" className="h-[26px] px-3"><b className="tabular-nums opacity-80">{summary.matchedByName}</b> Nome</StatusChip>
          <StatusChip tone="neutral" className="h-[26px] px-3">Horas ≤ 0 ou &gt; 24 mantêm o valor atual</StatusChip>
          <StatusChip tone="neutral" className="h-[26px] px-3">Separador {importer.delimiter} detectado</StatusChip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={filter === 'changed'} label="Alterados" count={summary.changed} onClick={() => toggle('changed')} />
          <FilterPill active={filter === 'unchanged'} label="Sem mudança" count={summary.unchanged} onClick={() => toggle('unchanged')} />
          <FilterPill active={filter === 'new'} label="Novos" count={summary.added} onClick={() => toggle('new')} />
          {summary.nameOnly > 0 && <FilterPill active={filter === 'name-only'} label="Conferir" count={summary.nameOnly} onClick={() => toggle('name-only')} />}
        </div>
        {summary.nameOnly > 0 && (
          <p className="text-[13px] text-muted-foreground">
            {summary.nameOnly === 1 ? '1 linha casou' : `${summary.nameOnly} linhas casaram`} só pelo nome. Confira se é a mesma pessoa; sem ID nem e-mail, dois colegas com o mesmo nome se confundem.
          </p>
        )}

        <div className="overflow-x-auto rounded-[14px] border border-border">
          <div className="min-w-[640px]">
            <div className={cn(GRID, 'bg-muted/60 py-2.5 text-xs font-bold leading-tight text-muted-foreground')}>
              <span>Nome / ID da conta</span>
              <span>Cargo</span>
              <span>Horas atuais</span>
              <span>Novas horas</span>
              <span>Status</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {importer.visibleRows.length === 0 ? (
                <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma linha neste status.</p>
              ) : (
                importer.visibleRows.map((row) => (
                  <div key={row.line} className={cn(GRID, 'border-t border-border py-2.5')}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{row.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{row.jiraAccountId || row.email || 'sem ID'}</span>
                    </span>
                    <span className="flex min-w-0 flex-col text-[13px] text-foreground">
                      <span className="truncate">{row.role}</span>
                      {row.existingMember && row.role !== (row.existingMember.role || 'Developer') && (
                        <span className="truncate text-xs text-muted-foreground">era {row.existingMember.role || 'Developer'}</span>
                      )}
                    </span>
                    <span className="text-[13px] tabular-nums text-muted-foreground">{formatHours(row.currentCapacity)}h</span>
                    <span className="flex flex-col">
                      <span className="text-sm font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{formatHours(row.importedCapacity)}h</span>
                      {row.capacityKept && <span className="text-xs text-muted-foreground">mantido</span>}
                    </span>
                    <StatusCell row={row} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
