'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { GuideSheet } from '@/components/room-kit';
import { GUIDE_ITEMS } from './content';

/** Guia lateral da página Segurança e dados: como ler a tabela e onde pedir ajuda. */
export function GovernanceGuideSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia desta página"
      description="Como ler Segurança e dados."
      icon={ShieldCheck}
      manualHref="/manual"
      tabs={[
        {
          id: 'como-ler',
          label: 'Como ler',
          content: (
            <div className="flex flex-col gap-4">
              {GUIDE_ITEMS.map((g, i) => (
                <div key={g.id} className={i === 0 ? 'flex flex-col gap-1.5' : 'flex flex-col gap-1.5 border-t border-border pt-4'}>
                  <strong className="text-sm font-semibold text-foreground">{g.title}</strong>
                  <p className="text-sm leading-relaxed text-muted-foreground">{g.text}</p>
                </div>
              ))}
              <Link
                href="/support"
                className="mt-1 inline-flex h-10 items-center justify-between rounded-[10px] border border-border px-3 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Suporte
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
