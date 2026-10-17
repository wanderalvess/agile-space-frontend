'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { FIELD, Modal, ModalButton, SettingRow } from '@/components/room-kit';
import { DEFAULT_HEALTH_CHECK_QUESTION } from '@/lib/retro-formats';

interface RetroSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthorsRevealed: boolean;
  onToggleAuthorsRevealed: (value: boolean) => void;
  syncStageEnabled: boolean;
  onToggleSyncStage: (value: boolean) => void;
  autoRevealOnTimerEnd: boolean;
  onToggleAutoRevealOnTimerEnd: (value: boolean) => void;
  autoSortOnVoteEnd: boolean;
  onToggleAutoSortOnVoteEnd: (value: boolean) => void;
  healthCheckEnabled: boolean;
  onToggleHealthCheck: (value: boolean) => void;
  healthCheckQuestion: string;
  onHealthCheckQuestionChange: (value: string) => void;
}

/**
 * Configurações da retro (só o facilitador vê). Cada interruptor vale na hora para todo o time — não há
 * "salvar": o quadro é atualizado a cada clique e o servidor avisa os demais.
 */
export function RetroSettingsDialog({
  isOpen,
  onClose,
  isAuthorsRevealed,
  onToggleAuthorsRevealed,
  syncStageEnabled,
  onToggleSyncStage,
  autoRevealOnTimerEnd,
  onToggleAutoRevealOnTimerEnd,
  autoSortOnVoteEnd,
  onToggleAutoSortOnVoteEnd,
  healthCheckEnabled,
  onToggleHealthCheck,
  healthCheckQuestion,
  onHealthCheckQuestionChange,
}: RetroSettingsDialogProps) {
  // Digitar não pode depender do round-trip do servidor para atualizar o campo (o valor real só volta pelo
  // broadcast do quadro). O debounce evita uma gravação a cada tecla.
  const [localQuestion, setLocalQuestion] = useState(healthCheckQuestion);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Enquanto há texto digitado ainda não enviado, o eco do servidor (valor mais antigo) não sobrescreve o campo.
  const hasUnsentRef = useRef(false);

  useEffect(() => {
    if (hasUnsentRef.current) return;
    setLocalQuestion(healthCheckQuestion);
  }, [healthCheckQuestion]);

  const handleQuestionChange = (value: string) => {
    setLocalQuestion(value);
    hasUnsentRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      hasUnsentRef.current = false;
      onHealthCheckQuestionChange(value);
    }, 500);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      icon={Settings}
      title="Configurações da retro"
      description="Valem para todo o time na hora."
      footer={<ModalButton variant="primary" onClick={onClose}>Concluir</ModalButton>}
    >
      <div className="flex flex-col pt-1">
        <SettingRow id="rs-authors" title="Autores abertos" desc="Mostra quem escreveu cada cartão" checked={isAuthorsRevealed} onChange={onToggleAuthorsRevealed} />
        <SettingRow id="rs-sync" title="Sincronizar coluna ativa" desc="Todos acompanham a coluna do facilitador" checked={syncStageEnabled} onChange={onToggleSyncStage} />
        <SettingRow id="rs-checkin" title="Check-in inicial" desc="Pergunta como cada pessoa chega à retro" checked={healthCheckEnabled} onChange={onToggleHealthCheck}>
          <div className="room-rise mt-3 flex flex-col gap-1.5">
            <label htmlFor="rs-checkin-question" className="text-xs font-semibold text-muted-foreground">Pergunta do check-in</label>
            <textarea
              id="rs-checkin-question"
              value={localQuestion}
              onChange={(e) => handleQuestionChange(e.target.value)}
              placeholder={DEFAULT_HEALTH_CHECK_QUESTION}
              rows={2}
              className={`${FIELD} min-h-[54px] resize-none py-2`}
            />
            <span className="text-xs text-muted-foreground">Em branco, vale a pergunta padrão.</span>
          </div>
        </SettingRow>
        <SettingRow id="rs-autoreveal" title="Revelar ao fim do timer" desc="Os cartões aparecem quando o tempo acaba" checked={autoRevealOnTimerEnd} onChange={onToggleAutoRevealOnTimerEnd} />
        <SettingRow id="rs-autosort" title="Ordenar por votos ao encerrar" desc="Os mais votados sobem para o topo de cada coluna" checked={autoSortOnVoteEnd} onChange={onToggleAutoSortOnVoteEnd} />
      </div>
    </Modal>
  );
}
