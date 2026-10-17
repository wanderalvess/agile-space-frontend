'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { FIELD, Modal, ModalButton, SelectField, SettingRow } from '@/components/room-kit';
import { squadOptions } from '@/components/showcase/review-room-logic';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { rememberRoom } from '@/lib/brainstorming-lobby';
import { moduleIcon } from '@/lib/modules-registry';
import type { BrainstormingBoard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { brainstormingApi } from '@/app/brainstorming/api';
import { BRAIN_TIMER_PRESETS, DEFAULT_TIMER_SECONDS, durationLabel, stoppedTimer } from './brainstorm-room-logic';

const LABEL = 'text-[13px] font-semibold text-foreground';

const DURATION_OPTIONS = BRAIN_TIMER_PRESETS.map((s) => ({ value: String(s), label: durationLabel(s) }));

export interface CreateBrainstormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avisa a tela de fora enquanto a sessão está sendo criada. */
  onCreatingChange?: (creating: boolean) => void;
  /** Sessão criada: a página leva a pessoa para a sala. */
  onCreated: (board: BrainstormingBoard) => void;
}

/**
 * Novo brainstorming: título, squad (a ativa, ou uma das do vínculo; nunca texto livre) e os ajustes que o
 * facilitador já pode escolher na criação (autores anônimos, ideias ocultas até revelar, duração do cronômetro).
 * Título vazio e falha do servidor aparecem no próprio diálogo e o que foi digitado fica.
 */
export function CreateBrainstormDialog({ open, onOpenChange, onCreatingChange, onCreated }: CreateBrainstormDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();
  const options = useMemo(
    () => squadOptions(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }),
    [memberships, activeSquadId, activeSquadName]
  );

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [chosenSquad, setChosenSquad] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [hideIdeas, setHideIdeas] = useState(false);
  const [duration, setDuration] = useState(String(DEFAULT_TIMER_SECONDS));
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // A squad do cabeçalho é a sugerida; a escolha da pessoa vale enquanto ela ainda estiver entre as do vínculo.
  const squad = options.some((o) => o.value === chosenSquad) ? chosenSquad : activeSquadId || options[0]?.value || '';

  const reset = () => {
    setTitle('');
    setTitleError(false);
    setAnonymous(false);
    setHideIdeas(false);
    setDuration(String(DEFAULT_TIMER_SECONDS));
    setFailure(null);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const create = async () => {
    if (creating) return;
    if (!userProfile?.id) {
      toast({ title: 'Perfil não identificado', description: 'Não foi possível carregar a sua identidade. Defina seu perfil e tente de novo.', variant: 'destructive' });
      return;
    }
    const name = title.trim();
    if (!name) {
      setTitleError(true);
      return;
    }

    setCreating(true);
    onCreatingChange?.(true);
    setFailure(null);

    try {
      const created = await brainstormingApi.saveOrUpdateBoard({
        creatorId: userProfile.id,
        title: name,
        team: squad || undefined,
        createdAt: new Date().toISOString(),
        phase: 'ideation',
        settings: { isAnonymous: anonymous, ...(hideIdeas ? { isRevealed: false } : {}) },
        timer: stoppedTimer(Number(duration) || DEFAULT_TIMER_SECONDS),
        participantIds: [userProfile.id],
      });
      if (!created?.id) {
        setFailure('O servidor não devolveu a sessão. O que você digitou foi mantido; tente de novo.');
        return;
      }
      rememberRoom(typeof window === 'undefined' ? undefined : window.localStorage, { roomId: created.id, title: name, team: squad, createdBy: userProfile.id });
      onOpenChange(false);
      reset();
      onCreated(created);
    } catch (error) {
      console.error('Erro ao criar o brainstorming', error);
      setFailure(errorMessage(error, 'Confira a conexão e tente de novo.'));
    } finally {
      setCreating(false);
      onCreatingChange?.(false);
    }
  };

  const squadLabel = options.find((o) => o.value === squad)?.label ?? '';

  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="md"
      icon={moduleIcon('brainstorming')}
      title="Novo brainstorming"
      description="Dê um nome à sessão. Você é o facilitador: troca de etapa, controla o cronômetro e revela as ideias."
      preventClose={creating}
      footer={
        <>
          <ModalButton onClick={() => close(false)} disabled={creating}>Cancelar</ModalButton>
          <ModalButton variant="primary" className="gap-2" onClick={() => void create()} disabled={creating}>
            {creating ? 'Criando…' : 'Criar sessão'}
            {!creating && <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="brain-title" className={LABEL}>Título da sessão</label>
          <input
            id="brain-title"
            autoFocus
            value={title}
            maxLength={255}
            onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            placeholder="Ex.: Refatoração do dashboard"
            aria-invalid={titleError}
            aria-describedby={titleError ? 'brain-title-error' : undefined}
            className={cn(FIELD, 'h-11', titleError && 'border-red-500/60')}
          />
          {titleError && (
            <p id="brain-title-error" role="alert" className="m-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Dê um nome para a sessão.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brain-squad" className={LABEL}>Squad</label>
          {options.length > 1 ? (
            <SelectField id="brain-squad" aria-label="Squad do brainstorming" value={squad} onChange={setChosenSquad} options={options} placeholder="Escolha a squad" className="h-11" />
          ) : (
            <div id="brain-squad" className={cn(FIELD, 'flex h-11 items-center justify-between gap-2')}>
              <span className={cn('truncate', !squadLabel && 'text-muted-foreground')}>{squadLabel || 'Nenhuma squad ativa'}</span>
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
          <p className="m-0 text-xs text-muted-foreground">
            {options.length === 0
              ? 'Sem squad ativa a sessão não entra na lista de ninguém; quem tem o link ou o ID entra do mesmo jeito.'
              : options.length > 1
                ? 'As squads do seu vínculo. A sessão aparece na lista da que você escolher.'
                : 'A squad ativa no cabeçalho. A sessão aparece na lista dela.'}
          </p>
        </div>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="mb-1 flex items-center gap-2 p-0 text-[13px] font-semibold text-foreground">Ajustes do facilitador</legend>
          <SettingRow id="brain-new-anon" title="Autores anônimos" desc="Ninguém vê quem lançou cada ideia, nem o facilitador." checked={anonymous} onChange={setAnonymous} disabled={creating} />
          <SettingRow id="brain-new-hide" title="Ocultar as ideias até revelar" desc="Cada pessoa só vê as próprias ideias até o facilitador revelar." checked={hideIdeas} onChange={setHideIdeas} disabled={creating} />
          <div className="flex items-center justify-between gap-4 py-3">
            <label htmlFor="brain-duration" className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">Duração do cronômetro</span>
              <span className="text-xs text-muted-foreground">Pode mudar na sala.</span>
            </label>
            <SelectField id="brain-duration" aria-label="Duração do cronômetro" value={duration} onChange={setDuration} options={DURATION_OPTIONS} className="h-10 w-[9.5rem] shrink-0" disabled={creating} />
          </div>
        </fieldset>

        {failure && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong className="font-semibold">Não foi possível criar a sessão agora.</strong> O que você digitou foi mantido. {failure}
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
