# 5. Brainstorming, Health Check e Plano de Ação — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/`. As páginas são finas; o grosso fica em `src/components/<sala>/*`.

---

## 5.1 Brainstorming

### Arquivos

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/brainstorming/page.tsx` | 255 | Hub (`ToolHubLayout`) + dialog "Iniciar Brainstorming" |
| `src/app/brainstorming/[id]/page.tsx` | 519 | Sala: estado, WS, handlers, escolha da fase |
| `src/app/brainstorming/api.ts` | 168 | `brainstormingApi` |
| `components/brainstorming/Toolbar.tsx` | 331 | **Barra própria**, no lugar do RoomHeader |
| `MuralPhase.tsx` | 265 | Fase Ideação ("Mural") |
| `DiagramPhase.tsx` | 275 | Fase "Teia" (React Flow) |
| `GroupingPhase.tsx` | 301 | Fase "Grupos" (dnd-kit) |
| `PrioritizationPhase.tsx` | 227 | Fase "Matriz" (DnD nativo HTML5) |
| `ActionsPhase.tsx` | 375 | Fase "Plano" + exportar para 5W2H |
| `IdeaCard.tsx` | 135 | Card (casca do `AgileCard`) |
| `ExportDialog.tsx` | 153 | Markdown/CSV via `EliteExportDialog` |
| `BrainstormingGuide.tsx` | 142 | Sheet "Guia do Brainstorming" |
| `lib/brainstorming-utils.ts` | 66 | `getQuadrant`, `ideaText`, `upsertById`, `votesOf`… |

### Estados e fases
- Carregamento: "Configurando identidade..." / "Inspirando mentes e conectando ideias..." / `NotFound "sessão de brainstorming"`.
- **5 fases** em `boardData.phase`: `ideation` (Mural), `diagram` (Teia), `grouping` (Grupos), `prioritization` (Matriz), `actions` (Plano).
- Só o facilitador troca a fase (segmented control em xl+, `<select>` abaixo de xl); PATCH + `BOARD_UPDATED`.
- Modos em `settings`: `isAnonymous`, `isRevealed` (ideias ocultas), `isPresentationMode`.
- Modo de fusão local (`mergingSourceId`) e modo exportar imagem (`isExporting`).
- Trocar o id da URL reseta o estado.

### Ações
- **Hub:** "Nova Sessão" (pede identidade); dialog Título* + Squad/Time, "Iniciar Jornada"/"Talvez depois"; entrar por ID (**MAIÚSCULAS**); 3 sessões recentes; feedback.
- **Mural:** busca; "Recentes"/"Populares"; contador Total/Encontradas; campo "O que você está pensando?" (5000, Enter/"Lançar", limpa só se salvou); por card: votar (desabilitado se oculta), **editar (qualquer pessoa)**, juntar (GitMerge → banner "Modo de Fusão Ativo" + Cancelar → clique no destino), excluir (só autor), "Ver Mais/Menos" (>3 linhas ou 140 caracteres).
- **Teia:** arrastar nó grava posição; ligar ideias pelos handles (hover) grava `parentId`; clique na linha → `window.confirm` remove; scroll faz pan, seleção por arrasto, pan com botão do meio/direito; Controls, MiniMap, Zoom+/−, "Centralizar"; votar e editar (sem excluir/fundir).
- **Grupos:** criar grupo (255, Enter/"Criar Grupo"); arrastar pelo grip (hover, 8px) entre colunas, inclusive "Sem Grupo"; apagar grupo (`window.confirm`, ideias voltam a "Sem Grupo"); votar. Sem renomear/reordenar grupo.
- **Matriz:** DnD nativo entre 5 colunas, cada uma grava ROI/Esforço fixo (A Classificar 50/50, Quick Wins 80/20, Estratégico 80/80, Secundários 20/20, Descartar 20/80); botões rápidos "Mover para Quick Wins"/"Descartar".
- **Plano:** "Exportar para 5W2H"; edição inline do texto (Enter salva, Shift+Enter quebra, blur salva, sem Esc; bloqueado se oculta); "Ver tudo/menos" (>100); `<select>` invisível troca o grupo.

### Painéis
- **Barra própria (56px):** seta "Voltar para o início" (vai para `/`, não ao hub); título + subtítulo "BRAIN • fase"; seletor de fases (participante vê desabilitado em xl e **nada** abaixo de xl); `EliteTimer` (some abaixo de sm); Guia; só facilitador: Anonimato, Revelar/Ocultar, Apresentação; "Convidar Time" (copia link); Participantes; "Exportar" (bloqueado ao participante com ideias ocultas). **Sem tema, projeto, perfil ou feedback.**
- Sidebar "PARTICIPANTES" (`EliteSidebar` + `EliteParticipantList`, rodapé "Convidar Time").
- Mural: barra de busca/ordenação/contador, input, grid 1–6 colunas.
- Grupos: "Classificação", colunas com scroll, "Sem Grupo" fixa.
- Matriz: "Kanban de Triagem", dica dos Quick Wins, 5 colunas.
- Plano: "Execução Imediata (Quick Wins)" com TOP n; "Iniciativas Estratégicas"; "Rank Total de Ideias" (top 10: Rank, Ideia, Grupo, Votos 🔥, Valor/ROI).

### Modais e toasts
- Dialog "Iniciar Brainstorming"; Sheet do guia (3 princípios, "Atalhos do Canvas", dica, link `/manual#brainstorming`); `EliteExportDialog` (prévia MD, "Fechar", "CSV (Excel)", "Salvar Imagem", "Copiar Resumo"); AlertDialog "Remover Participante?".
- `window.confirm`: remover ligação, apagar grupo.
- Toasts: sessão encerrada (redireciona); falha ao entrar; erros genéricos; "Ideias fundidas!"; "Link copiado!"; "Resumo copiado!"; "Download Iniciado!"; "Plano de ação criado!" / "Plano criado, mas faltam ações"; "Erro na exportação"; hub (perfil, título, criação).

