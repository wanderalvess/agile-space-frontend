'use client';

import React from 'react';
import { Tag, Globe, Wand2, ChevronsUpDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { useGithubLayouts } from './useGithubLayouts';

interface GithubIntegrationBarProps {
  currentTitle: string;
  setCurrentTitle: (val: string) => void;
  apiUrl: string;
  setApiUrl: (val: string) => void;
  github: ReturnType<typeof useGithubLayouts>;
  isLayoutPopoverOpen: boolean;
  setIsLayoutPopoverOpen: (val: boolean) => void;
}

const boxClass = 'flex items-center gap-2 bg-muted border border-border rounded-lg px-2.5 h-9';
const triggerClass =
  'h-9 w-full bg-muted border-border text-xs font-medium rounded-lg px-2 shadow-none focus:ring-0 text-foreground';
const itemClass =
  'text-xs font-medium hover:bg-muted focus:bg-muted bg-card text-foreground cursor-pointer';

export function GithubIntegrationBar({
  currentTitle,
  setCurrentTitle,
  apiUrl,
  setApiUrl,
  github,
  isLayoutPopoverOpen,
  setIsLayoutPopoverOpen,
}: GithubIntegrationBarProps) {
  const {
    repoInput, setRepoInput, submitRepo, tags, version, integrations, integration, routes, routePath,
    loadingTags, loadingTree, loadingLayout, selectIntegration, selectRoute, selectVersion,
  } = github;
  const selectedRouteName = routes.find(r => r.path === routePath)?.name;

  return (
    <div className="flex flex-wrap items-center px-4 sm:px-6 py-2 border-b border-border bg-card shrink-0 gap-2 sm:gap-3 w-full">
      {/* Nome do layout */}
      <div className={cn(boxClass, 'flex-[1.5] basis-[140px] min-w-[120px]')}>
        <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
        <Input
          value={currentTitle}
          onChange={(e) => setCurrentTitle(e.target.value)}
          placeholder="Nome do layout..."
          aria-label="Nome do layout"
          className="h-full bg-transparent border-none text-xs font-medium p-0 focus-visible:ring-0 placeholder:text-muted-foreground placeholder:text-xs text-foreground w-full"
        />
      </div>

      {/* URL de origem */}
      <div className={cn(boxClass, 'flex-[2] basis-[180px] min-w-[160px]')}>
        <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
        <Input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="URL de origem (opcional)..."
          aria-label="URL de origem"
          className="h-full bg-transparent border-none text-xs font-medium p-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground placeholder:text-xs w-full"
        />
      </div>

      {/* Repositório */}
      <div className={cn(boxClass, 'flex-[1.5] basis-[140px] min-w-[120px]')}>
        <Input
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRepo();
          }}
          placeholder="usuario/repositorio"
          aria-label="Repositório de layouts no GitHub"
          className="h-full w-full bg-transparent border-none text-xs font-medium p-0 focus-visible:ring-0 placeholder:text-muted-foreground placeholder:text-xs text-foreground"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={submitRepo}
              variant="ghost"
              size="icon"
              aria-label="Carregar layouts do repositório"
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent rounded shrink-0"
            >
              <Wand2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-card border-border text-xs text-foreground">
            Carregar layouts do repositório
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 1. Integração */}
      <div className="flex-[1.2] min-w-[110px]">
        <Select onValueChange={selectIntegration} value={integration} disabled={loadingTree || integrations.length === 0}>
          <SelectTrigger aria-label="Integração" className={triggerClass}>
            <SelectValue placeholder={loadingTree || loadingTags ? '...' : '1. Integração'} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            {integrations.map(name => (
              <SelectItem key={name} value={name} className={itemClass}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Rota */}
      <div className="flex-[2] min-w-[160px]">
        <Popover open={isLayoutPopoverOpen} onOpenChange={setIsLayoutPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              role="combobox"
              aria-label="Rota"
              aria-expanded={isLayoutPopoverOpen}
              disabled={!integration || loadingTree || loadingLayout || routes.length === 0}
              className="h-9 w-full bg-muted hover:bg-accent border border-border text-xs font-medium rounded-lg px-2 justify-between shadow-none focus:ring-0 text-left text-foreground hover:text-foreground disabled:opacity-100 disabled:text-muted-foreground"
            >
              <span className="truncate max-w-[130px]">
                {loadingLayout
                  ? 'Baixando...'
                  : selectedRouteName ?? (!integration ? '2. Rota' : routes.length === 0 ? 'Sem rotas' : '2. Buscar rota')}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0 border border-border shadow-2xl rounded-xl overflow-hidden" align="end">
            <Command className="bg-card text-foreground">
              <CommandInput placeholder="Digite para buscar..." className="h-9 text-xs font-medium border-none placeholder:text-muted-foreground bg-transparent text-foreground focus:ring-0" />
              <CommandList className="max-h-[240px] overflow-y-auto">
                <CommandEmpty className="py-2 text-center text-xs font-medium text-muted-foreground">Nenhuma rota encontrada</CommandEmpty>
                <CommandGroup>
                  {routes.map((route) => (
                    <CommandItem
                      key={route.path}
                      value={route.name}
                      onSelect={() => {
                        selectRoute(route.path);
                        setIsLayoutPopoverOpen(false);
                      }}
                      className="text-xs font-medium cursor-pointer text-foreground flex items-center justify-between py-2 px-3 data-[selected=true]:!bg-muted dark:data-[selected=true]:!bg-secondary transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{route.name}</span>
                      <Check className={cn('h-3.5 w-3.5 text-primary transition-opacity', routePath === route.path ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* 3. Versão (tag do repositório): trocar recarrega a mesma rota naquela versão */}
      <div className="flex-[1] min-w-[100px]">
        <Select onValueChange={selectVersion} value={version} disabled={loadingTags || tags.length === 0}>
          <SelectTrigger aria-label="Versão do repositório" className={triggerClass}>
            <SelectValue placeholder={loadingTags ? '...' : '3. Versão'} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            {tags.map((tag, i) => (
              <SelectItem key={tag} value={tag} className={itemClass}>
                {tag}{i === 0 ? ' (mais recente)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
