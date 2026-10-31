# 2. Painel do Time e 3. Meu Quadro — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/`.

**Divergências em relação ao plano**
- `painel/page.tsx` tem 645 linhas e `workspace/page.tsx` 694; os ~1.500 / ~3.700 só fecham somando os componentes.
- **O AI Digest não existe mais nesta branch** (removido no commit `3be5105c`, 23/09). Sobra só o item "Daily Helper" na paleta ⌘K do workspace, que leva a uma aba inexistente.
- "Meu Quadro" é só o nome do card na Home (`ModuleGrid.tsx:109`). A página se chama "Meu Espaço", o menu do perfil diz "Meu Workspace" e o badge diz "Cockpit Pessoal".

---

## 2. Painel do Time (`/painel`)

### 2.1 Arquivos

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/painel/page.tsx` | 645 | Página: dados, sync automático com Jira, layout 2 colunas, diálogo de importação, `EmptyState`. |
| `components/painel/NextCeremonyCard.tsx` | 305 | "Próxima cerimônia" (Google ou manual). |
| `components/painel/CeremonySettingsDialog.tsx` | 283 | "Configuração da squad": unidade de estimativa, fonte dos rituais, cerimônias manuais. |
| `components/painel/PainelWelcome.tsx` | 265 | Squad sem dado de sprint: hero, status Jira, métricas, "Comece por aqui". |
| `components/home/LinkedTeamWelcome.tsx` | 54 | Aviso de vínculo da squad. |
| `components/jira/JiraProfieldsImport.tsx` / `JiraImportPreview.tsx` | 297 / 279 | Importação Jira/Profields (fila de chaves) e prévia editável. |
| `hooks/useSquadDashboardData.ts` | 182 | Rollup, issues, membros, sprint em foco. |
| `hooks/useNextCeremony.ts` | 271 | Próxima cerimônia; timers 30s e 5min. |
| `hooks/useGoogleCalendarConnection.ts` | 234 | OAuth Google (GIS) no navegador. |
| `hooks/useSquadConfig.ts`, `useJiraSettings.ts`, `useTeamAvatars.ts` | 61 / 161 / 89 | Config da squad, credencial Jira, fotos. |
| `lib/painel-sync.ts`, `team-people.ts`, `ceremony-countdown.ts`, `ceremony-schedule.ts`, `google-calendar.ts`, `team-welcome.ts`, `safe-url.ts` | — | Regras auxiliares. |
| `app/squad/api.ts`, `services/projectService.ts` | 403 / 216 | Clients REST. |

Testes: `painel-sync`, `ceremony-countdown`, `ceremony-api`.

### 2.2 Estados

- **Carregando:** spinner de página inteira. `refresh()` também liga `loading`, então "Atualizar", "Tentar de novo" e o fim da importação piscam a página toda.
- **Sem squad** (`squadId` vazio ou `'Sem Time'`): `EmptyState` "Você ainda não está em uma squad" + "Escolher meu time" (`/onboarding`); "Importar do Jira" e "Atualizar" desabilitados.
- **Squad sem dado:** `PainelWelcome` com `syncState`:
  - `idle` (só hero); `syncing` (3 etapas cosméticas a cada 6s); `error` (alerta âmbar + "Atualizar conexão" + "Tentar de novo"); `done` ("Jira conectado, sem sprint aberta agora" + "Sincronizar"); `no-jira` ("Quer ver a sprint aqui?" + "Conectar Jira").
- **Com dados:** layout completo, com banners opcionais: "Alguns dados podem estar defasados: {error}" e aviso de capacidade dispensável (todos os membros sem capacidade).
- **Sync automático:** uma vez por visita, se carregou, tem squad e não tem dado; com Jira → `runJiraSync`, sem Jira → `no-jira`. Erro que casa `/token|configure|conex[aã]o jira/i` vira `no-jira`, o resto `error`.
- **LinkedTeamWelcome:** se `isJustSignedUp()` (10 min) e projeto ativo real; sem link "Ver painel do time"; aparece acima de qualquer estado.

### 2.3 Ações

- **Cabeçalho:** Home; "Importar do Jira" (só ícone abaixo de sm); "Atualizar" (só relê o backend, não sincroniza Jira); tema; seletor de squad (>1 projeto); feedback (md+); menu do perfil (Meu Perfil, Projetos & Governança, Meu Workspace, Manual, Administração só admin, Sair).
- **Corpo:** "Escolher meu time"; aviso de capacidade "Configurar" (`/squad/roster`) e X; aviso de vínculo X; "Board completo" e "Gestão do time" (`/squad`) — **cards de issue não são clicáveis**; Explorar (Poker, Retro, Showcase, Health Check, Brainstorming) e "Ir pra home e ver tudo".
- **Próxima cerimônia:** engrenagem (configurações, em todos os estados menos carregando); "Cadastrar cerimônia"/"Cadastrar manualmente"; "Conectar minha agenda" (popup Google); "Tentar de novo"; "Desconectar agenda" (só no estado "nenhuma cerimônia"); "Entrar no Meet" / "Ver na agenda" (desabilitado "Sem link disponível").
- **PainelWelcome:** "Atualizar conexão", "Tentar de novo", "Sincronizar", "Conectar Jira", 5 cards de ferramenta, "Ver todas as ferramentas".
- **Rodapé:** espacoagil.com.br, changelog, manual, governança, suporte, feedback.
- Não há atalhos, DnD, busca, filtro, ordenação nem exportação. Ordenações fixas por `updatedAtJira` desc.

### 2.4 Painéis

- **Coluna principal (1.6fr)**
  - **Sprint:** nome; "Faltam N dias úteis" ou "N itens na sprint"; % concluído e "X de Y itens" com barra; "N em andamento / a fazer / parados (âmbar) / atrasados (rosa)"; "sincronizado há X". Contagem por issue, não por ponto.
  - **Board da sprint:** 3 colunas (A fazer = new/unknown, Em andamento = indeterminate, Concluído = done) com contador; máx. 3 cards + "e mais N"; card com chave, badge "seu", texto `title || parentTitle || assigneeName || 'sem responsável'`; vazio "nada por aqui".
- **Coluna lateral:** Próxima cerimônia; Seu time (4 avatares + "+N", "N pessoas · você é {papel}", "Gestão do time"); Últimos movimentos (5 issues: avatar, "Nome · KEY em {status}", "há X"); Explorar (5 atalhos + home).
- **PainelWelcome:** hero (badge "Seu time foi criado…", nome, chave, segmento · tribo · localidade, papel, 6 avatares); bloco de status Jira; "O que o painel vai mostrar" (Pessoas, Sessões de Poker, Sprint atual, Retrospectivas); "Comece por aqui".

### 2.5 Modais e toasts

- **"Importar a {squad} do Jira"** (`max-w-4xl`):
  - Formulário: Domínio, "Projetos no Jira" (várias chaves), token; "Ver o que vai ser importado"/"Começar com N equipes"; lateral com passo a passo do token Atlassian.
  - Prévia: nome, segmento, tribo, localidade, VP, área VP, status; pessoas com busca, Todos/Nenhum/"Só líderes", checkbox, cargo (Developer/QA/Designer/UX/SME/Stakeholder), liderança travada, "sou eu"; banner "Só Agile Master ou People Lead cadastram equipes"; fila "Equipe i de N", "Pular esta equipe", "Voltar à lista"/"Trocar projeto".
  - Confirmar: `confirmProjectProfields`, `switchProject` para a 1ª equipe, grava token. Painel fecha, toast "{id} importado", invalida avatares e roda `runJiraSync()`.
  - Toasts do componente: Dados encontrados; Falha na sincronização; Não consegui ler {KEY}; importada mas não ativada; token não guardado; nenhuma importada; N importadas; não foi possível importar.
- **"Configuração da squad":** unidade (SP, HOURS, TSHIRT, COUNT); fonte (Google Calendar / Cadastro manual); cerimônias manuais (nome + lixeira sem confirmação, 7 dias Seg→Dom, horário, duração mín. 5 passo 5, link do Meet opcional, "Adicionar cerimônia"). Salvar só com nome + ≥1 dia + duração>0; link não-http → "Link do Meet inválido"; sucesso "Configuração salva…pra squad toda"; erro "Não consegui salvar". Reabre sempre do salvo. Voltar a Google mantém as manuais.
- **Popups Google:** consentimento `calendar.readonly` (`prompt:'consent'`), renovação silenciosa.
- **FeedbackWidget** ("Portal Tech V&D - Painel do Time").

### 2.6 Dados

| Chamada | Observação |
|---|---|
| `GET /squads/{id}/rollup[?sprintId=]`, `GET /squads/{id}/issues`, `GET /squads/{id}/members` | dados da sprint |
| `GET /projects/{key}` | fallback de membros, avatares (cache), PainelWelcome (sem cache) |
| `POST /squads/{id}/sync?forceFull=true` | sync Jira |
| `GET /squads/{id}` / `POST /squads/{id}` | config (merge parcial de `ceremonyMode`, `ceremonies`, `estimationUnit`, `name`) |
| `GET /poker?squadId=` | contagem no PainelWelcome |
| `GET/POST /users/{id}/jira-config` | credencial |
| `POST /projects/sync/{key}/preview` e `/confirm` | header `X-Jira-Token` |
| `POST /auth/switch-project?projectId=` | troca de projeto |
| `POST /feedbacks` | feedback |

- **Google:** script GIS; `GET calendar/v3/calendars/primary/events`; depende de `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- **WebSocket:** nenhum.
- **localStorage:** `agileSpace_painel_capacityNotice_{squadId}`, `agileSpace_googleCalendarConnected_{email|id}` (token nunca gravado), `agile_jira_config_{userId}`, `agileSpace_justSignedUp`, `feedback_sent_*`, `agileSpace_activeSquadId`.
- **Eventos de janela:** `squad-config-invalidated`, `team-avatars-invalidated`.

