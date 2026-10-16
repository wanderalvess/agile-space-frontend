'use client';

import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import type { SquadMember } from '@/lib/types';
import { systemHoursOf, type CapacityRule } from '@/lib/roster/calc';
import { decodeCsvBytes, downloadTextFile, type CsvDelimiter } from '@/lib/roster/csv';
import {
  buildImportMembers,
  buildRosterTemplateCsv,
  parseRosterImport,
  summarizeImport,
  type ImportRow,
  type ImportStatus,
} from '@/lib/roster/import';

export type ImportFilter = ImportStatus | 'name-only' | null;

/** Importação da planilha do time: leitura, prévia por linha, filtro por status e aplicação. */
export function useRosterImport(args: { squadId: string; members: SquadMember[]; rule: CapacityRule; inputRef: RefObject<HTMLInputElement | null> }) {
  const { squadId, members, rule, inputRef } = args;
  const { toast } = useToast();
  const batchUpdateMembers = useSquadStore((s) => s.batchUpdateMembers);

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(',');
  const [skipped, setSkipped] = useState(0);
  const [applying, setApplying] = useState(false);
  const [filter, setFilter] = useState<ImportFilter>(null);

  const pickFile = useCallback(() => inputRef.current?.click(), [inputRef]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Limpa para escolher o mesmo arquivo de novo depois de corrigi-lo.
      e.target.value = '';
      if (!file) return;
      try {
        const text = decodeCsvBytes(await file.arrayBuffer());
        const result = parseRosterImport(text, members, rule.baseHours);
        if (result === 'EMPTY') {
          toast({ title: 'Arquivo inválido', description: 'O arquivo não tem dados suficientes.', variant: 'destructive' });
          return;
        }
        setRows(result.rows);
        setDelimiter(result.delimiter);
        setSkipped(result.skipped);
        setFileName(file.name);
        setFilter(null);
        setOpen(true);
      } catch {
        toast({ title: 'Erro na leitura', description: 'Não foi possível ler o arquivo CSV.', variant: 'destructive' });
      }
    },
    [members, rule.baseHours, toast]
  );

  const summary = useMemo(() => summarizeImport(rows), [rows]);

  const visibleRows = useMemo(() => {
    if (!filter) return rows;
    if (filter === 'name-only') return rows.filter((r) => r.matchedBy === 'name');
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const close = useCallback(() => {
    setOpen(false);
    setRows([]);
    setFileName('');
    setFilter(null);
  }, []);

  const downloadTemplate = useCallback(() => downloadTextFile('modelo_capacidade_equipe.csv', buildRosterTemplateCsv()), []);

  const confirm = useCallback(async () => {
    if (rows.length === 0) return;
    setApplying(true);
    try {
      const batch = buildImportMembers(rows, squadId, rule.baseHours, (existing) => systemHoursOf(existing, rule));
      await batchUpdateMembers(squadId, batch);
      toast({ title: 'Importação concluída', description: `${batch.length} ${batch.length === 1 ? 'integrante atualizado' : 'integrantes atualizados'}.` });
      close();
    } catch (err: unknown) {
      toast({ title: 'Erro na importação', description: (err as Error)?.message || 'Falha ao salvar dados importados.', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  }, [rows, squadId, rule, batchUpdateMembers, toast, close]);

  return {
    pickFile, onFileChange,
    open, close, fileName, rows, visibleRows, delimiter, skipped, summary,
    filter, setFilter, applying, confirm, downloadTemplate,
  };
}
