'use client';

import React, { useState } from 'react';
import { Settings, Trash2, UserPlus } from 'lucide-react';
import { actionPlanApi } from '@/app/action-plan/api';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ConfirmDialog, FIELD, Modal, ModalButton, SelectField } from '@/components/room-kit';
import { boardIsPublic, type PlanPerson } from '@/lib/action-plan';
import { errorMessage } from '@/lib/ceremony-api';
import type { ActionPlanBoard } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface PlanSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: ActionPlanBoard;
  /** Quantas ações o plano tem (para o aviso de apagar). */
  taskCount: number;
  /** Pessoas da squad do plano: dão o nome aos participantes e as opções de convite. */
  people: readonly PlanPerson[];
  /** ID da conta de quem está na tela (aparece como "Você"). */
  myUserId?: string;
  onUpdated: (board: ActionPlanBoard) => void;
  onDeleted: () => void;
}

const LABEL = 'text-[13px] font-semibold text-foreground';

/**
 * Configurações do plano (só criador e administrador): renomear, quem vê, convidados e apagar.
 * Tudo isto o servidor já aceitava (PUT/DELETE do plano e POST dos participantes); a tela não oferecia.
 */
export function PlanSettingsDialog({ open, onOpenChange, board, taskCount, people, myUserId, onUpdated, onDeleted }: PlanSettingsDialogProps) {
  const [title, setTitle] = useState(board.title);
  const [isPublic, setIsPublic] = useState(boardIsPublic(board));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const participants = board.participantIds ?? [];
  const nameOf = (id: string) => (id === myUserId ? 'Você' : people.find((p) => p.userId === id)?.name ?? 'Participante');
  const invitable = people.filter((p) => p.userId && !participants.includes(p.userId));

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Dê um título para o plano.');
      return;
    }
    const patch: { title?: string; isPublic?: boolean } = {};
    if (trimmed !== board.title) patch.title = trimmed;
    if (isPublic !== boardIsPublic(board)) patch.isPublic = isPublic;
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onUpdated(await actionPlanApi.updateBoard(board.id, patch));
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, 'Confira a conexão e tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    const person = people.find((p) => p.userId === inviteId);
    if (!person?.userId) return;
    setInviting(true);
    setInviteError(null);
    try {
      onUpdated(await actionPlanApi.addParticipant(board.id, person.userId));
      setInviteId('');
    } catch (e) {
      setInviteError(errorMessage(e, 'Não foi possível convidar agora.'));
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await actionPlanApi.deleteBoard(board.id);
      onDeleted();
    } catch (e) {
      setConfirmDelete(false);
      setError(errorMessage(e, 'Não foi possível apagar o plano agora.'));
    } finally {
      setDeleting(false);
    }
  };

  const option = (value: boolean, name: string, desc: string) => {
    const on = isPublic === value;
    return (
      <label
        key={name}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
          on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/50',
        )}
      >
        <input
          type="radio"
          name="plan-visibility"
          checked={on}
          onChange={() => setIsPublic(value)}
          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{desc}</span>
        </span>
      </label>
    );
  };

  return (
    <>
      <Modal
        open={open && !confirmDelete}
        onOpenChange={onOpenChange}
        size="md"
        icon={Settings}
        title="Configurações do plano"
        description="Renomear, escolher quem vê e convidar pessoas."
        preventClose={saving}
        footer={
          <>
            <ModalButton onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {error && (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-title" className={LABEL}>Título do plano</label>
            <input
              id="plan-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(null); }}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'plan-title-error' : undefined}
              className={cn(FIELD, 'h-11', titleError && 'border-red-500/70')}
            />
            {titleError && <span id="plan-title-error" role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">{titleError}</span>}
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className={cn(LABEL, 'mb-2 p-0')}>Quem vê o plano</legend>
            {option(true, 'Qualquer pessoa logada com o link', 'Lê e edita as ações. É o padrão.')}
            {option(false, 'Só quem eu convidar', 'Você, os convidados e administradores.')}
          </fieldset>

          {!isPublic && (
            <section aria-label="Participantes" className="flex flex-col gap-2.5">
              <h3 className={cn(LABEL, 'm-0')}>Participantes</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {participants.length === 0 && <li className="text-xs text-muted-foreground">Só você, por enquanto.</li>}
                {participants.map((id) => (
                  <li key={id} className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2">
                    <InitialsAvatar name={nameOf(id)} className="h-6 w-6 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">{nameOf(id)}</span>
                    {id === board.creatorId && <span className="text-xs text-muted-foreground">criou o plano</span>}
                  </li>
                ))}
              </ul>
              {invitable.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="plan-invite" className="text-xs font-semibold text-muted-foreground">Convidar da squad</label>
                  <div className="flex gap-2">
                    <SelectField
                      id="plan-invite"
                      aria-label="Convidar da squad"
                      value={inviteId}
                      onChange={setInviteId}
                      placeholder="Escolha uma pessoa"
                      options={invitable.map((p) => ({ value: p.userId as string, label: p.name }))}
                      className="h-11 flex-1"
                    />
                    <ModalButton variant="primary" className="shrink-0 gap-2" disabled={!inviteId || inviting} onClick={handleInvite}>
                      <UserPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> {inviting ? 'Convidando…' : 'Convidar'}
                    </ModalButton>
                  </div>
                  {inviteError && <span role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">{inviteError}</span>}
                </div>
              ) : (
                <p className="m-0 text-xs text-muted-foreground">
                  Só dá para convidar quem já entrou no portal com o cadastro da squad. Quem tiver o link e for convidado depois também entra.
                </p>
              )}
            </section>
          )}

          <section aria-label="Apagar o plano" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 px-3.5 py-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">Apagar o plano</span>
              <span className="text-xs text-muted-foreground">
                Some com {taskCount === 1 ? 'a ação' : `as ${taskCount} ações`}, para todos. Só quem criou ou um administrador.
              </span>
            </span>
            <ModalButton variant="danger" className="shrink-0 gap-2" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Apagar plano
            </ModalButton>
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={open && confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title="Apagar este plano?"
        description={<>O plano “{board.title}” e todas as ações somem, para todos. Não dá para desfazer.</>}
        confirmLabel="Apagar plano"
        loading={deleting}
        loadingLabel="Apagando…"
        keepOpenOnConfirm
        onConfirm={handleDelete}
      />
    </>
  );
}
