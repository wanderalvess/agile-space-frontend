'use client';

/**
 * Aviso de uma vez só para quem acabou de criar a conta e já foi encontrado num time pelo e-mail
 * (o backend faz esse vínculo no cadastro). Diz em qual time a pessoa entrou e para onde ir.
 * Some ao dispensar; o sinal vem de lib/team-welcome.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { clearJustSignedUp, hasLinkedTeam, isJustSignedUp } from '@/lib/team-welcome';

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
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3" role="status">
      <Users className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">Você já está no time {teamName}.</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          Encontramos o seu e-mail nesse time e vinculamos a sua conta. Poker, Review e Retro já abrem com ele.
        </p>
      </div>
      {showPainelLink && (
        <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold shrink-0" onClick={dismiss}>
          <Link href="/painel">
            Ver painel do time <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dispensar aviso" className="h-8 w-8 rounded-lg shrink-0">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
