/**
 * Catálogo único das superfícies de integração públicas do Espaço Ágil —
 * o que dá pra chamar de fora com uma API key, sem sessão de usuário.
 *
 * Fonte de verdade compartilhada entre a referência completa
 * (components/manual/IntegrationsSection.tsx, renderizada em /manual#integracoes)
 * e o atalho por módulo (components/shared/ModuleIntegrationDialog.tsx, aberto
 * de dentro de /knowledge/kb, /prompt-hub, /squad e /room). Editar aqui atualiza
 * os dois — não duplicar endpoint/tool direto no JSX.
 *
 * Reflete o backend Spring (agile-space-backend): REST em /api/v1/** via
 * KnowledgeApiV1Controller + o proxy fino de src/app/api/v1/**, e MCP em
 * /mcp/sse via os @Tool de com.agilespace.backend.mcp.*.
 */

export const API_KEY_HEADER = 'X-Api-Key';

/**
 * Onde a chave é criada/revogada na própria UI. Sem hash de propósito: a página
 * /admin ignora o fragmento da URL e sempre abre na primeira aba, então um
 * '#api-keys' aqui daria a impressão errada de deep link.
 */
export const API_KEY_ADMIN_PATH = '/admin';

/** Placeholder usado nos exemplos — troque pelo host real do seu ambiente. */
export const EXAMPLE_HOST = 'https://espacoagil.app';

/**
 * Host real do legado (Agile-Space, Firestore) — o app novo ainda não tem
 * deploy público, só localhost (ver LOCAL_HOSTS). Mesmo contrato de rotas
 * (/api/v1/knowledge/docs, /api/v1/prompt-hub/**), então quem for consumir a
 * API hoje (ex: ingestão pela Lynn/TOTVS) aponta pra cá, não pro EXAMPLE_HOST.
 */
export const LEGACY_PRODUCTION_HOST = 'https://espacoagil.com.br';

/** Endpoints locais, pra copiar e colar em dev. */
export const LOCAL_HOSTS = {
  /** Proxy Next (paginação 1-based, preview em texto puro). */
  frontend: 'http://localhost:9002',
  /** Backend Spring direto (Page do Spring, 0-based). */
  backend: 'http://localhost:8002/api',
  /** Transporte SSE do servidor MCP embutido no backend. */
  mcpSse: 'http://localhost:8002/mcp/sse',
  mcpMessage: 'http://localhost:8002/mcp/message',
} as const;

export interface RestEndpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  params?: string;
  returns?: string;
}

export interface McpTool {
  name: string;
  summary: string;
  params: string;
  /** true = escreve no banco (o restante é leitura). */
  write?: boolean;
}

export interface ModuleIntegration {
  id: string;
  label: string;
  /** Uma linha sobre o que dá pra fazer de fora nesse módulo. */
  tagline: string;
  rest: RestEndpoint[];
  mcp: McpTool[];
  /** Exemplo copiável — a request mais útil do módulo. */
  snippet: string;
  /** Resposta abreviada do snippet acima, quando ajuda a entender o formato. */
  snippetResponse?: string;
  /** Ressalvas reais (limites, atribuição de autoria, divergência de paginação). */
  notes?: string[];
}

