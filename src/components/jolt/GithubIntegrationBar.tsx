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

interface GithubIntegrationBarProps {
  currentTitle: string;
  setCurrentTitle: (val: string) => void;
  apiUrl: string;
  setApiUrl: (val: string) => void;
  repoInput: string;
  setRepoInput: (val: string) => void;
  setGithubRepo: (val: string) => void;
  githubTags: string[];
  selectedTag: string;
  setSelectedTag: (val: string) => void;
  loadingGithubTags: boolean;
  githubIntegrations: string[];
  selectedIntegration: string;
  handleIntegrationChange: (val: string) => void;
  loadingGithubTree: boolean;
  githubLayouts: any[];
  selectedLayoutPath: string;
  handleLayoutPathChange: (val: string) => void;
  loadingGithubLayout: boolean;
  isLayoutPopoverOpen: boolean;
  setIsLayoutPopoverOpen: (val: boolean) => void;
}

export function GithubIntegrationBar({
  currentTitle,
  setCurrentTitle,
  apiUrl,
  setApiUrl,
  repoInput,
  setRepoInput,
  setGithubRepo,
  githubTags,
  selectedTag,
  setSelectedTag,
  loadingGithubTags,
  githubIntegrations,
  selectedIntegration,
  handleIntegrationChange,
  loadingGithubTree,
  githubLayouts,
  selectedLayoutPath,
  handleLayoutPathChange,
  loadingGithubLayout,
  isLayoutPopoverOpen,
  setIsLayoutPopoverOpen,
}: GithubIntegrationBarProps) {
  return (
    <div className="flex items-center px-6 py-2 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 shrink-0 gap-3 w-full">
      {/* Layout Name Box */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 h-7 flex-[1.5] min-w-[120px]">
        <Tag className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <Input 
          value={currentTitle} 
          onChange={(e) => setCurrentTitle(e.target.value)} 
          placeholder="NOME DO LAYOUT..." 
          className="h-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest text-slate-700 dark:text-slate-300 w-full" 
        />
      </div>
      
      {/* Source URL Box */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 h-7 flex-[2] min-w-[160px]">
        <Globe className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <Input 
          value={apiUrl} 
          onChange={(e) => setApiUrl(e.target.value)} 
          placeholder="URL DE ORIGEM (OPCIONAL)..." 
          className="h-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest w-full" 
        />
      </div>

      {/* GitHub Repository Box */}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 h-7 flex-[1.5] min-w-[120px]">
        <Input
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setGithubRepo(repoInput);
            }
          }}
          placeholder="USUARIO/REPOSITORIO"
          className="h-full w-full bg-transparent border-none text-[8px] md:text-[8px] font-black uppercase tracking-widest p-0 focus-visible:ring-0 placeholder:text-slate-450 dark:placeholder:text-slate-700 placeholder:text-[8px] placeholder:md:text-[8px] placeholder:tracking-widest text-slate-700 dark:text-slate-300"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={() => setGithubRepo(repoInput)} 
              variant="ghost" 
              size="icon" 
              className="h-4 w-4 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-850 rounded shrink-0"
            >
              <Wand2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-850 text-[10px] text-slate-700 dark:text-slate-300 font-sans">
            Carregar Layouts do Repositório
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Version Selector */}
      <div className="flex-[1] min-w-[80px]">
        <Select onValueChange={setSelectedTag} value={selectedTag} disabled={loadingGithubTags || githubTags.length === 0}>
          <SelectTrigger className="h-7 w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg px-2 shadow-none focus:ring-0 text-slate-700 dark:text-slate-300">
            <SelectValue placeholder={loadingGithubTags ? "..." : "VERSÃO"} />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-750 dark:text-slate-300">
            {githubTags.map(tag => (
              <SelectItem key={tag} value={tag} className="text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer">{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Integration Selector */}
      <div className="flex-[1.2] min-w-[100px]">
        <Select onValueChange={handleIntegrationChange} value={selectedIntegration} disabled={loadingGithubTree || githubIntegrations.length === 0}>
          <SelectTrigger className="h-7 w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg px-2 shadow-none focus:ring-0 text-slate-700 dark:text-slate-300">
            <SelectValue placeholder={loadingGithubTree ? "..." : "INTEGRAÇÃO"} />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-750 dark:text-slate-300">
            {githubIntegrations.map(integration => (
              <SelectItem key={integration} value={integration} className="text-[10px] font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer">{integration}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Route Selector */}
      <div className="flex-[2] min-w-[160px]">
        <Popover open={isLayoutPopoverOpen} onOpenChange={setIsLayoutPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              role="combobox"
              aria-expanded={isLayoutPopoverOpen}
              disabled={loadingGithubTree || loadingGithubLayout || githubLayouts.length === 0}
              className="h-7 w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg px-2 justify-between shadow-none focus:ring-0 text-left font-sans text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <span className="truncate max-w-[130px]">
                {loadingGithubLayout 
                  ? "BAIXANDO..." 
                  : (selectedLayoutPath
                      ? githubLayouts.find(l => l.path === selectedLayoutPath)?.name 
                      : (githubLayouts.length === 0 ? "SEM ROTAS" : "BUSCAR ROTA"))}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl overflow-hidden" align="end">
            <Command className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              <CommandInput placeholder="Digite para buscar..." className="h-9 text-[10px] uppercase font-bold border-none placeholder:text-slate-400 dark:placeholder:text-slate-650 bg-transparent text-slate-900 dark:text-white focus:ring-0" />
              <CommandList className="max-h-[200px] overflow-y-auto">
                <CommandEmpty className="py-2 text-center text-[8px] font-black uppercase text-slate-400 dark:text-slate-650">Nenhuma rota encontrada</CommandEmpty>
                <CommandGroup>
                  {githubLayouts.map((layout) => (
                    <CommandItem
                      key={layout.path}
                      value={layout.name}
                      onSelect={() => {
                        handleLayoutPathChange(layout.path);
                        setIsLayoutPopoverOpen(false);
                      }}
                      className="text-[10px] font-bold uppercase cursor-pointer text-slate-700 dark:text-slate-300 hover:!bg-slate-100 dark:hover:!bg-slate-800 hover:!text-slate-900 dark:hover:!text-white flex items-center justify-between py-2 px-3 data-[selected=true]:!bg-slate-100 dark:data-[selected=true]:!bg-slate-850 data-[selected=true]:!text-slate-900 dark:data-[selected=true]:!text-white aria-selected:!bg-slate-100 dark:aria-selected:!bg-slate-850 aria-selected:!text-slate-900 dark:aria-selected:!text-white transition-colors"
                    >
                      <span className="truncate max-w-[190px]">{layout.name}</span>
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 text-blue-500 transition-opacity",
                          selectedLayoutPath === layout.path ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
