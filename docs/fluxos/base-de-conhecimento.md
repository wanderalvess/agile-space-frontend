# Base de Conhecimento (wiki, busca, importação e Assistente de IA)

Descreve o que o código faz **hoje** (frontend e backend após as correções de 2026-10-09; migration V60 com índices). Suposições estão marcadas com **(suposição)**. Nada foi exercitado ao vivo (login do Portal e chave de IA reais não estavam disponíveis): leitura de código e testes unitários.

## 1. Objetivo e quem usa

Wiki compartilhada da empresa para manuais técnicos e guias, com busca, importação do TDN/Confluence e de arquivos, e um **Assistente** que responde perguntas com base nos documentos.

| Quem | O que pode |
|---|---|
| Qualquer pessoa logada | **Ler** qualquer documento, **criar** documentos, ver o histórico de versões, conversar com o Assistente |
| Autor do documento | Editar, mover para a lixeira, restaurar e restaurar versões do **próprio** documento |
| Liderança da squad do documento | Mesmo que o autor, nos documentos da squad dela. Liderança = a mesma noção de `SquadAccessService` (cargo AM/SM/PL/PO/Tech Lead/Tribe Lead/Agile Coach/SME em membro da squad, ou linha de liderança no roster), **sem** a regra de "squad sem liderança, qualquer membro gerencia" |
| Administrador (`ADMIN`) | Tudo, em qualquer documento |
| Chave de API (`X-Api-Key`) | Ler (`KNOWLEDGE_READ`) e criar (`KNOWLEDGE_WRITE`) pela API v1 e pelo MCP |

Sem login não há acesso a nada (nenhum conteúdo é público).

## 2. Telas e entradas

| Tela | Rota | Para quê |
|---|---|---|
| Base (leitura e gestão) | `/knowledge/kb` | Lista (até 200 documentos), filtros por módulo/categoria/tag, leitor com sumário, download, favoritos, sincronizar TDN |
| Novo / editar documento | `/knowledge/admin/new-asset` | Editor visual (Tiptap) + importar arquivo |
| Lixeira | `/knowledge/trash` | Documentos apagados (primeiros 100), restaurar |
| Assistente | `/knowledge/chat/[chatId]` | Conversas, lista lateral, resposta de IA |
| Configurações | `/knowledge/settings` | Chave Gemini (BYOK), modelo, total de tokens |
| Manual interno | `/knowledge/manual` | Texto de ajuda do módulo |

## 3. Fluxos principais

### 3.1 Criar, importar e salvar

```mermaid
flowchart TD
    A[Editor] --> B{Origem do conteúdo}
    B -- digitar --> E
    B -- ".txt .md .json" --> C[Lê no navegador, vira parágrafos] --> E
    B -- ".docx" --> D["POST /api/knowledge/ingest-pdf (Next)"] --> E
    B -- TDN --> T["POST /api/tdn/search e /content (Next, com login)"] --> E
    E[Salvar] --> F["Gera embedding: POST /api/knowledge/embed (Next)"]
    F --> G["POST ou PUT /api/knowledge (Spring), autor = login"]
    F -- "falhou" --> G
```

- O **embedding** (vetor de 384 números, modelo multilíngue rodando no servidor Next, sem LLM) é gerado a partir de título + até 2.000 caracteres. Se falhar, o documento salva **sem** embedding e fica de fora da busca semântica.
- `/api/knowledge/ingest-pdf` (nome histórico) aceita PDF, DOCX e texto; **a tela só oferece `.docx`, `.txt`, `.md`, `.json`**. Regras: login, 10 chamadas/min por pessoa, arquivo até 20 MB, tipo conferido **pelo conteúdo** (PDF começa com `%PDF-`, DOCX é um zip, texto sem bytes nulos), tempo máximo de 60 s na leitura, texto extraído até 1,5 milhão de caracteres, mensagens de erro em português. PDF escaneado (sem texto) devolve 422.
- Servidor (`POST/PUT /api/knowledge`): título obrigatório (até 255), conteúdo até 2 milhões de caracteres, campos de caminho até 255, até 50 tags de 100 caracteres, status só `indexed`/`published`/`deleted`. **POST ignora o `id` do corpo** (antes um POST com id existente sobrescrevia o documento e a autoria de outra pessoa). `authorId`/`updatedBy` vêm sempre do login.
- **Quem pode alterar:** editar (`PUT`), apagar (`DELETE`, marca `deleted`, `deletedAt`, `deletedBy`), restaurar da lixeira (`PUT` com status publicado, que limpa as marcas) e reimportar do TDN sobre um documento existente exigem **autor, liderança da squad do documento ou ADMIN**. Os demais recebem `403` com "Só o autor ou a liderança editam este documento." `PUT` sem status mantém o atual (antes zerava o status e o documento sumia das listas).
- **Squad do documento:** gravada no servidor na criação, a partir da squad do perfil do autor (o corpo da requisição é ignorado). Documentos criados antes da V61 não têm squad: só o autor e ADMIN editam. Documento sem autor registrado: só ADMIN.
- **`canEdit`:** toda resposta de documento (lista, leitura, criação, edição) traz `canEdit`, calculado para a pessoa logada (uma checagem de liderança por squad). A tela só mostra Editar, Excluir e Restaurar com `canEdit`; o servidor valida de novo em cada gravação.

