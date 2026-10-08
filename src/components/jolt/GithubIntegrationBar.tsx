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

const boxClass = 'flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 h-7';
const triggerClass =
  'h-7 w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg px-2 shadow-none focus:ring-0 text-slate-700 dark:text-slate-300';
const itemClass =
  'text-[10px] font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer';

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
    <div className="flex items-center px-6 py-2 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0 gap-3 w-full">
      {/* Nome do layout */}
      <div className={cn(boxClass, 'flex-[1.5] min-w-[120px]')}>
        <Tag className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <Input
          value={currentTitle}
          onChange={(e) => setCurrentTitle(e.target.value)}
          placeholder="NOME DO LAYOUT..."
          aria-label="Nome do layout"
          className="h-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest text-slate-700 dark:text-slate-300 w-full"
        />
      </div>

      {/* URL de origem */}
      <div className={cn(boxClass, 'flex-[2] min-w-[160px]')}>
        <Globe className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <Input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="URL DE ORIGEM (OPCIONAL)..."
          aria-label="URL de origem"
          className="h-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest w-full"
        />
      </div>

      {/* Repositório */}
      <div className={cn(boxClass, 'flex-[1.5] min-w-[120px]')}>
        <Input
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRepo();
          }}
          placeholder="USUARIO/REPOSITORIO"
          aria-label="Repositório de layouts no GitHub"
          className="h-full w-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest text-slate-700 dark:text-slate-300"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={submitRepo}
              variant="ghost"
              size="icon"
              aria-label="Carregar layouts do repositório"
              className="h-4 w-4 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded shrink-0"
            >
              <Wand2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300">
            Carregar layouts do repositório
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 1. Integração */}
      <div className="flex-[1.2] min-w-[110px]">
        <Select onValueChange={selectIntegration} value={integration} disabled={loadingTree || integrations.length === 0}>
          <SelectTrigger aria-label="Integração" className={triggerClass}>
            <SelectValue placeholder={loadingTree || loadingTags ? '...' : '1. INTEGRAÇÃO'} />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
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
              className="h-7 w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg px-2 justify-between shadow-none focus:ring-0 text-left text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <span className="truncate max-w-[130px]">
                {loadingLayout
                  ? 'BAIXANDO...'
                  : selectedRouteName ?? (!integration ? '2. ROTA' : routes.length === 0 ? 'SEM ROTAS' : '2. BUSCAR ROTA')}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl overflow-hidden" align="end">
            <Command className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              <CommandInput placeholder="Digite para buscar..." className="h-9 text-[10px] uppercase font-bold border-none placeholder:text-slate-400 dark:placeholder:text-slate-600 bg-transparent text-slate-900 dark:text-white focus:ring-0" />
              <CommandList className="max-h-[240px] overflow-y-auto">
                <CommandEmpty className="py-2 text-center text-[8px] font-black uppercase text-slate-400 dark:text-slate-600">Nenhuma rota encontrada</CommandEmpty>
                <CommandGroup>
                  {routes.map((route) => (
                    <CommandItem
                      key={route.path}
                      value={route.name}
                      onSelect={() => {
                        selectRoute(route.path);
                        setIsLayoutPopoverOpen(false);
                      }}
                      className="text-[10px] font-bold uppercase cursor-pointer text-slate-700 dark:text-slate-300 flex items-center justify-between py-2 px-3 data-[selected=true]:!bg-slate-100 dark:data-[selected=true]:!bg-slate-800 transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{route.name}</span>
                      <Check className={cn('h-3.5 w-3.5 text-blue-500 transition-opacity', routePath === route.path ? 'opacity-100' : 'opacity-0')} />
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
            <SelectValue placeholder={loadingTags ? '...' : '3. VERSÃO'} />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
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
