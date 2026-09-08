'use client';

import Link from 'next/link';
import { AlertTriangle, Bot, KeyRound, Network, Plug, ShieldCheck, Terminal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { cn } from '@/lib/utils';
import {
  API_KEY_ADMIN_PATH,
  API_KEY_HEADER,
  EXAMPLE_HOST,
  LEGACY_PRODUCTION_HOST,
  LOCAL_HOSTS,
  MODULE_INTEGRATIONS,
  MODULES_WITHOUT_INTEGRATION,
} from '@/lib/integration-catalog';

const CURL_LIST = `curl -s "${EXAMPLE_HOST}/api/v1/knowledge/docs?q=onboarding&page=1&pageSize=20" \\
  -H "${API_KEY_HEADER}: ask_SUA_CHAVE_AQUI"`;

const NODE_FETCH = `const BASE = '${EXAMPLE_HOST}';
const KEY = process.env.AGILE_SPACE_API_KEY;

// 1. acha os documentos
const lista = await fetch(
  \`\${BASE}/api/v1/knowledge/docs?q=onboarding&pageSize=50\`,
  { headers: { '${API_KEY_HEADER}': KEY } },
).then(r => r.json());

// 2. a listagem só traz contentPreview — o texto inteiro vem do detalhe
const documentos = await Promise.all(
  lista.docs.map(d =>
    fetch(\`\${BASE}/api/v1/knowledge/docs/\${d.id}?format=md\`, {
      headers: { '${API_KEY_HEADER}': KEY },
    }).then(r => r.json()),
  ),
);

console.log(documentos.map(d => d.content));`;

const MCP_CLIENT_CONFIG = `{
  "mcpServers": {
    "agile-space": {
      "url": "${LOCAL_HOSTS.mcpSse}",
      "headers": { "${API_KEY_HEADER}": "ask_SUA_CHAVE_AQUI" }
    }
  }
}`;

const SURFACE_COMPARISON = [
  {
    surface: 'REST /api/v1',
    good: 'Script, job, integração entre sistemas, planilha, webhook.',
    shape: 'HTTP síncrono, JSON, paginação 1-based.',
    icon: Terminal,
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    surface: 'MCP /mcp/sse',
    good: 'Agente de IA (Claude, Cursor, editor com MCP) que precisa descobrir sozinho o que dá pra fazer.',
    shape: 'SSE + JSON-RPC, tools autodescritas, paginação 0-based.',
    icon: Bot,
    tone: 'text-violet-600 dark:text-violet-400',
  },
];

const ERRORS = [
  { code: '401', when: 'Header X-Api-Key ausente, inválido ou de uma chave revogada.' },
  { code: '404', when: 'Documento inexistente, ou id que não é um UUID válido.' },
  { code: '400', when: 'POST sem title (único campo obrigatório na criação).' },
  { code: '500', when: 'Falha ao falar com o backend — o proxy Next não mascara: o corpo traz o status original.' },
];

/**
 * Referência completa das integrações (REST + MCP), renderizada como a seção
 * "integracoes" de /manual. Endpoints e tools vêm de lib/integration-catalog.ts,
 * o mesmo catálogo que alimenta o atalho por módulo — não repetir dado aqui.
 */
export function IntegrationsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4 space-y-6">
        <div className="w-20 h-20 bg-cyan-500/10 rounded-[2rem] flex items-center justify-center shadow-inner border border-cyan-500/10">
          <Network className="h-10 w-10 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
          Integrações <br />
          <span className="text-cyan-600 dark:text-cyan-400">& API</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Como puxar dados do Espaço Ágil de fora da aplicação — de um script, de outro sistema
          ou de um agente de IA — sem sessão de usuário logado.
        </p>

        <div className="p-6 bg-cyan-600 rounded-[2rem] text-white shadow-2xl space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
            <KeyRound className="h-4 w-4" /> Uma chave, duas portas
          </h4>
          <p className="text-sm font-medium leading-relaxed italic opacity-90">
            A mesma API key abre as duas superfícies: a REST em <code className="font-code not-italic">/api/v1</code> e o
            servidor MCP em <code className="font-code not-italic">/mcp</code>. Não existe segundo mecanismo de auth pra aprender.
          </p>
        </div>

        <div className="p-5 rounded-[2rem] border border-amber-500/30 bg-amber-500/5 space-y-2">
          <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Cobertura é parcial
          </h4>
          <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
            Só 4 módulos têm superfície pública. O resto ({MODULES_WITHOUT_INTEGRATION.join(', ')}) existe
            apenas na API interna, autenticada por JWT de sessão — e não é chamável com API key.
          </p>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-8">
        {/* 1. A CHAVE */}
        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Passo 1 · Gerar a API key
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              Sem ela, toda chamada volta 401.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-5">
            <ol className="space-y-3">
              {[
                <>
                  Vá em{' '}
                  <Link href={API_KEY_ADMIN_PATH} className="font-black text-cyan-700 dark:text-cyan-400 hover:underline">
                    Admin → Segurança → API Keys
                  </Link>{' '}
                  e clique em criar. Só quem tem acesso ao painel administrativo consegue.
                </>,
                <>
                  Dê um nome que identifique o consumidor (&quot;bot do Slack&quot;, &quot;script de backup&quot;) — é o que
                  aparece na lista depois.
                </>,
                <>
                  Copie a chave <code className="font-code text-cyan-700 dark:text-cyan-400">ask_…</code> na hora. Ela é
                  mostrada <strong>uma única vez</strong>: o banco guarda só o SHA-256, não dá pra recuperar depois.
                </>,
                <>Vazou ou não usa mais? Revogue na mesma tela — a chave para de funcionar na chamada seguinte.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                A chave vai em todas as chamadas no header{' '}
                <code className="font-code text-cyan-700 dark:text-cyan-400">{API_KEY_HEADER}</code>. A lista de chaves
                registra <code className="font-code">lastUsedAt</code>, mas <strong>não</strong> registra qual chave
                fez qual operação — não conte com isso para auditoria por consumidor.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. QUAL SUPERFÍCIE */}
        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              <Plug className="h-5 w-5 text-cyan-500" /> Passo 2 · Escolher a superfície
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              As duas leem os mesmos dados, por caminhos diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {SURFACE_COMPARISON.map(item => (
              <div
                key={item.surface}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <h4 className={cn('flex items-center gap-2 text-[11px] font-black uppercase tracking-widest', item.tone)}>
                  <item.icon className="h-4 w-4" /> {item.surface}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-black text-slate-700 dark:text-slate-300">Use quando:</span> {item.good}
                </p>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 leading-relaxed">{item.shape}</p>
              </div>
            ))}
            <div className="md:col-span-2 rounded-2xl bg-amber-500/5 border border-amber-500/25 p-4">
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Atenção à paginação:</span>{' '}
                a REST usa <code className="font-code">page</code> começando em <strong>1</strong>; as tools MCP usam{' '}
                <code className="font-code">page</code> começando em <strong>0</strong>. Mesmo dado, offset diferente — é a
                causa mais comum de &quot;faltou a primeira página&quot; ao portar código de uma pra outra.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. REST */}
        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              <Terminal className="h-5 w-5 text-emerald-500" /> REST · fazer a requisição
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              Base de Conhecimento e Prompt Hub. Squad e Poker são só MCP.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                  Este app (novo) ainda não tem deploy público
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Pra consumir agora (ex: ingestão pela Lynn/TOTVS), aponte pro legado — mesmo contrato de rotas:
                </p>
                <code className="font-code text-[12px] text-slate-700 dark:text-slate-300 break-all">
                  {LEGACY_PRODUCTION_HOST}/api/v1
                </code>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base em dev</h4>
                <code className="font-code text-[12px] text-slate-700 dark:text-slate-300 break-all">
                  {LOCAL_HOSTS.frontend}/api/v1
                </code>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  O backend Spring também responde direto em{' '}
                  <code className="font-code">{LOCAL_HOSTS.backend}/v1</code>, mas devolve o{' '}
                  <code className="font-code">Page</code> cru do Spring (0-based, conteúdo inteiro). Prefira o proxy.
                </p>
              </div>
            </div>

            {/* Uma tabela por módulo: com mais de um módulo expondo REST, uma lista
                achatada não deixaria claro a que módulo cada rota pertence. */}
            {MODULE_INTEGRATIONS.filter(m => m.rest.length > 0).map(module => (
              <div key={module.id} className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  {module.label}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[560px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Rota</th>
                        <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">O que faz</th>
                        <th className="py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Parâmetros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {module.rest.map(endpoint => (
                        <tr
                          key={`${endpoint.method}-${endpoint.path}`}
                          className="border-b border-slate-50 dark:border-slate-800/50 align-top"
                        >
                          <td className="py-3 pr-4">
                            <span
                              className={cn(
                                'inline-block px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest mr-2',
                                endpoint.method === 'POST'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              )}
                            >
                              {endpoint.method}
                            </span>
                            <code className="font-code text-[11px] text-slate-700 dark:text-slate-300">{endpoint.path}</code>
                          </td>
                          <td className="py-3 pr-4 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {endpoint.summary}
                            {endpoint.returns && (
                              <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                → {endpoint.returns}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                            {endpoint.params || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Buscar documentos — a request mínima
              </h4>
              <CodeBlock code={CURL_LIST} label="curl" />
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Trazer o conteúdo inteiro — o padrão em duas etapas
              </h4>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                A listagem devolve só um <code className="font-code">contentPreview</code> de 240 caracteres. Para o texto
                completo é preciso um segundo GET no id — de propósito, pra listar 50 documentos não trafegar megabytes.
              </p>
              <CodeBlock code={NODE_FETCH} label="Node / fetch" />
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Erros</h4>
              <ul className="space-y-2">
                {ERRORS.map(error => (
                  <li key={error.code} className="flex gap-3 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <code className="shrink-0 font-code font-black text-slate-700 dark:text-slate-300">{error.code}</code>
                    <span>{error.when}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Não há rate limit nesta versão — o controle é revogar a chave. (O repositório legado limita 60 leituras e
                20 escritas por minuto por chave.)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. MCP */}
        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              <Bot className="h-5 w-5 text-violet-500" /> MCP · conectar um agente de IA
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              Servidor embutido no backend, transporte SSE, {MODULE_INTEGRATIONS.reduce((n, m) => n + m.mcp.length, 0)} tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conexão (SSE)</h4>
                <code className="font-code text-[12px] text-slate-700 dark:text-slate-300 break-all">
                  {LOCAL_HOSTS.mcpSse}
                </code>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensagens</h4>
                <code className="font-code text-[12px] text-slate-700 dark:text-slate-300 break-all">
                  {LOCAL_HOSTS.mcpMessage}
                </code>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Configuração do cliente
              </h4>
              <CodeBlock code={MCP_CLIENT_CONFIG} label="mcp.json" />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Em produção troque o host; o path <code className="font-code">/mcp/sse</code> é fixo. O servidor se anuncia
                como <code className="font-code">agile-space-mcp-server</code> e o cliente descobre as tools sozinho no handshake.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tools por módulo</h4>
              {MODULE_INTEGRATIONS.filter(m => m.mcp.length > 0).map(module => (
                <div key={module.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    {module.label}
                  </h5>
                  <ul className="space-y-2">
                    {module.mcp.map(tool => (
                      <li key={tool.name} className="space-y-0.5">
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
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{tool.summary}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          <span className="font-black uppercase tracking-widest">Params:</span> {tool.params}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/25 p-4">
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Autoria das escritas:</span>{' '}
                tudo que uma tool MCP cria (documento importado, sala de poker) fica gravado como{' '}
                <code className="font-code">mcp-server</code>, não como a pessoa dona da chave. O transporte SSE executa a
                tool fora da thread da requisição HTTP, então o servidor não consegue saber qual chave originou a chamada.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. COBERTURA */}
        <Card className="border-none bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50">
            <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              O que existe em cada módulo
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              Nem todo módulo tem as duas superfícies — e alguns não têm nenhuma.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Módulo</th>
                    <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">REST</th>
                    <th className="py-2 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">MCP</th>
                    <th className="py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Dá pra</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULE_INTEGRATIONS.map(module => (
                    <tr key={module.id} className="border-b border-slate-50 dark:border-slate-800/50 align-top">
                      <td className="py-3 pr-4 text-[12px] font-black text-slate-700 dark:text-slate-300">
                        {module.label}
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-slate-500 dark:text-slate-400">
                        {module.rest.length > 0 ? `${module.rest.length} endpoints` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-slate-500 dark:text-slate-400">
                        {module.mcp.length > 0 ? `${module.mcp.length} tools` : '—'}
                      </td>
                      <td className="py-3 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {module.tagline}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-black uppercase tracking-widest text-slate-400">Sem integração pública:</span>{' '}
                {MODULES_WITHOUT_INTEGRATION.join(', ')}. Esses módulos só respondem à API interna com JWT de sessão —
                uma API key não abre nada neles.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