### 3.2 Busca

| Busca | Como funciona | Limites |
|---|---|---|
| Texto (`GET /api/knowledge?query=`) | `LIKE` em título, conteúdo, categoria e caminho. Se vierem menos de 3 resultados e a busca tiver várias palavras, refaz por palavras-chave **em memória** sobre **todos** os documentos ativos | Custo cresce com o tamanho da base |
| Semântica (`POST /api/knowledge/search/semantic`) | O navegador gera o embedding da pergunta; o servidor calcula o produto escalar contra o embedding **de todos** os documentos ativos e devolve os com similaridade ≥ 0,2 | Também em memória; ver pontos frágeis |
| Filtro por tags | Aplicado depois da paginação, no servidor | Total e páginas ficam errados com filtro; a tela filtra tags no navegador e não usa isso |
| Ordem padrão | Sem ordenação pedida, mais recentemente atualizado primeiro (novo) | — |

Não há filtro de permissão porque os documentos são de toda a empresa.

### 3.3 Assistente de IA

```mermaid
sequenceDiagram
    participant U as Pessoa
    participant UI as Tela do chat
    participant N as Next /api/ai/chat
    participant S as Spring /api/knowledge
    participant G as Google Gemini
    U->>UI: pergunta
    alt sem chave configurada
        UI->>S: busca semântica e por palavra-chave (+ TDN)
        S-->>UI: documentos
        UI-->>U: lista de resultados (sem gerar texto)
    else com chave BYOK
        UI->>N: mensagens (só papel+texto) + chave
        N->>N: valida login (GET /auth/me), limita 20 req/min
        N->>S: busca semântica pela pergunta (8 documentos), com o token da pessoa
        N->>G: instruções + documentos + mensagens
        G-->>N: texto + uso de tokens
        N-->>UI: resposta inteira (sem streaming)
        UI->>S: grava pergunta e resposta na conversa; soma tokens
    end
```

- **Contexto:** prioridade para (1) documentos enviados no pedido (máx. 20), (2) os 8 mais parecidos com a pergunta por busca semântica, (3) fallback: os 50 primeiros documentos (cache de 15 min por pessoa). Cada documento é cortado em 12 mil caracteres e o total em 120 mil.
- **Mensagens:** só as últimas 20, só texto, cada uma até 8 mil caracteres. O último papel precisa ser da pessoa (senão 400).
- **Instruções:** o texto dos documentos entra entre marcadores e o prompt diz que é **dado, não instrução**. Reduz, não elimina, o risco de *prompt injection* via documento editado por alguém.
- **Provedores:** só Google Gemini com chave da pessoa (ou chave do servidor por variável de ambiente) e "Lynn" (chave global, quando configurada, `provider: 'lynn'`, hoje sem chamada na tela). Chave começando com `sk-` (OpenAI/Anthropic) é recusada com mensagem clara; as opções OpenAI/Anthropic em Configurações aparecem como "Em breve".
- **Falha:** o motor tenta `gemini-2.5-flash` e, se falhar, `gemini-1.5-flash` (pode dobrar o custo em erro de cota). Em erro a tela mostra o motivo real e **devolve a pergunta à caixa de texto**; a pergunta só é gravada no histórico junto com a resposta.
- **Tokens:** o navegador informa o total; o servidor ignora negativos e limita 200 mil por chamada. É referência de custo, não medição confiável.

