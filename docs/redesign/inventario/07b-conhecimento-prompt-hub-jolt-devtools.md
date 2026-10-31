# 7b. Conhecimento, Prompt Hub, Jolt e DevTools — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/src/`. **Nenhuma destas telas usa WebSocket ou Firebase**: tudo é REST (`authFetch`) ou `localStorage`/`sessionStorage`.

---

## A. Conhecimento (Wiki Space) — `/knowledge/**`

### Rotas

| Rota | Arquivo | Linhas | Papel |
|---|---|---|---|
| (layout) | `app/knowledge/layout.tsx` | 154 | Cabeçalho da área, `GlobalSearch`, `KnowledgeGuide` |
| `/knowledge` | `page.tsx` | 47 | **Redireciona para `/knowledge/chat`** (não há dashboard) |
| `/knowledge/admin` | `admin/page.tsx` | 5 | Redireciona para `/knowledge/kb` |
| `/knowledge/admin/new-asset[?id=]` | `admin/new-asset/page.tsx` | 481 | Editor Tiptap (cria/edita) |
| `/knowledge/chat` | `chat/page.tsx` | 23 | Gera slug e redireciona |
| `/knowledge/chat/[chatId]` | `chat/[chatId]/page.tsx` | 678 | Assistente virtual |
| `/knowledge/kb[?id=]` | `kb/page.tsx` | 1181 | Lista, gestão e leitor |
| `/knowledge/manual` | `manual/page.tsx` | 117 | **Órfã** (nenhum link) |
| `/knowledge/settings` | `settings/page.tsx` | 215 | Chave BYOK e consumo de tokens |
| `/knowledge/trash` | `trash/page.tsx` | 202 | Lixeira |

Clients `knowledge/api.ts` (150), `knowledge/chat/api.ts` (124). Componentes `GlobalSearch` (237), `DocumentHistory` (177), `TdnImportDialog` (416), `KnowledgeGuide` (143). Serviços `tdnService` (247), `oracleService` (111), `useTdnSettings`, `lib/knowledge-export`, `knowledge-types`, `sanitize-html`, `text-to-html`. Rotas Next: `api/ai/chat`, `api/knowledge/embed`, `api/knowledge/ingest-pdf`, `api/tdn/search`, `api/tdn/content`.

### Estados
- Layout sem login: só conteúdo, sem cabeçalho.
- KB: spinner; modo leitor (documento selecionado); modo gestão; "Nenhum documento encontrado nesta busca"; toast de erro.
- Leitor: abas Documento / Histórico (carregando, erro + "Tentar de novo", vazio, "Escolha uma versão").
- Chat: vazio com 4 sugestões; esqueleto pulsante; **com chave** chama Gemini (`/api/ai/chat`); **sem chave ("Busca Simples")** faz busca semântica → palavra-chave → TDN e mostra "Configurar Chave".
- Settings: "Recuperando Chave Cifrada"; `loadFailed` desabilita Salvar.
- Trash: carregando, "A lixeira está vazia", lista.
- GlobalSearch: carregando; sem termo "Sugestões do Sistema" (5 recentes); "Resultados"; "Vácuo de Detecção" + "Resetar Parâmetros".
- TdnImportDialog: modo Configuração / Busca; "Aguardando termo de pesquisa".

