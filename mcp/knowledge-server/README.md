# agile-space-knowledge-mcp

Servidor MCP fino sobre a API pública da Base de Conhecimento (`/api/v1/knowledge/docs`),
exposta tanto pelo legado (`Agile-Space`) quanto pelo rewrite (`agile-space-frontend`).
Não duplica lógica por app — os dois expõem o mesmo contrato de rota/resposta, então
esse servidor só troca a base URL e a API key conforme o parâmetro `source`.

## Setup

```bash
cd mcp/knowledge-server
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
    "agile-space-knowledge": {
      "command": "node",
      "args": ["/caminho/absoluto/para/mcp/knowledge-server/dist/index.js"],
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

## Dev

```bash
npm run dev   # roda direto via tsx, sem build
```
