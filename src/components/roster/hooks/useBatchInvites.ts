'use client';

import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';
import { decodeCsvBytes, downloadTextFile } from '@/lib/roster/csv';
import {
  BATCH_CONCURRENCY,
  buildBatchLinksCsv,
  buildBatchTemplateCsv,
  parseBatchInvites,
  runWithConcurrency,
  type BatchInviteRow,
  type BatchResultRow,
} from '@/lib/roster/invites';

export type BatchPhase = 'pick' | 'preview' | 'running' | 'done';

/**
 * Convidar em lote: lê o CSV `e-mail;papel`, valida cada linha e gera os links com chamadas unitárias ao endpoint
 * existente, três por vez (o servidor limita 300 requisições por minuto por IP).
 */
export function useBatchInvites(args: {
  squadId: string;
  create: (role: string, email: string) => Promise<string>;
  onFinished: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { squadId, create, onFinished, inputRef } = args;
  const { toast } = useToast();
  const [phase, setPhase] = useState<BatchPhase>('pick');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<BatchInviteRow[]>([]);
  const [results, setResults] = useState<BatchResultRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const ready = useMemo(() => rows.filter((r) => r.validation === 'ready'), [rows]);
  const attention = rows.length - ready.length;

  const reset = useCallback(() => {
    setPhase('pick');
    setFileName('');
    setRows([]);
    setResults([]);
    setProgress({ done: 0, total: 0 });
  }, []);

  const pickFile = useCallback(() => inputRef.current?.click(), [inputRef]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const parsed = parseBatchInvites(decodeCsvBytes(await file.arrayBuffer()));
        if (parsed === 'EMPTY') {
          toast({ title: 'Arquivo inválido', description: 'O arquivo não tem linhas de convite.', variant: 'destructive' });
          return;
        }
        if (parsed === 'TOO_MANY') {
          toast({ title: 'Lote grande demais', description: 'Divida em arquivos de até 200 linhas.', variant: 'destructive' });
          return;
        }
        setRows(parsed.rows);
        setFileName(file.name);
        setResults([]);
        setPhase('preview');
      } catch {
        toast({ title: 'Erro na leitura', description: 'Não foi possível ler o arquivo CSV.', variant: 'destructive' });
      }
    },
    [toast]
  );

  const downloadTemplate = useCallback(() => downloadTextFile('modelo_convites.csv', buildBatchTemplateCsv()), []);

  const run = useCallback(
    async (only?: BatchResultRow[]) => {
      // Primeira rodada: as linhas prontas. Nova tentativa: só as que falharam.
      const todo = only ? only.map((r) => ({ email: r.email, role: r.role })) : ready.map((r) => ({ email: r.email, role: r.role as string }));
      if (todo.length === 0) return;
      setPhase('running');
      setProgress({ done: 0, total: todo.length });
      const outcome = await runWithConcurrency(
        todo,
        BATCH_CONCURRENCY,
        async (item): Promise<BatchResultRow> => {
          try {
            const link = await create(item.role, item.email);
            return { ...item, status: 'done', link };
          } catch (err: unknown) {
            return { ...item, status: 'error', error: (err as Error)?.message || 'Erro ao gerar o convite.' };
          }
        },
        (done, total) => setProgress({ done, total })
      );
      const fresh: BatchResultRow[] = outcome.map((o, i) =>
        o instanceof Error ? { ...todo[i], status: 'error', error: o.message } : o
      );
      // Em nova tentativa, troca só as linhas refeitas e mantém os links já gerados.
      const merged = only
        ? results.map((r) => fresh.find((f) => f.email === r.email && r.status === 'error') ?? r)
        : fresh;
      setResults(merged);
      setPhase('done');
      onFinished();
      const ok = fresh.filter((r) => r.status === 'done').length;
      const failed = fresh.length - ok;
      toast(
        failed === 0
          ? { title: 'Convites gerados', description: `${ok} ${ok === 1 ? 'link gerado' : 'links gerados'}. Copie ou exporte o CSV.` }
          : { title: `${ok} de ${fresh.length} links gerados`, description: `${failed} com erro: veja a situação de cada linha.`, variant: 'destructive' }
      );
    },
    [ready, results, create, onFinished, toast]
  );

  const retryFailed = useCallback(() => run(results.filter((r) => r.status === 'error')), [run, results]);

  const exportLinks = useCallback(
    () => downloadTextFile(`convites_${squadId}_${new Date().toISOString().split('T')[0]}.csv`, buildBatchLinksCsv(results)),
    [results, squadId]
  );

  return {
    phase, fileName, rows, ready, attention, results, progress,
    pickFile, onFileChange, downloadTemplate, run: () => run(), retryFailed, exportLinks, reset,
  };
}