### Ações
- **Cabeçalho:** "Portal" (`/`); logo (`/knowledge`); nav Base de Conhecimento / Assistente Virtual / Ajustes (**só xl+; abaixo não há menu**); "Pesquisar Wiki..." com **⌘K/Ctrl+K**; tema; ajuda; "Criar".
- **KB gestão:** "Buscar e Importar TDN" (sem config → toast "Configurar" → `/workspace`); "Sincronizar Manuais" (todos com `tdnId`); "Lixeira"; "Criar Artigo"; "Consumir via API & MCP"; busca local (título, categoria, pasta, conteúdo); sidebar xl (Módulo/Pasta com contagem, Categoria, Rótulos com busca e "Limpar"); chips de filtros ativos; tabela com selecionar todos/por linha, título abre leitor, Baixar `.md`, Editar/Excluir (`canEdit`); lote Sincronizar/Baixar/Excluir (N) — Excluir desabilita se algum não é editável; painel "N documentos falharam na sincronização".
- **KB leitor:** trilha "Base de Conhecimento"; ★ favoritar; "Sincronizar" (TDN); "Exportar" (formato); "Editar"; barra de progresso de leitura; sumário "Nesta página"; Histórico com prévia e "Restaurar esta versão" (confirmação).
- **new-asset:** voltar; negrito/itálico/sublinhado; H1/H2; listas; bloco de código; "Importar" (`.txt`, `.md`, `.json`, `.docx` via `ingest-pdf`); "Salvar"; sidebar xl: Título, Categoria (Processo, Técnico, Negócio, Suporte), Localização com até 5 atalhos de caminhos, Status (published/draft/archived). Título e conteúdo obrigatórios.
- **Chat:** "Nova Consulta"; conversas recentes com prévia; excluir conversa (hover); "Limpar Conversa"; gaveta no mobile; sugestões só preenchem; Enter envia; copiar mensagem (hover); cartão de documento abre `/knowledge/kb?id=` em nova aba; TDN: abrir link ou "Importar"; "Configurar Chave".
- **Settings:** motor (só Gemini; OpenAI/Anthropic "Em breve"); "Obter Chave"; chave com mostrar/ocultar; Salvar.
- **Trash:** "Voltar ao Painel" (history back); busca; "Restaurar" (`canEdit`); exclusão permanente só mostra "não suportado".
- **GlobalSearch:** debounce 300ms; resultado abre `/knowledge/kb?id=`.
- **TdnImportDialog:** engrenagem alterna config/busca; Base URL, Token (Bearer), Space, Label; busca; por resultado: abrir original, baixar `.md`, "Importar"/"Atualizar".

### Painéis
Cabeçalho fixo; KB com sidebar de filtros, destaque (Artigos ativos, MB usados, Do TDN) e tabela; leitor com cabeçalho, progresso, abas e sumário; new-asset com editor + "Metadados do Ativo" + "Análise do Ativo"; chat com sidebar, mensagens e input fixo; settings com motor/chave, "Uso de Tokens", "Sobre o Consumo".

### Modais
GlobalSearch (Dialog), KnowledgeGuide (Sheet), TdnImportDialog (Dialog), "Escolher Formato" (`.md`, `.html`, `.txt`), confirmação de restaurar versão, `confirm()` ao excluir um/vários, gaveta do chat. Toasts: KB e new-asset com `sonner`; chat e settings com `useToast`.

### Dados
- `GET /knowledge?query&tags&status&page&size`, `GET/PUT/DELETE /knowledge/{id}` (DELETE manda para a lixeira), `POST /knowledge`, `GET /knowledge/{id}/versions[/{n}]`, `POST .../versions/{n}/restore`, `POST /knowledge/{id}/view`, `POST /knowledge/search/semantic?size=`.
- Embeddings via `POST /api/knowledge/embed` (transformers.js local) antes de salvar e buscar.
- Chat: `GET/POST /knowledge/conversations`, `GET/PUT/DELETE /knowledge/conversations/{id}`, `POST .../messages`, `GET/PUT /knowledge/ai-settings`, `GET /knowledge/token-usage`, `POST /knowledge/token-usage/increment`, `GET /knowledge/token-usage/top` (admin).
- IA: `POST /api/ai/chat` `{messages, apiKey}` — Gemini por BYOK ou env; RAG via `/knowledge/search/semantic` e `/knowledge`.
- TDN: `POST /api/tdn/search|content` (30s); config em `GET/PUT /users/{id}/tdn-config`.
- Palavra-chave: cache Zustand de 10 min sobre `/knowledge?size=500`, top 5.
- `POST /api/knowledge/ingest-pdf` (multipart; servidor aceita PDF e DOCX).
- localStorage `kb_favorites`.

