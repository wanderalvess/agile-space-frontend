'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronRight, Kanban, ListChecks, Loader2, X } from 'lucide-react';
import { ConfirmDialog, FIELD, FOCUS_RING, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import type { KnownPlan, OriginCheck } from '@/lib/action-plan-origin';
import { runPlan, type ItemOutcome, type PlanDeps, type PlanDestination, type PlanRecord } from '@/lib/health-check-plan';
import { LEVEL_LABELS, type PlanItem } from '@/lib/health-check-rules';
import { cn } from '@/lib/utils';
import { levelTone } from './health-ui';

interface ItemDraft {
  checked: boolean;
  what: string;
  who: string;
  why: string;
}

export interface HealthPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  radarId: string;
  radarTitle: string;
  /** Chave da squad do radar (o plano da squad nasce nela). */
  team: string;
  items: PlanItem[];
  /** Plano já criado a partir deste radar neste navegador (a trava local, reserva do backend antigo). */
  record: PlanRecord | null;
  /** `guarded`: o servidor guardou a origem do plano (backend novo), então a trava dele vale. */
  onRecord: (record: PlanRecord, guarded: boolean) => void;
  /** O que o servidor disse sobre "este radar já tem plano?" (null enquanto consulta ou sem consulta). */
  check?: OriginCheck | null;
  /** O servidor recusou a criação porque o radar já tem plano (409): a tela guarda o plano existente. */
  onExisting?: (plan: KnownPlan) => void;
  deps: PlanDeps;
  onOpenPlan: (planId: string) => void;
  onOpenKanban: () => void;
}

const LABEL = 'text-xs font-semibold text-foreground';

function draftsOf(items: PlanItem[]): Record<string, ItemDraft> {
  return Object.fromEntries(items.map((i) => [i.key, { checked: i.suggested, what: i.what, who: '', why: i.why }]));
}

/**
 * Criar o plano de ação a partir do que está em atenção: escolha o destino (plano da squad ou Kanban pessoal),
 * revise os itens e crie. Mostra o que foi criado e o que faltou. Radar que já gerou plano (o servidor guarda um por
 * radar e squad) mostra "Esta sessão já gerou o plano «X»" com "Abrir o plano", sem oferecer criar outro; o aviso
 * deste navegador só vale de reserva quando o servidor é antigo e não guarda a origem.
 */
