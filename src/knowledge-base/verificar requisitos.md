# Requisitos do Sistema — Chat com Base de Conhecimento em Markdown

Documento de especificação para implementação do zero. Descreve um assistente de chat corporativo alimentado por **modelos Claude (Anthropic)** que responde com base em uma **base de conhecimento curada em arquivos Markdown**, com painel administrativo, autenticação local e histórico persistente.

> Pode ser adaptado para qualquer domínio (suporte interno, atendimento acadêmico, helpdesk de TI, FAQ institucional, etc.). O exemplo original é um assistente de suporte para um sistema de gestão pública.

---

## 1. Visão geral

Um aplicativo web multi-usuário onde:

- O **admin** cadastra usuários, configura o provedor LLM e mantém a base de conhecimento.
- O **usuário comum** conversa com o assistente, que responde **fielmente** com base nos `.md` da KB e **cita a fonte** de cada informação.
- Todo o histórico (conversas e mensagens) é persistido por usuário.
- O admin pode escolher em runtime entre **Anthropic API** (chave direta) ou **Claude Enterprise/OAuth**.

### Objetivo
Reduzir o tempo de resposta em suporte/atendimento, padronizando respostas a partir de documentação controlada e versionada, sem permitir que o modelo "invente" respostas fora da base.

---

## 2. Requisitos funcionais

### RF-01 — Autenticação local
- Login por **e-mail + senha** (senha em hash **bcrypt**, mínimo 12 rounds).
- Sessão baseada em **cookie httpOnly** com JWT.
- Logout invalida a sessão no servidor.
- Proteção contra **força bruta** por rate-limit por IP (ex.: 5 tentativas / 5 min).

