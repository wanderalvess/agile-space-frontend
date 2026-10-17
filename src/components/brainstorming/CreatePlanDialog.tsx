'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Check, ListChecks } from 'lucide-react';
import { actionPlanApi } from '@/app/action-plan/api';
import { FIELD, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { votesOf } from '@/lib/brainstorming-utils';
import { errorMessage } from '@/lib/ceremony-api';
import type { BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { quadrantLabel } from './brainstorm-room-logic';
import { buildPlanTask, defaultPlanSelection, planCandidates, planTitle, readPlanLock, writePlanLock, type PlanLock } from './brainstorm-plan';

type Step = { kind: 'form' } | { kind: 'done'; planId: string; title: string; created: number; failed: number };

export interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardTitle: string;
  /** Squad da sessão (o plano nasce na mesma). */
  team?: string;
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
}

/**
 * "Criar plano de ação": mostra as ideias que viram ação (as cinco mais votadas, sem as descartadas, já marcadas),
 * deixa ajustar o título e a seleção e explica como cada ação nasce no 5W2H. Já existindo um plano criado a partir
 * desta sessão neste navegador, avisa e só segue depois de a pessoa confirmar que quer outro (a trava de verdade,
 * uma por sessão, depende do servidor). Com falha parcial o plano abre mesmo assim.
 */
export function CreatePlanDialog({ open, onOpenChange, boardId, boardTitle, team, ideas, groups }: CreatePlanDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();

  const candidates = useMemo(() => planCandidates(ideas), [ideas]);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existing, setExisting] = useState<PlanLock | null>(null);
  const [confirmAnother, setConfirmAnother] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'form' });

  // A cada abertura: título padrão, as cinco primeiras marcadas e a consulta à trava local.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- o formulário recomeça a cada abertura */
    setTitle(planTitle(boardTitle));
    setSelected(new Set(defaultPlanSelection(candidates)));
    setExisting(readPlanLock(typeof window === 'undefined' ? undefined : window.localStorage, boardId));
    setConfirmAnother(false);
    setStep({ kind: 'form' });
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId]);

  const chosen = candidates.filter((c) => selected.has(c.id));
  const blockedByExisting = !!existing && !confirmAnother;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    if (!session || creating || blockedByExisting) return;
    const planName = title.trim() || planTitle(boardTitle);
    setCreating(true);
    try {
      // criador, id, datas e autor são definidos pelo servidor a partir do login
      const plan = await actionPlanApi.createBoard({ title: planName, team: team || 'Squad Geral' });
      if (!plan?.id) throw new Error('Falha ao criar o plano de ação.');

      let failed = 0;
      for (let i = 0; i < chosen.length; i += 1) {
        const idea = chosen[i];
        try {
          await actionPlanApi.createTask(plan.id, buildPlanTask(idea, groups.find((g) => g.id === idea.groupId), i));
        } catch (taskError) {
          failed += 1;
          console.error('Erro ao criar ação do plano', taskError);
        }
      }

      writePlanLock(typeof window === 'undefined' ? undefined : window.localStorage, boardId, { planId: plan.id, title: planName, createdAt: new Date().toISOString() });
      if (failed > 0) {
        toast({ title: 'Plano criado, mas faltam ações', description: `${failed} de ${chosen.length} ações não foram criadas. Adicione as que faltam no plano.`, variant: 'destructive' });
      } else {
        toast({ title: 'Plano de ação criado!', description: 'Matriz 5W2H gerada com sucesso.' });
      }
      setStep({ kind: 'done', planId: plan.id, title: planName, created: chosen.length - failed, failed });
    } catch (error) {
      console.error('Erro ao exportar', error);
      toast({ title: 'Erro na exportação', description: errorMessage(error, 'Não foi possível gerar a matriz 5W2H.'), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  if (step.kind === 'done') {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        tone="success"
        icon={Check}
        title="Plano de ação criado"
        description={`${step.created} ${step.created === 1 ? 'ação criada' : 'ações criadas'} em "${step.title}".`}
        footer={
          <>
            <ModalButton onClick={() => onOpenChange(false)}>Continuar no brainstorming</ModalButton>
            <ModalButton variant="primary" className="gap-2" onClick={() => router.push(`/action-plan/${step.planId}`)}>
              Abrir o plano <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </ModalButton>
          </>
        }
      >
        {step.failed > 0 && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong className="font-semibold">Plano criado, mas faltam ações.</strong> {step.failed} de {step.failed + step.created} ações não foram criadas. O plano abre mesmo assim; adicione as que faltam lá.
            </span>
          </p>
        )}
        <p className="m-0 text-sm text-muted-foreground">Quem, quando e como ficam em branco para a squad preencher no plano.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={ListChecks}
      title="Criar plano de ação"
      description="Leva as ideias que vencerem para um plano 5W2H da squad."
      preventClose={creating}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={creating}>Cancelar</ModalButton>
          <ModalButton variant="primary" className="gap-2" onClick={() => void create()} disabled={creating || blockedByExisting || !session}>
            <ListChecks className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            {creating ? 'Criando…' : chosen.length === 0 ? 'Criar plano sem ações' : `Criar plano com ${chosen.length} ${chosen.length === 1 ? 'ação' : 'ações'}`}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {existing && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-900 dark:text-amber-100">
            <p className="m-0 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong className="font-semibold">Já existe um plano criado a partir desta sessão</strong>
                {existing.title ? <> ({existing.title})</> : null}. Criar de novo gera outro plano, com as mesmas ações.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3 pl-6">
              <button type="button" onClick={() => router.push(`/action-plan/${existing.planId}`)} className="rounded font-semibold underline underline-offset-2">
                Abrir o plano que já existe
              </button>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={confirmAnother} onChange={(e) => setConfirmAnother(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Criar outro mesmo assim
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-title" className="text-[13px] font-semibold text-foreground">Título do plano</label>
          <input id="plan-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} className={cn(FIELD, 'h-11')} />
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 flex w-full items-center justify-between gap-2 p-0 text-[13px] font-semibold text-foreground">
            <span>Ações a criar</span>
            <StatusChip tone="neutral">{chosen.length} de {candidates.length} {candidates.length === 1 ? 'ideia' : 'ideias'}</StatusChip>
          </legend>
          {candidates.length === 0 ? (
            <p className="m-0 rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">Nenhuma ideia disponível: as descartadas na Matriz e as ocultas não viram ação.</p>
          ) : (
            <ul className="m-0 flex max-h-64 list-none flex-col gap-1.5 overflow-y-auto p-0">
              {candidates.map((idea) => {
                const id = `plan-idea-${idea.id}`;
                const votes = votesOf(idea).length;
                return (
                  <li key={idea.id}>
                    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-accent/40">
                      <input id={id} type="checkbox" checked={selected.has(idea.id)} onChange={() => toggle(idea.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm text-foreground">{idea.content}</span>
                        <span className="text-xs text-muted-foreground">
                          {votes} {votes === 1 ? 'voto' : 'votos'} · {quadrantLabel(idea.qualifiers)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="m-0 text-xs text-muted-foreground">As cinco primeiras (por votos, sem as descartadas) entram marcadas. Marque ou desmarque para ajustar.</p>
        </fieldset>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="block text-[13px] font-semibold text-foreground">Como cada ação nasce (5W2H)</strong>
          <strong className="font-semibold text-foreground">O quê:</strong> o texto da ideia · <strong className="font-semibold text-foreground">Por quê:</strong> &ldquo;Ideia priorizada no Brainstorming&rdquo; e os votos ·{' '}
          <strong className="font-semibold text-foreground">Onde:</strong> o grupo da ideia · <strong className="font-semibold text-foreground">Quanto:</strong> esforço baixo ou alto ·{' '}
          <strong className="font-semibold text-foreground">Quem, quando e como:</strong> em branco para a squad preencher.
        </div>
      </div>
    </Modal>
  );
}
