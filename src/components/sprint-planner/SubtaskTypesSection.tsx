'use client';

import { useCallback, useEffect, useState } from 'react';
import { FIELD, StatusChip } from '@/components/room-kit';
import { ErrorState, LoadingSkeleton } from '@/components/page';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { cn } from '@/lib/utils';
import { subtaskTypesApi, type SubtaskClass, type SubtaskType } from '@/lib/sprint-planner/api';
import { CLASS_LABEL, CLASS_TONE, ORIGIN_LABEL } from '@/lib/sprint-planner/format';

const CLASSES: SubtaskClass[] = ['DEV', 'QA', 'FORA_DA_CONTA', 'SEM_CLASSIFICACAO'];

type Load = { state: 'loading' } | { state: 'error' } | { state: 'unavailable' } | { state: 'ok'; types: SubtaskType[] };

/**
 * "Tipos de subtarefa da squad": a classe vem do TIPO no Jira, não do título. Liderança (canEdit) troca a classe;
 * os demais veem em leitura. Contrato da E1b: GET/PUT /api/squads/{s}/subtask-types.
 */
export function SubtaskTypesSection({ squadId, sprintKey, canEdit }: { squadId: string; sprintKey: string; canEdit: boolean }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTypes = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const r = await subtaskTypesApi.get(squadId, sprintKey);
      setLoad(r.status === 'ok' ? { state: 'ok', types: r.data.types } : { state: 'unavailable' });
    } catch {
      setLoad({ state: 'error' });
    }
  }, [squadId, sprintKey]);

  useEffect(() => { void fetchTypes(); }, [fetchTypes]);

  const change = async (t: SubtaskType, cls: SubtaskClass) => {
    if (cls === t.subtaskClass) return;
    setSavingId(t.typeId);
    try {
      const view = await subtaskTypesApi.update(squadId, sprintKey, [
        { typeId: t.typeId, typeName: t.typeName, subtaskClass: cls, defaultHours: t.defaultHours, qaByTitleException: t.qaByTitleException },
      ]);
      setLoad((prev) => {
        if (prev.state !== 'ok') return prev;
        const byId = new Map(view.types.map((x) => [x.typeId, x]));
        return { state: 'ok', types: prev.types.map((x) => byId.get(x.typeId) ?? (x.typeId === t.typeId ? { ...x, subtaskClass: cls, origin: 'MANUAL' } : x)) };
      });
    } catch (e) {
      toast({ title: 'Não foi possível salvar o tipo', description: errorMessage(e, 'Tente de novo.'), variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  if (load.state === 'loading') return <LoadingSkeleton variant="table" rows={4} label="Carregando tipos de subtarefa" />;
  if (load.state === 'error') return <ErrorState embedded title="Não foi possível carregar os tipos" onRetry={() => void fetchTypes()} />;
  if (load.state === 'unavailable') {
    return (
      <p className="rounded-[10px] bg-muted px-3 py-3 text-sm text-muted-foreground">
        Os tipos de subtarefa ainda não estão disponíveis neste servidor. Eles chegam com a sincronização do backlog.
      </p>
    );
  }
  const unclassified = load.types.filter((t) => t.subtaskClass === 'SEM_CLASSIFICACAO').length;
  return (
    <div className="flex flex-col gap-3">
      {load.types.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum tipo de subtarefa encontrado ainda. Sincronize o backlog do Jira para listar os tipos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
          {load.types.map((t) => (
            <li key={t.typeId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 basis-[180px] flex-col">
                <span className="font-semibold text-foreground">{t.typeName}</span>
                <span className="text-xs text-muted-foreground">
                  {ORIGIN_LABEL[t.origin] ?? t.origin}
                  {t.inheritedFromSprint ? ` (${t.inheritedFromSprint})` : ''}
                  {t.qaByTitleException ? ' · vira QA com "QA" no título' : ''}
                  {t.defaultHours ? ` · padrão ${t.defaultHours} h` : ''}
                </span>
              </div>
              {canEdit ? (
                <select
                  aria-label={`Classe do tipo ${t.typeName}`}
                  className={cn(FIELD, 'h-10 w-[180px]')}
                  value={t.subtaskClass}
                  disabled={savingId === t.typeId}
                  onChange={(e) => void change(t, e.target.value as SubtaskClass)}
                >
                  {CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
                </select>
              ) : (
                <StatusChip tone={CLASS_TONE[t.subtaskClass]}>{CLASS_LABEL[t.subtaskClass]}</StatusChip>
              )}
            </li>
          ))}
        </ul>
      )}
      {unclassified > 0 && (
        <p className="rounded-[10px] bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
          {unclassified === 1 ? '1 tipo sem classificação' : `${unclassified} tipos sem classificação`}: não entram no total DEV/QA do escopo até alguém mapear.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {canEdit ? 'Vale para as próximas sprints da squad; a próxima herda este mapa.' : 'Quem edita é a liderança da squad. Você vê em leitura.'}
      </p>
    </div>
  );
}