export const MODULE_INTEGRATIONS: ModuleIntegration[] = [
  {
    id: 'knowledge',
    label: 'Base de Conhecimento',
    tagline: 'Listar, buscar, baixar e criar documentos da KB de fora da aplicação.',
    rest: [
      {
        method: 'GET',
        path: '/api/v1/knowledge/docs',
        summary: 'Lista documentos publicados, com busca textual.',
        params: 'q (título/conteúdo/categoria), page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ docs[], page, pageSize, total, totalPages } — cada doc traz contentPreview de 240 caracteres, sem o conteúdo inteiro',
      },
      {
        method: 'GET',
        path: '/api/v1/knowledge/docs/{id}',
        summary: 'Documento completo, com o conteúdo convertido.',
        params: 'format = html (padrão) | md | txt',
        returns: 'documento + content no formato pedido',
      },
      {
        method: 'GET',
        path: '/api/v1/knowledge/docs/{id}/download',
        summary: 'Mesma coisa, mas como arquivo para download.',
        params: 'format = md (padrão) | html | txt',
        returns: 'corpo do arquivo + Content-Disposition: attachment com o título em slug',
      },
      {
        method: 'POST',
        path: '/api/v1/knowledge/docs',
        summary: 'Cria um documento novo já publicado.',
        params: 'body { title (obrigatório), content, category, tags: string[] | "a,b,c" }',
        returns: '201 com o documento salvo',
      },
    ],
    mcp: [
      {
        name: 'listDocuments',
        summary: 'Lista documentos da KB, com busca textual opcional.',
        params: 'query?, page? (0-based), size?',
      },
      { name: 'getDocument', summary: 'Busca um documento pelo id.', params: 'id (UUID)' },
      {
        name: 'importDocument',
        summary: 'Importa/cria um documento na KB.',
        params: 'title, content, category?, tags? ("a,b,c")',
        write: true,
      },
    ],
    snippet: `curl -s "${EXAMPLE_HOST}/api/v1/knowledge/docs?q=onboarding&page=1&pageSize=20" \\
  -H "X-Api-Key: ask_SUA_CHAVE_AQUI"`,
    snippetResponse: `{
  "docs": [
    {
      "id": "8f3c...",
      "title": "Onboarding da squad",
      "category": "Processos",
      "tags": ["onboarding"],
      "byteSize": 4821,
      "status": "published",
      "updatedAt": "2026-09-01T13:22:10",
      "contentPreview": "Checklist do primeiro dia..."
    }
  ],
  "page": 1, "pageSize": 20, "total": 37, "totalPages": 2
}`,
    notes: [
      'A listagem nunca devolve o conteúdo inteiro — só o contentPreview. Para o texto completo, chame GET /docs/{id}.',
      'Documentos em lixeira (status trash/deleted) ficam fora de qualquer resposta.',
      'Toda criação, por REST ou MCP, é gravada com authorId "mcp-server": não existe atribuição por chave individual.',
    ],
  },
  {
    id: 'prompt-hub',
    label: 'Prompt Hub',
    tagline: 'Ler prompts e coleções públicas de fora da aplicação, por REST ou MCP.',
    rest: [
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/items',
        summary: 'Lista prompts/iniciativas públicos, com busca textual ou filtro por autor.',
        params: 'q, authorId, page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ items[], page, pageSize, total, totalPages }',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/items/{id}',
        summary: 'Um prompt/iniciativa pelo id.',
        returns: 'prompt completo, ou 404 (mesmo status pra inexistente ou privado)',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/collections',
        summary: 'Lista coleções públicas (trilhas de prompts).',
        params: 'ownerId, page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ collections[], page, pageSize, total, totalPages } — items de cada coleção já vêm filtrados a só os públicos',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/collections/{id}',
        summary: 'Uma coleção pública pelo id, com os prompts (públicos) embutidos.',
        returns: 'coleção + items[], ou 404 (mesmo status pra inexistente ou privada)',
      },
    ],
    mcp: [
      {
        name: 'listPrompts',
        summary: 'Lista prompts públicos, com busca textual ou filtro por autor.',
        params: 'query?, authorId?, page? (0-based), size?',
      },
      { name: 'getPrompt', summary: 'Busca um prompt pelo id.', params: 'id (UUID)' },
      {
        name: 'listPromptCollections',
        summary: 'Lista coleções públicas (trilhas de prompts).',
        params: 'ownerId?, page? (0-based), size?',
      },
      {
        name: 'getPromptCollection',
        summary: 'Busca uma coleção com os prompts embutidos.',
        params: 'id (UUID)',
      },
    ],
    snippet: `curl -s "${EXAMPLE_HOST}/api/v1/prompt-hub/items?q=retrospectiva&page=1&pageSize=10" \\
  -H "X-Api-Key: ask_SUA_CHAVE_AQUI"`,
    snippetResponse: `{
  "items": [
    {
      "id": "c53b...",
      "title": "Retro em 3 perguntas",
      "type": "prompt",
      "visibility": "public",
      "authorName": "Fulano",
      "useCount": 12,
      "forkCount": 2,
      "updatedAt": "2026-09-01T13:22:10"
    }
  ],
  "page": 1, "pageSize": 10, "total": 1, "totalPages": 1
}`,
    notes: [
      'Sempre restrito a visibility="public" — inclusive filtrando por authorId/ownerId, tanto no REST quanto no MCP: uma API key nunca enxerga mais do que um visitante anônimo veria.',
      'Coleção pública com item privado dentro: o item privado é filtrado do array, a coleção continua aparecendo.',
      'Nenhuma escrita: criar ou editar prompt continua exclusivo da UI autenticada por JWT.',
    ],
  },
  {
    id: 'squad',
    label: 'Squad',
    tagline: 'Ler status, membros e issues sincronizadas de uma squad — leitura apenas, só via MCP.',
    rest: [],
    mcp: [
      {
        name: 'getSquadStatus',
        summary: 'Resumo da squad: contagem de issues e tempo estimado/logado/restante.',
        params: 'squadId',
      },
      { name: 'listSquadMembers', summary: 'Lista os membros da squad.', params: 'squadId' },
      {
        name: 'listSquadIssues',
        summary: 'Lista as issues sincronizadas, opcionalmente de um sprint.',
        params: 'squadId, sprintId?',
      },
    ],
    snippet: `// tool call MCP
{
  "name": "getSquadStatus",
  "arguments": { "squadId": "DDWMISSI" }
}`,
    notes: [
      'Só leitura: nenhuma tool altera squad, membro ou issue.',
      'As issues devolvidas são o snapshot da última sincronização com o Jira, não uma consulta ao vivo.',
    ],
  },
  {
    id: 'poker',
    label: 'Scrum Poker',
    tagline: 'Abrir uma sala de planning poker, e buscar estimativas de rodadas já feitas.',
    rest: [
      {
        method: 'GET',
        path: '/api/v1/poker/rounds',
        summary: 'Busca estimativas de rodadas já feitas, por texto livre (tópico ou nota da rodada).',
        params: 'q (opcional; vazio lista as mais recentes), page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ rounds[], page, pageSize, total, totalPages } — cada round traz topic, issueId, devPoints, qaPoints, timestamp, roomId',
      },
    ],
    mcp: [
      {
        name: 'createPokerSession',
        summary: 'Cria uma sala de planning poker e devolve o id dela.',
        params: 'title, deckType? (padrão "fibonacci"), mode? ("sync" padrão | "async")',
        write: true,
      },
      {
        name: 'searchPokerEstimates',
        summary: 'Busca estimativas de rodadas já feitas, por texto livre (tópico ou nota).',
        params: 'query, page? (0-based), size?',
      },
    ],
    snippet: `curl -s "${EXAMPLE_HOST}/api/v1/poker/rounds?q=winthor-integracao-matcon&pageSize=20" \\
  -H "${API_KEY_HEADER}: ask_SUA_CHAVE_AQUI"`,
    notes: [
      'A sala nasce sem participantes; entre nela pela UI em /room/{id} com o id devolvido.',
      'O criador registrado é sempre "mcp-server" com papel ADMIN, não a pessoa dona da chave.',
      'Sem campo estruturado de squad/projeto no Poker — a busca é textual sobre topic/note. O nome do serviço/projeto normalmente está dentro do texto da tarefa, não numa chave separada.',
      'devPoints/qaPoints são os pontos de estimativa por papel (dev = "codificação", qa = "teste"), não uma unidade de tempo fixa — depende do deckType da sessão (fibonacci, tshirt, horas...).',
    ],
  },
];

/** Módulos sem superfície pública — documentado de propósito, evita procura inútil. */
export const MODULES_WITHOUT_INTEGRATION = [
  'Retrospectiva',
  'Daily Flow',
  'Sprint Planner',
  'Radar de Saúde',
  'Brainstorming',
  'Showcase',
  'Jolt Hub',
  'DevTools',
  'Governança',
];

export function getModuleIntegration(id: string): ModuleIntegration | undefined {
  return MODULE_INTEGRATIONS.find(m => m.id === id);
}
