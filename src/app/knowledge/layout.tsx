"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { GlobalSearch } from '@/components/knowledge/GlobalSearch';
import { Bot, HelpCircle, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { moduleIcon } from '@/lib/modules-registry';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { KnowledgeGuide } from '@/components/knowledge/KnowledgeGuide';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { ModalButton } from '@/components/room-kit';
import { useUserContext } from '@/context/UserContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const TITULOS: [string, string][] = [
  ['/knowledge/admin/new-asset', 'Novo artigo'],
  ['/knowledge/chat', 'Assistente virtual'],
  ['/knowledge/settings', 'Ajustes da base'],
  ['/knowledge/trash', 'Lixeira'],
  ['/knowledge/manual', 'Manual da base'],
  ['/knowledge', 'Base de conhecimento'],
];

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading: isUserLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const router = useRouter();
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  useDocumentTitle(TITULOS.find(([prefixo]) => pathname.startsWith(prefixo))?.[1]);

  const navItems = [
    { label: 'Base de conhecimento', path: '/knowledge/kb', icon: moduleIcon('knowledge') },
    { label: 'Assistente virtual', path: '/knowledge/chat', icon: Bot },
    { label: 'Ajustes', path: '/knowledge/settings', icon: SlidersHorizontal },
  ];

  const effectiveUser = session || userProfile;

  // Se não está logado, renderiza apenas o children (a page.tsx cuida da tela de "Identidade Necessária")
  if (!effectiveUser && !isInitializing && !isUserLoading) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background text-foreground">
      {/* Help Guide (Standard Sheet) */}
      <KnowledgeGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <AppHeader />

      {/* Sub-barra do módulo: navegação interna, busca na base e criação */}
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-8 2xl:px-12">
          <nav aria-label="Base de conhecimento" className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== '/knowledge' && pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => router.push(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden h-9 w-60 items-center gap-2 rounded-[10px] border border-border bg-background px-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex-1">Pesquisar na base</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">⌘K</kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Pesquisar na base"
              className="h-9 w-9 rounded-[10px] border border-border md:hidden max-sm:h-11 max-sm:w-11"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGuideOpen(true)}
              aria-label="Abrir o guia da base de conhecimento"
              className="h-9 w-9 rounded-[10px] border border-border text-muted-foreground hover:text-foreground max-sm:h-11 max-sm:w-11"
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <ModalButton variant="primary" onClick={() => router.push('/knowledge/admin/new-asset')} className="h-9 gap-1.5 px-4">
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar
            </ModalButton>
          </div>
        </div>
      </div>

      {/* Área da página: altura da janela menos o cabeçalho e a sub-barra; o rodapé fica logo abaixo */}
      <div id="conteudo" className="relative flex h-[max(34rem,calc(100dvh-8.5rem))] flex-col overflow-hidden">
        {/* Global Search Component */}
        <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />

        <div className="relative w-full flex-1 overflow-y-auto">{children}</div>
      </div>

      <AppFooter toolName="Base de conhecimento" />
    </div>
  );
}