### 2.7 Papéis

- Conteúdo não muda por papel; o papel é só texto (membro do Jira por e-mail/nome, senão `userProfile.role`).
- Configuração da squad: qualquer membro edita (backend `requireSquadWriteAccess`).
- Importar: botão para todos; bloqueio só na prévia (AM/PL). `leadsPeople` é ignorado.
- Admin: item "Administração". Seletor de squad: >1 projeto.

### 2.8 Compartilhados

`RoomHeader` (+ ThemeToggle, GlobalProjectSelector, ProfileAvatar), `Footer`, `FeedbackWidget`, `MemberAvatar`, `LinkedTeamWelcome`, `JiraProfieldsImport`/`JiraImportPreview`, `ui/*`, `use-toast`.

### 2.9 Detalhes fáceis de perder

- Timers: countdown 30s; eventos Google 5min; renovação de token 60s antes; etapas cosméticas 6s.
- Google: janela hoje 00:00 → +2 dias, palavras-chave daily/stand-up/planning/review/retro/refinement/grooming/showcase (pt/en), ignora cancelados, pega o mais próximo não terminado; texto diz "próximas 48h".
- Manual: procura 8 dias (texto diz 7); sem "confirmados".
- Badge da contagem: "agora" verde, ≤15min âmbar, resto primária; ≥24h usa dia ("amanhã 10:00", "qua 15/10 10:00").
- Pessoas: união Jira + projeto sem duplicar; avatar por e-mail → accountId → nome.
- Título da aba: "Painel {squad} | Portal Tech V&D".
- Aviso de capacidade começa "dispensado" para não piscar.
- "Últimos movimentos" sem estado vazio.
- Mobile: 1 coluna abaixo de lg; board 1 coluna abaixo de sm.
- Fundo com 2 blobs desfocados.
- A squad vem de `userProfile.squadId` ← `session.activeProjectId`; importar várias chaves pode trocar a squad do painel.
- O hook já suporta seletor de sprint (`sprintOptions`, `selectedSprint`), não usado.

