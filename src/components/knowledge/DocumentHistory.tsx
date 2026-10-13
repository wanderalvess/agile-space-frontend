'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { knowledgeApi } from '@/app/knowledge/api';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { KnowledgeDocument, KnowledgeVersion } from '@/lib/knowledge-types';

interface DocumentHistoryProps {
  documentId: string;
  canEdit: boolean;
  /** Chamado depois de restaurar, com o documento já atualizado. */
  onRestored: (doc: KnowledgeDocument) => void;
}

export function formatVersionDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '---';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Aba "Histórico" do documento: lista de versões (quem e quando), pré-visualização e restauração com confirmação. */
export function DocumentHistory({ documentId, canEdit, onRestored }: DocumentHistoryProps) {
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<KnowledgeVersion | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setVersions(await knowledgeApi.listVersions(documentId));
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar o histórico.');
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    setSelected(null);
    load();
  }, [load]);

  const open = async (v: KnowledgeVersion) => {
    setIsLoadingVersion(true);
    try {
      setSelected(await knowledgeApi.getVersion(documentId, v.versionNumber));
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível abrir esta versão.');
    } finally {
      setIsLoadingVersion(false);
    }
  };

  const restore = async () => {
    if (!selected) return;
    setIsRestoring(true);
    try {
      const doc = await knowledgeApi.restoreVersion(documentId, selected.versionNumber);
      toast.success(`Versão ${selected.versionNumber} restaurada como uma nova versão.`);
      setConfirming(false);
      setSelected(null);
      onRestored(doc);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível restaurar a versão.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return <div className="py-16 flex justify-center"><AgileSpinner size="md" /></div>;
  }
  if (error) {
    return (
      <div className="py-12 text-center space-y-3" role="alert">
        <p className="text-sm text-destructive font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Tentar de novo</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-6">
      <ul className="space-y-2" aria-label="Versões do documento">
        {versions.map(v => (
          <li key={v.versionNumber}>
            <button
              type="button"
              onClick={() => open(v)}
              aria-current={selected?.versionNumber === v.versionNumber}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                selected?.versionNumber === v.versionNumber
                  ? 'border-cyan-600 bg-cyan-50/60 dark:bg-cyan-950/30'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">Versão {v.versionNumber}</span>
                {v.current && <span className="text-[9px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400">Atual</span>}
              </span>
              <span className="block text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{v.changedByName || v.changedBy || 'Autor desconhecido'}</span>
              <span className="block text-[10px] text-slate-500">{formatVersionDate(v.changedAt)}</span>
            </button>
          </li>
        ))}
        {versions.length === 0 && <li className="text-sm text-slate-500">Este documento ainda não tem versões registradas.</li>}
      </ul>

      <div className="min-w-0">
        {isLoadingVersion && <div className="py-10 flex justify-center"><AgileSpinner size="sm" /></div>}
        {!isLoadingVersion && !selected && (
          <div className="py-16 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <History className="h-6 w-6 opacity-50" />
            Escolha uma versão para ver o conteúdo.
          </div>
        )}
        {!isLoadingVersion && selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{selected.title}</h3>
                <p className="text-[11px] text-slate-500">
                  Versão {selected.versionNumber} · {selected.changedByName || selected.changedBy || 'Autor desconhecido'} · {formatVersionDate(selected.changedAt)}
                </p>
              </div>
              {canEdit && !selected.current && (
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setConfirming(true)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar esta versão
                </Button>
              )}
            </div>
            {selected.tags && selected.tags.length > 0 && (
              <p className="text-[11px] text-slate-500">Tags: {selected.tags.join(', ')}</p>
            )}
            <div
              className="prose prose-slate dark:prose-invert max-w-none text-[14px] leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content) || '<em>Sem conteúdo.</em>' }}
            />
          </div>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={(o) => !isRestoring && setConfirming(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar a versão {selected?.versionNumber}?</DialogTitle>
            <DialogDescription>
              O conteúdo atual continua guardado no histórico. A versão escolhida vira a versão mais recente do documento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={isRestoring} onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button disabled={isRestoring} onClick={restore}>{isRestoring ? 'Restaurando...' : 'Restaurar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
