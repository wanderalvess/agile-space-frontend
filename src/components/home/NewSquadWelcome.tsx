'use client';

/**
 * Aviso da home logo depois de criar um time: diz que deu certo e aponta os
 * próximos passos (cerimônia, painel, Jira opcional). Some ao dispensar.
 * A flag é gravada pelo /onboarding (agileSpace_newSquad_<squad>).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PartyPopper, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/UserContext';

export function NewSquadWelcome() {
  const { userProfile } = useUserContext();
  const squadId = userProfile?.squadId;
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
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <PartyPopper className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">A squad {squadId} está criada.</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
          Escolha uma ferramenta abaixo pra começar (Poker, Retro, Showcase...). Se usar Jira, dá pra conectar depois no painel.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0">
        <Link href="/painel">
          Painel <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </Button>
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dispensar boas-vindas" className="h-8 w-8 rounded-lg shrink-0">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
