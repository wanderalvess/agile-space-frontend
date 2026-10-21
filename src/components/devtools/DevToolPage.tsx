'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, CircleHelp, Lightbulb } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { GuideSheet } from '@/components/room-kit';
import { TONES } from '@/components/room-kit/tokens';
import { getDevTool, getGroup, toolBadge } from '@/lib/devtools/registry';
import { cn } from '@/lib/utils';
import { ToolBadge, toolButtonClass } from './ToolControls';
import { StarButton } from './StarButton';
import { useDevToolPrefs } from './useDevToolPrefs';

interface DevToolPageProps {
  /** id da ferramenta no registro (src/lib/devtools/registry.ts). */
  toolId: string;
  children: React.ReactNode;
  /** Botões extras no cabeçalho (ex.: exemplo, limpar tudo). */
  actions?: React.ReactNode;
  /** Quando true, o corpo rola; por padrão ele ocupa a altura da janela e cada painel rola sozinho. */
  scrollBody?: boolean;
}

// Casca única das ferramentas: AppHeader/AppFooter do portal, cabeçalho com o ícone do módulo, trilha
// (DevTools › grupo › ferramenta), selo de onde a ferramenta roda, estrela de favorita e "Como usar" em
// folha lateral. Ferramentas que usam rede mostram um aviso com o nome do serviço. O corpo usa a largura
// e a altura da página (`wide`).
export function DevToolPage({ toolId, children, actions, scrollBody = false }: DevToolPageProps) {
  const tool = getDevTool(toolId);
  const [helpOpen, setHelpOpen] = useState(false);
  const { favorites, toggleFavorite, markOpened } = useDevToolPrefs();

  useEffect(() => {
    if (tool) markOpened(tool.id);
  }, [tool, markOpened]);

  if (!tool) return null;
  const group = getGroup(tool.group);
  const badge = toolBadge(tool);
  const isFav = favorites.includes(tool.id);

  return (
    <PageShell documentTitle={`${tool.title} | DevTools`} feedbackName={tool.title} width="wide" contentClassName="gap-3">
      <PageHeader
        title={tool.title}
        module="devtools"
        breadcrumb={[{ label: 'DevTools', href: '/devtools' }, { label: group.label }, { label: tool.title }]}
        badges={<ToolBadge tool={tool} size="md" />}
        actions={
          <>
            {actions}
            <StarButton on={isFav} name={tool.title} onToggle={() => toggleFavorite(tool.id)} size="lg" />
            <button type="button" onClick={() => setHelpOpen(true)} className={cn(toolButtonClass(), 'h-10')}>
              <CircleHelp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Como usar
            </button>
          </>
        }
      />

      {tool.network && (
        <div role="note" className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-sm', TONES.warn.chip, 'border-amber-500/30')}>
          <Cloud className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1 leading-relaxed text-foreground">
            <strong className="font-semibold">{badge.label}.</strong> {tool.network.notice}
          </span>
        </div>
      )}

      <div
        data-tool-body
        className={
          scrollBody
            ? 'min-h-[24rem] flex-1'
            : 'h-[max(36rem,calc(100dvh-17rem))] min-h-0 overflow-y-auto md:overflow-hidden'
        }
      >
        {children}
      </div>

      <GuideSheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title={`Como usar: ${tool.title}`}
        description={tool.description}
        icon={Lightbulb}
        tabs={[
          {
            id: 'passos',
            label: 'Passo a passo',
            content: (
              <div className="flex flex-col gap-5">
                <ol className="flex flex-col gap-2.5">
                  {tool.howTo.map((step, i) => (
                    <li key={i} className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-foreground">{i + 1}</span>
                      <span className="text-sm leading-relaxed text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className={cn('rounded-xl border p-3 text-sm leading-relaxed text-foreground', badge.external ? 'border-amber-500/30 bg-amber-500/10' : 'border-border bg-muted/40')}>
                  {tool.network
                    ? `${tool.network.what} O restante do que você cola fica no navegador.`
                    : 'Tudo roda no navegador. Nada do que você cola é enviado a servidor.'}
                </p>
              </div>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
