'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  JiraDateFieldsError, getJiraDateFields, saveJiraDateFields, type JiraDateFields, type JiraFieldOption,
} from '@/lib/cronograma/date-fields-client';
import { FIELD, WARN_BOX } from './styles';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  /** Chamado depois de salvar, para sincronizar com os campos novos. */
  onSaved: () => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: JiraDateFields };

function withCurrent(options: JiraFieldOption[], id: string | null, name: string | null): JiraFieldOption[] {
  if (!id || options.some((o) => o.id === id)) return options;
  return [{ id, name: name || id }, ...options];
}

/** Conteúdo da janela: monta a cada abertura, então começa sempre em "carregando". */
function DateFieldsBody({ squadId, onClose, onSaved }: { squadId: string; onClose: () => void; onSaved: () => void }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJiraDateFields(squadId)
      .then((r) => {
        if (cancelled) return;
        if (!r.available) { setState({ kind: 'unavailable' }); return; }
        setStartId(r.data.startFieldId ?? '');
        setEndId(r.data.endFieldId ?? '');
        setState({ kind: 'ready', data: r.data });
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof JiraDateFieldsError ? e.message : 'Não foi possível carregar os campos agora.' });
      });
    return () => { cancelled = true; };
  }, [squadId, attempt]);

  const retry = () => { setState({ kind: 'loading' }); setAttempt((n) => n + 1); };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveJiraDateFields(squadId, { startFieldId: startId || null, endFieldId: endId || null });
      onClose();
      onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        {state.kind === 'loading' && <p role="status" className="text-sm text-muted-foreground">Carregando os campos…</p>}

        {state.kind === 'unavailable' && (
          <p role="status" className="rounded-xl border border-border bg-muted/50 p-3.5 text-sm leading-relaxed text-muted-foreground">
            Este recurso ainda não está disponível neste servidor. O cronograma continua funcionando com as datas que o Jira já traz e com a sugestão pelas horas.
          </p>
        )}

        {state.kind === 'error' && (
          <div role="alert" className={`flex flex-col gap-2 rounded-xl p-3.5 text-sm ${WARN_BOX}`}>
            <span>{state.message}</span>
            <Button type="button" variant="outline" onClick={retry} className="h-9 self-start rounded-lg">Tentar de novo</Button>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              Início planejado
              <select value={startId} onChange={(e) => setStartId(e.target.value)} className={`${FIELD} h-11 text-foreground`}>
                <option value="">Deixar o portal escolher pelo nome</option>
                {withCurrent(state.data.candidates.start, state.data.startFieldId, state.data.startFieldName).map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              Fim planejado
              <select value={endId} onChange={(e) => setEndId(e.target.value)} className={`${FIELD} h-11 text-foreground`}>
                <option value="">Deixar o portal escolher pelo nome</option>
                {withCurrent(state.data.candidates.end, state.data.endFieldId, state.data.endFieldName).map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                ))}
              </select>
            </label>
            {state.data.warning && <p role="note" className={`rounded-xl p-3 text-sm leading-relaxed ${WARN_BOX}`}>{state.data.warning}</p>}
            <p className="rounded-xl border border-border bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
              {state.data.sample.total > 0 ? (
                <>
                  Com a amostra da última sincronização:{' '}
                  <strong className="text-foreground">{state.data.startFieldName || 'Início'} em {state.data.sample.startFilled} de {state.data.sample.total} subtarefas</strong>;{' '}
                  <strong className="text-foreground">{state.data.endFieldName || 'Fim'} em {state.data.sample.endFilled} de {state.data.sample.total}</strong>.{' '}
                </>
              ) : (
                'Ainda não há amostra de subtarefas da última sincronização. '
              )}
              A capacidade por pessoa vem do cadastro do time.
              {state.data.autoDetected ? ' Os campos acima foram encontrados automaticamente pelo nome.' : ''}
            </p>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 rounded-xl">Cancelar</Button>
          {state.kind === 'ready' && (
            <Button type="button" onClick={() => void save()} disabled={saving} className="h-10 rounded-xl font-semibold">
              {saving ? 'Salvando…' : 'Salvar e sincronizar'}
            </Button>
          )}
        </DialogFooter>
    </>
  );
}

/** Janela "Campos de data do Jira": de qual campo o portal lê o início e o fim planejados das subtarefas. */
export function DateFieldsDialog({ open, onOpenChange, squadId, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] rounded-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Campos de data do Jira</DialogTitle>
          <DialogDescription>
            O portal procura os campos pelo nome no Jira da sua squad e lê data e hora. Se existir mais de um com o mesmo nome, escolha qual vale.
          </DialogDescription>
        </DialogHeader>
        <DateFieldsBody squadId={squadId} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
