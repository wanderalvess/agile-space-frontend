'use client';

import { Users } from 'lucide-react';
import type { MyLink } from '@/lib/my-links';
import { IdentityRow } from './IdentityRow';
import { LinksSection } from './LinksSection';

export interface RowSquadsProps {
  open: boolean;
  onToggle: () => void;
  links: MyLink[];
  active?: MyLink;
  canSwitch: boolean;
  switchingTo: string | null;
  onActivate: (link: MyLink) => void;
  email: string;
  mustOnboard: boolean;
  legacyOnly: boolean;
  onNavigate: () => void;
}

/** "Nome (ativa) e mais N": resume os vínculos numa linha. */
function SquadsValue({ links, active }: { links: MyLink[]; active?: MyLink }) {
  if (links.length === 0) return <>Sem vínculos</>;
  const main = active ?? links[0];
  const more = links.length - 1;
  return (
    <>
      {main.name}
      <span className="font-normal text-muted-foreground">
        {active ? ' (ativa)' : ''}
        {more > 0 ? ` e mais ${more}` : ''}
      </span>
    </>
  );
}

/** Linha "Squads": resumo; aberta, lista os vínculos (tornar ativa) e as saídas para pedir vínculo ou usar convite. */
export function RowSquads({ open, onToggle, links, active, canSwitch, switchingTo, onActivate, email, mustOnboard, legacyOnly, onNavigate }: RowSquadsProps) {
  return (
    <IdentityRow id="squads" icon={Users} label="Squads" value={<SquadsValue links={links} active={active} />} actionLabel="Gerenciar" open={open} onToggle={onToggle}>
      <LinksSection
        embedded
        links={links}
        canSwitch={canSwitch}
        switchingTo={switchingTo}
        onActivate={onActivate}
        email={email}
        mustOnboard={mustOnboard}
        legacyOnly={legacyOnly}
        onNavigate={onNavigate}
      />
    </IdentityRow>
  );
}