### RF-02 — Admin bootstrap via variáveis de ambiente
- Ao subir a aplicação, se não houver usuário admin no banco, criar um a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD` (env).
- O admin criado com credenciais do env **deve ser obrigado a trocar a senha** no primeiro login (flag `deve_trocar_senha=true`).

### RF-03 — CRUD de usuários (apenas admin)
- Listar, criar, editar, desativar e resetar senha de usuários.
- Campos: e-mail, nome, papel (`admin` | `user`), status (ativo/inativo).
- Reset de senha gera uma senha temporária e marca `deve_trocar_senha=true`.
- Usuários **nunca são deletados fisicamente** (apenas `ativo=false`), para preservar histórico e auditoria.

### RF-04 — Chat com o assistente
- Tela principal com composer de mensagem e área de conversa.
- Envio de mensagem dispara **streaming SSE** da resposta token-a-token.
- Suportar **Markdown** na resposta, incluindo código com highlight, listas, tabelas, fórmulas (KaTeX) e diagramas (Mermaid).
- Exibir **modelo utilizado**, latência e contagem de tokens in/out por mensagem.
- Permitir **anexar imagens** (até 10 por mensagem) via upload — pré-visualização antes do envio.
- Botão "parar" que cancela o streaming.
- Botão "copiar" em cada resposta.

### RF-05 — Histórico de conversas
- Sidebar com lista de conversas do usuário, ordenada por data (desc).
- Clicar na conversa retoma contexto completo.
- Renomear título da conversa (inline ou modal).
- Arquivar / deletar (soft-delete: marca `deletada_em`).
- **Tópicos**: usuário pode agrupar conversas em tópicos (similar a canais Discord). Tópico "Recentes" é implícito para conversas sem tópico.
- Título da conversa é gerado automaticamente a partir da primeira mensagem (usando o próprio Claude com prompt curto).

### RF-06 — Exportação de conversas
- Exportar conversa individual em **Markdown** ou **JSON**.
- Exportar **todas as conversas** do usuário em ZIP (portabilidade — LGPD).

### RF-07 — Base de conhecimento (gerenciada pelo admin)
- Estrutura em 3 níveis: **Módulo → Pasta → Arquivo**.
- Cada nível tem slug, nome, descrição e ordem de exibição.
- Arquivo contém o conteúdo em **Markdown**.
- Admin pode criar/editar/remover qualquer nível via painel.
- Fluxo inicial permite também carregar `.md` de um diretório no disco (seed).
- Ao responder, o assistente **cita a fonte** (caminho virtual: `modulo/pasta/arquivo.md`).

### RF-08 — Estratégia de recuperação (v1)
- **Full-context retriever**: concatena todos os `.md` da KB no system prompt.
- Usar **prompt caching da Anthropic** para amortizar custo (KB cacheada, só o histórico + pergunta variam).
- Interface `IKnowledgeRetriever` abstrata, preparada para futuro `VectorRetriever` (RAG com embeddings) sem retrabalho.

### RF-09 — Configuração LLM em runtime (apenas admin)
- Linha única na tabela `llm_config`. Campos:
  - `modo`: `"API"` (Anthropic API key) ou `"OAUTH"` (Claude Enterprise).
  - `api_key_encrypted` / `oauth_token_encrypted`: **cifrados com AES-256-GCM** usando chave do env `CONFIG_ENCRYPTION_KEY`.
  - `modelo`: ID do modelo default (ex.: `claude-sonnet-4-5`).
  - `available_models`: CSV de modelos liberados para o usuário escolher.
  - `temperature`, `max_tokens`, `cache_system_prompt`.
- Aplicação lê a config a cada request (com cache curto, ex.: 30s).
- Trocar provedor **não** exige redeploy.

### RF-10 — Preferência de modelo por usuário
- Cada usuário pode escolher um modelo dentre os `available_models` no seletor do chat.
- Se nulo, usa o `modelo` default da config.

### RF-11 — Templates de chamado (admin)
- Admin cadastra templates de texto (ex.: "Chamado urgente", "Chamado padrão").
- Template contém placeholders `{{campo}}` e instruções adicionais para a IA.
- No chat, usuário clica em "Exportar chamado" → escolhe template → IA preenche o template usando o histórico da conversa.

### RF-12 — Auditoria
- Toda ação administrativa relevante gera linha em `audit_log`: `user.create`, `user.update`, `user.reset_password`, `user.deactivate`, `config.update`, `kb.update`, `user.login`, `user.logout`.
- Campos: usuário, ação, detalhes (JSON, sem conteúdo sensível), IP, timestamp.
- Tela de visualização no painel admin mostra últimas 200 ações.

### RF-13 — Health check
- Endpoint `GET /api/health` retorna:
  - Status do banco (`SELECT 1`).
  - Existência da linha em `llm_config`.
  - Versão da aplicação.
- Usado por monitoramento e readiness probe.

### RF-14 — Rate limiting
- Por usuário: máx. N mensagens por janela de tempo (ex.: 30 msgs / 5 min).
- Resposta 429 com `Retry-After`.
- Implementação in-memory inicialmente; abstração pronta para Redis quando houver múltiplas instâncias.

### RF-15 — Primeiro acesso e troca obrigatória de senha
- Ao logar com `deve_trocar_senha=true`, redirecionar para `/trocar-senha` bloqueando todo o resto do app.
- Após trocar, a flag vira `false`.

---

## 3. Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | **Manutenibilidade**: camadas desacopladas (apresentação / aplicação / LLM / KB / persistência). |
| RNF-02 | **Segurança**: senhas com bcrypt (≥12 rounds), segredos via env, API keys cifradas no DB (AES-256-GCM), CSRF em forms não-GET, httpOnly + SameSite=Lax nos cookies. |
| RNF-03 | **Observabilidade**: log estruturado de requests, métricas básicas (latência média, erros, tokens consumidos). |
| RNF-04 | **Fidelidade à KB**: assistente **não inventa** — se a KB não tem a resposta, deve dizer "não encontrei na base". |
| RNF-05 | **Versionamento**: código e conteúdo da KB em Git. |
| RNF-06 | **Performance**: streaming da primeira palavra em < 2s em condições normais; uso de prompt caching. |
| RNF-07 | **Acessibilidade**: navegação completa por teclado, contraste WCAG AA, ARIA nos controles interativos. |
| RNF-08 | **Responsividade**: layout usável em ≥ 1024px (desktop-first); sidebar colapsa em ≤ 768px. |
| RNF-09 | **Tema claro e escuro** desde a v1. |
| RNF-10 | **Idioma**: PT-BR na UI e nas respostas do assistente. |

---

## 4. Stack sugerida

O aluno pode trocar por qualquer equivalente, desde que cumpra os requisitos.

| Camada | Tecnologia sugerida | Alternativas |
|---|---|---|
| Frontend | Next.js 15+/16 (App Router) + React 19 + TypeScript | Remix, SvelteKit, Nuxt |
| Estilo | Tailwind CSS 4 + daisyUI | Chakra UI, Material UI |
| Autenticação | NextAuth 5 (Credentials provider) + bcrypt-ts | Auth.js, lucia-auth, Passport |
| LLM SDK | Vercel AI SDK 6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`) | SDK oficial `@anthropic-ai/sdk` |
| Auth OAuth opcional | `@anthropic-ai/claude-agent-sdk` | — |
| Banco | SQL Server (ou PostgreSQL/MySQL) | Qualquer relacional |
| ORM | Prisma 6 | Drizzle, TypeORM, Kysely |
| Validação | Zod | Yup, Valibot |
| UI de streaming | `@ai-sdk/react` + componentes `ai-elements` | Implementação manual com SSE |
| Testes E2E | Playwright | Cypress |
| Lint/Format | Biome ou ESLint + Prettier | — |