### 2.10 Morto, fake ou quebrado

- **Erro do Google nunca aparece:** `fetchCalendarEvents` engole erros e devolve `[]`; token expirado vira "Nenhuma cerimônia encontrada".
- "Desconectar agenda" só aparece quando não há cerimônia.
- PainelWelcome: "Sprint atual" e "Retrospectivas" sempre "—".
- Badge "Seu time foi criado…" aparece também para squads antigas sem sprint.
- Card do board cai para o nome do responsável (contraria o comentário).
- "Conectar Jira"/"Atualizar conexão" abrem o fluxo completo de projeto + pessoas.
- "Atualizar" é só releitura e pisca a página.
- Texto sem client ID diz "não está disponível pra essa squad" (é do sistema todo); comentário desatualizado em `useGoogleCalendarConnection.ts:82`.
- Unidade de estimativa mora no diálogo de cerimônias.
- `leadsPeople`, `importedProjects`, `notImportedKeys` ignorados.

---

## 3. Meu Quadro / Meu Espaço (`/workspace`)

### 3.1 Arquivos

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/workspace/page.tsx` | 694 | 9 abas, handlers de kanban/notas/atalhos/perfil, modal de tarefa, busca do histórico. |
| `src/app/workspace/api.ts` | 137 | Kanban, notas, links, snippets. |
| `components/workspace/BentoDashboard.tsx` | 395 | Aba Início + Atividade Recente. |
| `KanbanBoard.tsx` | 365 | Kanban pessoal (dnd-kit). |
| `StickyNotes.tsx` | 252 | Notas. |
| `HistoryTimeline.tsx` | 285 | Histórico (accordion). |
| `ProfileSettings.tsx` | 250 | Perfil. |
| `ConnectivitySettings.tsx` | 248 | Jira, TDN, API keys. |
| `QuickLinks.tsx` | 251 | Atalhos. |
| `MyPrompts.tsx` | 216 | Prompts. |
| `SnippetLibrary.tsx` | 359 | Snippets (Monaco). |
| `CommandPalette.tsx` | 153 | ⌘K. |
| `WorkspaceSectionHeader.tsx`, `types.ts` | 55 / 35 | Cabeçalho das abas, tipos. |
| `shared/MyApiKeysManager.tsx` | 328 | API keys self-service. |
| `lib/my-api-keys-client.ts`, `lib/session-status.ts`, `useJiraSettings`, `useTdnSettings` | — | Apoio. |
| `prompt-hub/components/` (PromptCard, PromptSpecimenCard, PromptEditor 646, PromptView 601) | — | Reusados na aba Prompts. |

`Calmaria.tsx` (240) mora na pasta mas é usado no layout global.

### 3.2 Estados

- Inicializando: "Carregando dados do seu Espaço."
- Sem perfil e sessão: "Autenticação Requerida…" + `requestIdentity()`; sem botão de login.
- **Aba ativa só em estado local** (padrão `home`): recarregar volta ao Início; não há link direto para aba.
- Kanban: 3 skeletons por coluna; vazio "Sem tarefas aqui" + "Criar Tarefa".
- Notas: 4 skeletons; vazio "Seu mural está vazio" + "Criar Primeira Nota".
- Histórico: spinner; vazio "Nenhum registro encontrado"; sem squad → vazio direto.
- Início: "Nenhuma sessão registrada recentemente"; "Nenhuma nota fixada no momento" + "Criar Primeira Nota".
- Prompts: spinner; "Nenhum prompt encontrado" + "Criar Primeiro Prompt".
- Snippets: spinner; "Nenhum snippet encontrado" (sem botão).
- Atalhos: "Nenhum atalho configurado".
- API keys: spinner, "Nenhuma chave criada ainda", alerta de vencimento.
- **"Salvando..."** aparece 1,5s fixos a cada escrita, independente da requisição.

### 3.3 Ações

- **Cabeçalho:** "Busca ⌘K" (md+) + itens padrão do RoomHeader.
- **Abas (barra fixa, rolagem horizontal):** Início, Kanban (badge "A fazer"), Notas (badge), Histórico (badge), Perfil, Conectividade, Atalhos (badge), Prompts, Snippets.
- **Paleta ⌘K:** busca (cmdk), ↑↓ e Enter; navegação (Home, Kanban, Daily Helper, Snippets, Notas, Histórico); ações (Nova Tarefa, Criar Nova Nota, Registrar Snippet — evento `agile-space:new-snippet` após 150ms); Portal (Prompts, Perfil).
- **Início:** "Ir para o Kanban", "Nova Tarefa", "Nova Nota", "Histórico →", "Ver Todas"; clique na atividade abre `/room|/retro|/health-check/{id}`; "Ver Todas (N)" das notas; clique na nota fixada → aba Notas.
- **Kanban:** "+" por coluna (cria no status), "Criar Tarefa"; clique abre o modal; DnD entre colunas muda status em `onDragOver` com PATCH otimista; teclado (Espaço/Enter + setas); mouse só após 5px.
- **Modal de tarefa:** Título*, Descrição, Urgência (Baixa/Média/Alta/Crítica), Status; faixa "Vinculado a Cerimônia" + "Ver Sala" quando há `originLink`; "Excluir" (sem confirmação), "Cancelar", "Salvar Tarefa". Criação com `tag:'Manual'`; edição PATCH parcial; erro mantém aberto.
- **Notas:** "Nova Nota" cria vazia (âmbar); edição no card (20.000 caracteres), autosave 2s + ao sair; fixar; "Promover para Kanban" (1ª linha = título, resto = descrição, `tag:'Nota Rápida'`, média; apaga a nota; toast); excluir (otimista, sem confirmação); 5 cores. Ações só no hover em desktop.
- **Histórico:** accordion; badge Organizador/Participante, data/hora, tipo, time; resumo por tipo; "Acessar Sala" e "Ver Relatório" (nova aba).
- **Perfil:** nome, e-mail (desabilitado), "Papel na Squad" (`ROLES`), "Squad Principal" (projetos + squads + "+ Outra Squad (Digitar)"), avatar (NiceAvatar), "Salvar Perfil".
- **Conectividade:** Jira (domínio, PAT); TDN/Confluence (URL, PAT, Espaço, Rótulo); "Salvar Configurações" (os dois juntos); API keys (nome, escopos, validade, "Gerar Chave", chave exibida uma vez com copiar; Renovar +90d, Rotacionar e Revogar com `confirm()`).
- **Atalhos:** "Novo Link" (Nome, URL normalizada com `https://` e bloqueio de `javascript:`, 9 ícones, 5 cores, "Salvar Atalho"); card abre em nova aba; lixeira sem confirmação.
- **Prompts:** filtro (título, conteúdo, tags), "Novo"; clique/Enter abre `PromptView`; "Copiar link" e copiar conteúdo; `PromptEditor` completo (tipo, título, descrição, conteúdo, link da ferramenta, visibilidade, tags, objetivo, status, impacto, público, documentação); `PromptView` (copiar, abrir ferramenta, copiar link, formatado/bruto, comentários).
- **Snippets:** busca (título, linguagem, código); "Novo Snippet" (Monaco, 11 linguagens); hover: Editar, Excluir (`confirm()`), Copiar.
- Sem exportação.

