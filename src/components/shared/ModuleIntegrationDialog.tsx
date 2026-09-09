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
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Plug className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Integrar {label}
              </DialogTitle>
              <DialogDescription className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {tagline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Autenticação */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 space-y-2">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <KeyRound className="h-3.5 w-3.5 text-amber-500" /> Antes de tudo: a chave
            </h3>
            <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              Toda chamada (REST ou MCP) exige o header <code className="font-code text-cyan-700 dark:text-cyan-400">{API_KEY_HEADER}</code>.
              Gere a sua em{' '}
              <Link href={API_KEY_ADMIN_PATH} className="font-black text-cyan-700 dark:text-cyan-400 hover:underline">
                Admin → Segurança → API Keys
              </Link>{' '}
              (visão de ADMIN/LEAD sobre todas as chaves) ou gere a sua própria agora, sem precisar de acesso ao admin.
              A chave crua aparece uma única vez na criação — o banco guarda só o hash SHA-256.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeyManager(true)}
              className="h-9 px-4 rounded-xl border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <KeyRound className="h-3.5 w-3.5" /> Gerar minha chave
            </Button>
          </section>

          {/* REST */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-emerald-500" /> REST
            </h3>
            {rest.length === 0 ? (
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
                Este módulo não tem endpoint REST público. O acesso externo é só por MCP (abaixo).
              </p>
            ) : (
              <ul className="space-y-2">
                {rest.map(endpoint => (
                  <li
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest',
                          endpoint.method === 'POST'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        )}
                      >
                        {endpoint.method}
                      </span>
                      <code className="font-code text-[11px] text-slate-800 dark:text-slate-200 break-all">
                        {endpoint.path}
                      </code>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{endpoint.summary}</p>
                    {endpoint.params && (
                      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        <span className="font-black uppercase tracking-widest">Params:</span> {endpoint.params}
                      </p>
                    )}
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                      Escopo: {endpoint.scope}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* MCP */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <Bot className="h-3.5 w-3.5 text-violet-500" /> MCP · {mcp.length} {mcp.length === 1 ? 'tool' : 'tools'}
            </h3>
            <ul className="space-y-2">
              {mcp.map(tool => (
                <li key={tool.name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-code text-[11px] font-bold text-violet-700 dark:text-violet-400">
                      {tool.name}
                    </code>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest',
                        tool.write
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {tool.write ? 'escrita' : 'leitura'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{tool.summary}</p>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    <span className="font-black uppercase tracking-widest">Params:</span> {tool.params}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                    Escopo: {tool.scope}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Exemplo */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Exemplo pronto
            </h3>
            <CodeBlock code={snippet} label={rest.length > 0 ? 'curl' : 'tool call'} />
            {snippetResponse && <CodeBlock code={snippetResponse} label="Resposta" />}
          </section>

          {notes && notes.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Precisa saber
              </h3>
              <ul className="space-y-1.5">
                {notes.map(note => (
                  <li
                    key={note}
                    className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pl-4 relative before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-cyan-500"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button asChild className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2">
            <Link href="/manual#integracoes">
              Referência completa de integração <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showKeyManager} onOpenChange={setShowKeyManager}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Minhas API Keys
              </DialogTitle>
              <DialogDescription className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Gere, veja e revogue suas próprias chaves.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <MyApiKeysManager compact />
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
            ? 'h-10 px-4 rounded-xl border-slate-300 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400 hover:border-cyan-400/60'
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
