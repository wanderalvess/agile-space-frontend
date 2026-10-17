'use client';

import { useEffect } from 'react';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader, type AppHeaderProps } from '@/components/layout/AppHeader';
import { cn } from '@/lib/utils';
import { PAGE_WIDTHS, type PageWidth } from './styles';

export interface PageShellProps {
  children: React.ReactNode;
  /** Título da aba do navegador, sem o sufixo: "Time da squad" vira "Time da squad | Portal Tech V&D". */
  documentTitle?: string;
  /** Nome da tela no feedback enviado pelo rodapé. Padrão: `documentTitle`. */
  feedbackName?: string;
  /** Largura máxima do conteúdo: `default` (1680 px, como a Home), `narrow` (1120 px) ou `wide` (1920 px). */
  width?: PageWidth;
  /** Props repassadas ao `AppHeader` (ex.: `squadControl={null}` para páginas sem squad). */
  header?: AppHeaderProps;
  /** Rodapé próprio (a Home passa o dela); `false` esconde. Padrão: `AppFooter`. */
  footer?: React.ReactNode | false;
  /** Elemento decorativo atrás do topo (a Home usa um halo). */
  backdrop?: React.ReactNode;
  className?: string;
  /** Classes do miolo (padrão: coluna com espaço de 20 px entre as seções). */
  contentClassName?: string;
}

/**
 * Esqueleto de toda página que não é sala: AppHeader, miolo com largura máxima e AppFooter.
 * O layout raiz já abre um main; por isso o miolo é uma div com id "conteudo".
 *
 * Exemplo mínimo:
 *   <PageShell documentTitle="Time da squad">
 *     <PageHeader title="Time da squad" breadcrumb={[{ label: 'Squad', href: '/squad' }, { label: 'Time da squad' }]} />
 *     <KpiRow>...</KpiRow>
 *   </PageShell>
 */
export function PageShell({
  children,
  documentTitle,
  feedbackName,
  width = 'default',
  header,
  footer,
  backdrop,
  className,
  contentClassName,
}: PageShellProps) {
  useEffect(() => {
    if (documentTitle) document.title = `${documentTitle} | Portal Tech V&D`;
  }, [documentTitle]);

  return (
    <div className={cn('relative flex min-h-dvh w-full flex-1 flex-col bg-background text-foreground', className)}>
      {backdrop}
      <AppHeader {...header} />
      <div
        id="conteudo"
        className={cn(
          'relative mx-auto flex w-full flex-1 flex-col gap-5 px-4 pb-14 pt-6 sm:px-8 sm:pt-7 2xl:px-12',
          PAGE_WIDTHS[width],
          contentClassName,
        )}
      >
        {children}
      </div>
      {footer === false ? null : footer ?? <AppFooter toolName={feedbackName ?? documentTitle} />}
    </div>
  );
}