### 3.4 Painéis

- **Início:** hero "Cockpit Operacional" ("Sistema Pronto" pulsante, "Olá, {nome}", pendentes e WIP, "Ritmo do Dia" %, 3 botões); "Fluxo de Trabalho" (barra A fazer/Andamento/Concluído + "N cerimônias registradas"); "Atividade Recente" (3 sessões, ícone, título, tipo, data, chip Ao vivo/Assíncrona/Planejando/Concluída); "Notas em Destaque" (3 fixadas).
- **Kanban:** 3 colunas (rosa, âmbar, verde) com "N Itens"; card com barra da prioridade, título, ponto, descrição (2 linhas), tag, "Urgente" pulsante (crítica), ícone de link; overlay girado.
- **Notas:** grade; fixadas primeiro com anel; depois por `updatedAt`; data e bolinhas de cor.
- **Histórico:** "N SESSÕES"; `PokerSummary` (duração, tópicos, esforço, média, 4 estimativas), `RetroSummary` (positivos, críticos, plano de ação), `HealthSummary` (fortalezas, atenção); "Resumo indisponível…".
- **Perfil:** dados da conta com prévia do avatar; "Identidade & Avatar".
- **Conectividade:** cards Jira ("v2.0 API"), TDN, "Minhas API Keys" ("Self-service").