### Dados
- REST: `GET/POST/PATCH /brainstormings[/{id}]`, `GET/POST/DELETE .../participants`, `GET/POST .../ideas`, `PATCH/DELETE .../ideas/{id}`, `POST .../ideas/{id}/vote`, `POST .../ideas/{target}/merge/{source}`, `GET/POST .../groups`, `DELETE .../groups/{id}`. Sem uso: `listBoards`, `deleteBoard`.
- **Integração 5W2H:** `actionPlanApi.createBoard` ("Plano de Ação: {título}") + `createTask` do top 5 por votos (sem ocultas nem "Descartar"): what = texto, why = "Ideia priorizada... (ROI: x%)", where = grupo, howMuch = "Esforço: x%"; navega para `/action-plan/{id}`.
- **WS** `/ws/brainstorming/{id}` via `connectRoomSocket` (backoff 1,5s–15s): `BOARD_UPDATED`, `BOARD_DELETED`, `PARTICIPANT_JOINED/LEFT`, `IDEA_SAVED/DELETED`, `GROUP_SAVED/DELETED`, `REFRESH_BOARD`.
- Carga com `Promise.all` + `reloadSeq`; revelar/anonimato recarrega só ideias; auto-join com `role || 'DEV'`.
- localStorage: `brainstorming-sound-enabled`, `agileSpace_rooms_meta`, `feedback_sent_*`.
- Export: MD por grupo/votos com ROI/Esforço; CSV com BOM (Grupo, Votos, Conteúdo, ROI, Esforço, Data); PNG via `html-to-image` (mural e teia).
- `document.title` "{título} | Brainstorming | Portal Tech V&D"; som externo mixkit.

### Papéis
- Facilitador (`creatorId`): fase, timer, anonimato, revelar, apresentação, remover participante, exportar com ideias ocultas.
- Participante: lança, vota, **edita e funde qualquer ideia**, exclui só as próprias, cria/apaga grupos, move, prioriza, liga na teia, **exporta para 5W2H**, vê timer.
- "Assumir controle" suportado pelo componente mas não ligado.