### 3.4 Histórico de versões

- Toda gravação que muda **título, conteúdo ou tags** cria uma versão (número sequencial, quem alterou, data em UTC e foto de título, conteúdo, tags, categoria e caminho). Mudar só status, categoria ou tamanho não cria versão. Limite de **50 versões** por documento; as mais antigas são descartadas.
- Documentos anteriores ao histórico ganham a versão inicial (o estado de antes) na primeira edição ou na primeira vez que alguém abre a aba Histórico.
- Endpoints: `GET /api/knowledge/{id}/versions` (metadados, qualquer pessoa logada), `GET .../versions/{n}` (com conteúdo) e `POST .../versions/{n}/restore` (exige a permissão de edição). **Restaurar cria uma nova versão** com aquele conteúdo; o histórico só cresce.
- **Busca e Assistente usam só a versão vigente.** Ao mudar o texto, o servidor descarta o vetor de busca antigo (se a tela mandou um vetor novo, usa esse). Depois de restaurar, a tela gera o vetor novo e regrava o mesmo texto (isso não cria outra versão). Sem vetor, o documento fica fora da busca semântica até ser reindexado; a busca por palavra continua achando.
- API v1 e MCP leem só a versão vigente.
- Na tela: leitor do documento > aba **Histórico**: lista (versão, quem, quando, "Atual"), pré-visualização sanitizada e botão "Restaurar esta versão" com confirmação (só com permissão).

## 4. Estados e transições

- Documento: `published` / `indexed` → `deleted` (lixeira) → `published` (restaurar). Não existe exclusão definitiva e **não há purga automática** (a tela dizia "30 dias"; corrigido).
- Conversa: criada vazia (título derivado da primeira pergunta), mensagens acrescentadas uma a uma num campo JSON; até 100 mil caracteres por mensagem e 2 milhões por conversa (409 acima).

## 5. Permissões: servidor × cliente

| Ação | Servidor | Cliente |
|---|---|---|
| Qualquer rota `/api/knowledge/**` | Exige JWT (filtro) | `authFetch` |
| Editar, apagar, restaurar, restaurar versão | Autor, liderança da squad do documento ou ADMIN (403 com mensagem) | Botões só com `canEdit`; mostra a mensagem do servidor; apagar em lote só habilita quando todos os selecionados são editáveis |
| Ver histórico | Qualquer pessoa logada | Aba Histórico |
| Conversas | Só a dona (404 para as dos outros) | — |
| Rotas Next (`ai/chat`, `embed`, `ingest-pdf`, `tdn/*`, `sync-manuals`) | Exigem login (validado em `/auth/me`) | `authFetch` |
| API v1 | `X-Api-Key` + escopo; **não devolve documento da lixeira** | — |

CORS: o `@CrossOrigin("*")` com credenciais do controlador foi removido; vale a configuração global de origens.

## 6. Dados guardados (negócio)

Documentos (título, conteúdo HTML, categoria, caminho, módulo/pasta, tags, tamanho, visualizações, autor, quem alterou/apagou e quando, id do TDN, embedding), conversas (título, mensagens), configurações de IA por pessoa (modelo e **chave cifrada em repouso**) e total de tokens por pessoa.

## 7. Rotas `/api` no Caddy (produção)

O Caddy manda `/api/*` ao Spring, exceto a lista `@nextApi`: `/api/ai/*`, `/api/llms`, `/api/mock-config`, `/api/mock/*`, `/api/tdn/*`, `/api/knowledge/embed`, `/api/knowledge/ingest-pdf`, `/api/knowledge/sync-manuals`, e agora `/api/v1/knowledge/docs/*/download`.

Conferência estática de **272 chamadas** do frontend contra os controladores Spring e a lista: **nenhuma chamada sem destino**. Observações:

- `GET /api/v1/knowledge/docs/{id}/download` só existia no Next e estava anunciado no catálogo de integrações → dava 404 para consumidores externos. Corrigido incluindo o caminho em `@nextApi`. **Exige reiniciar o contêiner do proxy** (bind mount do Caddyfile; ver `ambiente-e-deploy.md`).
- `src/app/api/jira/*` (7 rotas do Next) não estão em `@nextApi`; em produção quem atende é o Spring (que tem POST equivalente). Os handlers do Next são código morto em produção.
- Sem chamador no frontend: `/api/llms` (retorna 403 fixo), `/api/mock*` e `/api/knowledge/sync-manuals`.

