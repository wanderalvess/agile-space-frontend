'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PAGE_CARD } from '@/components/page';
import { ConfirmDialog, Modal, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { isMissingRoute, promptApi } from '@/app/prompt-hub/api';
import { invalidateCatalogCache } from '@/app/prompt-hub/catalog-query';
import type { PromptItem, PromptVersionDetail, PromptVersionSummary } from '@/app/prompt-hub/types';

const whenLabel = (iso?: string) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
};

interface VersionsCardProps {
  item: Pick<PromptItem, 'id' | 'title'>;
  /** Dona do item ou administradora: só ela restaura. */
  canRestore: boolean;
  /** Depois de restaurar, a tela recebe o item como ficou. */
  onRestored: (item: PromptItem) => void;
  /** Muda quando o item foi salvo de novo, para a lista recarregar. */
  refreshKey?: string | number;
}

/** Cartão "Versões": o histórico do item. "Ver" abre a versão; "Restaurar" volta o item para ela. */
export function VersionsCard({ item, canRestore, onRestored, refreshKey }: VersionsCardProps) {
  const [versions, setVersions] = useState<PromptVersionSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [viewing, setViewing] = useState<PromptVersionDetail | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [toRestore, setToRestore] = useState<PromptVersionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const list = await promptApi.listVersions(item.id);
      setVersions([...list].sort((a, b) => b.versionNumber - a.versionNumber));
      setState('ready');
    } catch (err) {
      setState(isMissingRoute(err) ? 'missing' : 'error');
    }
  }, [item.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const view = async (version: PromptVersionSummary) => {
    setOpening(version.versionNumber);
    try {
      setViewing(await promptApi.getVersion(item.id, version.versionNumber));
    } catch (err) {
      toast.error('Não foi possível abrir a versão', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setOpening(null);
    }
  };

  const restore = async () => {
    if (!toRestore) return;
    setRestoring(true);
    try {
      const restored = await promptApi.restoreVersion(item.id, toRestore.versionNumber);
      invalidateCatalogCache();
      toast.success(`Versão ${toRestore.versionNumber} restaurada`);
      setToRestore(null);
      setViewing(null);
      onRestored(restored);
      await load();
    } catch (err) {
      toast.error('Erro ao restaurar a versão', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRestoring(false);
    }
  };

  // Backend antigo: sem histórico, o cartão não aparece.
  if (state === 'missing') return null;

  return (
    <section aria-label="Versões" className={cn(PAGE_CARD, 'flex flex-col gap-2.5 p-[18px]')}>
      <h2 className="text-base font-bold text-foreground">Versões</h2>
      {state === 'loading' && <p className="text-sm text-muted-foreground">Carregando as versões…</p>}
      {state === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex-1">Não foi possível carregar as versões.</span>
          <ModalButton onClick={() => void load()}>Tentar de novo</ModalButton>
        </div>
      )}
      {state === 'ready' && versions.length === 0 && <p className="text-sm text-muted-foreground">Este item ainda não foi alterado.</p>}
      {state === 'ready' && versions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {versions.map(version => (
            <li key={version.versionNumber} className="flex items-center gap-2.5 rounded-[10px] border border-border px-2.5 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  Versão {version.versionNumber}
                  {version.current ? ' · atual' : ''}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[version.changedByName, whenLabel(version.changedAt)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void view(version)}
                disabled={opening === version.versionNumber}
                aria-label={`Ver a versão ${version.versionNumber}`}
                className="h-8 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                Ver
              </button>
              {canRestore && !version.current && (
                <button
                  type="button"
                  onClick={() => setToRestore(version)}
                  aria-label={`Restaurar a versão ${version.versionNumber}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Restaurar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!viewing}
        onOpenChange={open => {
          if (!open) setViewing(null);
        }}
        size="lg"
        icon={History}
        title={viewing ? `Versão ${viewing.versionNumber}${viewing.current ? ' · atual' : ''}` : 'Versão'}
        description={viewing ? [viewing.changedByName, whenLabel(viewing.changedAt)].filter(Boolean).join(' · ') : undefined}
        footer={
          <>
            <ModalButton onClick={() => setViewing(null)}>Fechar</ModalButton>
            {canRestore && viewing && !viewing.current && (
              <ModalButton variant="primary" onClick={() => setToRestore(viewing)}>
                Restaurar esta versão
              </ModalButton>
            )}
          </>
        }
      >
        {viewing && (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-foreground">{viewing.title}</h3>
            {viewing.description && <p className="text-sm text-muted-foreground">{viewing.description}</p>}
            {viewing.content ? (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-border bg-muted/40 p-3.5 font-mono text-[13px] leading-relaxed text-foreground">
                {viewing.content}
              </pre>
            ) : (
              viewing.gemLink && <p className="break-all font-mono text-[13px] text-muted-foreground">{viewing.gemLink}</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toRestore}
        onOpenChange={open => {
          if (!open) setToRestore(null);
        }}
        icon={RotateCcw}
        title={`Restaurar a versão ${toRestore?.versionNumber ?? ''}?`}
        description="O item volta a ter o título e o conteúdo dessa versão. A versão de hoje continua no histórico."
        confirmLabel="Restaurar"
        loading={restoring}
        loadingLabel="Restaurando…"
        keepOpenOnConfirm
        onConfirm={restore}
      />
    </section>
  );
}
