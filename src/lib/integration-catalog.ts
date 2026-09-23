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
 * Onde ADMIN/LEAD cria/revoga qualquer chave (visão global). Sem hash de
 * propósito: a página /admin ignora o fragmento da URL e sempre abre na
 * primeira aba, então um '#api-keys' aqui daria a impressão errada de deep link.
 */
export const API_KEY_ADMIN_PATH = '/admin';

/**
 * Onde qualquer usuário autenticado gera/revoga as próprias chaves — aba
 * Conectividade de /workspace (mesma ressalva de deep link do path acima:
 * a aba é estado de React, não lê fragmento da URL). Único caminho pra quem
 * não é ADMIN/LEAD; sem passar por /admin em nenhum momento.
 */
export const API_KEY_SELF_SERVICE_PATH = '/workspace';

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

/**
 * Escopo exigido — mesmos valores de com.agilespace.backend.domain.ApiKeyScope
 * no backend. Sem escopo aqui listado, ApiKeyAccess/ApiKeyContext negam com
 *403 (REST) ou erro na tool (MCP) — a única exceção é uma chave "grandfathered"
 * (criada antes desse mecanismo existir, ver ApiKey.hasFullAccessGrandfathered),
 * que passa em qualquer checagem.
 */
export type ApiKeyScope =
  | 'KNOWLEDGE_READ'
  | 'KNOWLEDGE_WRITE'
  | 'SQUAD_READ'
  | 'PROMPTHUB_READ'
  | 'PROMPTHUB_WRITE'
  | 'POKER_READ'
  | 'POKER_WRITE';

export interface RestEndpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  params?: string;
  returns?: string;
  scope: ApiKeyScope;
}

