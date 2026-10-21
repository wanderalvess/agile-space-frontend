import Link from 'next/link';
import { Bot, KeyRound, Terminal } from 'lucide-react';
import { BRAND_TEXT, CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import {
  API_KEY_ADMIN_PATH,
  API_KEY_HEADER,
  API_KEY_SELF_SERVICE_PATH,
  EXAMPLE_HOST,
  getModuleIntegration,
} from '@/lib/integration-catalog';
import { cn } from '@/lib/utils';
import { MODULE_API_HEADING } from '../data/search';
import { ManualCode } from './ManualCode';

interface ModuleApiToolSectionProps {
  moduleId: string;
  /** Âncora do sumário "Neste tópico". */
  id?: string;
}

const LINK = cn('rounded-sm font-semibold underline underline-offset-2 hover:no-underline', BRAND_TEXT, FOCUS_RING);

/** Os exemplos do catálogo usam um endereço de mostra; no Manual vale o mesmo marcador dos outros tópicos. */
function withPlaceholderHost(text: string): string {
  return text.split(EXAMPLE_HOST).join('https://SEU-PORTAL');
}

/**
 * API REST e ferramentas MCP de um módulo: endereços, escopos, exemplo e ressalvas.
 * Tudo vem de `lib/integration-catalog.ts`, o mesmo catálogo do atalho de API dentro de cada módulo.
 */
export function ModuleApiToolSection({ moduleId, id }: ModuleApiToolSectionProps) {
  const integration = getModuleIntegration(moduleId);
  if (!integration) return null;

  const { label, tagline, rest, mcp, snippet, snippetResponse, notes } = integration;

  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className={cn('scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground', CARD_SHADOW)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id ? `${id}-titulo` : undefined} className="text-xl font-bold leading-tight tracking-tight text-foreground">
            {MODULE_API_HEADING}: {label}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{tagline}</p>
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          Cabeçalho <code className="font-code text-foreground">{API_KEY_HEADER}</code>
        </span>
      </header>

      <div className="flex flex-col gap-6 px-6 py-6">
        <div role="note" className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5">
          <p className="text-[15px] font-semibold text-foreground">Como obter a chave</p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Toda chamada leva o cabeçalho <code className="rounded-md border border-border bg-card px-1.5 py-0.5 font-code text-sm text-foreground">{API_KEY_HEADER}: ask_…</code>.
            Gere a sua em{' '}
            <Link href={API_KEY_SELF_SERVICE_PATH} className={LINK}>
              Meu espaço, na aba Conta, em Conectividade
            </Link>
            . Administradores também gerenciam as chaves em{' '}
            <Link href={API_KEY_ADMIN_PATH} className={LINK}>
              Administração
            </Link>
            .
          </p>
        </div>

        {rest.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Terminal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Endereços da API REST
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {rest.map((r) => (
                <li key={`${r.method}-${r.path}`} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        'inline-flex h-6 items-center rounded-md px-2 font-code text-xs font-bold',
                        r.method === 'GET' ? 'bg-primary/10 text-foreground dark:bg-primary/15' : 'bg-amber-500/15 text-foreground',
                      )}
                    >
                      {r.method}
                    </span>
                    <code className="break-all font-code text-sm text-foreground">{r.path}</code>
                    <span className="ml-auto rounded-full border border-border px-2.5 py-0.5 font-code text-xs text-muted-foreground">Escopo {r.scope}</span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{r.summary}</p>
                  {r.params && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground">Parâmetros:</strong> {r.params}
                    </p>
                  )}
                  {r.returns && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <strong className="font-semibold text-foreground">Retorno:</strong> {r.returns}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mcp.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Bot className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ferramentas MCP para assistentes de IA
            </h3>
            <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 lg:grid-cols-2">
              {mcp.map((tool) => (
                <li key={tool.name} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-code text-sm font-bold text-foreground">{tool.name}</code>
                    <span
                      className={cn(
                        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
                        tool.write ? 'bg-amber-500/15 text-foreground' : 'bg-primary/10 text-foreground dark:bg-primary/15',
                      )}
                    >
                      {tool.write ? 'Escrita' : 'Leitura'}
                    </span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{tool.summary}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <strong className="font-semibold text-foreground">Argumentos:</strong> {tool.params}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-foreground">Exemplo</h3>
          <ManualCode code={withPlaceholderHost(snippet)} lang={rest.length > 0 ? 'curl' : 'chamada de ferramenta'} />
          {snippetResponse && (
            <>
              <p className="text-sm font-semibold text-muted-foreground">Resposta de exemplo</p>
              <ManualCode code={snippetResponse} lang="json" />
            </>
          )}
        </div>

        {notes && notes.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3.5">
            <h3 className="text-base font-bold text-foreground">O que vale saber</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {notes.map((note) => (
                <li key={note} className="flex gap-2.5 text-[15px] leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