### Detalhes fáceis de perder
- Timer: presets 1–5 min, mas a criação grava 600s; vermelho nos últimos 10s; alarme uma vez por `endTime`; **não há botão de som na UI**.
- "Hot" com ≥3 votos (anel laranja e chama). Ideia oculta borrada com cadeado ("Uma ideia anônima está sendo escrita..."; "Ideia oculta pelo facilitador" na Matriz/Plano). Anonimato mostra "Anônimo"; o autor vê "Você".
- Apresentação só esconde o input do Mural. Teia: (0,0) cai numa grade 3 col (400×300); novas em posição aleatória 100–500.
- Sem edição otimista; textos preservados em erro.
- **Mobile:** sidebar `hidden md:flex` (botão Participantes não faz nada abaixo de md); timer some; Matriz sem DnD em toque (só botões rápidos); grip só no hover.
- Hub mostra só 4 `referenceSections` ("5. Ações" nunca aparece).
- Empty states: mural vazio, busca sem resultado, "Arraste ideias aqui", "Solte aqui", sem Quick Win, sem estratégica.

### Morto, fake ou quebrado
- **Feedback inacessível** (`setFeedbackSignal` nunca chamado).
- **"Salvar Imagem" fora de Mural/Teia** deixa `isExporting=true` e dispara download sozinho ao voltar para essas fases.
- **Editar card no Grupos descarta a edição** (sem `onUpdate`).
- `idea.children` nunca preenchido (FLAG).
- **Guia fake:** cursores dos colegas, duplo clique, Espaço+Arrastar, canvas infinito.
- Hub cita fase "3. Votação" inexistente.
- `ExportDialog.handleCopy` duplicado sem uso; `Toolbar.handleCopyLink` duplica a página.
- Props/API sem uso; `removeRoom` não exposto; imports sem uso; `role` com `as any`.
- Entrar por ID em MAIÚSCULAS (provável falha com UUID).

---

## 5.2 Health Check (Radar de Saúde)

### Arquivos

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/health-check/page.tsx` | 173 | Hub (rose) + `CreateHealthCheckDialog` |
| `src/app/health-check/[id]/page.tsx` | 331 | Sala: WS, join, voto, encerrar, escolha da tela |
| `src/app/health-check/api.ts` | 90 | `healthCheckApi` |
| `components/health-check/CreateHealthCheckDialog.tsx` | 423 | Configuração |
| `HealthCheckVotingBoard.tsx` | 414 | Votação |
| `HealthCheckResults.tsx` | 579 | Resultados |
| `HealthCheckRadarChart.tsx` | 157 | Radar (recharts) |
| `ExportHealthCheckDialog.tsx` | 262 | MD, CSV, PDF |
| `HealthGuide.tsx` | 143 | Sheet do guia |
| `FinishHealthCheckDialog`, `HealthCheckNicknameDialog`, `HealthCheckTrendChart` | 71/31/135 | **Mortos** |
| `lib/health-check-defaults.ts`, `lib/health-check-templates.ts` | 12/68 | 8 dimensões padrão, 4 templates |

### Estados
- "Configurando identidade..." / "Carregando Radar de Saúde..." / `NotFound` / "Juntando-se à sala...".
- `collecting` → votação; `finished` → resultados. Só o criador encerra (confirmação). Ao encerrar, recarrega votos (dos meus → todos anônimos). **Não há reabrir.**

### Ações
- **Hub:** "Nova Sessão", entrar por ID, recentes (type `health`), feedback.
- **Criação:** template (Spotify, Maturidade Scrum, Excelência Técnica, Clima e Moral — troca dimensões e escala); escala Semáforo / Numérico 1-5 / Emocional; Título*; Squad/Time; dimensões com edição inline, excluir (hover), "Adição rápida", "Importar" em massa (uma por linha, separadores ` - `, `: `, ` – `, ` — `), "Limpar" (sem confirmação), "Restaurar Dimensões Originais"; "Salvar preferências como meu padrão" (só dimensões); "Cancelar"/"Lançar Radar".
- **Votação:** votar por dimensão (troca, sem desvotar): Ótimo/Atenção/Ruim, 1–5 ou 😫/😐/🙂; comentário "Por que essa nota?" (2000, só após votar, debounce 700ms + blur/encerrar/desmontar); copiar link; guia; "Encerrar" (criador); feedback; RoomHeader completo.
- **Resultados:** "EXPORTAR RADAR"; copiar link; abas "Frequência de Faróis"/"Gráfico Radar"; tooltip com contagens; **"Gerar Plano de Ação" cria cards no Kanban pessoal** (vira "Ver no Workspace"); "Sair do Radar" → `/workspace`.
- **Exportar:** "Relatório Markdown" (copia), "Dados Brutos (CSV)", "Snapshot Visual (PDF)".

### Painéis
- **Votação:** RoomHeader (sprintName; "Progresso %" lg+; chip de participantes; Copiar; Encerrar; Guia); banner "Privacidade Anonimato — votos 100% secretos"; grid de dimensões (título, descrição, bolinha da cor, botões, comentário, "Voto Registrado"/"Aguardando Avaliação").
- **Resultados:** RoomHeader (Exportar, Copiar, "Concluído"); hero "Resultado Consolidado" (insights, Engajamento %, Categorias, Health Score 0–10 com cor ≥8/≥5); "Cultura de Feedback"; abas de gráfico; "Pontos Fortes"; "Faróis de Atenção"; "Sugestão de Foco" (estático); "Plano de Ação Imediato"; "Detalhamento Analítico" por dimensão (Avg, distribuição, "Comentários Anônimos"); rodapé "Health Snapshot v2.5".

### Modais e toasts
- Dialog de criação; AlertDialog "Encerrar Radar de Saúde?" ("Continuar Votando"/"Confirmar e Gerar Resultados"); Sheet do guia (3 passos, "Como Interpretar", "Segurança de Dados", `/manual#health-check`); Dialog "Exportar Snapshot" (layout escondido a -9999px para o PDF); FeedbackWidget flutuante.
- Toasts: radar apagado; falha ao entrar; erro ao votar; "Aguarde"; "Acesso negado"; "Radar finalizado!"; erro ao finalizar; link; "Tudo saudável!"; "Plano de Ação Gerado!" (ação "Acessar Kanban"); exportações; dimensões importadas; padrão restaurado; template carregado; validações; hub.