---

## 5. Modelo de dados

### Tabelas principais

```text
users
  id                PK bigint autoincrement
  email             unique nvarchar(255)
  nome              nvarchar(255)
  senha_hash        nvarchar(255)
  role              nvarchar(20)  -- 'admin' | 'user'
  ativo             bool default true
  deve_trocar_senha bool default false
  preferred_model   nvarchar(100) null
  criado_em         datetime
  ultimo_login_em   datetime null

sessions
  id           PK bigint
  user_id      FK -> users.id
  token_hash   nvarchar(255)
  ip           nvarchar(45)
  user_agent   nvarchar(500)
  criada_em    datetime
  expira_em    datetime
  encerrada_em datetime null

conversation_topic
  id           PK bigint
  user_id      FK -> users.id
  nome         nvarchar(120)
  ordem        int

conversations
  id           PK bigint
  user_id      FK -> users.id
  topic_id     FK -> conversation_topic.id null
  titulo       nvarchar(255)
  criada_em    datetime
  atualizada_em datetime
  arquivada    bool default false
  deletada_em  datetime null

messages
  id              PK bigint
  conversation_id FK -> conversations.id
  role            nvarchar(20) -- 'user' | 'assistant' | 'system'
  conteudo        nvarchar(max)
  criada_em       datetime
  modelo          nvarchar(100) null
  tokens_in       int null
  tokens_out      int null
  latency_ms      int null
  fontes_citadas  nvarchar(max) null -- JSON com caminhos dos .md citados
  deletada_em     datetime null

message_attachment
  id              PK bigint
  message_id      FK -> messages.id null -- null = órfão até envio
  conversation_id FK -> conversations.id null
  user_id         FK -> users.id
  tipo            nvarchar(20) default 'image'
  filename        nvarchar(255)
  content_type    nvarchar(100)
  size_bytes      int
  storage_key     nvarchar(500) -- caminho local ou S3 key
  width, height   int null
  criado_em       datetime

knowledge_module
  id            PK bigint
  slug          unique nvarchar(80)
  nome          nvarchar(255)
  descricao     nvarchar(max) null
  ordem         int

knowledge_folder
  id            PK bigint
  module_id     FK -> knowledge_module.id
  slug          nvarchar(80)
  nome          nvarchar(255)
  descricao     nvarchar(max) null
  ordem         int
  UNIQUE(module_id, slug)

knowledge_file
  id            PK bigint
  folder_id     FK -> knowledge_folder.id
  slug          nvarchar(120)
  nome          nvarchar(255)
  conteudo      nvarchar(max)  -- markdown
  ordem         int
  UNIQUE(folder_id, slug)

ticket_template
  id            PK bigint
  slug          unique nvarchar(80)
  nome          nvarchar(255)
  descricao     nvarchar(max) null
  instrucoes_ia nvarchar(max) null
  template      nvarchar(max)
  ativo         bool default true
  ordem         int

llm_config
  id                     PK int default 1  -- linha única
  modo                   nvarchar(10) -- 'API' | 'OAUTH'
  api_key_encrypted      nvarchar(max) null
  oauth_token_encrypted  nvarchar(max) null
  oauth_expires_at       datetime null
  modelo                 nvarchar(100)
  available_models       nvarchar(max) null -- CSV
  temperature            float default 0.3
  max_tokens             int default 4096
  cache_system_prompt    bool default true
  atualizado_em          datetime
  atualizado_por         FK -> users.id null

audit_log
  id         PK bigint
  user_id    FK -> users.id null
  acao       nvarchar(100)
  detalhes   nvarchar(max) null -- JSON
  ip         nvarchar(45)
  criado_em  datetime
```

