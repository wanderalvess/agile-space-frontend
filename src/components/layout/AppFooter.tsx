'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { MessageSquareHeart } from 'lucide-react';
import { FeedbackWidget } from '@/components/feedback-widget';
import { FOCUS_RING } from '@/components/home/home-ui';
import { cn } from '@/lib/utils';
import { getModule, type ModuleKey } from '@/lib/modules-registry';
import { useNewVersion } from '@/lib/new-version';
import { NewVersionNotice } from './NewVersionNotice';
import packageInfo from '../../../package.json';

/** Atalhos do rodapé, na ordem: o texto e a rota vêm do registro de módulos. */
const FOOTER_LINKS: ModuleKey[] = ['changelog', 'manual', 'governance', 'support'];

interface AppFooterProps {
  /** Nome da tela no feedback enviado (ex.: "Time da squad"). Padrão: o portal. */
  toolName?: string;
  /**
   * Quem já monta o próprio `FeedbackWidget` (Home) passa o gatilho aqui e o rodapé não monta outro.
   * Sem isso o rodapé cuida do feedback sozinho.
   */
  onOpenFeedback?: () => void;
  className?: string;
}

/**
 * Rodapé padrão de toda página que não é sala: nome do portal, versão e os atalhos de sempre
 * (Feedback, Versões, Manual, Segurança e dados, Suporte). Sem logo.
 */
export function AppFooter({ toolName, onOpenFeedback, className }: AppFooterProps) {
  const [signal, setSignal] = useState<number | undefined>();
  const openOwnFeedback = useCallback(() => setSignal(Date.now()), []);
  const handleFeedback = onOpenFeedback ?? openOwnFeedback;

  const { unread } = useNewVersion();

  const linkClass = cn(
    'inline-flex h-8 items-center rounded-lg px-3 text-xs max-sm:h-11 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
    FOCUS_RING,
  );

  return (
    <footer className={cn('relative mt-auto border-t border-border', className)}>
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8 2xl:px-12">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Portal Tech V&amp;D</span> · © 2026 ·{' '}
          <span className="tabular-nums" title="Versão do portal">
            v{packageInfo.version}
          </span>
        </p>
        <nav aria-label="Links úteis do rodapé" className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={handleFeedback} className={cn(linkClass, 'gap-1.5')}>
            <MessageSquareHeart aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            Feedback
          </button>
          {FOOTER_LINKS.map((key) => {
            const m = getModule(key);
            const hasDot = key === 'changelog' && unread;
            return (
              <Link
                key={key}
                href={m.href}
                aria-label={hasDot ? `${m.label}, há uma versão nova` : undefined}
                className={cn(linkClass, hasDot && 'relative gap-2')}
              >
                {m.label}
                {hasDot && <span aria-hidden="true" data-testid="versions-dot" className="h-2 w-2 rounded-full bg-primary ring-[3px] ring-primary/25" />}
              </Link>
            );
          })}
        </nav>
      </div>
      <NewVersionNotice />
      {!onOpenFeedback && (
        <FeedbackWidget toolName={toolName ? `Portal Tech V&D - ${toolName}` : 'Portal Tech V&D'} triggerVariant="none" externalTriggerSignal={signal} />
      )}
    </footer>
  );
}
