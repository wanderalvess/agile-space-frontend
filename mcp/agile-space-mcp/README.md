# agile-space-mcp

Servidor MCP fino sobre APIs públicas `/api/v1/**` do Espaço Ágil.

- **Base de Conhecimento** (`/api/v1/knowledge/docs`): exposta tanto pelo legado
  (`Agile-Space`) quanto pelo rewrite (`agile-space-frontend`) com o mesmo contrato
  de rota/resposta — por isso as tools de doc trocam a base URL e a API key
  conforme o parâmetro `source` (`legacy`/`new`).
- **Prompt Hub** (`/api/v1/prompt-hub/**`): só existe aqui pro **legado**
  (`Agile-Space`, Firestore) — leitura de itens/coleções com `visibility=public`.
  O app novo (Spring) já tem essas mesmas consultas via MCP embutido próprio em
  `/mcp/sse` (`McpPromptHubTools`), então as tools de prompt não têm parâmetro
  `source` — sempre chamam o legado.

## Setup

```bash
cd mcp/agile-space-mcp
npm install
npm run build
```

Gere uma API key em `/admin` → aba **API Keys** (em cada app que for usar), depois
configure as env vars do servidor MCP (não são as mesmas do app — são só pra esse
processo MCP saber onde e com qual chave chamar cada API):

```
LEGACY_BASE_URL=https://espacoagil.com.br
LEGACY_API_KEY=ask_...
NEW_BASE_URL=https://<url-do-novo-app>
NEW_API_KEY=ask_...
```

Só precisa configurar o par que for usar — uma chamada com `source` sem a env var
correspondente falha com mensagem clara, não erro genérico.

## Uso (Claude Desktop / Claude Code)

Adicione ao `claude_desktop_config.json` (ou config MCP equivalente):

```json
{
  "mcpServers": {
    "agile-space-mcp": {
      "command": "node",
      "args": ["/caminho/absoluto/para/mcp/agile-space-mcp/dist/index.js"],
      "env": {
        "LEGACY_BASE_URL": "https://espacoagil.com.br",
        "LEGACY_API_KEY": "ask_...",
        "NEW_BASE_URL": "https://...",
        "NEW_API_KEY": "ask_..."
      }
    }
  }
}
```

## Tools

- `list_docs(source, category?, tag?, page?, pageSize?)` — lista documentos
- `search_docs(source, query, page?, pageSize?)` — busca por texto (título + conteúdo)
- `get_doc(source, id, format?)` — documento completo (`html`/`md`/`txt`, padrão `html`)
- `download_doc(source, id, format?)` — mesmo conteúdo, pronto pra salvar em arquivo (padrão `md`)
- `create_doc(source, title, content, category?, tags?)` — cria e publica um novo documento (Markdown ou HTML)

`source` é sempre `"legacy"` ou `"new"`.

Prompt Hub (só legado, sem `source`):

- `list_prompts(query?, authorId?, tag?, page?, pageSize?)` — lista prompts/iniciativas públicos
- `get_prompt(id)` — um prompt público por id
- `list_prompt_collections(ownerId?, page?, pageSize?)` — lista coleções públicas
- `get_prompt_collection(id)` — uma coleção pública por id, com os itens embutidos

## Dev

```bash
npm run dev   # roda direto via tsx, sem build
```

Debug de chamadas HTTP: `MCP_DEBUG=1` grava em `mcp_debug.log` (gitignored, nunca
grava valor de API key). Rede corporativa quebrando TLS: `MCP_ALLOW_INSECURE_TLS=1`
(nunca ligar por padrão). Antes de mexer neste diretório, veja [AGENTS.md](AGENTS.md).
