# 1. Retro — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend` (develop + commits da Home). Somente leitura; nada foi alterado.
> Caminhos relativos a `agile-space-frontend/`.

## 1. Arquivos

**Rotas e client**

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/retro/page.tsx` | 291 | Lobby (hub) com `ToolHubLayout`, modal de criação, `handleCreate` (:91), histórico local (:73). |
| `src/app/retro/[id]/page.tsx` | 1217 | Sala. Carga, WebSocket, estado otimista e todos os handlers (cards, votos, reações, merge, DnD, timer, chat, check-in, participantes), loading e erro. |
| `src/app/retro/api.ts` | 181 | `retroApi` (REST) e `RetroApiError`. |

**Componentes (`src/components/retro/`)**

| Arquivo | Linhas | Papel |
|---|---|---|
| `RetroBoard.tsx` | 752 | Layout da sala: header, "Mais ações", guia, chat, participantes, modo apresentação, barra de etapas, `DndContext`. |
| `RetroControls.tsx` | 465 | Pílula de status, layout, "Apresentar", controles do facilitador, popover de timer e limite de votos. |
| `RetroColumn.tsx` | 547 | Coluna: título editável, contador de votos, importar, sincronizar resumo, ordenação, composer, empty state, modo minimizado. |
| `RetroCard.tsx` | 435 | Card: edição inline, reações, linha do tempo do merge, badges de ação carregada, "Marcar feito", exclusão. |
| `AddRetroCard.tsx` | 139 | Composer. Em coluna de ação: responsável e prazo. |
| `ExportRetroDialog.tsx` | 778 | PDF (jsPDF), Markdown, CSV, texto TDN. |
| `CreateRetroDialog.tsx` | 526 | Modal "Configurar Retrospectiva". |
| `RetroSettingsDialog.tsx` | 201 | Configurações (só facilitador); exporta `ToggleRow` (reusado pelo Poker). |
| `RetroActionImportDialog.tsx` | 180 | Importa ações pendentes de retros anteriores. |
| `RetroHealthCheckGate.tsx` | 81 | Overlay do check-in de humor. |
| `SprintStatsDialog.tsx` | 123 | "Números da sprint" (Jira). |
| `RetroParticipantList.tsx` | 42 | Adapter para `EliteParticipantList`. |
| `RetroWelcome.tsx` | 86 | Faixa "Como funciona" no quadro vazio. |
| `retro-chat.ts` | 56 | Papéis → canais do chat, merge/upsert de mensagens. |
| `retro-card-visibility.ts` | 14 | `canShowCardContent` (anonimato). |
| `RetroNicknameDialog.tsx` | 32 | **Morto.** |
| `RetroHistoryPanel.tsx` | 201 | Não é desta tela; usado em `squad/SquadPerformanceView.tsx`. |

**Compartilhados usados:** `poker/team-chat/*` (TeamChat, ChatComposer, ChatMessageList, ChatMessageContent, ChatDirectList, useChatReadState, chatChannels), `layout/RoomHeader`, `shared/EliteSidebar`, `shared/EliteParticipantList`, `common/MemberCard`, `shared/EliteCard` (`AgileCard`), `shared/EliteBaseCard`, `shared/ToolHubLayout`, `hooks/useToolHistory`, `feedback-widget`, `layout/LoadingScreen`, `NotFound`, `lib/retro-templates`, `lib/types.ts:565-729`, `lib/poker-utils`, `work-items-api.ts:63`, `feedback/api`, `ui/DashboardFilters` (`useProjectEstimationUnit`).

## 2. Estados e fases

Não há enum de fase: a fase é a combinação de flags do board + estado local.

**Lobby** (`/retro`): hub; "Nova Sessão" abre `CreateRetroDialog`.

**Telas de bloqueio da sala** (ordem de precedência, `[id]/page.tsx`):
1. Sem sessão: "Entre para abrir este quadro" + "Ir para o login" (:1098).
2. Falha de carga: "Não foi possível carregar o quadro" + "Tentar de novo" (:1108).
3. Sem perfil: "Configurando identidade..." e `requestIdentity()` (:1131, :372).
4. Carregando: "Sincronizando o quadro com o time..." (:1133).
5. 404: `NotFound` "quadro retrospectivo" (:1136).
6. Ainda não participante: "Validando seu acesso ao quadro..." (auto-join :470).
7. Check-in pendente: overlay `RetroHealthCheckGate` (:1139-1148).

**Fases do facilitador**
- **Escrita anônima** (`isCardsRevealed=false`): "Revelar cards" alterna e pode voltar a ocultar. Revela sozinho no fim do timer se `autoRevealOnTimerEnd`.
- **Votação** `disabled → active → finished`: "Iniciar votação" exige cards revelados; "Encerrar votação" (com `autoSortOnVoteEnd` grava `columnSorts=true` nas colunas não-ação); "Resetar votação" com `window.confirm` → `POST votes/reset`.
- **Timer** `stopped / running / paused`.
- **Não existe estado "encerrada".** Não há botão para encerrar a retro.

**Modos de visualização**
- Layout pessoal `board` ou `focus` (localStorage `agile_retro_layout_mode`).
- Coluna ativa (`activeStage`); com `syncStageEnabled` o participante segue `board.activeColumnKey`.
- **Modo apresentação** (`isFocusMode`): "Apresentar" / "Sair" / Esc; esconde o header, barra fixa de abas de colunas com `RetroControls compact`, coluna ativa em tela cheia sem composer, fonte 19px.
- Modo merge (`mergingSourceId`; Esc cancela).
- Edição inline de card e de título de coluna.

## 3. Ações do usuário

### Lobby
- "Nova Sessão" (pede identidade se faltar).
- Entrar por ID (input + seta/Enter) — **converte para MAIÚSCULAS** (ver §10).
- Sessões recentes (máx. 3, só deste navegador).
- Cards "Como funciona" e "Dicas" (informativos).
- Feedback (header md+ e Footer).
- **Modal de criação**: "Começar de um template" (só com templates salvos); Título; Squad/Time (pré-preenchido por `?squad=` ou perfil); grade com 10 formatos com preview de colunas no hover; editor "Personalizado" (nome ≤40, toggle "plano de ação", remover, "+ Coluna", 2 a 6 colunas); 5 toggles de facilitador com atalhos "Padrão/Nenhum/Todos"; pergunta do check-in; Cancelar / "Iniciar Retrospectiva". Validações por toast (perfil, título, colunas custom ≥2 sem repetição).

### Header da sala
- Home, ThemeToggle, GlobalProjectSelector, Feedback (md+), menu do perfil (Meu Perfil, Projetos & Governança, Meu Workspace, Manual, Administração só admin, Sair).
- Layout "Quadro"/"Foco"; "Apresentar".
- **Só facilitador:** revelar/ocultar; iniciar/encerrar/resetar votação; popover "Controles" (votos por pessoa por painel ∞/3/5/10; timer 2/3/4/5 min com Play/Pause/Retomar/Zerar; som).
- **"Mais ações":** Exportar (participante só após revelar — "Exportar (após revelar os cards)"); Copiar link; Guia do facilitador; Estatísticas da sprint; Configurações (só facilitador).
- Botão Chat com badge de não lidas e botão Participantes com contador (abrir um fecha o outro).

### Colunas e cards
- **Adicionar card:** Enter envia, Shift+Enter quebra, limite 1000; em coluna de ação, responsável (datalist dos participantes) e prazo (date).
- "Escrever" no empty state foca o composer.
- **Editar card** (autor ou facilitador): Enter salva, Shift+Enter quebra, Esc cancela; em ação edita responsável e prazo.
- **Excluir** (autor ou facilitador) com AlertDialog "Remover Feedback?".
- **Votar** (estrela; toggle; só com votação ativa; limite por coluna).
- **Reações** Concordo / Amei / Uau / Preocupa — exclusivas por pessoa, só com conteúdo visível, fora das colunas de ação.
- **Merge:** botão GitMerge em todo card; origem "Origem" pulsando, hover mostra "Destino"; clique funde; Esc ou clique na origem cancela. Bloqueado na fase anônima e entre colunas.
- **Drag-and-drop** (dnd-kit, ponteiro + teclado pelo `GripVertical`): reordenar e mover entre colunas. Regras: fase anônima só autor/facilitador; coluna ordenada por votos não reordena; mover card votado não pode estourar o limite do destino.
- **"Marcar feito" / "Concluído"** em ação (autor ou facilitador).
- Clique no card alterna `isExpanded` (sem efeito útil, §10).
- **Só facilitador na coluna:** renomear título (lápis no hover; Enter/blur salva, Esc cancela); ordenar por votos; importar ações pendentes (coluna de ação); sincronizar resumo com o histórico.
- Focar coluna por clique; navegar etapas pela pílula ou abas (travado para participante com sync).

### Atalhos
| Contexto | Teclas |
|---|---|
| Global | Esc cancela merge |
| Apresentação | Esc sai; ←/→ troca coluna (ignorado em campos; travado pelo sync) |
| DnD | teclado do dnd-kit no handle |
| Chat | Enter envia, Shift+Enter quebra; modo código: Ctrl/Cmd+Enter |

### Participantes
- Remover (facilitador) com confirmação.
- **"Assumir Controle"** (coroa, qualquer participante) com confirmação.
- Copiar link de convite (sheet mobile e rodapé "Convidar Time" no desktop).

### Chat
- Abas "Geral", canal da função e "Diretas" (lista, abrir DM, voltar).
- Modo código, enviar, apagar a própria (facilitador apaga as dos outros, exceto DM), copiar bloco de código.

### Exportar
- PDF (download), Markdown (copiar), CSV (baixar), texto TDN (copiar); campo "Link do slide (opcional)"; "Ver prévia do texto".

### Outros
- Responder check-in (5 opções); Configurações (facilitador: 5 toggles + pergunta); Estatísticas da sprint; Feedback NPS flutuante.

## 4. Painéis e seções

**Lobby:** RoomHeader; card título/descrição/"Nova Sessão"/entrar por ID; "Sessões recentes" ("Salvo só neste navegador"); "Como funciona" (4 seções); "Dicas para a cerimônia" (3); Footer.

**Sala**
- Header sticky 48px: Home, ícone `Flame`, título, badge do squad; à direita pílula de status, controles, "Mais ações", Chat, Participantes, tema, projeto, feedback, perfil.
- Faixa `RetroWelcome` (quadro vazio, fora da apresentação): Escrever / Revelar / Votar / Agir, com X.
- Área de colunas com scroll horizontal (board).
- Coluna: ícone do tema, título, "Star usados/máx", importar, sincronizar, estrela de ordenação, badge total; composer; grade de cards; empty state por tema com "Seus cards ficam ocultos até a revelação".
- Coluna minimizada (foco): ícone, título vertical, cadeado se travado, contagem.
- Pílula de etapas fixa embaixo (layout foco ou sync ligado; check nas passadas).
- Barra do modo apresentação (abas, cadeado, controles compactos, "Sair").
- Participantes: `EliteSidebar` "Squad Ativa" (desktop, w-72) / `Sheet` (mobile).
- Painel de chat flutuante à direita (`TeamChat`).
- Botão flutuante de feedback.

## 5. Modais, gavetas, confirmações, toasts

- **CreateRetroDialog** "Configurar Retrospectiva".
- **Popover "Controles da sessão"** (votos, timer, som).
- **Sheet "Como conduzir a retro"**: 3 etapas, ferramentas do facilitador, "Antes de encerrar".
- **Sheet "Participantes"** (mobile).
- **ExportRetroDialog**: KPIs, PDF "Recomendado", demais formatos, link do slide, prévia Markdown.
- **RetroSettingsDialog**: "Durante a retro" (mostrar autores; todos acompanham a coluna do facilitador; pergunta de humor com debounce 500ms) e "Automações" (revelar no fim do timer; ordenar ao encerrar votação). Aplica na hora via PATCH.
- **RetroActionImportDialog** "Ações pendentes": loading, erro + "Tentar de novo", vazio, aviso parcial ("Não consegui ler N retro(s)"); lista de retros com data e badge de pendentes; clicar importa todas as pendentes daquela retro.
- **RetroHealthCheckGate**: tela cheia com 5 botões (Exausto, Cansado, Neutro, Bem, Ótimo).
- **SprintStatsDialog** "Números da sprint": Entregue, Entregue do previsto, Ficou para a próxima, % Cumprimento; loading, erro, sem dados ("Conecte o Jira...").
- **FeedbackWidget**: NPS 0–10 ou "só sugestão" → comentário → agradecimento (fecha em 2,5s).

**Confirmações:** "Remover Feedback?", "Remover Participante?", "Assumir Controle do Quadro?" (HTML via `dangerouslySetInnerHTML`), `window.confirm` para resetar votação.

**Toasts:**
- Lobby: Perfil Não Identificado, Título Obrigatório, Revise as colunas, Erro de Configuração, Erro na Criação.
- Sala: Você saiu do quadro; falhas de adicionar/apagar/editar card; votação não aberta; limite de votos; limite do painel de destino; falha ao votar/resetar; falha de reação/ação; Sem coluna de Ação; Pendências importadas!; Erro ao Importar; Ação bloqueada (fase anônima); Fusão não permitida; Ideias fundidas!; falha ao fundir; Card de outra pessoa; falha ao mover; falha ao remover participante; "👑 Controle assumido"; Erro ao assumir controle; falha no check-in; falha no chat; "Não foi possível salvar a alteração".
- Componentes: Link Copiado!; Título atualizado!; falha ao renomear; Nenhuma ação para exportar; Resumo sincronizado!; falha ao sincronizar; Campo Obrigatório; Markdown/TDN copiado; CSV baixado; PDF baixado; Erro na exportação.

## 6. Dados

**REST** (`src/app/retro/api.ts`, `authFetch`, base `NEXT_PUBLIC_API_URL`)

| Método | Path | Uso |
|---|---|---|
| GET | `/retros?sprintId&team&squadId` | `listBoards` (import dialog) |
| GET | `/retros/{id}` | `getBoard` |
| POST | `/retros` | criação |
| PATCH | `/retros/{id}` | todas as mudanças do board (colunas, summary, participantIds, timer…) |
| POST | `/retros/{id}/votes/reset` | resetar votos |
| POST | `/retros/{id}/cards/{cardId}/vote` | votar |
| POST | `/retros/{id}/cards/{target}/merge/{source}` | fundir |
| POST | `/retros/{id}/transfer-control` | assumir controle |
| GET/POST | `/retros/{id}/participants` | listar / entrar ou atualizar (inclui `healthCheckAnswer`) |
| DELETE | `/retros/{id}/participants/{userId}` | remover |
| GET/POST | `/retros/{id}/cards` | listar / salvar card inteiro (criar, editar, mover, reação, isDone) |
| DELETE | `/retros/{id}/cards/{cardId}` | excluir |
| POST | `/retros/{id}/cards/import` | importar ações |
| GET | `/retros/{id}/chat?channelId=` | histórico |
| POST | `/retros/{id}/chat` | enviar |
| DELETE | `/retros/{id}/chat/{messageId}` | apagar |
| GET | `/work-items/{squadId}/sprint/{sprintId\|active}/stats` | Números da sprint |
| POST | `/feedbacks` | feedback |

4xx mostra a mensagem do servidor; 5xx/rede usa texto padrão.

**WebSocket** `ws(s)://<host>/ws/retro/{boardId}?token=` — reconecta a cada 3s, recarrega tudo no `onopen`. Recebe `BOARD_UPDATED`, `PARTICIPANT_JOINED`, `PARTICIPANT_LEFT`, `CARD_SAVED`, `CARD_DELETED`, `CARDS_IMPORTED`, `CHAT_MESSAGE_SAVED`, `CHAT_MESSAGE_DELETED`, `REFRESH_BOARD` (e desconhecidos → reload). **O cliente nunca envia nada.**

**localStorage:** `agileSpace_rooms_meta` (só ao criar), `agileSpace_retro_templates` (só leitura), `agile_retro_layout_mode`, `retro_sound_enabled`, `agile_retro_welcome_dismissed`, `poker-chat-read:{boardId}:{uid}`, `feedback_sent_{toolName}`.

**URL do lobby:** `?squad=` e `?sprintId=`.

**Integrações:** Jira só via stats; PDF jsPDF (A4, KPIs, rodapé, sem emojis); CSV com BOM e proteção contra injeção de fórmula; Markdown/TDN no clipboard com fallback; som externo mixkit. Sem IA, Google ou Spotify.

## 7. Papéis e permissões

- **Facilitador** = `creatorId === userProfile.id`; `transfer-control` troca o dono.
- **Só facilitador:** revelar/ocultar; votação (iniciar/encerrar/resetar/limite); timer e som; Configurações; renomear coluna; ordenar por votos; importar ações; sincronizar resumo; editar/excluir qualquer card; mover card alheio na fase anônima; marcar feito qualquer ação; remover participante; moderar chat (não DM); exportar antes de revelar; navegar com sync ligado; executar no próprio cliente o auto-revelar/fim do timer.
- **Participante:** escrever, editar/excluir/mover os próprios; votar; reagir; **fundir qualquer card**; marcar feito as próprias ações; chat, guia, copiar link, estatísticas, exportar após revelar; **assumir o controle a qualquer momento**.
- **Admin:** nada específico.
- **Canais de chat:** `mapGlobalToTeamRole` (AM, PO, PL, QA, UX, DEV, SME, OUTRO) → dev / qa / organizador / spectator.
- **Anonimato:** servidor redige `card.hidden`; conteúdo visível se não oculto e (revelado, ou autor, ou coluna de ação); autor visível se `isAuthorsRevealed`, autor ou ação — senão "Anônimo" com fantasma. Export só mostra autor com `isAuthorsRevealed`.

## 8. Componentes compartilhados

`RoomHeader`; `EliteSidebar` + `EliteParticipantList` + `MemberCard`; `poker/team-chat/*`; `EliteCard` (`AgileCard`) + `EliteBaseCard`; `ToolHubLayout` + `useToolHistory` + `Footer`; `FeedbackWidget`, `LoadingScreen`, `NotFound`; `RetroSettingsDialog.ToggleRow` (reusado pelo Poker); `ui/*` (Dialog, Sheet, Popover, DropdownMenu, AlertDialog, Tooltip, Switch, Select, ScrollArea, Badge, AgileSpinner). **Não há componente de timer próprio** — vive dentro de `RetroControls`.

## 9. Detalhes fáceis de perder

- **Timer:** padrão 300s; atualiza a cada 500ms; vermelho ≤30s; ao zerar toca alarme, auto-revela (se ligado) e o facilitador marca `stopped`; quem abre >3s após o fim não ouve o alarme; pausa guarda `remainingOnPause`; som é preferência local e **participante não tem controle de som**.
- **Animações:** pulse em "Votando"/"Encerrar votação", `animate-shadow-pulse` na coluna focada, framer-motion no chat/feedback/lobby (respeita reduced motion), mesh gradient estático. Sem confete.
- **Limites:** card 1000; chat 8000; colunas custom 2–6 com 40 caracteres; votos ∞/3/5/10 (padrão 5); templates salvos 20; timeline do merge mostra 2 + "+N mais"; badges "9+"/"99+".
- **Ordenação automática** por votos com votação ativa/encerrada (salvo escolha explícita); colunas de ação nunca ordenam.
- **Empty states:** coluna por tema; chat "Ninguém falou nada ainda..." / "Ninguém mais na sala"; import "Nenhuma ação pendente"; stats "Ainda não há dados desta sprint"; lobby "Nenhuma sessão ainda".
- **Ações entre sprints:** import grava `carriedFromBoardId/Title` (raiz da cadeia) e `carryCount+1`; badges "Trazido de: X" e "Recorrente (Nx)"; ação concluída com 60% de opacidade.
- **Merge:** textos fundidos viram `originalTexts` (linha do tempo e export "agrupado com").
- **Check-in:** bloqueia quadro e stats até responder; uma vez por participante; o facilitador também responde.
- `document.title` = `"<título> | Retrospectiva | Portal Tech V&D"`.
- Auto-join com papel do perfil; sincroniza nome/cargo se mudarem; removido recebe toast e vai para `/`.
- Otimismo por card (`pendingRef`), proteção de reload fora de ordem (`loadSeqRef`), Strict Mode (`joinAttemptedRef`).
- Export usa a data de criação do board; arquivo `relatorio-<slug>-<yyyy-MM-dd>`.
- **Presença:** sem heartbeat; todo mundo aparece online.
- **Responsivo:** rótulos só md/2xl; pílula some no mobile se nada ativo; Sheet de participantes no mobile; chat largura total; colunas mín. 310/360/400px; 2 cards por linha em 2xl.
- **Flags do board:** `isAuthorsRevealed`, `syncStageEnabled`, `healthCheckEnabled` + `healthCheckQuestion`, `autoRevealOnTimerEnd`, `autoSortOnVoteEnd`.
- **Templates:** classic, start_stop_continue, mad_sad_glad, starfish, four_ls, daki, sailboat, three_little_pigs, speed_car, custom. Start/Stop/Continue, Mad/Sad/Glad e Starfish **não têm coluna de ação** (sem importar nem "Marcar feito"). Boards antigos sem `columns` → classic.

## 10. Código morto, fake ou quebrado

**Morto**
- `RetroNicknameDialog.tsx` nunca importado.
- `onLeaveBoard`/`handleLeaveRoom` passados e nunca usados — **não existe botão "Sair do quadro"**.
- `saveTemplate`/`deleteTemplate` nunca chamados — "Começar de um template" é praticamente inalcançável.
- "Padrão" e "Nenhum" fazem a mesma coisa (`CreateRetroDialog:417-432`).
- Props sem uso: `RetroColumn.onToggleFocusMode/actionColumns`, `ExportRetroDialog.triggerNode`, `AgileCard.timestamp/isTruncated/onToggleExpand`, `ToolHubLayout.removeRoom` (não dá para apagar sessão recente).
- Imports sem uso em `RetroBoard`, `RetroCard`, `RetroColumn`, `retro/page.tsx`, `TeamChat`, `ToolHubLayout`.

**Enganoso**
- Clique no card só muda `min-h` (`RetroCard:351`).
- Exclusão cita "comentários vinculados" que não existem.
- "Remover participante" diz que perde acesso "permanentemente", mas volta pelo link (auto-join).
- Botão de voto aparece sempre (até em colunas de ação), só desabilitado.
- Botão de merge aparece para todos, em qualquer coluna e em cards ocultos; bloqueio só ao executar.

**Prováveis bugs**
- Entrar por ID converte para maiúsculas, mas ids são UUID minúsculo → provável 404.
- "Sessões recentes" só lista quadros criados neste navegador.
- Renomear coluna e importar ações dependem do eco do WS (cards importados somem até chegar `CARDS_IMPORTED`).
- Renomear coluna em board legado (sem `columns`) não faz nada.
- Import sem deduplicação e com N+1 requisições.
- Reação/edição gravam o card inteiro com `votes` → risco de corrida com votos.
- `SprintStatsDialog` usa a unidade de estimativa do squad do usuário, não do board.
- Copiar link (`RetroBoard:279`) mostra sucesso mesmo se o clipboard falhar.
- Rótulos de `TEMPLATE_OPTIONS` não batem com `RETRO_TEMPLATES`.
- Coluna custom só permite temas `neutral` e `action`.

Sem TODO/FIXME e sem dados mocados.
