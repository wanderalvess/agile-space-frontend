'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Search, Send, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMyLinkRequests } from '@/hooks/useMyLinkRequests';
import { filterMyLinks, countLabel, type MyLink } from '@/lib/my-links';
import { parseInviteToken } from '@/lib/onboarding';
import { FOCUS_RING, IconTile, ModalButton } from '@/components/room-kit';
import { InviteFooter } from '@/components/onboarding/InviteFooter';
import { LegacyOnlyNotice } from '@/components/onboarding/LegacyOnlyNotice';
import { MyRequests } from '@/components/onboarding/MyRequests';
import { LinkCard } from './LinkCard';
import { LinkRequestFlow } from './LinkRequestFlow';
import { cn } from '@/lib/utils';

/** A partir daqui a lista ganha busca. */
const SEARCH_FROM = 6;

export interface LinksSectionProps {
  links: MyLink[];
  canSwitch: boolean;
  switchingTo: string | null;
  onActivate: (link: MyLink) => void;
  /** E-mail do login, sugerido nos pedidos de vínculo. */
  email: string;
  /** Sem squad definida: o caminho de cadastro é o `/onboarding`. */
  mustOnboard: boolean;
  /** Sem vínculo nenhum, só com rastro do modelo antigo: mostra o aviso "peça à liderança da squad". */
  legacyOnly?: boolean;
  /** Fecha o modal antes de seguir para outra página. */
  onNavigate: () => void;
}

/**
 * Seção "Meus vínculos" (só leitura): um cartão por squad com papel e tipo, "Tornar ativa" e as saídas
 * para ganhar um vínculo novo (pedir vínculo, usar convite). O vínculo nasce por Jira, convite ou pedido
 * aprovado; aqui ninguém escolhe projeto, squad ou papel à mão.
 */
export function LinksSection({ links, canSwitch, switchingTo, onActivate, email, mustOnboard, legacyOnly = false, onNavigate }: LinksSectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { requests, reload } = useMyLinkRequests();
  const [mode, setMode] = useState<'list' | 'request'>('list');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visible = filterMyLinks(links, query);

  const openInvite = (raw: string) => {
    const token = parseInviteToken(raw);
    if (!token) {
      toast({ title: 'Link de convite inválido', description: 'Cole o link completo ou só o código do convite.', variant: 'destructive' });
      return;
    }
    onNavigate();
    router.push(`/invite/${token}`);
  };

  const searchSquad = () => {
    if (mustOnboard) {
      onNavigate();
      router.push('/onboarding');
    } else {
      setMode('request');
    }
  };

  if (mode === 'request') {
    return (
      <LinkRequestFlow
        defaultEmail={email}
        linkedIds={links.map((l) => l.id)}
        onBack={() => setMode('list')}
        onSent={() => void reload()}
      />
    );
  }

  const invite = inviteOpen && <InviteFooter open onOpenChange={setInviteOpen} onSubmit={openInvite} />;

  if (links.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {legacyOnly && <LegacyOnlyNotice />}
        <section
          aria-labelledby="identity-vazio"
          className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-card p-5 sm:p-6"
        >
          <IconTile icon={Users} size="lg" />
          <div className="flex flex-col gap-1">
            <h3 id="identity-vazio" className="text-lg font-bold leading-tight text-foreground">
              Você ainda não tem vínculos
            </h3>
            <p className="text-[13px] text-muted-foreground">Entre numa squad para usar as ferramentas do seu time.</p>
          </div>
          <div className="flex w-full flex-wrap gap-2">
            <ModalButton variant="primary" onClick={searchSquad} className="gap-2 max-sm:h-11 max-sm:w-full">
              <Search aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Buscar squad
            </ModalButton>
            <ModalButton onClick={() => setInviteOpen(true)} className="gap-2 max-sm:h-11 max-sm:w-full">
              <Link2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Usar convite
            </ModalButton>
            <ModalButton onClick={() => setMode('request')} className="gap-2 max-sm:h-11 max-sm:w-full">
              <Send aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Pedir acesso
            </ModalButton>
          </div>
          {invite}
        </section>
        <MyRequests requests={requests} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-full flex-col sm:basis-40">
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">Suas squads</h3>
          <span className="text-xs text-muted-foreground">{countLabel(links.length)}</span>
        </div>
        <ModalButton onClick={() => setMode('request')} className="gap-2 max-sm:h-11 max-sm:flex-1">
          <Send aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Pedir vínculo
        </ModalButton>
        <ModalButton onClick={() => setInviteOpen((v) => !v)} aria-expanded={inviteOpen} className="gap-2 max-sm:h-11 max-sm:flex-1">
          <Link2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Usar convite
        </ModalButton>
      </div>

      {invite}

      {links.length > SEARCH_FROM && (
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome, chave ou papel"
            aria-label="Filtrar vínculos"
            autoComplete="off"
            className={cn('h-10 rounded-[10px] bg-muted/40 pl-10 text-[13px] max-sm:h-11', FOCUS_RING)}
          />
        </div>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {visible.map((link) => (
          <LinkCard key={link.id} link={link} canSwitch={canSwitch} switching={switchingTo === link.id} busy={!!switchingTo} onActivate={onActivate} />
        ))}
      </ul>
      {visible.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhuma squad com “{query.trim()}”.</p>}

      <MyRequests requests={requests} />
    </div>
  );
}
