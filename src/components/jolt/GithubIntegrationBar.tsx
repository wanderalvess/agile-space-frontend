'use client';

import React, { useState } from 'react';
import { Check, ChevronsUpDown, Github, Loader2, Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SelectField, StatusChip } from '@/components/room-kit';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { FIELD_LABEL } from './LayoutCard';
import { Notice } from './JoltBits';
import type { useGithubLayouts } from './useGithubLayouts';

type Github = ReturnType<typeof useGithubLayouts>;

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Cartão "Buscar do GitHub": Integração → Rota → Versão, e "Carregar layout". A página não consulta o GitHub
 * sozinha: o botão "Buscar layouts do GitHub" é quem faz a primeira consulta.
 */
export function GithubIntegrationBar({ github, envelope }: { github: Github; envelope: boolean }) {
  const {
    repo, repoInput, setRepoInput, submitRepo, repoError, clearRepoError, status, errorMessage, resetAt, truncated, search,
    tags, version, integrations, integration, routes, routePath, routeName, missingRoute, loadingTree, loadingLayout, loaded,
    selectIntegration, selectRoute, selectVersion, loadSelected,
  } = github;
  const [editRepo, setEditRepo] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  const consulted = status === 'pronto';
  const showLoaded = !!loaded && loaded.path === routePath && loaded.tag === version;
  const canLoad = consulted && !!routePath && !missingRoute && !loadingLayout && !loadingTree;

  const validateRepo = async () => {
    setValidating(true);
    const ok = await submitRepo();
    setValidating(false);
    if (ok) setEditRepo(false);
  };

  return (
    <section aria-label="Buscar do GitHub" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-bold text-foreground">
          <Github className="h-[17px] w-[17px]" strokeWidth={1.5} aria-hidden="true" />
          Buscar do GitHub
        </h2>
        <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
          Repositório
          <code className="rounded-lg border border-border bg-muted/50 px-2 py-0.5 font-code text-xs text-foreground">{repo}</code>
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-expanded={editRepo}
            onClick={() => {
              setEditRepo((v) => !v);
              clearRepoError();
              setRepoInput(repo);
            }}
            className="h-7 rounded-lg px-2.5 text-xs font-semibold"
          >
            Trocar
          </Button>
        </span>
      </div>

      {editRepo && (
        <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <label htmlFor="jolt-repo" className={FIELD_LABEL}>Repositório (dono/nome)</label>
            <input
              id="jolt-repo"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void validateRepo();
              }}
              spellCheck={false}
              className={cn(FIELD, 'h-10 font-code text-[13px]')}
            />
          </div>
          <Button type="button" onClick={() => void validateRepo()} disabled={validating} className="h-10 rounded-[10px] px-4 font-bold">
            {validating && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
            Validar e usar
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditRepo(false)} className="h-10 rounded-[10px] px-4 font-semibold">
            Cancelar
          </Button>
          <span className="basis-full text-xs text-muted-foreground">Conferimos se o repositório existe e tem a pasta de rotas antes de usar.</span>
          {repoError && <span role="alert" className="basis-full text-[13px] font-semibold text-red-700 dark:text-red-300">{repoError}</span>}
        </div>
      )}

      {status === 'nao-consultado' && (
        <Notice
          tone="neutral"
          action={
            <Button type="button" onClick={() => void search()} className="h-10 gap-2 rounded-[10px] px-4 font-bold">
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Buscar layouts do GitHub
            </Button>
          }
        >
          <strong>Ainda não consultado.</strong> <span className="text-muted-foreground">A página não chama o GitHub sozinha; busque quando precisar.</span>
        </Notice>
      )}

      {status === 'buscando' && (
        <div role="status" className="flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            Consultando {repo}…
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1.4fr_1fr]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-10 rounded-[10px] border border-border bg-muted/50 motion-safe:animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {status === 'limite' && (
        <Notice
          tone="warn"
          icon={TriangleAlert}
          role="alert"
          action={
            <Button type="button" variant="outline" onClick={() => void search()} className="h-9 rounded-[10px] px-3.5 font-semibold">
              Tentar de novo
            </Button>
          }
        >
          <strong>O GitHub atingiu o limite de consultas.</strong> Sem login no GitHub, o limite é de 60 por hora por rede.
          {resetAt ? ` Tente de novo depois das ${formatTime(resetAt)}.` : ' Tente de novo em alguns minutos.'}
        </Notice>
      )}

      {status === 'erro' && (
        <Notice
          tone="danger"
          icon={TriangleAlert}
          role="alert"
          action={
            <Button type="button" variant="outline" onClick={() => void search()} className="h-9 rounded-[10px] px-3.5 font-semibold">
              Tentar de novo
            </Button>
          }
        >
          <strong>Não foi possível consultar o GitHub.</strong> {errorMessage}
        </Notice>
      )}

      {consulted && (
        <>
          {truncated && (
            <Notice tone="warn" icon={TriangleAlert} role="alert" className="text-[13px]">
              <strong>A lista veio cortada.</strong> O GitHub limita árvores muito grandes, então algumas rotas podem não aparecer. Se não achar a sua, escolha outra versão ou carregue o arquivo pelo repositório.
            </Notice>
          )}
          {missingRoute && (
            <Notice tone="warn" icon={TriangleAlert} role="alert" className="text-[13px]">
              <strong>Esta versão não tem a rota «{missingRoute}».</strong> Escolha outra rota ou outra versão.
            </Notice>
          )}
          <div className="grid grid-cols-1 items-end gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jolt-gh-integracao" className={FIELD_LABEL}>Integração</label>
              <SelectField
                id="jolt-gh-integracao"
                aria-label="Integração"
                value={integration}
                onChange={selectIntegration}
                options={integrations.map((i) => ({ value: i, label: i }))}
                placeholder="Escolha a integração"
                disabled={loadingTree || integrations.length === 0}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="jolt-gh-rota-rotulo" className={FIELD_LABEL}>Rota</span>
              <Popover open={routeOpen} onOpenChange={setRouteOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-labelledby="jolt-gh-rota-rotulo"
                    aria-expanded={routeOpen}
                    disabled={!integration || loadingTree || routes.length === 0}
                    className={cn(
                      'h-10 w-full justify-between rounded-[10px] bg-muted/40 px-3 font-code text-[13px] font-normal',
                      missingRoute && 'border-amber-500/60',
                    )}
                  >
                    <span className={cn('truncate', !routeName && !missingRoute && 'font-sans text-muted-foreground')}>
                      {routeName || missingRoute || (!integration ? 'Escolha a integração' : routes.length === 0 ? 'Sem rotas' : 'Buscar rota…')}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite para buscar…" aria-label="Buscar rota" />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty className="py-3 text-center text-[13px] text-muted-foreground">Nenhuma rota com esse nome.</CommandEmpty>
                      <CommandGroup>
                        {routes.map((r) => (
                          <CommandItem
                            key={r.path}
                            value={r.name}
                            onSelect={() => {
                              selectRoute(r.path);
                              setRouteOpen(false);
                            }}
                            className="flex items-center justify-between gap-2 font-code text-[13px]"
                          >
                            <span className="truncate">{r.name}</span>
                            <Check className={cn('h-3.5 w-3.5 shrink-0 text-primary', routePath === r.path ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="jolt-gh-versao" className={FIELD_LABEL}>Versão</label>
              <SelectField
                id="jolt-gh-versao"
                aria-label="Versão do repositório"
                value={version}
                onChange={(v) => void selectVersion(v)}
                options={tags.map((t, i) => ({ value: t, label: i === 0 ? `${t} (mais recente)` : t }))}
                disabled={tags.length === 0 || loadingTree}
                className="h-10"
              />
            </div>
            <Button type="button" onClick={() => void loadSelected()} disabled={!canLoad} className="h-10 rounded-[10px] px-4 font-bold">
              {loadingLayout && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              {loadingLayout ? 'Baixando…' : 'Carregar layout'}
            </Button>
          </div>
          {showLoaded && (
            <span role="status" className="inline-flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <StatusChip tone="success" className="h-[22px] font-bold">
                <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Carregado
              </StatusChip>
              {envelope ? (
                <>Reconhecemos o envelope <code className="font-code text-foreground">tabela.campos</code> e pegamos a spec de dentro dele.</>
              ) : (
                <>O arquivo não tem o envelope <code className="font-code text-foreground">tabela.campos</code>; ele foi colocado inteiro no editor de spec.</>
              )}
            </span>
          )}
        </>
      )}
    </section>
  );
}