### Índices importantes
- `users(email)` — lookup em login.
- `sessions(token_hash)`, `sessions(user_id)`.
- `conversations(user_id, atualizada_em desc)` — listagem da sidebar.
- `messages(conversation_id, criada_em)` — leitura do histórico.
- `audit_log(criado_em desc)`.

### Integridade referencial
No SQL Server, **ciclos de cascade** não são permitidos. Usar `ON DELETE NO ACTION` em FKs de `conversations.user_id` e `message_attachment`. Exclusão física de usuário não é suportada — usar `ativo=false`.

---

## 6. Rotas da aplicação

### Páginas
| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Público | Tela de login |
| `/trocar-senha` | Usuário com flag `deve_trocar_senha` | Forçada no 1º login |
| `/` | Usuário autenticado | Novo chat |
| `/chat/[id]` | Dono da conversa | Retomar conversa |
| `/admin` | Admin | Dashboard com contadores |
| `/admin/usuarios` | Admin | CRUD de usuários |
| `/admin/config` | Admin | Configuração LLM |
| `/admin/knowledge` | Admin | Gestão da KB |
| `/admin/ticket-templates` | Admin | Templates de chamado |
| `/admin/auditoria` | Admin | Últimas 200 ações |

### API
| Método + Rota | Função |
|---|---|
| `POST /api/auth/login` | Login (credentials) |
| `POST /api/auth/logout` | Logout |
| `POST /api/chat` | Streaming de resposta + persistência |
| `GET  /api/conversations` | Lista do usuário |
| `GET  /api/conversations/[id]` | Detalhe com mensagens |
| `PATCH /api/conversations/[id]` | Renomear / mover de tópico / arquivar |
| `DELETE /api/conversations/[id]` | Soft-delete |
| `GET  /api/conversations/[id]/export?format=md\|json` | Download |
| `POST /api/conversations/[id]/ticket` | Gera texto de chamado a partir de um template |
| `POST /api/uploads` | Upload de imagem (retorna `attachmentId`) |
| `GET  /api/admin/users` · `POST` · `PATCH /[id]` · `POST /[id]/reset-password` | CRUD |
| `GET  /api/admin/llm-config` · `PUT` | Ler/atualizar config LLM |
| `GET/POST/PATCH/DELETE /api/admin/knowledge/...` | CRUD da KB |
| `GET/POST/PATCH/DELETE /api/admin/ticket-templates/...` | CRUD de templates |
| `GET  /api/admin/audit` | Últimas 200 ações |
| `GET  /api/health` | Health check |

---

## 7. Fluxo de uma mensagem

```
Usuário envia → POST /api/chat
  1. Middleware valida cookie de sessão → identifica userId
  2. Rate limit por userId (janela móvel)
  3. Persiste mensagem do usuário em `messages` (role='user')
  4. Resolve getLanguageModel():
     - Lê llm_config (cache 30s)
     - Decifra api_key_encrypted ou oauth_token_encrypted
     - Monta model via SDK apropriado
  5. FullContextRetriever monta system prompt:
     - Instruções de fidelidade + formato de citação
     - Conteúdo consolidado dos .md da KB
     - [cache_control: "ephemeral"] nos blocos da KB
  6. Carrega últimas N mensagens do histórico da conversa
  7. streamText({ model, system, messages, temperature, maxTokens })
  8. Stream de tokens vai por SSE para o cliente
  9. onFinish:
     - Persiste resposta em `messages` (role='assistant')
     - Grava modelo, tokens_in, tokens_out, latency_ms
     - Grava fontes citadas (extraídas da resposta via regex)
     - Atualiza conversations.atualizada_em
  10. Cliente renderiza tokens em Markdown com streamdown
```

---

## 8. Comportamento do assistente (system prompt)

O system prompt deve conter, nesta ordem:

