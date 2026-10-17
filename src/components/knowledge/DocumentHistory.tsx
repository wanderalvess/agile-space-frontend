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
import { ArticleContent } from '@/components/knowledge/ArticleContent';
import { cn } from '@/lib/utils';
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
      <ul className="space-y-2" aria-label="Versões do documento">
        {versions.map(v => (
          <li key={v.versionNumber}>
            <button
              type="button"
              onClick={() => open(v)}
              aria-current={selected?.versionNumber === v.versionNumber}
              className={cn(
                'w-full rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected?.versionNumber === v.versionNumber
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border bg-card hover:bg-muted/60',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">Versão {v.versionNumber}</span>
                {v.current && <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">Atual</span>}
              </span>
              <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                <span>{v.changedByName || v.changedBy || 'Autor desconhecido'}</span>
                <span aria-hidden="true">·</span>
                <span>{formatVersionDate(v.changedAt)}</span>
              </span>
            </button>
          </li>
        ))}
        {versions.length === 0 && <li className="text-sm text-muted-foreground">Este documento ainda não tem versões registradas.</li>}
      </ul>

      <div className="min-w-0">
        {isLoadingVersion && <div className="py-10 flex justify-center"><AgileSpinner size="sm" /></div>}
        {!isLoadingVersion && !selected && (
          <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <History className="h-6 w-6 opacity-50" />
            Escolha uma versão para ver o conteúdo.
          </div>
        )}
        {!isLoadingVersion && selected && (
          <div className="space-y-4 rounded-2xl border border-border bg-card px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-2xl font-bold text-foreground">{selected.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">Tags: {selected.tags.join(', ')}</p>
            )}
            <ArticleContent html={selected.content || ''} emptyText="Sem conteúdo." />
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
