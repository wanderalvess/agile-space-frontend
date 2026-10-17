'use client';

/**
 * Aviso da home logo depois de criar um time: diz que deu certo e aponta o Resumo da squad.
 * Some ao dispensar. A flag é gravada pelo /onboarding (agileSpace_newSquad_<squad>).
 */

import { useCallback, useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { SQUAD_SUMMARY_HREF } from '@/lib/squad-hub';
import { Notice } from './Notice';

export function NewSquadWelcome() {
  const { squadId: activeSquadId } = useActiveSquad();
  const squadId = activeSquadId;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!squadId) {
      setVisible(false);
      return;
    }
    try {
      setVisible(localStorage.getItem(`agileSpace_newSquad_${squadId}`) === '1');
    } catch {
      setVisible(false);
    }
  }, [squadId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.removeItem(`agileSpace_newSquad_${squadId}`);
    } catch {
      /* storage bloqueado: some só nesta sessão */
    }
  }, [squadId]);

  if (!visible) return null;

  return (
    <Notice
      compact
      icon={PartyPopper}
      title={`A squad ${squadId} está criada.`}
      text="Escolha uma ferramenta para começar."
      action={{ label: 'Resumo', href: SQUAD_SUMMARY_HREF }}
      dismissLabel="Dispensar boas-vindas"
      onDismiss={dismiss}
    />
  );
}