### Dados
- REST: `GET/POST /health-checks[/{id}]`, `POST /health-checks/{id}/finish`, `GET /health-checks?squadId=` (só usado no workspace), `DELETE` (sem UI), `GET/POST/DELETE .../participants`, `GET .../votes` (aberto: só os meus; encerrado: todos anônimos), `POST .../votes`.
- Kanban: `POST /workspace/{userId}/kanban` com "Melhorar: {dimensão}", prioridade `critica`/`media`, tag "Saúde da Squad", `originLink`.
- **WS** `/ws/health-check/{id}`: `BOARD_UPDATED`, `BOARD_DELETED`, `PARTICIPANT_JOINED/LEFT`, `VOTE_SAVED`, `REFRESH_BOARD`.
- Auto-join com `GlobalRole` → `TeamRole`.
- localStorage: `custom-health-check-dimensions`, `agileSpace_rooms_meta`, `feedback_sent_Health Radar`.
- recharts, jspdf + html2canvas, date-fns. Resumo calculado no servidor; radar recalcula médias no cliente.
- `document.title` "{sprintName} | Radar de Saúde | Portal Tech V&D".

### Papéis
- Criador: único com "Encerrar" (página também barra com "Acesso negado").
- Todos: votar, comentar, copiar, guia; nos resultados exportam e geram plano no próprio Kanban.
- Anonimato total na votação (nem o criador vê); só contagem de participantes.
- `isCreator` passado aos Results e não usado.

### Detalhes fáceis de perder
- Progresso = minhas dimensões votadas / total (lg+).
- Comentário sem voto fica só local; com voto vai em segundo plano; erro mantém o texto.
- Health Score = média das médias / máximo (3 ou 5) × 10. Fortes ≥2,5 (≥4 numérico); atenção >0 e <1,8 (<2,5 numérico).
- Critério do plano: semáforo (vermelho ou amarelos > verdes), emocional (triste ou neutros > felizes), numérico (1/2 ou média <3).
- `h-screen` com scroll interno. **"EXPORTAR RADAR" é `hidden sm:flex`** (sem alternativa no celular).
- Dialog de exportação some sem votos; radar "Não há dados suficientes...".
- Join falho prende em "Juntando-se à sala...".
- **Recarregar reabilita "Gerar Plano de Ação"** → duplica cards no Kanban.