### Papéis
`canEdit` vem do servidor (autor ou liderança/admin) e controla Editar, Excluir, Restaurar e Restaurar versão. new-asset com `canEdit=false` redireciona ao leitor. "Criar" para qualquer logado. Conversas e configurações de IA por usuário.

### Detalhes fáceis de perder
- `/knowledge` cai no chat, não no KB.
- Exportar no leitor tem 3 formatos; na tabela só `.md`.
- Sync TDN reconverte macros do Confluence, adiciona rodapé "Documento importado do TDN" e prefixo `[TDN]`.
- Conversa criada no 1º envio, título com até 30 caracteres; pergunta volta ao campo em erro; persiste par pergunta/resposta e registra tokens.
- Restaurar versão cria versão nova e reindexa; lixeira restaura com PUT do documento inteiro.
- **KB filtra só os primeiros 200 documentos** (sem paginação).
- Settings guarda `model`, mas o chat não envia.

### Morto, fake ou quebrado
- **KB sem login: spinner infinito**; tela "Identidade Necessária" citada não existe.
- Importar do TDN no KB não atualiza a lista; o diálogo só monta se já houver config.
- `importedIds` nunca passado (selo "Importado"/"Atualizar" nunca aparecem).
- Favoritos gravados sem lista/filtro de favoritos.
- `incrementViews` nunca chamado; rota `api/knowledge/sync-manuals` sem uso.
- Chat: clipe de anexo sem ação; `isSidebarOpen` sem botão; "Limpar Conversa" só limpa a tela; textos fake "Acesso Avançado Pro" e "V4.0.2 Premium".
- new-asset: "Otimização 98%" fixo; sem campo de tags; Importar não aceita PDF embora servidor e guia digam que sim.
- Lixeira: exclusão permanente cosmética.
- GlobalSearch anuncia "↑↓ Navegar / ↵ Selecionar" sem navegação por teclado.
- `manual/page.tsx` órfã, desatualizada, sem tema escuro.
- `KnowledgeSidebar.tsx` e `KnowledgeHowToUse.tsx` não importados.

---

## B. Prompt Hub — `/prompt-hub/**`

### Rotas

| Rota | Arquivo | Linhas | Papel |
|---|---|---|---|
| `/prompt-hub` | `page.tsx` | 158 | Gate de onboarding / landing pública / dashboard |
| (componente) | `components/Dashboard.tsx` | 1057 | Catálogo |
| `/prompt-hub/[id]` | `[id]/page.tsx` | 103 | Link compartilhável |
| `/prompt-hub/autor/[authorId]` | | 198 | Perfil do autor |
| `/prompt-hub/colecoes` | | 313 | Coleções (CRUD) |
| `/prompt-hub/colecoes/[id]` | | 180 | Trilha ordenada |
| `/prompt-hub/seed` | | 199 | Carga inicial (admin, sem link) |
| `/prompt-hub/tutorial` | | 690 | Guia "Como criar uma Skill" |

Componentes: `PromptSpecimenCard` (441), `PromptCard` (27, só repassa), `PromptView` (601), `PromptEditor` (646), `SkillImportDialog` (677), `CollectionEditor` (301). Lógica: `api.ts` (341), `types.ts`, `constants.tsx` (fonte única de tipos/status/impacto/visibilidade), `skillFrontmatter.ts`, `findSimilar.ts`, `deletePrompt.ts`, `requisitos.md`. Guia `components/prompt-hub/PromptGuide.tsx` (210).

