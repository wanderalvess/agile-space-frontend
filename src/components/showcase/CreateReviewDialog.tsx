'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { FIELD, Modal, ModalButton, SelectField } from '@/components/room-kit';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { showcaseApi } from '@/app/showcase/api';
import { DEFAULT_SHOWCASE_IMAGE, type ShowcaseSession } from './types';
import { squadOptions } from './review-room-logic';

const STEPS = [
  { n: 1, t: 'Importe as tarefas', d: 'Traga as issues da sprint do Jira ou crie cards à mão.' },
  { n: 2, t: 'Prepare as evidências', d: 'Em cada card, registre o problema, a solução e links de vídeo ou print.' },
  { n: 3, t: 'Apresente e colete o aceite', d: 'No Modo Teatro, o PO aceita ou pede ajuste em cada entrega.' },
] as const;

const LABEL = 'text-[13px] font-semibold text-foreground';

export interface CreateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com a Review criada; a página abre a sala. */
  onCreated: (session: ShowcaseSession) => void;
  onCreatingChange?: (creating: boolean) => void;
}

/**
 * Nova Review: título, squad (escolhida entre as do vínculo, nunca digitada) e sprint opcional.
 * Sem squad não cria: o hub lista por squad, então uma Review sem ela sumiria da lista (antes caía em "DDWMISSI").
 */
export function CreateReviewDialog({ open, onOpenChange, onCreated, onCreatingChange }: CreateReviewDialogProps) {
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();
  const options = useMemo(
    () => squadOptions(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }),
    [memberships, activeSquadId, activeSquadName]
  );

  const [name, setName] = useState('');
  const [sprintName, setSprintName] = useState('');
  const [squad, setSquad] = useState('');
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [failed, setFailed] = useState(false);

  // A squad do cabeçalho é a sugerida; se a pessoa mudar de squad com o diálogo aberto, não pisa na escolha dela.
  useEffect(() => {
    if (!open) return;
    setSquad((current) => (current && options.some((o) => o.value === current) ? current : activeSquadId || options[0]?.value || ''));
  }, [open, activeSquadId, options]);

  const reset = () => {
    setName('');
    setSprintName('');
    setNameError(false);
    setFailed(false);
  };

  const create = async () => {
    if (creating) return;
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    if (!squad) return;
    setCreating(true);
    onCreatingChange?.(true);
    setFailed(false);
    try {
      const created = await showcaseApi.saveSession({
        name: name.trim(),
        sprintName: sprintName.trim(),
        squadName: squad,
        tasks: [],
        // Imagem da empresa como padrão; dá para trocar em Configurar.
        coverImage: DEFAULT_SHOWCASE_IMAGE,
        presentationBackground: DEFAULT_SHOWCASE_IMAGE,
        status: 'planning',
      } as Partial<ShowcaseSession>);
      reset();
      onOpenChange(false);
      onCreated(created);
    } catch (err) {
      console.error(err);
      // O que foi digitado fica: o aviso aparece dentro do diálogo.
      setFailed(true);
    } finally {
      setCreating(false);
      onCreatingChange?.(false);
    }
  };

  const noSquad = options.length === 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={moduleIcon('showcase')}
      title="Configurar Review"
      description="Dê um nome à Review e escolha a squad. Você importa as tarefas do Jira logo depois de criar."
      preventClose={creating}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={creating}>Cancelar</ModalButton>
          <ModalButton variant="primary" className="gap-2" onClick={create} disabled={creating || noSquad}>
            {creating ? 'Criando…' : 'Criar Review'}
            {!creating && <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-name" className={LABEL}>Título da Review</label>
          <input
            id="review-name"
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            placeholder="Ex.: Review da Sprint 42"
            aria-invalid={nameError}
            aria-describedby={nameError ? 'review-name-error' : undefined}
            className={cn(FIELD, 'h-11', nameError && 'border-red-500/60')}
          />
          {nameError && (
            <p id="review-name-error" role="alert" className="m-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Dê um nome para a Review.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-squad" className={LABEL}>Squad</label>
            <SelectField id="review-squad" aria-label="Squad da Review" value={squad} onChange={setSquad} options={options} placeholder="Escolha a squad" className="h-11" disabled={noSquad} />
            <p className="m-0 text-xs text-muted-foreground">
              {noSquad ? 'Você ainda não tem squad: peça acesso a quem lidera.' : 'As squads do seu vínculo; é o nome que a lista usa para achar a Review.'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-sprint" className={LABEL}>
              Sprint <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="review-sprint" value={sprintName} maxLength={80} onChange={(e) => setSprintName(e.target.value)} placeholder="Ex.: Sprint 42" className={cn(FIELD, 'h-11')} />
          </div>
        </div>

        {failed && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Não foi possível criar a Review agora. O que você digitou foi mantido. Confira a conexão e tente de novo.
          </p>
        )}

        <section aria-label="Como a Review funciona" className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-bold text-muted-foreground">Como a Review funciona</h3>
          <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-3">
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">{s.n}</span>
                <span className="text-[13px] font-bold leading-tight">{s.t}</span>
                <span className="text-xs leading-snug text-muted-foreground">{s.d}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  );
}
