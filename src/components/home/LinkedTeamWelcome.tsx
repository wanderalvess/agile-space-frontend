'use client';

/**
 * Aviso de uma vez só para quem acabou de criar a conta e já foi encontrado num time pelo e-mail
 * (o backend faz esse vínculo no cadastro). Diz em qual time a pessoa entrou e para onde ir.
 * Some ao dispensar; o sinal vem de lib/team-welcome.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clearJustSignedUp, hasLinkedTeam, isJustSignedUp } from '@/lib/team-welcome';
import { Notice } from './Notice';

export function LinkedTeamWelcome({ showPainelLink = true }: { showPainelLink?: boolean }) {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);
  const teamId = session?.activeProjectId;
  const teamName = session?.activeProjectName || teamId;

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
      title={`Você já está na squad ${teamName}.`}
      text="Vinculamos a sua conta pelo e-mail."
      action={showPainelLink ? { label: 'Ver painel da squad', href: '/painel' } : undefined}
      onDismiss={dismiss}
    />
  );
}