### Estados
- `page.tsx`: spinner; gate "Conecte seu Cargo e Squad" (`mustOnboard`) com "Completar Perfil" / "Apenas Ver Modelos Públicos"; visitante → landing `ToolHubLayout`; logado → Dashboard (`isPublicView = showPublicOnly || !session`).
- Dashboard: spinner só na 1ª carga; erro com "Tentar de novo"/"Entrar" (401); faixa "só públicos" para anônimo; vazio "A biblioteca está vazia"/"Nenhum item encontrado"; Destaques e "Ateliê" só sem filtros.
- `[id]`: "Acesso restrito" e 404 (texto diferente logado/não logado).
- Autor: carregando, falha, "Nada publicado ainda". Coleções: carregando, "Nenhuma coleção ainda". Coleção: erro, "Nada para mostrar", aviso de N itens ocultos. Seed: "Área restrita"; resultado por item.
- SkillImportDialog: `pick` → `preview` → `importing`.

### Ações
- **Cabeçalho:** Integrar API/MCP (lg+), "Coleções", "Como criar uma skill", ajuda (PromptGuide), "Importar pasta", "Publicar item" (os dois últimos fora da visão pública).
- **Filtros:** tipos com contagem (sidebar xl / pílulas); visibilidade Todos/Públicos/Meus privados (sidebar / select); "Apenas Favoritos" (sidebar / ★); **"Tags Populares" top 10 só na sidebar xl**; busca sem acento (título, descrição, conteúdo, autor, objetivo, público, tags) com ✕; Status ("Sem arquivados" padrão); Impacto; ordenação Mais recentes / Mais usados / Mais clonados / A-Z; chips de tags e "Limpar filtros".
- **Card:** clique/Enter/Espaço abre; copiar link; ★; menu "⋮" do dono (Editar, Duplicar, Excluir); tag filtra; autor abre perfil; "Copiar" (conta uso), "Preencher" (com `{{variáveis}}`), "Abrir" (item-link, conta uso); selos tipo, `{{N}}`, status, visibilidade, "Entradas", trecho, contadores.
- **PromptView:** "Copiar conteúdo" com variáveis substituídas; "Abrir ferramenta" (`gemLink`); "Duplicar"; ★; compartilhar `/prompt-hub/{id}`; Editar/Excluir (dono); "Personalize antes de copiar"; "Formatado"/"Cru"; caracteres e linhas; "Ficha Técnica"; tags filtram; Discussão (4000 caracteres, excluir próprio ou qualquer se dono, `confirm`, "Tentar de novo", exige login).
- **PromptEditor:** 8 tipos; Título, Descrição, Conteúdo (rótulo/dica por tipo); "Ver tutorial" (skill); validação SKILL.md ao vivo (erros bloqueiam, avisos não); "Link da ferramenta" (Gem); aviso de itens parecidos; "Quem pode ver" (Somente eu / Público); tags (Enter, até 30, sugestões; tag não confirmada entra ao salvar); "Detalhes de iniciativa" (Objetivo, Status, Impacto, Público-alvo, Documentação); cancelar com confirmação; trava de duplo clique; links normalizados.
- **SkillImportDialog:** arrastar pastas (recursivo); "Selecionar Pasta Local" (`webkitdirectory`); "Selecionar Arquivos .md"; prévia com "Selecionar todas", "Visibilidade padrão", checkbox/nome/descrição/visibilidade por item; selos válidas/avisos/inválida; "Escolher outra pasta"; "Importar N Skills".
- **Coleções:** "Nova coleção"; card abre; menu do dono (hover) Editar/Excluir (`confirm`); CollectionEditor: Nome, Descrição, Visibilidade, buscar item (8) e adicionar, Subir/Descer, remover; exige nome e 1 item; confirma descarte.
- Autor e coleção: cards somente leitura ("Copiar" conta uso; clique abre `/prompt-hub/{id}`). Tutorial: índice com âncoras, Copiar em blocos, "Publicar minha skill" (volta ao Hub). Seed: "Executar Carga"/"Executar Novamente".