export interface McpTool {
  name: string;
  summary: string;
  params: string;
  scope: ApiKeyScope;
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
        scope: 'KNOWLEDGE_READ',
      },
      {
        method: 'GET',
        path: '/api/v1/knowledge/docs/{id}',
        summary: 'Documento completo, com o conteúdo convertido.',
        params: 'format = html (padrão) | md | txt',
        returns: 'documento + content no formato pedido',
        scope: 'KNOWLEDGE_READ',
      },
      {
        method: 'GET',
        path: '/api/v1/knowledge/docs/{id}/download',
        summary: 'Mesma coisa, mas como arquivo para download.',
        params: 'format = md (padrão) | html | txt',
        returns: 'corpo do arquivo + Content-Disposition: attachment com o título em slug',
        scope: 'KNOWLEDGE_READ',
      },
      {
        method: 'POST',
        path: '/api/v1/knowledge/docs',
        summary: 'Cria um documento novo já publicado.',
        params: 'body { title (obrigatório), content, category, tags: string[] | "a,b,c" }',
        returns: '201 com o documento salvo',
        scope: 'KNOWLEDGE_WRITE',
      },
    ],
    mcp: [
      {
        name: 'listDocuments',
        summary: 'Lista documentos da KB, com busca textual opcional.',
        params: 'query?, page? (0-based), size?',
        scope: 'KNOWLEDGE_READ',
      },
      { name: 'getDocument', summary: 'Busca um documento pelo id.', params: 'id (UUID)', scope: 'KNOWLEDGE_READ' },
      {
        name: 'importDocument',
        summary: 'Importa/cria um documento na KB.',
        params: 'title, content, category?, tags? ("a,b,c")',
        write: true,
        scope: 'KNOWLEDGE_WRITE',
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
      'Criação (REST ou MCP) grava authorId com o dono real da chave — "mcp-server" só aparece se a chave for anônima (sem ownerUserId), o que não deveria acontecer com chave gerada hoje.',
    ],
  },
  {
    id: 'prompt-hub',
    label: 'Prompt Hub',
    tagline: 'Consultar prompts/coleções públicas e publicar/atualizar skills de agentes por REST ou MCP.',
    rest: [
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/items',
        summary: 'Lista prompts/iniciativas públicos, com busca textual ou filtro por autor.',
        params: 'q, authorId, page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ items[], page, pageSize, total, totalPages }',
        scope: 'PROMPTHUB_READ',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/items/{id}',
        summary: 'Um prompt/iniciativa pelo id.',
        returns: 'prompt completo, ou 404 (mesmo status pra inexistente ou privado)',
        scope: 'PROMPTHUB_READ',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/collections',
        summary: 'Lista coleções públicas (trilhas de prompts).',
        params: 'ownerId, page (1-based, padrão 1), pageSize (padrão 20, máx 100)',
        returns: '{ collections[], page, pageSize, total, totalPages } — items de cada coleção já vêm filtrados a só os públicos',
        scope: 'PROMPTHUB_READ',
      },
      {
        method: 'GET',
        path: '/api/v1/prompt-hub/collections/{id}',
        summary: 'Uma coleção pública pelo id, com os prompts (públicos) embutidos.',
        returns: 'coleção + items[], ou 404 (mesmo status pra inexistente ou privada)',
        scope: 'PROMPTHUB_READ',
      },
      {
        method: 'POST',
        path: '/api/v1/prompt-hub/items',
        summary: 'Importa ou atualiza uma skill (formato Agent Skills / Markdown com frontmatter YAML).',
        params: 'body { title?, content, description?, tags?: string[] | "a,b,c", type?: "skill", visibility?: "public" }',
        returns: '201 com o prompt/skill salvo (idempotente por título para skills)',
        scope: 'PROMPTHUB_WRITE',
      },
    ],
    mcp: [
      {
        name: 'listPrompts',
        summary: 'Lista prompts públicos, com busca textual ou filtro por autor.',
        params: 'query?, authorId?, page? (0-based), size?',
        scope: 'PROMPTHUB_READ',
      },
      { name: 'getPrompt', summary: 'Busca um prompt pelo id.', params: 'id (UUID)', scope: 'PROMPTHUB_READ' },
      {
        name: 'listPromptCollections',
        summary: 'Lista coleções públicas (trilhas de prompts).',
        params: 'ownerId?, page? (0-based), size?',
        scope: 'PROMPTHUB_READ',
      },
      {
        name: 'getPromptCollection',
        summary: 'Busca uma coleção com os prompts embutidos.',
        params: 'id (UUID)',
        scope: 'PROMPTHUB_READ',
      },
      {
        name: 'importSkill',
        summary: 'Importa ou atualiza uma skill individual (formato Agent Skills / SKILL.md).',
        params: 'name?, content, description?, tags?, visibility?',
        write: true,
        scope: 'PROMPTHUB_WRITE',
      },
      {
        name: 'batchImportSkills',
        summary: 'Importa múltiplas skills em lote via array JSON.',
        params: 'skillsJson (string JSON contendo [{ name?, content, description?, tags?, visibility? }])',
        write: true,
        scope: 'PROMPTHUB_WRITE',
      },
    ],
    snippet: `# 1. Listar prompts públicos:
curl -s "${EXAMPLE_HOST}/api/v1/prompt-hub/items?q=retrospectiva&page=1&pageSize=10" \\
  -H "X-Api-Key: ask_SUA_CHAVE_AQUI"

# 2. Subir ou atualizar uma skill (SKILL.md com YAML frontmatter):
curl -X POST "${EXAMPLE_HOST}/api/v1/prompt-hub/items" \\
  -H "X-Api-Key: ask_SUA_CHAVE_AQUI" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "---\\nname: map-java-project\\ndescription: Diagnóstico arquitetural de projetos Spring Boot\\n---\\n# Guia de Mapeamento Java...",
    "type": "skill",
    "visibility": "public"
  }'`,
    snippetResponse: `{
  "id": "e9b254bc-876b-4e09-b472-132da970db2b",
  "title": "map-java-project",
  "description": "Diagnóstico arquitetural de projetos Spring Boot",
  "type": "skill",
  "visibility": "public",
  "status": "producao",
  "impact": "medio",
  "tags": ["skill"],
  "authorName": "Wanderson Alves",
  "createdAt": "2026-09-14T17:30:00Z"
}`,
    notes: [
      'Leituras sempre restritas a visibility="public" — inclusive filtrando por authorId/ownerId, tanto no REST quanto no MCP: uma API key nunca enxerga mais do que um visitante anônimo veria.',
      'Coleção pública com item privado dentro: o item privado é filtrado do array, a coleção continua aparecendo.',
      'Upload e ingestão de skills (REST POST /api/v1/prompt-hub/items ou MCP importSkill/batchImportSkills) requer o escopo PROMPTHUB_WRITE.',
      'O endpoint extrai automaticamente name/description de blocos YAML frontmatter (---) caso não sejam informados explicitamente.',
      'A importação de skills é idempotente por título: se o autor ou sistema já possuir uma skill com o mesmo nome, o conteúdo existente é atualizado em vez de duplicar.',
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
        scope: 'SQUAD_READ',
      },
      { name: 'listSquadMembers', summary: 'Lista os membros da squad.', params: 'squadId', scope: 'SQUAD_READ' },
      {
        name: 'listSquadIssues',
        summary: 'Lista as issues sincronizadas, opcionalmente de um sprint.',
        params: 'squadId, sprintId?',
        scope: 'SQUAD_READ',
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
      'Chave com squadId travado (toda chave self-service com SQUAD_READ) só lê a própria squad — pedir squadId de outra squad dá erro, não devolve vazio. Chave sem squadId (as de ADMIN/LEAD) lê qualquer squad, igual antes.',
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
        scope: 'POKER_READ',
      },
    ],
    mcp: [
      {
        name: 'createPokerSession',
        summary: 'Cria uma sala de planning poker e devolve o id dela.',
        params: 'title, deckType? (padrão "fibonacci"), mode? ("sync" padrão | "async")',
        write: true,
        scope: 'POKER_WRITE',
      },
      {
        name: 'searchPokerEstimates',
        summary: 'Busca estimativas de rodadas já feitas, por texto livre (tópico ou nota).',
        params: 'query, page? (0-based), size?',
        scope: 'POKER_READ',
      },
    ],
    snippet: `curl -s "${EXAMPLE_HOST}/api/v1/poker/rounds?q=winthor-integracao-matcon&pageSize=20" \\
  -H "${API_KEY_HEADER}: ask_SUA_CHAVE_AQUI"`,
    notes: [
      'A sala nasce sem participantes; entre nela pela UI em /room/{id} com o id devolvido.',
      'O criador registrado (creatorId) é o dono real da chave que chamou createPokerSession, não mais um valor fixo.',
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
  'Governança',
];

export function getModuleIntegration(id: string): ModuleIntegration | undefined {
  return MODULE_INTEGRATIONS.find(m => m.id === id);
}