### 3.5 Modais e toasts

- Modal de tarefa; CommandDialog; "Adicionar Atalho" (erro inline de URL; fica aberto se falhar); editor de Snippet (Monaco `vs-dark`, 1000px); PromptEditor/PromptView.
- `confirm()` nativo: excluir prompt, excluir snippet, revogar/rotacionar API key.
- Toasts `useToast`: falhas de carga; falhas de escrita (mover/salvar/excluir tarefa, criar/salvar/excluir/promover nota, salvar/excluir atalho); "Nota promovida!"; "Perfil atualizado! Suas permissões foram validadas."; "Conexões Atualizadas"/"Erro ao Salvar"; API keys.
- Toasts `sonner` em Prompts e Snippets — **a tela mistura duas bibliotecas de toast**.
- FeedbackWidget ("Portal Tech V&D - Meu Espaço").

### 3.6 Dados

| Chamada | Uso |
|---|---|
| `GET/POST /workspace/{userId}/kanban`, `PATCH/DELETE /workspace/kanban/{id}` | kanban |
| `GET/POST /workspace/{userId}/notes`, `PATCH/DELETE /workspace/notes/{id}` | notas |
| `GET/POST /workspace/{userId}/links`, `DELETE /workspace/links/{id}` | atalhos |
| `GET/POST /workspace/{userId}/snippets` (POST cria e edita), `DELETE /workspace/snippets/{id}` | snippets |
| `GET /poker?squadId=`, `GET /retros?squadId=`, `GET /health-checks?squadId=` | histórico — lista inteira filtrada no navegador por participante/criador |
| `GET /projects`, `GET /squads`, `POST /users` | perfil |
| `GET/POST /users/{id}/jira-config`, `GET/POST /users/{id}/tdn-config` | conectividade |
| `GET/POST /api-keys`, `POST /api-keys/{id}/renew|rotate|revoke` | API keys |
| `GET /prompts?authorId=&page=0&size=100`, `POST`, `PUT/PATCH/DELETE /prompts/{id}`, comentários | prompts |