### Painéis
Dashboard: sidebar xl; busca/filtros; "Ateliê de IA" (Ativos, Execuções/Cópias); "Destaques da Bancada" (top 4 por uso); grade "Todos os itens"; rodapé; feedback. PromptView e PromptEditor em duas colunas.

### Modais
PromptView, PromptEditor, SkillImportDialog, CollectionEditor (Dialog); PromptGuide (Sheet); `confirm()` em excluir item, comentário, descartar edição, excluir coleção; toasts `sonner`; FeedbackWidget.

### Dados
- `promptApi`: `GET /prompts?query&authorId&page&size` (até 10×200), `GET/PUT/DELETE /prompts/{id}`, `POST /prompts`, `POST /prompts/skill-upsert`, `POST /prompts/batch` (recaída item a item), `POST /prompts/{id}/use|fork|clone`, `GET/POST /prompts/{id}/comments`, `DELETE .../comments/{cid}`.
- `publicPromptApi` (sem token): `GET /public/prompt-hub/items[/{id}]`.
- `promptCollectionApi`: `GET/POST /prompts/collections`, `GET/PUT/DELETE /prompts/collections/{id}`, `POST/DELETE /prompts/collections/{cid}/items/{pid}`.
- `ApiError` com mensagens por status.
- **Favoritos só no navegador** (`favorites_{userId}` / `favorites_anonymous`).
- Sem IA no Hub.

### Papéis
Anônimo lê só públicos (sem publicar, favoritar, duplicar, comentar ou ver autor). Logado vê públicos + próprios. Dono edita/exclui item e qualquer comentário do item. Autor do comentário exclui o próprio. Seed só admin. Dono da coleção edita/exclui. `mustOnboard` bloqueia até completar perfil ou escolher "só públicos".

### Detalhes
`{{variavel}}` vira campo (`${{x}}` ignorado); substituição numa passada; Duplicar abre o editor da cópia; contagens por tipo não zeram ao filtrar; destaques só sem filtros e com uso > 0; tags minúsculas sem `#` (100); sem status = "producao", sem impacto = "medio"; coleção não muda visibilidade dos itens; limites título 255, descrição 10 mil, conteúdo 200 mil. Reusado em `workspace/MyPrompts`.

### Morto, fake ou quebrado
- **SkillImportDialog oferece "Squad"**, que está marcada como indisponível → itens importados como Squad ficam invisíveis para os outros.
- Selo "com avisos" conta itens com erro.
- **Link compartilhado não conta uso** e não tem Duplicar, Favoritar, Editar nem filtro por tag.
- Perfil do autor: tag volta ao Hub e perde o filtro; exige login.
- Coleção: "Copiar" chama `usePrompt` sem login e engole o erro.
- **Não existe "adicionar à coleção" no card nem na visualização** (`addItemToCollection` sem uso).
- `forkPrompt` sem uso; `PromptCollection.updatedAt` = `createdAt`; `requisitos.md` desatualizado.
- Mobile sem "Tags Populares"; `GripVertical` decorativo na coleção.
- Tutorial: "Padrões da empresa" vazio. Card "Explorar sem login" sem `onClick`.
- Seed usa `[DESCREVA...]` e grava contadores de uso/clone falsos.

---

## C. Jolt — `/jolt/**`

### Rotas
| Rota | Arquivo | Linhas | Papel |
|---|---|---|---|
| `/jolt` | `app/jolt/page.tsx` | 212 | Hub estático (2 modos, fluxo, referência) |
| `/jolt/gerador` | `gerador/page.tsx` | 639 | Spec a partir de exemplo (3 etapas) |
| `/jolt/sandbox` | `sandbox/page.tsx` + `SandboxPane.tsx` | 970 + 111 | Laboratório com 3 Monaco |