1. **Identidade**: "Você é o assistente [Nome]. Responde perguntas sobre [domínio] em PT-BR."
2. **Regra de fidelidade**: "Use **exclusivamente** a base de conhecimento abaixo. Se a resposta não está na base, responda 'Não encontrei na base de conhecimento.' Não invente."
3. **Formato de resposta**: Markdown, citar fonte com `**Fonte:** caminho/do/arquivo.md` ao final.
4. **Tom**: profissional, direto, sem enrolação.
5. **Base de conhecimento**: blocos `## modulo/pasta/arquivo.md` + conteúdo, um por arquivo, todos cacheados.

Validação: após gerar, extrair as citações. Se a resposta afirma algo e não cita fonte, marcar como "possível alucinação" no log (não bloqueia).

---

## 9. Segurança

- **Senhas**: bcrypt com ≥12 rounds. Nunca logar senha em nenhum nível.
- **API keys no DB**: cifra simétrica AES-256-GCM. Chave em `CONFIG_ENCRYPTION_KEY` (env). Nonce random por linha, prefixado no ciphertext.
- **Cookies**: `httpOnly`, `Secure` (em prod), `SameSite=Lax`, expiração 7 dias com sliding.
- **CSRF**: token em formulários server-action; métodos não-GET rejeitam origem cruzada.
- **Input**: validar todos os inputs com Zod (DTOs explícitos).
- **Output**: sanitizar HTML renderizado de Markdown (Streamdown faz por padrão).
- **Uploads**: limitar tamanho (ex.: 5 MB/imagem), validar MIME (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), regenerar nome com nanoid.
- **Autorização**: toda rota `/admin/*` e `/api/admin/*` checa `role === 'admin'`. Conversas acessíveis apenas pelo dono.
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP restrito.

---

## 10. Variáveis de ambiente

```env
# Obrigatórias
DATABASE_URL=sqlserver://host:1433;database=base_chat_ai;user=app;password=...;encrypt=true
AUTH_SECRET=...                 # openssl rand -base64 32
CONFIG_ENCRYPTION_KEY=...       # openssl rand -base64 32 (AES-256-GCM)
ADMIN_EMAIL=admin@empresa.com
ADMIN_PASSWORD=...              # usado só no bootstrap inicial

# Opcionais
UPLOAD_DIR=./uploads            # ou S3_BUCKET + credenciais
LOG_LEVEL=info
RATE_LIMIT_MESSAGES_PER_WINDOW=30
RATE_LIMIT_WINDOW_SECONDS=300
```

---

## 11. Scripts (npm / pnpm)

```bash
pnpm install

pnpm db:generate         # gera cliente ORM
pnpm db:migrate:dev      # cria + aplica migration (dev)
pnpm db:migrate:deploy   # aplica migrations pendentes (prod)
pnpm db:bootstrap        # cria admin + seed llm_config (idempotente)
pnpm db:studio           # GUI do banco

pnpm dev                 # servidor de desenvolvimento
pnpm build && pnpm start # produção
pnpm test                # Playwright E2E
pnpm check / fix         # lint/format
```

### Script de bootstrap
Idempotente. Lê `ADMIN_EMAIL` e `ADMIN_PASSWORD`:
1. Se não existe usuário com `role='admin'`, cria com `deve_trocar_senha=true`.
2. Se não existe linha em `llm_config`, insere default (modo='API', modelo padrão, temperature 0.3, max_tokens 4096).

---

## 12. Casos de uso (fluxos de teste)

### CU-01 — Primeiro uso
1. Sobe a aplicação com env configurado.
2. Acessa `/` → redireciona para `/login`.
3. Faz login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. Redireciona para `/trocar-senha`.
5. Define nova senha.
6. Vai para `/admin/config`, cola chave Anthropic, salva.
7. Vai para `/admin/knowledge`, cria módulo/pasta/arquivo e cola Markdown.
8. Vai para `/`, pergunta algo coberto pela KB → recebe resposta citando fonte.

### CU-02 — Admin cria usuário
1. Em `/admin/usuarios`, clica "Novo".
2. Preenche e-mail + nome + senha temporária.
3. Salva → usuário aparece na lista com `deve_trocar_senha=true`.
4. Envia credenciais ao usuário.
5. Usuário loga → é forçado a trocar senha.