### Morto, fake ou quebrado
- **Exportação errada fora do semáforo** (conta só green/yellow/red → MD/CSV/PDF zerados).
- **Pontos fortes/fracos da exportação sempre vazios** (usa `r.red` etc., mas o dado tem `values`).
- MD copia sem fallback nem tratamento de erro.
- **Dados fake:** "Engajamento" supõe 5 participantes; "Data Inicial: Sprint Atual" fixa; "Snapshot Oficial"/"Finalizada" estáticos.
- Badge "Avg" com limiares fixos também no 1–5; radar diz "de 1 a 3" mesmo no 1–5; distribuição em `grid-cols-3` com 5 valores.
- Configuração: preferência não salva a escala; Select de template não-controlado; recarrega dimensões quando o perfil muda (pode apagar edição).
- Tendência entre rodadas não existe (TrendChart morto), embora o hub diga "Olhe a tendência".
- "Gerar Plano de Ação" aqui cria cards no Kanban, não um 5W2H (nome confunde).

---

## 5.3 Plano de Ação (5W2H)

### Arquivos

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/app/action-plan/page.tsx` | 283 | Hub (fuchsia) + dialog "Criar Plano de Ação" |
| `src/app/action-plan/[id]/page.tsx` | 192 | Sala: carga, polling, RoomHeader, guia, exportação |
| `src/app/action-plan/api.ts` | 80 | `actionPlanApi` |
| `components/action-plan/ActionPlanBoard.tsx` | 339 | Tabela 5W2H com edição inline e status |
| `ActionTaskDialog.tsx` | 268 | Criar/editar/excluir ação |
| `ExportActionPlanDialog.tsx` | 116 | MD + CSV via `EliteExportDialog` |
| `ActionPlanGuide.tsx` | 141 | Sheet do guia |
| `lib/sprintCycleNav.ts` | — | Entrada pelo ciclo de sprint |

### Estados
- Spinner fuchsia; erro de rede com "Tentar novamente"; 404/403 → toast e volta ao hub; normal (tabela, sem fases); sem identidade → `requestIdentity()`.

### Ações
- **Hub:** "Nova Sessão" (Título*, Squad pré-preenchida por `?squad=`/perfil, `?sprintId=` gravado escondido), "Iniciar Matriz"/"Talvez depois", entrar por ID, recentes (`action_plan`).
- **Sala:** Guia "?", Compartilhar (copia), "Exportar", RoomHeader padrão. **Sem feedback.**
- **Tabela:** "Nova Ação"; edição inline em What, Why, How, Where, When, Who (clique ou Enter entra, Enter/blur salva, Esc cancela, erro mantém editando); status clicável A Fazer → Em Andamento → Concluído → Impedido → A Fazer; "Editar Detalhes" (só hover/foco).
- **Dialog:** What*, Why, How, Who*, When (texto livre), Where, How Much; status (4 botões, só edição); "Excluir" (`window.confirm`); Cancelar/"Salvar Ação".
- **Exportar:** prévia MD, "Copiar Resumo", "CSV (Excel)", "Fechar".

### Painéis
- RoomHeader; "Matriz de Execução / Gerencie o 5W2H para {título}" + "Nova Ação"; tabela com cabeçalho fixo (#, What + "Custo", Why/How empilhados, Where, When, Who com iniciais, Status); vazio "Nenhuma ação definida ainda…".
- Hub: 3 dicas e "Como funciona" (só What, Why, Where, When dos 7).

### Modais e toasts
- Dialog de criação; dialog "Nova Ação 5W2H"/"Editar Ação"; `window.confirm` excluir; `EliteExportDialog` sem "Salvar Imagem"; Sheet do guia ("Atalhos da Matriz", "Dica Ágil", `/manual#action-plan`).
- Toasts: não encontrado / sem acesso; link; "Não foi possível salvar" ("O texto continua na célula"); status; campos obrigatórios; excluir; resumo copiado; download; hub.