Componentes `components/jolt/`: `GithubIntegrationBar` (178), `useGithubLayouts` (304), `JoltMaintenancePanel` (402), `RouteRecordPanel` (198), `JoltGuide` (143); mortos `JoltPanel` (174), `JoltNicknameDialog` (86). Libs: `jolt-engine`, `jolt-lite` (1126, motor JS local), `jolt-generator`, `jolt-route-record`, `jolt-maintenance` (629), `jolt-compare`, `jolt-parser`; `services/joltService`.

### Estados
- Gerador: etapas Exemplos → Regras → "Spec e validação" (2 e 3 só após resultado); erro de parse por caixa; busy; erro geral; validação "bate com a esperada"/"cumpre o contrato", diferenças ou "o motor recusou a spec"; textos mudam em modo `CONTRATO`.
- Sandbox: LoadingScreen até hidratar; Executando/Comparando; estatística (motor, ms); erros de JSON com linha/coluna.

### Ações
- **Hub:** "Abrir Sandbox", "Abrir Gerador", "JSON Studio no DevTools".
- **Gerador:** Entrada + Saída esperada + "Gerar regras"; filtro Todos / A confirmar / Calculados / Fixos e variáveis; seção "A confirmar" e grupos por escopo; "Ajustar" abre `RuleEditor` (tipo, "Vem de", valor fixo, de-para com "Qualquer outro", "Desfazer ajuste"); barra fixa "Exemplos" / "Aplicar ajustes" / "Gerar spec"; abas LAYOUTTRANSFORMACAO / "Registro completo da rota"; "Copiar"; "Abrir na Sandbox"; `RouteRecordPanel` ("Carregar registro", Serviço, Empresa, Tipo BUSCAR/ENVIAR, método, URL, cabeçalhos e parâmetros chave/valor, flags Ativo / Disponível na URL WTA / Autenticador / Só atualizar integração core, variáveis, problemas).
- **Sandbox:** "Gerador de spec" (leva a entrada), "Guia", "Jolt"; "Meus layouts" (select), excluir (AlertDialog), Salvar/Atualizar; motor JS ou Java; "Comparar"; "Executar"; legenda dispensável; GithubIntegrationBar (nome, URL de origem, repositório padrão `totvs/winthor-smart-hub-layouts`, "Carregar", Integração → Rota (combobox) → Versão (tag)); Entrada (Colar, Formatar, Copiar); Spec ("Manutenção", "Layout completo" Copiar/Baixar `.json`, "Modelos" shift/modify/default/cardinality/remove que **substituem a spec**, Colar, Formatar, Copiar); Resultado (Limpar, Copiar, selo motor/ms).
- **JoltMaintenancePanel (Sheet):** "Adicionar campo" (campo da entrada, destino, prévia, "Adicionar ao layout"); "Desfazer a última alteração"; "campos não usados" (preenche o formulário); mapeamentos com filtro, remover (confirmação), editar destino; reexecuta se já havia resultado.

### Modais
JoltGuide e JoltMaintenancePanel (Sheet); "Comparação de Motores JOLT" (até 50 diferenças, nota "só ordem de chaves", saídas JS/Java com tempos); AlertDialog "Excluir Layout?"; toasts em quase todas as ações.

### Dados
- `POST /api/jolt/transform` (motor Java Bazaarvoice); `POST /api/jolt/generate` (inferência + overrides + validação; alimenta "glossário da equipe").
- GitHub sem token: `api.github.com/repos/{repo}/tags`, `.../git/trees/{tag}?recursive=1`, `raw.githubusercontent.com/...`; cache em `sessionStorage`.
- localStorage: `agileSpace_jolt_layouts_{userId}` (**layouts só no navegador**), `agileSpace_jolt_sandbox_engine_hint_dismissed`, `jolt_generator_input`, `jolt_visual_generated_spec`, `jolt_visual_input_json`, `jolt_visual_from_maintenance`.
- Motor local no navegador (`jolt-lite`); extrai `LAYOUTTRANSFORMACAO` do layout completo.

### Papéis
Sem controle por papel. Salvar layout exige identidade; o Gerador exige login no backend.