## 8. Pontos frágeis e o que **não** foi corrigido

- **Chave BYOK sai do servidor para o navegador.** `GET /ai-settings` devolve a chave decifrada e o navegador a manda a cada pergunta. É a chave da própria pessoa, protegida por JWT e cifrada em repouso, mas qualquer XSS a leria. A correção real é o Spring chamar o provedor (mudança de arquitetura); mascarar só no GET não resolve porque a tela precisa da chave para usá-la. Decisão do dono do produto.
- **`NEXT_PUBLIC_GEMINI_API_KEY`** é variável de **build** (`Dockerfile` e `docker-compose.yml`): se tiver valor na VM, a chave fica embutida no JavaScript público. Conferir o `.env` de produção e deixar vazia; o servidor aceita também `GEMINI_API_KEY`/`GOOGLE_API_KEY` (não públicas). Não alterei o fallback para não derrubar quem depende dele.
- **Adulteração por quem pode editar.** Agora só autor, liderança e ADMIN editam e há histórico, mas um documento adulterado ainda vira "verdade" para o Assistente até alguém restaurar. Mitigação no prompt. Não há aprovação antes de publicar.
- **Documentos antigos sem squad** só são editados pelo autor e ADMIN: se o autor saiu, só ADMIN resolve (ou um ajuste de dados no banco para preencher `squad_id`).
- **Quem muda de squad:** a squad do documento é a do autor na criação e não acompanha mudanças posteriores.
- **Liderança "da squad do documento" depende do cadastro do usuário** (cargo e roster). Quem tem cargo de liderança mas não está vinculado à squad não edita.
- **Versão só no servidor:** importação do TDN em lote cria uma versão por documento alterado (50 por documento; descarta as mais antigas).
- **Busca semântica e fallback por palavras-chave carregam todos os documentos (com conteúdo) na memória** a cada consulta. Aceitável para algumas centenas de documentos; para milhares precisa de busca vetorial no banco (pgvector) ou ao menos carregar só id+embedding.
- **Filtro por tags no servidor** fica após a paginação (total incorreto).
- **A lista da Base carrega só os 200 primeiros** e a lixeira os 100 primeiros; não há paginação na tela.
- **Gravação de mensagens de conversa** lê, altera e regrava o campo JSON inteiro; duas mensagens simultâneas na mesma conversa podem perder uma. A tela grava em sequência.
- **"Limpar Conversa"** (botão lateral) só limpa a tela; ao recarregar o histórico volta.
- **SSRF do TDN:** o domínio é validado (DNS e IPs privados) e redirecionamentos agora são bloqueados, mas continua existindo a janela entre a resolução do DNS e a conexão (DNS rebinding).
- **Limite de requisições é em memória** por processo (some ao reiniciar, não vale entre réplicas).
- **PDF não é oferecido na tela**, embora a rota o processe.
- **Fallback de modelo** pode duplicar o custo em erro de cota.
- **Importação TDN sobrescreve** o documento existente com o mesmo `tdnId`, de quem quer que seja.
- **Não testado ao vivo**: IA real, ingestão com arquivos reais, TDN, restauração da lixeira, V60.

## 9. Onde olhar no código

- Frontend: `src/app/knowledge/**` (kb, chat, settings, trash, admin/new-asset, `api.ts`), `src/components/knowledge/*`, `src/services/tdnService.ts`, `src/lib/ai-chat-context.ts`, `src/lib/file-sniff.ts`, `src/lib/text-to-html.ts`, `src/lib/embeddings.ts`, `src/lib/verify-auth.ts`, `src/lib/ssrf-guard.ts`.
- Rotas Next: `src/app/api/ai/chat`, `src/app/api/knowledge/{embed,ingest-pdf,sync-manuals}`, `src/app/api/tdn/{search,content}`, `src/app/api/v1/knowledge/docs/**`.
- Backend: `KnowledgeController`, `KnowledgeApiV1Controller`, `KnowledgeService`, `McpKnowledgeTools`, entidades `KnowledgeDocument`, `KnowledgeConversation`, `KnowledgeUserAiSettings`, `KnowledgeTokenUsage`, `Caddyfile` (lista `@nextApi`), migrations V60 e V61 (squad do documento e tabela de versões).
