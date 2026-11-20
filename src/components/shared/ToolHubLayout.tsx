'use client';

import React, { useState } from 'react';
import { ArrowRight, ChevronRight, History, Plus, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToolHistory, RoomMeta } from '@/hooks/useToolHistory';
import { cn } from '@/lib/utils';
import { PAGE_CARD, PageHeader, PageShell } from '@/components/page';
import { IconTile, ModalButton } from '@/components/room-kit';
import { getModule, type ModuleKey } from '@/lib/modules-registry';

interface Tip {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ReferenceSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  label?: string;
  /** Quando presente, o card vira um atalho clicável. Sem isso, segue informativo. */
  onClick?: () => void;
}

interface ToolHubLayoutProps {
  /** Módulo do registro: dá o nome, o ícone e a migalha da página. Preferido a `title`/`icon`. */
  module?: ModuleKey;
  /** Só para quem não está no registro; com `module`, vale o nome do registro. */
  title: string;
  description: string;
  /** Só para quem não está no registro; com `module`, vale o ícone do registro. */
  icon?: React.ReactNode;
  /** @deprecated As telas usam os tokens do tema; a cor por ferramenta saiu do desenho. */
  themeColor?: string;
  toolType?: RoomMeta['type'];
  tips: Tip[];
  referenceSections?: ReferenceSection[];
  onNewSession?: () => void;
  onSecondaryAction?: () => void;
  onJoinSession?: (id: string) => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  hideHistory?: boolean;
  hideJoinAction?: boolean;
  isCreating?: boolean;
  children?: React.ReactNode;
  /** Só o miolo (`children`) abaixo do cabeçalho da página, sem os cartões do hub (ex.: lista de Reviews). */
  onlyChildren?: boolean;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

const tinted = (el: React.ReactNode, className: string) =>
  React.isValidElement(el) ? React.cloneElement(el as React.ReactElement<{ className?: string }>, { className }) : el;

/**
 * Hub de uma cerimônia (Retrospectiva, Radar de clima, Brainstorming, Plano de ação, Review) e landing da
 * Biblioteca de IA: AppHeader/AppFooter do portal via `PageShell`, cabeçalho da página com migalha e os cartões
 * de início de sessão, sessões recentes, "Como funciona" e dicas.
 */
export function ToolHubLayout({
  module,
  title,
  description,
  icon,
  toolType,
  tips,
  referenceSections = [],
  onNewSession,
  onSecondaryAction,
  onJoinSession,
  primaryActionLabel = 'Nova sessão',
  secondaryActionLabel,
  hideJoinAction = false,
  isCreating = false,
  children,
  onlyChildren = false,
  actions,
  badge,
}: ToolHubLayoutProps) {
  const [joinId, setJoinId] = useState('');
  const { history, loading } = useToolHistory(toolType || 'poker');
  const pageTitle = module ? getModule(module).label : title;

  const handleJoinClick = () => {
    if (joinId.trim() && onJoinSession) {
      onJoinSession(joinId.trim().toUpperCase());
    }
  };

  return (
    <PageShell documentTitle={pageTitle}>
      <PageHeader
        title={pageTitle}
        module={module}
        subtitle={description}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: pageTitle }]}
        badges={badge}
        actions={actions}
      />

      {onlyChildren ? (
        <div className="flex w-full flex-1 flex-col">{children}</div>
      ) : (
        <div className="grid w-full grid-cols-1 items-stretch gap-5 text-left md:grid-cols-2 lg:grid-cols-12">
          {/* Início de sessão: ações principais */}
          <section aria-label="Iniciar" className={cn(PAGE_CARD, 'col-span-1 flex flex-col justify-between gap-5 p-6 md:col-span-2 lg:col-span-8')}>
            <div className="flex items-start gap-3">
              {module ? (
                <IconTile icon={getModule(module).icon} />
              ) : (
                icon && (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    {tinted(icon, 'h-[18px] w-[18px]')}
                  </span>
                )
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">Comece por aqui</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {onNewSession ? 'Crie uma sessão nova' : 'Escolha como continuar'}
                  {onJoinSession && !hideJoinAction ? ' ou entre numa que já existe com o código.' : '.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {onNewSession && (
                <ModalButton variant="primary" onClick={onNewSession} disabled={isCreating} className="h-11 shrink-0 gap-2 px-6">
                  <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  {primaryActionLabel}
                </ModalButton>
              )}

              {onSecondaryAction && secondaryActionLabel && (
                <ModalButton onClick={onSecondaryAction} className="h-11 shrink-0 px-6">
                  {secondaryActionLabel}
                </ModalButton>
              )}

              {onJoinSession && !hideJoinAction && (
                <div className="relative min-w-0 flex-1">
                  <Input
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                    placeholder="Código da sala"
                    aria-label="Entrar com o código da sala"
                    className="h-11 rounded-[10px] pr-14 text-sm font-medium uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handleJoinClick}
                    disabled={!joinId.trim()}
                    aria-label="Entrar na sala"
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Sessões recentes (só deste navegador) */}
          <section aria-label="Sessões recentes" className={cn(PAGE_CARD, 'col-span-1 flex flex-col gap-3 p-6 lg:col-span-4')}>
            <div className="flex items-center gap-2">
              <IconTile icon={History} size="sm" tone="neutral" />
              <h2 className="text-base font-semibold text-foreground">Sessões recentes</h2>
            </div>

            <div className="flex max-h-[160px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {loading ? (
                <div role="status" aria-label="Carregando sessões" className="space-y-2 py-2 motion-safe:animate-pulse">
                  <div className="h-12 rounded-xl bg-muted" />
                  <div className="h-12 rounded-xl bg-muted" />
                </div>
              ) : history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sessão ainda</p>
              ) : (
                history.slice(0, 3).map((room) => (
                  <button
                    type="button"
                    key={room.roomId}
                    onClick={() => onJoinSession?.(room.roomId)}
                    className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{room.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{room.team || 'Squad geral'}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                ))
              )}
            </div>

            <p className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Salvo só neste navegador</p>
          </section>

          {/* Como funciona */}
          {referenceSections.length > 0 && (
            <section aria-label="Como funciona" className={cn(PAGE_CARD, 'col-span-1 flex flex-col gap-3 p-6 md:col-span-2 lg:col-span-8')}>
              <div className="flex items-center gap-2">
                <IconTile icon={Search} size="sm" />
                <h2 className="text-base font-semibold text-foreground">Como funciona</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {referenceSections.slice(0, 4).map((section, idx) => {
                  const body = (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                        {tinted(section.icon, 'h-4 w-4 text-primary')}
                      </span>
                      <span className="min-w-0 space-y-1">
                        <span className="block text-sm font-semibold text-foreground">{section.title}</span>
                        <span className="line-clamp-4 block text-sm leading-normal text-muted-foreground">{section.description}</span>
                      </span>
                    </>
                  );
                  const base = 'flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-left';
                  return section.onClick ? (
                    <button
                      type="button"
                      key={idx}
                      onClick={section.onClick}
                      className={cn(base, 'transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={idx} className={base}>
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Dicas */}
          <section aria-label="Dicas" className={cn(PAGE_CARD, 'col-span-1 flex flex-col gap-3 p-6 md:col-span-2 lg:col-span-4')}>
            <div className="flex items-center gap-2">
              <IconTile icon={Sparkles} size="sm" tone="warn" />
              <h2 className="text-base font-semibold text-foreground">Dicas para a cerimônia</h2>
            </div>

            <div className="flex-1 space-y-3">
              {tips.slice(0, 3).map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                    {tinted(tip.icon, 'h-3.5 w-3.5 text-primary')}
                  </span>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">{tip.title}</h3>
                    <p className="line-clamp-4 text-sm leading-snug text-muted-foreground">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Miolo extra (widgets da própria tela) */}
          {children && <div className="col-span-1 w-full md:col-span-2 lg:col-span-12">{children}</div>}
        </div>
      )}
    </PageShell>
  );
}