- `userId` = `session.id || userProfile.id || email` (Snippets/Prompts usam outra ordem).
- **Quem mais escreve no kanban:** Health Check (`tag:'Saúde da Squad'`, `originLink`, `exportedAt`).
- Sem WebSocket nem polling; recarrega após escrita.
- Evento `agile-space:new-snippet`.

### 3.7 Papéis

- Escopos de API key: ADMIN/LEAD todos; demais `KNOWLEDGE_READ` e `SQUAD_READ` (travado na squad ativa); validades só-admin.
- Histórico: "Organizador" se `creatorId` é o usuário.
- **Papel no Perfil é autodeclarado** (qualquer um vira AM/PO) e vai para `POST /users`; no login seguinte vale `session.activeProjectRole`.
- O resto é pessoal.

### 3.8 Compartilhados

`RoomHeader`, `Footer`, `FeedbackWidget`, `GlobalProjectSelector`, `MyApiKeysManager` (também no `ModuleIntegrationDialog`), componentes do Prompt Hub, `ui/*` (tabs, dialog, select, command, accordion, card, scroll-area, checkbox, AgileSpinner), `react-nice-avatar`, `@dnd-kit`, `framer-motion`, `@monaco-editor/react`, `session-status`, `safe-url`.

### 3.9 Detalhes fáceis de perder

- Otimismo em mover tarefa e editar/fixar/colorir/excluir nota (erro → recarrega). Recarga total (3 GETs) após criar/salvar/excluir tarefa, criar nota, atalhos, promover.
- Autosave de notas 2s + ao desmontar; não regrava nota excluída/promovida.
- Migração de cor de notas antigas por palavra-chave.
- Sessão "ao vivo" sem atividade há >12h aparece Concluída (testado).
- Animações framer-motion (cascata, layout, presença), "Urgente" pulsante.
- **Mobile:** abas com rolagem; colunas do kanban 85vw; botão Busca escondido (⌘K inexistente no celular); ações de snippets só no hover (inacessíveis no toque).
- Barra de abas fixa em `top-12`. Título "Meu Espaço | Portal Tech V&D".
- **Links externos para `/workspace` caem no Início** (toast "Acessar Kanban" do Health Check, `API_KEY_SELF_SERVICE_PATH`, "Configurar" na KB).
- `MyApiKeysManager` quebra no tema escuro (`bg-white`, `slate-*`).

### 3.10 Morto, fake ou quebrado

- **Prompts:** não dá para editar nem excluir (`isReadOnly={true}`, PromptView sem `onEdit/onDelete`); `onFork/onToggleFavorite/onCopy` vazios.
- **Paleta:** "Daily Helper" leva a aba inexistente; atalhos "H"/"K" são só visuais; ⌘K só abre, nunca fecha (closure); imports sem uso.
- **Perfil:** "+ Outra Squad (Digitar)" só limpa a squad (o campo nunca aparece); toast "permissões validadas" aparece mesmo se `POST /users` falhar; formulário não acompanha mudanças do perfil.
- **Conectividade:** "Conexões Atualizadas" aparece mesmo se o Jira for recusado; salva TDN mesmo vazio; badge "v2.0 API" decorativo.
- **Kanban:** `dueDate` carregado mas sem campo/salvamento/exibição; `currentExportedAt` nunca exibido; sem reordenação dentro da coluna (ordem não persistida); PATCH a cada coluna atravessada; excluir tarefa/nota/atalho sem confirmação (prompts/snippets pedem).
- **Início:** "Sistema Pronto"/"centro de comando sincronizado" fixos; "Ritmo do Dia" = % concluído de todos os tempos; `onOpenFeedback` ignorado.
- **Histórico:** "Acessar Sala" e "Ver Relatório" vão para a mesma URL; depende de `summary` na listagem; baixa tudo da squad e filtra no navegador; não inclui Plano de Ação nem Brainstorming.
- Textos dizem "squad" numa área pessoal (Kanban, Atalhos, Histórico).
- Código morto: `router`, vários ícones e imports em `page.tsx`; `resilientReq`; `MoreVertical`; "● Editor Monaco Ativo" decorativo; `isEditable` do RoomHeader não usado.
- Nomes inconsistentes: Meu Quadro / Meu Espaço / Meu Workspace / Cockpit Pessoal.
