'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Link2Off, ListChecks, Sparkles } from 'lucide-react';
import { FIELD, Modal, ModalButton, SelectField, SettingRow } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export interface NewPlanSquadOption {
  id: string;
  name: string;
}

export interface NewPlanValues {
  title: string;
  /** ID da squad (o servidor só liga o plano à squad pelo ID). Vazio: plano sem squad. */
  squadId: string;
  sprintId: string;
  /** `true` = só criador, convidados e administradores. */
  isPrivate: boolean;
}

export interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Squads do vínculo da pessoa. */
  squads: NewPlanSquadOption[];
  /** Squad escolhida de saída (a ativa, ou a da URL). */
  defaultSquadId: string;
  /** Sprint que veio na URL (ciclo da sprint). */
  initialSprintId?: string;
  busy: boolean;
  /** Falha do servidor ou do perfil: aparece no topo da janela, com o texto mantido. */
  error: string | null;
  onSubmit: (values: NewPlanValues) => void;
}

const LABEL = 'text-[13px] font-semibold text-foreground';

/** "Novo plano de ação": título, squad fixa na ativa, sprint (quando vem do ciclo) e quem vê o plano. */
export function NewPlanDialog({ open, onOpenChange, squads, defaultSquadId, initialSprintId = '', busy, error, onSubmit }: NewPlanDialogProps) {
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [chosenSquad, setChosenSquad] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState(initialSprintId);
  const [isPrivate, setIsPrivate] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // O cursor entra no título depois que o modal assume o foco.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Enquanto a pessoa não escolhe, vale a squad ativa (que pode chegar depois da janela abrir: os vínculos carregam sozinhos).
  const squadId = chosenSquad ?? defaultSquadId;

  // A squad da URL pode não estar nos vínculos (ex.: administrador): entra como opção, pelo ID.
  const options = squads.some((s) => s.id.toLowerCase() === squadId.toLowerCase()) || !squadId ? squads : [{ id: squadId, name: squadId }, ...squads];
  const squadName = options.find((s) => s.id === squadId)?.name ?? squadId;

  const submit = () => {
    if (busy) return;
    if (!title.trim()) {
      setTitleError('Dê um título para o plano.');
      return;
    }
    onSubmit({ title: title.trim(), squadId, sprintId, isPrivate });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={ListChecks}
      title="Novo plano de ação"
      description="Dê um nome ao plano. Você adiciona as ações na tabela 5W2H logo depois."
      preventClose={busy}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={busy}>{busy ? 'Criando…' : 'Criar plano'}</ModalButton>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {initialSprintId && (
          <div role="note" className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 dark:bg-primary/15">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex flex-col gap-0.5 text-sm">
              <span className="font-semibold text-foreground">Vindo do ciclo da sprint.</span>
              <span className="text-muted-foreground">O plano fica ligado à sprint {initialSprintId} e a squad já vem escolhida.</span>
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-0.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">Não foi possível criar o plano agora.</span>
            <span>{error} O que você digitou foi mantido.</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-plan-title" className={LABEL}>Título do plano</label>
          <input
            id="new-plan-title"
            ref={titleRef}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
            placeholder="Ex.: Execução do novo checkout"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? 'new-plan-title-error' : undefined}
            className={cn(FIELD, 'h-11', titleError && 'border-red-500/70')}
          />
          {titleError && <span id="new-plan-title-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">{titleError}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-plan-squad" className={LABEL}>Squad</label>
          {options.length > 1 ? (
            <SelectField
              id="new-plan-squad"
              aria-label="Squad"
              value={squadId}
              onChange={setChosenSquad}
              options={options.map((s) => ({ value: s.id, label: s.name }))}
              className="h-11"
            />
          ) : (
            <input id="new-plan-squad" readOnly value={squadName || 'Sem squad ativa'} aria-describedby="new-plan-squad-hint" className={cn(FIELD, 'h-11 cursor-default')} />
          )}
          <span id="new-plan-squad-hint" className="text-xs text-muted-foreground">
            {squadId ? 'O plano aparece na lista dessa squad.' : 'Sem squad ativa o plano não entra na lista de nenhuma squad; só quem tem o link o abre.'}
          </span>
        </div>

        {sprintId && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-plan-sprint" className={LABEL}>Sprint</label>
            <div className="flex gap-2">
              <input id="new-plan-sprint" readOnly value={sprintId} className={cn(FIELD, 'h-11 min-w-0 flex-1 cursor-default')} />
              <ModalButton className="shrink-0 gap-2" onClick={() => setSprintId('')} aria-label="Não ligar o plano a esta sprint">
                <Link2Off className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Desligar
              </ModalButton>
            </div>
            <span className="text-xs text-muted-foreground">Liga o plano à sprint, como o ciclo da sprint faz.</span>
          </div>
        )}

        <SettingRow
          id="new-plan-private"
          title="Só quem eu convidar"
          desc="Desligado: qualquer pessoa logada com o link lê e edita. Ligado: só você, os convidados e administradores."
          checked={isPrivate}
          onChange={setIsPrivate}
          className="border-b-0 pb-0"
        />
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Criar plano</button>
      </form>
    </Modal>
  );
}