### Detalhes
Colar um registro de rota inteiro na Spec preenche nome e URL; o GitHub mostra só a transformação mas guarda o arquivo inteiro; trocar versão recarrega a mesma rota; Comparar ignora ordem de chaves; `jolt_generator_input` só é apagado ao gerar; respostas fora de ordem descartadas.

### Morto, fake ou quebrado
- **Persistência na nuvem implementada e não usada** (`/jolt/projects` CRUD, `/versions`, `/rollback`, `/jolt/engine-info`) — layouts não são compartilhados nem versionados, embora o hub diga "Salva e recarrega layouts".
- `isBackendConfigured`, `readApiError` sem uso; `JoltPanel`, `JoltNicknameDialog` não importados; Tooltip importado sem tooltip; `apiUrl` só metadado; sem atalho de teclado para Executar.

---

## D. DevTools — `/devtools` e 34 ferramentas

**Infra:** registro único `lib/devtools/registry.ts` (300; id, título, descrição, categoria, ícone, `qa`, status `ready`/`soon`, palavras-chave, passos de "Como usar"); casca `components/devtools/DevToolPage.tsx` (cabeçalho com ações, Sheet "Como usar", voltar, trilha "DevTools › Categoria"); `ToolPane.tsx` (copiar, colar, limpar, baixar, rodapé de erro/estatística); `http/RequestEditor.tsx`; libs `http-request`, `ip`, `br-docs`, `junit`.

**Hub** (`app/devtools/page.tsx` → `DevToolsHubPage`/`DevToolsHub`): busca (título, descrição, palavras-chave) com **`/`** focando; chips de categoria (Dados & Formatos, Codificação & Segurança, Texto & Código, Rede & Brasil, API & Integração, Qualidade & Testes, Documentação — só as que têm ferramentas); "N disponíveis · M em breve"; prontas primeiro e depois alfabética; "Em breve" desativados (hoje 0); "Nenhuma ferramenta encontrada". **Sem favoritos, recentes ou filtro na URL.** `/qa` é o mesmo hub com `qa: true`.

**Restrição geral:** `fetch` direto do navegador esbarra na CSP `connect-src` (`next.config.ts:47`).