### Dados
- REST: `GET /action-plans?sprintId=` (sprintCycleNav), `GET /action-plans?squadId=` (**sem uso**), `POST /action-plans`, `GET /action-plans/{id}`, `POST .../participants` (**sem uso**), `GET/POST .../tasks`, `PUT /action-plans/tasks/{id}` (parcial; "" limpa), `DELETE /action-plans/tasks/{id}`.
- **Sem WebSocket:** polling de `listTasks` a cada 15s com a aba visível + ao voltar à aba; toda edição faz refetch.
- Criação envia `settings:{isPublic:true}`, `participantIds`, `sprintId`; ação nova com `authorId` e `order`.
- localStorage `agileSpace_rooms_meta`.
- Export: MD por ação (PT); CSV com BOM, 9 colunas, status em inglês.
- Entradas: fase Plano do Brainstorming e `sprintCycleNav` (CeremoniesDashboard do admin).

### Papéis
- **Nenhuma diferença no front:** qualquer logado com o link cria, edita, exclui, muda status e exporta. `creatorId` e `isPublic` não são lidos. Sem participantes nem auto-join.

### Detalhes fáceis de perder
- Rótulos de status variam: tabela PT, dialog EN maiúsculo, CSV EN. Status desconhecido → "A Fazer".
- Avatar do Who: 2 letras ou "??". How Much só no dialog. When sem date picker.
- Sem reordenar, filtro, busca ou ordenação.
- `table-fixed` com scroll horizontal no mobile; "Editar Detalhes" invisível no toque; rótulo "Exportar" some abaixo de sm.
- `savingRef` evita salvar duas vezes; erros do polling só `console.warn`.

### Morto, fake ou quebrado
- Ícone do RoomHeader vazio (`toolIcon={undefined}`).
- Sem feedback; `document.title` não atualiza.
- `FieldIcon` com Tailwind dinâmico (classes provavelmente purgadas).
- `handleCopy` sem uso; FLAG desatualizado sobre `RoomMeta['type']`.
- Hub mostra 4 dos 7 itens do 5W2H.
- **Workspace não lista planos de ação nem brainstormings** no histórico.
- `login-context.ts` só reconhece `/room/`, `/retro/`, `/brainstorming/` → quem chega deslogado por link de health-check ou action-plan não vê "Você foi chamado para uma sala".

---

## 5.4 Peças repetidas entre as três

1. **Hub:** `saveRoomMeta` + `ROOMS_META_KEY` copiados nos três; `handleCreate` com as mesmas validações; `onNewSession` com `requestIdentity`; pré-preenchimento de squad. Brainstorming e Plano têm o **mesmo dialog de criação**.
2. **Cabeçalho:** Brainstorming tem barra própria; HC e Plano usam RoomHeader; os três têm Guia "?", Copiar link e Exportar.
3. **Copiar link** implementado 5 vezes com textos diferentes.
4. **Guia (Sheet):** os três são o mesmo template (header escuro, 3 passos, lista, dica, "Acessar Manual Completo").
5. **Exportação:** Brainstorming e Plano usam `EliteExportDialog` (ambos com `handleCopy` morto); HC tem dialog próprio; 3 geradores de CSV.
6. **Sala em tempo real:** Brainstorming e HC duplicam `reloadSeq`, `joinAttempted`, reset por id, `wsBase`, `connectRoomSocket`, auto-join, gate de Loading/NotFound, `document.title`; `upsertById` duplicado. Plano usa polling.
7. **"Gerar plano de ação"** em duas versões que não conversam (Brainstorming → 5W2H real; HC → Kanban pessoal).
8. **Edição inline com `savingRef`** reimplementada em `ActionsPhase`, `ActionPlanBoard.InPlaceInput`, `IdeaCard` e comentários do HC.
9. **Feedback:** inacessível (Brainstorming), flutuante + header (HC), nenhum (Plano).
10. **Participantes:** sidebar completa (Brainstorming), só contagem (HC), nada (Plano).
11. **Confirmações** misturam `window.confirm` e `AlertDialog`.
12. **Tabelas de cor/classificação próprias:** quadrantes, escala do HC (repetida entre Radar e Trend), `STATUS_INFO` do Plano.
