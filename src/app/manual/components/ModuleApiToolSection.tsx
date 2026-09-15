'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { Terminal, Bot, KeyRound, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getModuleIntegration, API_KEY_HEADER, API_KEY_ADMIN_PATH, API_KEY_SELF_SERVICE_PATH } from '@/lib/integration-catalog';
import Link from 'next/link';

interface ModuleApiToolSectionProps {
  moduleId: string;
}

export function ModuleApiToolSection({ moduleId }: ModuleApiToolSectionProps) {
  const integration = getModuleIntegration(moduleId);

  if (!integration) return null;

  const { label, tagline, rest, mcp, snippet, snippetResponse, notes } = integration;

  return (
    <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/30 dark:shadow-none overflow-hidden">
      <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-500/20">
              <Terminal className="h-3 w-3" /> Integração de Máquina & API
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              API REST & Ferramentas MCP do {label}
            </CardTitle>
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tagline}
            </CardDescription>
          </div>

          <Badge variant="outline" className="h-7 px-3 rounded-xl border-slate-300 dark:border-slate-700 text-xs font-bold gap-1.5 text-slate-700 dark:text-slate-300">
            <KeyRound className="h-3.5 w-3.5 text-amber-500" /> Header: <code className="font-mono">{API_KEY_HEADER}</code>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {/* Como Autenticar e Obter Chave */}
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" /> Como Obter sua Chave e Autenticar
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Toda chamada exige o envio do header <code className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-900 dark:text-amber-300">{API_KEY_HEADER}: ask_...</code>. 
            Você pode gerar sua chave pessoal em{' '}
            <Link href={API_KEY_SELF_SERVICE_PATH} className="font-bold text-primary hover:underline">
              Meu Espaço → Conectividade
            </Link>{' '}
            ou via painel de administração em{' '}
            <Link href={API_KEY_ADMIN_PATH} className="font-bold text-primary hover:underline">
              Admin → API Keys
            </Link>.
          </p>
        </div>

        {/* REST Endpoints se existirem */}
        {rest.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Endpoints REST Disponíveis
            </h4>
            <div className="space-y-3">
              {rest.map((r, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono tracking-wider ${
                      r.method === 'GET' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {r.method}
                    </span>
                    <code className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                      {r.path}
                    </code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ml-auto">
                      Escopo: {r.scope}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {r.summary}
                  </p>
                  {r.params && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      <strong>Parâmetros:</strong> <code className="font-mono text-[10px] bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">{r.params}</code>
                    </p>
                  )}
                  {r.returns && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      <strong>Retorno:</strong> {r.returns}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MCP Tools se existirem */}
        {mcp.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Ferramentas MCP (Model Context Protocol) para Agentes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mcp.map((tool, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-black text-violet-700 dark:text-violet-400">
                      {tool.name}
                    </code>
                    {tool.write ? (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        Write / Escrita
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                        Read / Leitura
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {tool.summary}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong>Argumentos:</strong> <code className="font-mono text-[10px] bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">{tool.params}</code>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Snippet de Exemplo Prático */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
            Exemplo Prático de Chamada
          </h4>
          <CodeBlock code={snippet} language="bash" />
          {snippetResponse && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Exemplo de Resposta (JSON):
              </span>
              <CodeBlock code={snippetResponse} language="json" />
            </div>
          )}
        </div>

        {/* Notas e Restrições Reais */}
        {notes && notes.length > 0 && (
          <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Regras de Negócio & Detalhes de Integração
            </h5>
            <ul className="space-y-1.5">
              {notes.map((note, i) => (
                <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