| Ferramenta | Rota | O que faz | Backend / externo | Estado |
|---|---|---|---|---|
| JSON Studio | `/devtools/json` | Formata (2/4) ou minifica; erro com linha/coluna; exemplo; baixar | — | ok |
| XML Studio | `/devtools/xml` | Formata, minifica, valida, XML↔JSON | — | ok |
| YAML ⇄ JSON | `/devtools/yaml-converter` | Converte nos dois sentidos | — | ok |
| SQL Formatter | `/devtools/sql-formatter` | Indenta; palavras-chave maiúsculas ou mantidas | — | ok ("dialeto" no Como usar sem seletor) |
| JSON Schema | `/devtools/json-schema` | Gera schema e valida subconjunto do draft-07 | — | ok (sem `$ref`) |
| Planilha → CSV | `/devtools/xlsx-to-csv` | `.xlsx/.xlsm`, aba, separador, BOM, filtro, prévia, baixar | — | ok (sem `.xls`) |
| Markdown Viewer | `/devtools/markdown-viewer` | Editor com prévia, arrastar `.md`, exemplo | — | ok |
| Base64 | `/devtools/base64` | Codifica/decodifica UTF-8; formata se JSON | — | ok |
| URL Encoder | `/devtools/url-encoder` | Valor ou URL | — | ok |
| JWT Inspector | `/devtools/jwt-inspector` | Header/payload, expiração, exemplo, baixar | — | ok (não verifica assinatura) |
| Deep Decoder | `/devtools/deep-decoder` | Decodifica em cadeia mostrando camadas | — | ok |
| Certificados | `/devtools/cert-inspector` | PEM: emissor, validade, SANs, SHA-1/256; gera autoassinado | — | ok |
| Cofre de Segredos | `/devtools/secret-vault` | AES-GCM 256 + PBKDF2 310k; criar, desbloquear, revelar, copiar, excluir, apagar cofre | localStorage `devtools.secret-vault.v1` | ok |
| Regex Lab | `/devtools/regex-lab` | Padrão, flags, destaque, grupos, referência | — | ok |
| Diff | `/devtools/diff` | DiffEditor Monaco (JSON/XML/texto) | — | ok |
| String Master | `/devtools/string-master` | ~20 transformações | — | ok |
| Gerador de Tipos | `/devtools/type-generator` | TS, Java, Delphi a partir de JSON | — | ok |
| Cron | `/devtools/cron-decoder` | Explica em pt-BR e lista próximas execuções; presets | — | ok |
| Data & Hora | `/devtools/date-time` | Relógio; Unix (s/ms), ISO, relativo | — | parcial (promete fusos; só local e UTC) |
| UUID & IDs | `/devtools/uuid-generator` | UUID v4/v7, ULID, NanoID em lote (500) | — | ok |
| Calculadoras | `/devtools/calculators` | Padrão, Geometria, Bytes | — | ok |
| IP Analyzer | `/devtools/ip-analyzer` | IPv4/CIDR local; geolocalização | `ipapi.co` | ok (IPv6 só reconhecido; limite gratuito) |
| Consulta de CEP | `/devtools/cep` | Máscara, endereço, baixar | `viacep.com.br` | ok |
| Cliente HTTP | `/devtools/api-client` | Método, URL, params, headers, body; abas Corpo/Headers; importar cURL | `fetch` direto | **parcial** (CSP bloqueia quase tudo) |
| Snippets de API | `/devtools/api-snippets` | cURL, fetch, Axios, Python, Java, C#; importar cURL | — | ok |
| Massa de Dados | `/devtools/test-data` | CPF, CNPJ, cartão, pessoa; lote 500 em JSON/CSV/SQL; exportar para Mocks | localStorage `agile-space_custom_mocks` | ok (herda problema dos Mocks) |
| Zephyr Explorer | `/devtools/zephyr` | 1 caso de teste por chave; passos; copiar JSON; relatório MD | `POST /api/jira/testcase` | **parcial** (não lista ciclos; contadores digitados com valores fictícios 12/2/1/5) |
| BDD & Bugs | `/devtools/bdd-bugs` | Gherkin pt ou bug em MD | — | ok (só copia) |
| Gerador de Automação | `/devtools/automation` | Passos → Cypress/Playwright | — | ok (TS/JS só muda comentário) |
| Fuzz de Limites | `/devtools/fuzz` | Catálogo fixo de 14 entradas hostis | — | ok (estático) |
| Diff de API | `/devtools/api-diff` | Esperado × atual; asserções Postman/Cypress/Playwright | — | **parcial** (só 1º nível) |
| Estúdio de Mocks | `/devtools/mocks` | Cria/lista/copia/exclui mocks | só localStorage | **fake** (nada é servido; rotas `api/mock-config` e `api/mock/[...slug]` existem e não são chamadas) |
| Gerador JUnit | `/devtools/junit-generator` | Esqueleto local ou testes via Gemini (BYOK) | Gemini direto do navegador (chave `agilespace_gemini_key`) | ok (chave separada da do Conhecimento) |
| CPF & CNPJ | `/devtools/doc-generator` | Gera e valida CPF, CNPJ e CNPJ alfanumérico | — | ok (id enganoso) |

**Para o redesenho:** "Como usar" e descrições vêm do `registry.ts` (mudar id muda a rota); `qa: true` define `/qa`; `soon` é o "Em breve"; "Exemplo" fica nas `actions` do cabeçalho; o Sheet diz "nada é enviado a servidor", o que não vale para Zephyr, IP, CEP, Cliente HTTP e JUnit com IA.