export function HealthPlanDialog({ open, onOpenChange, radarId, radarTitle, team, items, record, onRecord, check, onExisting, deps, onOpenPlan, onOpenKanban }: HealthPlanDialogProps) {
  const required = useMemo(() => items.filter((i) => i.level !== 'ok'), [items]);
  const optional = useMemo(() => items.filter((i) => i.level === 'ok'), [items]);
  const [destination, setDestination] = useState<PlanDestination>('squad');
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, ItemOutcome>>({});
  const [planId, setPlanId] = useState<string | undefined>();
  const [planFailed, setPlanFailed] = useState(false);
  const [view, setView] = useState<'form' | 'done'>('form');
  const [again, setAgain] = useState(false);
  const [hiddenConflict, setHiddenConflict] = useState(false);
  const [kanbanOnly, setKanbanOnly] = useState(false);

  const serverPlan = check?.kind === 'server' ? check.plan : null;
  const staleRecord = !!record && record.destination === 'squad' && check?.kind === 'none' && check.stale;

  useEffect(() => {
    if (!open) return;
    setDrafts(draftsOf(items));
    setOutcomes({});
    setPlanFailed(false);
    setShowOptional(false);
    setDestination('squad');
    setPlanId(undefined);
    setHiddenConflict(false);
    setKanbanOnly(false);
    setView(record && !staleRecord ? 'done' : 'form');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chosen = items.filter((i) => drafts[i.key]?.checked);
  const failedKeys = Object.entries(outcomes).filter(([, o]) => o === 'error').map(([k]) => k);
  const okKeys = new Set(Object.entries(outcomes).filter(([, o]) => o === 'ok').map(([k]) => k));

  const patch = (key: string, changes: Partial<ItemDraft>) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...changes } }));

  const create = async () => {
    if (running || chosen.length === 0) return;
    setRunning(true);
    setPlanFailed(false);
    try {
      const result = await runPlan({
        destination,
        items: chosen.map((i) => ({ key: i.key, label: i.title, what: drafts[i.key].what.trim() || i.what, why: drafts[i.key].why.trim() || i.why, who: drafts[i.key].who.trim(), priority: i.priority })),
        radarId,
        radarTitle,
        team,
        existingPlanId: planId,
        alreadyDone: okKeys,
        deps,
      });
      if (result.conflict) {
        // o servidor já tem plano deste radar nesta squad: leva ao plano existente em vez de criar outro
        if (result.conflict.existingPlanId) {
          const existingId = result.conflict.existingPlanId;
          const title = await deps.getBoard?.(existingId).then((b) => b.title).catch(() => '');
          onExisting?.({ id: existingId, title: title || 'Plano de ação' });
        } else {
          setHiddenConflict(true);
        }
        setOutcomes({});
        return;
      }
      setOutcomes(result.outcomes);
      setPlanId(result.planId);
      setPlanFailed(result.planFailed);
      const done = chosen.filter((i) => result.outcomes[i.key] === 'ok');
      if (done.length > 0) {
        onRecord({
          boardId: radarId,
          destination,
          planId: result.planId,
          planTitle: result.planTitle,
          items: done.map((i) => ({ key: i.key, what: drafts[i.key].what.trim() || i.what })),
          createdAt: new Date().toISOString(),
        }, !!result.guarded);
      }
      if (!result.planFailed && chosen.every((i) => result.outcomes[i.key] === 'ok')) setView('done');
    } finally {
      setRunning(false);
    }
  };

  const shown = view === 'done' && record ? record : null;

  if (view === 'form' && !kanbanOnly && (serverPlan || hiddenConflict)) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        tone="warn"
        icon={ListChecks}
        title="Este radar já tem plano"
        description="O portal guarda um plano de ação por radar em cada squad."
        footerStart={<ModalButton variant="ghost" onClick={() => { setKanbanOnly(true); setDestination('kanban'); }}>Só no meu Kanban</ModalButton>}
        footer={
          serverPlan ? (
            <ModalButton variant="primary" className="gap-1.5" onClick={() => onOpenPlan(serverPlan.id)}>Abrir o plano <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /></ModalButton>
          ) : (
            <ModalButton onClick={() => onOpenChange(false)}>Fechar</ModalButton>
          )
        }
      >
        <p className="m-0 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {serverPlan ? (
            <span>Esta sessão já gerou o plano <strong>«{serverPlan.title}»</strong>. Abra o plano para acompanhar as ações.</span>
          ) : (
            <span>Esta sessão já gerou um plano, mas ele é privado e você não tem acesso. Peça a quem criou para convidar você.</span>
          )}
        </p>
      </Modal>
    );
  }

  if (view === 'done' && shown) {
    return (
      <>
        <Modal
          open={open}
          onOpenChange={onOpenChange}
          size="md"
          tone="success"
          icon={ListChecks}
          title="Plano de ação criado"
          description="Pronto para acompanhar na próxima sprint."
          footerStart={serverPlan ? undefined : <ModalButton variant="ghost" onClick={() => setAgain(true)}>Criar outro plano</ModalButton>}
          footer={
            shown.destination === 'squad' && shown.planId ? (
              <>
                <ModalButton className="gap-2" onClick={onOpenKanban}><Kanban className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ver no Meu espaço</ModalButton>
                <ModalButton variant="primary" className="gap-1.5" onClick={() => onOpenPlan(shown.planId as string)}>Abrir plano <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /></ModalButton>
              </>
            ) : (
              <ModalButton variant="primary" className="gap-1.5" onClick={onOpenKanban}>Ver no Meu espaço <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /></ModalButton>
            )
          }
        >
          <div className="flex flex-col gap-4">
            <p className="m-0 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={2} aria-hidden="true" />
              <span>
                {shown.items.length} {shown.items.length === 1 ? 'ação criada' : 'ações criadas'}
                {shown.destination === 'squad' ? <> em <strong>{shown.planTitle || 'Plano de ação'}</strong>. O plano aparece na lista da squad.</> : <> no seu <strong>Kanban pessoal</strong>.</>}
              </span>
            </p>
            <ul className="m-0 flex list-none flex-col gap-1.5 rounded-xl border border-border p-3.5 text-sm">
              {shown.items.map((i) => <li key={i.key} className="font-semibold">{i.what}</li>)}
            </ul>
            {!serverPlan && (
              <p className="m-0 text-xs text-muted-foreground">
                Este aviso vale só neste navegador: este servidor não guarda de qual radar o plano saiu, então outra pessoa pode criar de novo.
              </p>
            )}
          </div>
        </Modal>
        <ConfirmDialog
          open={again}
          onOpenChange={setAgain}
          tone="warn"
          icon={AlertCircle}
          title="Criar outro plano?"
          description="Já existe um plano criado a partir deste radar. Criar outro duplica as ações."
          confirmLabel="Criar outro plano"
          onConfirm={() => { setOutcomes({}); setPlanId(undefined); setDrafts(draftsOf(items)); setView('form'); }}
        />
      </>
    );
  }

  const renderItem = (i: PlanItem) => {
    const d = drafts[i.key];
    if (!d) return null;
    const out = outcomes[i.key];
    return (
      <li key={i.key} className={cn('flex flex-col gap-3 rounded-xl border p-3.5', d.checked ? 'border-primary/40 bg-primary/5' : 'border-border')}>
        <div className="flex items-center gap-3">
          <input
            id={`plan-check-${i.key}`}
            type="checkbox"
            checked={d.checked}
            disabled={out === 'ok' || running}
            onChange={(e) => patch(i.key, { checked: e.target.checked })}
            className={cn('h-4 w-4 accent-[hsl(var(--primary))]', FOCUS_RING)}
          />
          <label htmlFor={`plan-check-${i.key}`} className="min-w-0 flex-1 truncate text-sm font-bold">{i.title}</label>
          {out === 'ok' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Criada</span>}
          {out === 'error' && <span role="alert" className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300"><X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Não foi criada</span>}
          <StatusChip tone={levelTone(i.level === 'ok' ? 'ok' : i.level)}>{i.level === 'ok' ? 'Algum voto ruim' : LEVEL_LABELS[i.level]}</StatusChip>
        </div>
        {d.checked && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`plan-what-${i.key}`} className={LABEL}>O quê</label>
              <input id={`plan-what-${i.key}`} value={d.what} maxLength={500} onChange={(e) => patch(i.key, { what: e.target.value })} disabled={out === 'ok' || running} className={cn(FIELD, 'h-10')} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`plan-who-${i.key}`} className={LABEL}>Quem <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <input id={`plan-who-${i.key}`} value={d.who} maxLength={200} placeholder="Responsável" onChange={(e) => patch(i.key, { who: e.target.value })} disabled={out === 'ok' || running || destination === 'kanban'} className={cn(FIELD, 'h-10')} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor={`plan-why-${i.key}`} className={LABEL}>Por quê</label>
              <input id={`plan-why-${i.key}`} value={d.why} maxLength={500} onChange={(e) => patch(i.key, { why: e.target.value })} disabled={out === 'ok' || running} className={cn(FIELD, 'h-10')} />
            </div>
          </div>
        )}
      </li>
    );
  };

  const retry = failedKeys.length > 0 || planFailed;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={ListChecks}
      title="Criar plano de ação"
      description="Os itens saem dos pontos em atenção do resultado. Edite o texto e escolha quem responde."
      preventClose={running}
      footerStart={<ModalButton variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>Cancelar</ModalButton>}
      footer={
        <ModalButton variant="primary" className="gap-2" onClick={() => void create()} disabled={running || chosen.length === 0 || (chosen.length > 0 && chosen.every((i) => okKeys.has(i.key)))}>
          {running ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> : <ListChecks className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          {running ? 'Criando…' : retry ? 'Tentar as que faltam' : chosen.length === 1 ? 'Criar 1 ação' : `Criar ${chosen.length} ações`}
        </ModalButton>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={running || okKeys.size > 0 || kanbanOnly}>
          <legend className="mb-1 p-0 text-[13px] font-semibold text-muted-foreground">Destino</legend>
          <div role="radiogroup" aria-label="Destino do plano" className="flex flex-col gap-2">
            {([
              { id: 'squad' as const, icon: ListChecks, name: 'Plano de ação da squad', desc: `Um plano 5W2H novo, visível para a squad, com "${radarTitle}" no texto de cada ação.` },
              { id: 'kanban' as const, icon: Kanban, name: 'Meu Kanban pessoal', desc: 'Um cartão por ponto em atenção, só para você, com a etiqueta Radar de clima.' },
            ]).map((o) => {
              const on = destination === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDestination(o.id)}
                  className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-base disabled:opacity-60', on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/50', FOCUS_RING)}
                >
                  <o.icon className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-bold">{o.name}</span>
                    <span className="text-xs text-muted-foreground">{o.desc}</span>
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={2} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {planFailed && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" /> Não foi possível criar o plano da squad. Nada foi criado; confira a conexão e tente de novo.
          </p>
        )}
        {!planFailed && failedKeys.length > 0 && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {okKeys.size} {okKeys.size === 1 ? 'ação criada' : 'ações criadas'} e {failedKeys.length} sem criar. Use &quot;Tentar as que faltam&quot;: o que já foi criado não se repete.
          </p>
        )}

        {required.length === 0 && optional.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma dimensão em atenção neste radar. Não há o que propor; você pode criar o plano à mão na lista de planos.
          </p>
        ) : (
          <section aria-label="Itens propostos" className="flex flex-col gap-3">
            <h3 className="m-0 text-[13px] font-bold text-muted-foreground">Itens propostos ({chosen.length} de {items.length})</h3>
            {required.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{required.map(renderItem)}</ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">Nenhuma dimensão em atenção. Veja as que tiveram algum voto ruim.</p>
            )}
            {optional.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  aria-expanded={showOptional}
                  onClick={() => setShowOptional((o) => !o)}
                  className={cn('flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-border px-3.5 text-left text-[13px] text-muted-foreground hover:bg-accent/40', FOCUS_RING)}
                >
                  {showOptional ? <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                  Outras dimensões com algum voto ruim ({optional.length}): {optional.map((o) => o.title).join(', ')}
                </button>
                {showOptional && <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{optional.map(renderItem)}</ul>}
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