### CU-03 — Conversa com retomada
1. Usuário inicia conversa, envia mensagem.
2. Após 1ª resposta, título é gerado automaticamente.
3. Fecha navegador.
4. Reabre → sidebar mostra a conversa.
5. Clica → contexto completo é retomado.
6. Continua a conversa.

### CU-04 — Troca de provedor em runtime
1. Admin em `/admin/config` troca de `API` para `OAUTH`.
2. Cola token OAuth, salva.
3. Próxima mensagem já usa o novo provedor, sem redeploy.

### CU-05 — Export de chamado
1. Usuário tem conversa com diagnóstico de um problema.
2. Clica em "Exportar chamado" → escolhe template "Chamado padrão".
3. IA gera texto preenchendo placeholders com dados da conversa.
4. Texto aparece em modal, botão "copiar".

### CU-06 — Pergunta fora da KB
1. Usuário pergunta algo não coberto.
2. Assistente responde: "Não encontrei na base de conhecimento."
3. Não inventa informação.

---

## 13. Testes mínimos

### Unitários
- Cifra/decifra AES-256-GCM (round-trip).
- Hash bcrypt (verify/verify-fail).
- Parser de citações a partir do texto da resposta.
- Montagem do system prompt a partir da árvore da KB.

### Integração (API)
- Login válido/inválido; bloqueio por rate-limit.
- `POST /api/chat` rejeita sem sessão.
- CRUD de usuários só funciona com role=admin.
- Soft-delete mantém registro no DB.

### E2E (Playwright)
- Fluxo completo do CU-01.
- Retomada de conversa (CU-03).
- Troca de senha obrigatória.
- Streaming: recebe pelo menos 1 token em < 3s.

---

## 14. Entregáveis

1. **Código fonte** em um repositório Git (GitHub/GitLab) com README de instalação.
2. **Banco** com migrations versionadas.
3. **Script de bootstrap** idempotente.
4. **Dockerfile** e `docker-compose.yml` para subir app + banco.
5. **Documentação** com:
   - Diagrama de arquitetura (camadas).
   - Modelo ER do banco.
   - Fluxograma do POST /api/chat.
   - Capturas de tela das principais telas (login, chat, admin).
6. **Vídeo curto** (3-5 min) demonstrando os fluxos CU-01 a CU-04.
7. **Apresentação** (10-15 slides) com: problema, solução, arquitetura, decisões técnicas, demo, limitações, roadmap.

---

## 15. Critérios de aceite

- [ ] Admin consegue subir app do zero seguindo só o README.
- [ ] Primeiro login força troca de senha.
- [ ] Admin configura chave Anthropic pelo painel (cifrada no DB).
- [ ] Admin cria módulo/pasta/arquivo de KB pelo painel.
- [ ] Usuário comum envia mensagem e recebe resposta em streaming.
- [ ] Resposta cita fonte (`caminho/do/arquivo.md`).
- [ ] Pergunta fora da KB resulta em "não encontrei na base".
- [ ] Conversa persiste no DB e retoma contexto após recarregar.
- [ ] Exportação em MD e JSON funciona.
- [ ] Troca de provedor (API ↔ OAUTH) não exige redeploy.
- [ ] Tema claro e escuro funcionam.
- [ ] Todos os endpoints admin bloqueiam role=user.
- [ ] API keys no DB nunca aparecem em texto claro (confirmado via `SELECT`).
- [ ] Testes E2E passam.
- [ ] Lint/format sem erros.

---

## 16. Roadmap opcional (v2+)

- Busca full-text nas conversas.
- RAG com embeddings (swap do retriever).
- Rate-limit por tokens, não só por mensagens.
- Redis para rate-limit e sessões em múltiplas instâncias.
- Exportação em lote (LGPD — portabilidade).
- Direito ao esquecimento (LGPD — deletar tudo de um usuário).
- 2FA para o admin.
- Tool use do Claude para consultar sistemas vivos.
- Feedback de usuário (👍/👎) em cada resposta, usado para curadoria da KB.

---

## 17. Referências úteis

- [Anthropic API docs](https://docs.anthropic.com/)
- [Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma + SQL Server](https://www.prisma.io/docs/orm/overview/databases/sql-server)
- [NextAuth v5](https://authjs.dev/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)