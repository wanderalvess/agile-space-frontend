'use client';

/**
 * Aviso de uma vez só para quem acabou de criar a conta e já foi encontrado num time pelo e-mail
 * (o backend faz esse vínculo no cadastro). Diz em qual time a pessoa entrou e para onde ir.
 * Some ao dispensar; o sinal vem de lib/team-welcome.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { clearJustSignedUp, hasLinkedTeam, isJustSignedUp } from '@/lib/team-welcome';
import { SQUAD_SUMMARY_HREF } from '@/lib/squad-hub';
import { Notice } from './Notice';

export function LinkedTeamWelcome({ showPainelLink = true }: { showPainelLink?: boolean }) {
  const [visible, setVisible] = useState(false);
  const { squadId: teamId } = useActiveSquad();

  useEffect(() => {
    setVisible(isJustSignedUp() && hasLinkedTeam(teamId));
  }, [teamId]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearJustSignedUp();
  }, []);

  if (!visible) return null;

  return (
    <Notice
      compact
      icon={Users}
      title={'Você já está vinculado a esta squad.'}
      text="Vinculamos a sua conta pelo e-mail."
      action={showPainelLink ? { label: 'Ver o resumo da squad', href: SQUAD_SUMMARY_HREF } : undefined}
      onDismiss={dismiss}
    />
  );
}
