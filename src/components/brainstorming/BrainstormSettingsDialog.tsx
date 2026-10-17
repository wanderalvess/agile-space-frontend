'use client';

import React, { useState } from 'react';
import { Flag, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { FIELD, Modal, ModalButton, SettingRow, normalizeRoomTitle } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { VoteLimitField } from './VoteLimitField';

export interface BrainstormSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFacilitator: boolean;
  title: string;
  anonymous: boolean;
  /** `settings.isRevealed === false`. */
  ideasHidden: boolean;
  presentation: boolean;
  soundEnabled: boolean;
  onToggleAnonymous: () => void;
  onToggleReveal: () => void;
  onTogglePresentation: () => void;
  onRename: (title: string) => void;
  onSoundChange: (enabled: boolean) => void;
  /** Mural encerrado: os ajustes que o servidor recusa ficam desabilitados (só o nome muda). */
  finished?: boolean;
  /** O backend conhece as funções novas: aparecem votos por pessoa, edição restrita e encerrar. */
  ceremonyApi?: boolean;
  /** Votos por pessoa; `null` = sem limite. */
  voteLimit?: number | null;
  onVoteLimitChange?: (value: number | null) => void;
  restrictEdits?: boolean;
  onRestrictEditsChange?: (value: boolean) => void;
  /** Encerrar ou reabrir (facilitador, criador ou ADMIN). */
  canFinish?: boolean;
  onFinish?: () => void;
  onReopen?: () => void;
}

/**
 * Configurações da sessão. Os três atalhos do facilitador (autores anônimos, ocultar ideias e modo apresentação)
 * ganham texto aqui e continuam no cabeçalho; o som do cronômetro é uma preferência de cada pessoa, guardada neste
 * navegador. Quem não é facilitador vê só a parte pessoal.
 */
export function BrainstormSettingsDialog({
  open,
  onOpenChange,
  isFacilitator,
  title,
  anonymous,
  ideasHidden,
  presentation,
  soundEnabled,
  onToggleAnonymous,
  onToggleReveal,
  onTogglePresentation,
  onRename,
  onSoundChange,
  finished = false,
  ceremonyApi = false,
  voteLimit = null,
  onVoteLimitChange,
  restrictEdits = false,
  onRestrictEditsChange,
  canFinish = false,
  onFinish,
  onReopen,
}: BrainstormSettingsDialogProps) {
  // Rascunho do nome: enquanto não se digita nada vale o título atual (que outra pessoa pode ter mudado).
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? title;

  const commitName = () => {
    const next = normalizeRoomTitle(name, title);
    if (next) onRename(next);
    setDraft(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={SlidersHorizontal}
      title="Configurações da sessão"
      description={isFacilitator ? 'Valem para todas as pessoas na sala. A preferência de som é só sua.' : 'Só o facilitador muda os ajustes da sessão. A preferência de som é só sua.'}
      footer={<ModalButton onClick={() => onOpenChange(false)}>Fechar</ModalButton>}
    >
      <div className="flex flex-col gap-5">
        {isFacilitator && (
          <section aria-label="Da sessão" className="flex flex-col">
            <h3 className="m-0 mb-1 text-[13px] font-bold text-muted-foreground">Da sessão (só o facilitador)</h3>
            <SettingRow
              id="brain-set-anon"
              title="Autores anônimos"
              desc="Ninguém vê quem lançou cada ideia, nem o facilitador. O servidor só diz o autor ao próprio autor."
              checked={anonymous}
              onChange={() => onToggleAnonymous()}
              disabled={finished}
            />
            <SettingRow
              id="brain-set-hide"
              title="Ocultar as ideias"
              desc="Cada pessoa só vê as próprias até o facilitador revelar. Revelar e ocultar vale na hora para todos."
              checked={ideasHidden}
              onChange={() => onToggleReveal()}
              disabled={finished}
            />
            <SettingRow
              id="brain-set-present"
              title="Modo apresentação"
              desc="Esconde o campo de nova ideia para projetar o mural sem distrações."
              checked={presentation}
              onChange={() => onTogglePresentation()}
              disabled={finished}
            />
            {ceremonyApi && onVoteLimitChange && <VoteLimitField idPrefix="brain-set" value={voteLimit} onChange={onVoteLimitChange} disabled={finished} />}
            {ceremonyApi && onRestrictEditsChange && (
              <SettingRow
                id="brain-set-restrict"
                title="Só o autor e a facilitação editam o texto"
                desc="Mover, agrupar, votar e juntar ideias continuam livres para todos."
                checked={restrictEdits}
                onChange={onRestrictEditsChange}
                disabled={finished}
              />
            )}
            <div className="flex flex-col gap-1.5 py-3">
              <label htmlFor="brain-set-name" className="text-sm font-semibold text-foreground">Nome da sessão</label>
              <div className="flex gap-2">
                <input
                  id="brain-set-name"
                  value={name}
                  maxLength={255}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                  }}
                  className={cn(FIELD, 'h-10')}
                />
              </div>
            </div>
          </section>
        )}

        {ceremonyApi && canFinish && (
          <section aria-label="Encerramento" className="flex flex-col gap-2">
            <h3 className="m-0 text-[13px] font-bold text-muted-foreground">Encerramento</h3>
            {finished ? (
              <ModalButton className="h-10 w-fit gap-2" onClick={() => { onOpenChange(false); onReopen?.(); }}>
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Reabrir brainstorming
              </ModalButton>
            ) : (
              <ModalButton className="h-10 w-fit gap-2" onClick={() => { onOpenChange(false); onFinish?.(); }}>
                <Flag className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Encerrar brainstorming
              </ModalButton>
            )}
          </section>
        )}

        <section aria-label="Só para você" className="flex flex-col">
          <h3 className="m-0 mb-1 text-[13px] font-bold text-muted-foreground">Só para você (neste navegador)</h3>
          <SettingRow
            id="brain-set-sound"
            title="Som ao acabar o tempo"
            desc="Toca um alerta quando o cronômetro chega a zero. Fica guardado neste navegador."
            checked={soundEnabled}
            onChange={onSoundChange}
          />
        </section>
      </div>
    </Modal>
  );
}
