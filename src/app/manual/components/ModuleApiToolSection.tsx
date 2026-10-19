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
    <Card className="border border-border/80 dark:border-border bg-card rounded-2xl shadow-xl shadow-black/10 dark:shadow-none overflow-hidden">
      <CardHeader className="p-8 pb-4 border-b border-border bg-muted/50 dark:bg-background/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground text-xs font-bold tracking-normal border border-primary/20">
              <Terminal className="h-3 w-3" /> Integração de Máquina & API
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              API REST & Ferramentas MCP do {label}
            </CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground">
              {tagline}
            </CardDescription>
          </div>

          <Badge variant="outline" className="h-7 px-3 rounded-xl border-border text-xs font-bold gap-1.5 text-foreground dark:text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" /> Cabeçalho: <code className="font-mono">{API_KEY_HEADER}</code>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {/* Como Autenticar e Obter Chave */}
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
          <h4 className="text-xs font-bold tracking-normal text-amber-800 dark:text-amber-400 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-700 dark:text-amber-300" /> Como Obter sua Chave e Autenticar
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            Toda chamada exige o envio do header <code className="font-mono bg-card dark:bg-muted px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-900 dark:text-amber-300">{API_KEY_HEADER}: ask_...</code>. 
            Você pode gerar sua chave pessoal em{' '}
            <Link href={API_KEY_SELF_SERVICE_PATH} className="font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground hover:underline">
              Meu Espaço → Conectividade
            </Link>{' '}
            ou via painel de administração em{' '}
            <Link href={API_KEY_ADMIN_PATH} className="font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground hover:underline">
              Admin → API Keys
            </Link>.
          </p>
        </div>

        {/* REST Endpoints se existirem */}
        {rest.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-normal text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> Endpoints REST Disponíveis
            </h4>
            <div className="space-y-3">
              {rest.map((r, i) => (
                <div key={i} className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/50 border border-border/70 dark:border-border space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold  font-mono tracking-normal ${
                      r.method === 'GET' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-foreground text-background'
                    }`}>
                      {r.method}
                    </span>
                    <code className="text-xs font-mono font-bold text-foreground">
                      {r.path}
                    </code>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted/60 dark:bg-muted text-foreground dark:text-muted-foreground ml-auto">
                      Escopo: {r.scope}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {r.summary}
                  </p>
                  {r.params && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Parâmetros:</strong> <code className="font-mono text-xs bg-card px-1 py-0.5 rounded border border-border">{r.params}</code>
                    </p>
                  )}
                  {r.returns && (
                    <p className="text-xs text-muted-foreground">
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
            <h4 className="text-xs font-bold tracking-normal text-foreground flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" /> Ferramentas MCP (Model Context Protocol) para Agentes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mcp.map((tool, i) => (
                <div key={i} className="p-4 rounded-2xl bg-muted/40 dark:bg-muted/50 border border-border/70 dark:border-border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                      {tool.name}
                    </code>
                    {tool.write ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20">
                        Escrita
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-foreground border border-primary/20">
                        Leitura
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {tool.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Argumentos:</strong> <code className="font-mono text-xs bg-card px-1 py-0.5 rounded border border-border">{tool.params}</code>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Snippet de Exemplo Prático */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-normal text-foreground">
            Exemplo Prático de Chamada
          </h4>
          <CodeBlock
            code={snippet}
            label={rest && rest.length > 0 ? 'curl' : 'tool call'}
            language="bash"
          />
          {snippetResponse && (
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-bold text-muted-foreground tracking-normal">
                Exemplo de Resposta (JSON):
              </span>
              <CodeBlock code={snippetResponse} label="Resposta esperada" language="json" />
            </div>
          )}
        </div>

        {/* Notas e Restrições Reais */}
        {notes && notes.length > 0 && (
          <div className="p-5 rounded-2xl bg-muted/60 border border-border space-y-2">
            <h5 className="text-xs font-bold tracking-normal text-muted-foreground">
              Regras de Negócio & Detalhes de Integração
            </h5>
            <ul className="space-y-1.5">
              {notes.map((note, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 mt-0.5 shrink-0" />
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
