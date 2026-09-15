'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, KeyRound, Plug, Terminal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { MyApiKeysManager } from '@/components/shared/MyApiKeysManager';
import { cn } from '@/lib/utils';
import {
  API_KEY_ADMIN_PATH,
  API_KEY_HEADER,
  getModuleIntegration,
} from '@/lib/integration-catalog';

interface ModuleIntegrationDialogProps {
  /** id do módulo em MODULE_INTEGRATIONS (knowledge, prompt-hub, squad, poker). */
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Atalho de integração dentro do próprio módulo: mostra só o que serve pra
 * chamar aquele módulo de fora (endpoints REST, tools MCP, um exemplo pronto)
 * e manda pra referência completa em /manual#integracoes. Os dados vêm de
 * lib/integration-catalog.ts, o mesmo que alimenta a página do manual.
 */
export function ModuleIntegrationDialog({ moduleId, open, onOpenChange }: ModuleIntegrationDialogProps) {
  const [showKeyManager, setShowKeyManager] = useState(false);
  const integration = getModuleIntegration(moduleId);
  if (!integration) return null;

  const { label, tagline, rest, mcp, snippet, snippetResponse, notes } = integration;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[88vh] flex flex-col p-0 overflow-hidden border border-border bg-card text-card-foreground shadow-2xl rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-4 bg-card shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Integrar {label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {tagline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Coluna Esquerda: Autenticação + Endpoints REST + MCP Tools */}
          <div className="lg:col-span-7 space-y-6">
            {/* Autenticação */}
            <section className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground">
                <KeyRound className="h-4 w-4 text-amber-500" /> Antes de tudo: a chave de API
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Toda chamada (REST ou MCP) exige o header <code className="font-code px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">{API_KEY_HEADER}</code>.
                Gere a sua em{' '}
                <Link href={API_KEY_ADMIN_PATH} className="font-semibold text-primary hover:underline">
                  Admin → Segurança → API Keys
                </Link>{' '}
                ou crie uma chave pessoal instantaneamente sem sair daqui. A chave crua aparece uma única vez.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKeyManager(true)}
                className="h-8 px-3 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold gap-1.5 hover:bg-amber-500/20"
              >
                <KeyRound className="h-3.5 w-3.5" /> Gerar minha chave
              </Button>
            </section>

            {/* REST */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground">
                <Terminal className="h-4 w-4 text-emerald-500" /> Endpoints REST
              </h3>
              {rest.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed rounded-xl border border-dashed border-border p-3">
                  Este módulo não tem endpoint REST público. O acesso externo é só por MCP.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rest.map(endpoint => (
                    <li
                      key={`${endpoint.method}-${endpoint.path}`}
                      className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                            endpoint.method === 'POST'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                          )}
                        >
                          {endpoint.method}
                        </span>
                        <code className="font-code text-xs font-medium text-foreground break-all">
                          {endpoint.path}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground">{endpoint.summary}</p>
                      {endpoint.params && (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Params:</span> {endpoint.params}
                        </p>
                      )}
                      <p className="text-[11px] font-semibold text-primary">
                        Escopo: {endpoint.scope}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* MCP */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground">
                <Bot className="h-4 w-4 text-violet-500" /> Ferramentas MCP · {mcp.length} {mcp.length === 1 ? 'ferramenta' : 'ferramentas'}
              </h3>
              <ul className="space-y-2">
                {mcp.map(tool => (
                  <li key={tool.name} className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5 transition-colors hover:bg-muted/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-code text-xs font-bold text-violet-600 dark:text-violet-400">
                        {tool.name}
                      </code>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider',
                          tool.write
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground border border-border'
                        )}
                      >
                        {tool.write ? 'escrita' : 'leitura'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tool.summary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Params:</span> {tool.params}
                    </p>
                    <p className="text-[11px] font-semibold text-primary">
                      Escopo: {tool.scope}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Coluna Direita: Exemplo pronto + Notas + Referência completa */}
          <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Exemplo */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold tracking-wide text-foreground">
                  Exemplo pronto
                </h3>
                <CodeBlock code={snippet} label={rest.length > 0 ? 'curl' : 'tool call'} />
                {snippetResponse && <CodeBlock code={snippetResponse} label="Resposta esperada" />}
              </section>

              {notes && notes.length > 0 && (
                <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <h3 className="text-xs font-semibold tracking-wide text-foreground">
                    Precisa saber
                  </h3>
                  <ul className="space-y-2">
                    {notes.map(note => (
                      <li
                        key={note}
                        className="text-xs text-muted-foreground leading-relaxed pl-3.5 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <Button asChild className="w-full h-11 rounded-xl font-semibold text-xs tracking-wide gap-2 mt-4">
              <Link href="/manual#integracoes">
                Referência completa de integração <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showKeyManager} onOpenChange={setShowKeyManager}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border shadow-2xl bg-card text-card-foreground p-6">
        <DialogHeader className="space-y-1 text-left pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Minhas API Keys
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Gere, veja e revogue suas próprias chaves de acesso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="pt-4">
          <MyApiKeysManager compact />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

interface ModuleIntegrationButtonProps {
  moduleId: string;
  className?: string;
  label?: string;
  /** 'ghost' para barras de header que já usam botões sem borda. */
  variant?: 'outline' | 'ghost';
}

/**
 * Botão + dialog num componente só, pra plugar o atalho numa página de módulo
 * sem ela precisar gerenciar estado de abertura.
 */
export function ModuleIntegrationButton({
  moduleId,
  className,
  label = 'API & MCP',
  variant = 'outline',
}: ModuleIntegrationButtonProps) {
  const [open, setOpen] = useState(false);

  if (!getModuleIntegration(moduleId)) return null;

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'gap-2',
          variant === 'outline'
            ? 'h-9 px-3.5 rounded-lg border-border text-xs font-semibold text-foreground hover:bg-accent'
            : 'text-muted-foreground hover:text-foreground',
          className
        )}
      >
        <Plug className="h-3.5 w-3.5" /> {label}
      </Button>
      <ModuleIntegrationDialog moduleId={moduleId} open={open} onOpenChange={setOpen} />
    </>
  );
}
