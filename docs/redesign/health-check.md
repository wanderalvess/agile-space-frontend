# Radar de clima (Health Check)

Lobby `/health-check`, sala `/health-check/[id]` (votação e resultado) e o que sai deles (plano de ação, exportação). O módulo se chama **Radar de clima** em toda a interface (registro de módulos); "Radar de Saúde" e "Health Check" não aparecem mais em texto. Nada de backend mudou: mesmos endpoints REST e mesmo WebSocket (`/ws/health-check/{id}`).

## Regra única de "em atenção"

`src/lib/health-check-rules.ts`, usada na tela, no resultado, no CSV, no Markdown, no PDF, no plano de ação, na lista e na evolução do lobby. Antes cada um tinha a sua e o plano discordava da lista de "Faróis de Atenção".

- **Nota de clima** (0 a 10) = `(média − 1) ÷ (máx − 1) × 10`, com máx 3 (semáforo e emocional) ou 5 (1 a 5). A pior resposta vale 0 e a melhor 10 nas três escalas. A nota geral é a média das notas das dimensões que têm respostas.
- **Crítico**: 30% ou mais dos votos no pior valor (`red`, `sad` ou `1`) **ou** nota abaixo de 4.
- **Alerta**: nota abaixo de 6.
- **Forte**: nota de 7,5 ou mais.
- Faixa da nota geral: 7,5 ou mais "Forte"; de 5 a 7,5 "No caminho"; abaixo de 5 "Em atenção".

O cálculo parte das **contagens por valor** que o servidor grava em `summary.results[].values`, não da média dele (`HealthCheckService.buildSummary` ainda usa os limites antigos 2,5 e 1,8 só para `topMetrics`/`lowMetrics`, que a tela não usa). Quando o backend ganhar a regra equivalente, troca-se a fonte; `summarizeResults` continua igual. Sem `summary`, as contagens saem dos votos (`resultsFromVotes`).

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/health-check-rules.ts` | Escalas, nota, situação, resumo, frase do resultado, itens do plano |
| `src/lib/health-check-lobby.ts` | Entrar por ID/link, linhas da lista, filtros, evolução, radar anterior, squads |
| `src/lib/health-check-form.ts` | Limites do servidor, importação em massa, validação da nova pesquisa |
| `src/lib/health-check-export.ts` | `buildReport` (um modelo para MD, CSV e PDF), convite em texto |
| `src/lib/health-check-plan.ts` | Criação do plano (item a item, com resultado de cada um), origem enviada ao servidor e trava local de reserva (ver `plano-de-acao-origem.md`) |
| `src/components/health-check/HealthLobbyView.tsx` | Lobby no `PageShell` |
| `src/components/health-check/CreateHealthCheckDialog.tsx` | Nova pesquisa (Modal G, duas abas) |
| `src/components/health-check/HealthRoomShell.tsx` | `RoomTopBar` (Votar, Resultado), participantes, compartilhar, guia, apagar |
| `src/components/health-check/HealthCheckVotingBoard.tsx` | Votação |
| `src/components/health-check/HealthCheckResults.tsx` (+ `HealthResultParts`, `HealthCheckRadarChart`, `HealthPresentation`) | Resultado e modo apresentação |
| `src/components/health-check/HealthPlanDialog.tsx`, `HealthExportDialog.tsx`, `health-check-pdf.ts` | Plano de ação e exportação |
| `src/components/health-check/HealthRoomStates.tsx` | Carregando, entrando, não encontrado, erro, apagado |

## Matriz: função do código anterior → onde ficou

**Lobby** (`page.tsx`, `ToolHubLayout`)

| Função anterior | Agora |
|---|---|
| Cartão "Comece por aqui", "Nova sessão", código da sala | `StartCard`: "Nova pesquisa" e "ID ou link"; extrai o ID do link, volta UUID para minúsculas e mantém a caixa de IDs que não são UUID |
| "Sessões recentes" (3 salas locais) | "Última pesquisa" e "Pesquisas da squad" (servidor, `listBoards`); o atalho local (`agileSpace_rooms_meta`) segue gravando e entra na lista só para a squad ativa |
| Quatro cartões "Como funciona" e três dicas | `HowCard` e `TipsCard` (rótulo não usado removido; "compare os radares" agora é cumprido pela Evolução) |
| `removeRoom` (código morto) | removido; "Apagar pesquisa" é ação do servidor (só o criador, com confirmação vermelha) |
| Criar: modelo, escala, título, squad, dimensões editáveis, adição rápida, importar em massa, limpar, restaurar, salvar como padrão | Mesmas ações no Modal G. Mudanças: squad vem do vínculo (nunca texto livre), limpar pede confirmação, lixeira sempre visível, contadores dos limites (30/255/2000), erros no campo e em faixa |
| "Squad Geral" quando vazio | removido (a pesquisa nasce na squad escolhida; sem squad nasce sem squad, só por link) |
| `saveOrUpdateBoard` ao criar, `saveRoomMeta` | iguais |

**Sala** (`[id]/page.tsx`, `VotingBoard`)

| Função anterior | Agora |
|---|---|
| WebSocket com reconexão e `REFRESH_BOARD`, só a recarga mais recente vale, auto-join uma vez, relê os votos ao encerrar | iguais; ganha estado de conexão visível (`onClose` em `connectRoomSocket`) |
| `BOARD_UPDATED/DELETED`, `PARTICIPANT_JOINED/LEFT`, `VOTE_SAVED` | iguais; `BOARD_DELETED` vira estado de página (quem apagou segue para a lista) |
| Falha de rede mostrava "não encontrada" | `HealthRoomState kind="error"` com "Tentar de novo"; só 404/403 dizem "não encontrado" |
| `RoomHeader` + `GlobalProjectSelector` | `RoomTopBar` do kit (Votar, Resultado, presença, ações) |
| Contador de participantes | pilha de avatares que abre a lista (sem dizer quem votou) |
| Copiar link | Compartilhar: link, QR e convite em texto |
| Botão de guia, `HealthGuide` | `GuideSheet` com abas Como funciona, Escalas, Privacidade (texto corrigido) |
| Feedback do cabeçalho e `FeedbackWidget` | "Sugerir melhoria" no Mais; `FeedbackWidget` sem gatilho próprio |
| Voto: um clique grava, trocar regrava, comentário com envio 700 ms depois da última tecla, ao sair do campo, ao encerrar e ao sair da tela | iguais; ganha "Salvando… / Salvo / Não salvou" |
| Escalas semáforo, 1 a 5, emocional (rótulos de 8 px, emoji) | rótulos de 14 px, ícone de linha, pontas "1 · Crítico" e "5 · Muito bom" |
| Faixa de privacidade | "Respostas anônimas. Você só vê as suas até o facilitador encerrar…" |
| Progresso próprio | cartão visível em qualquer largura |
| Encerrar: confirma, envia comentários pendentes, `finishBoard`, toasts de erro | `ConfirmDialog` vermelho; erro do servidor (ex.: "É necessário pelo menos um voto…") dentro da janela |

**Resultado** (`HealthCheckResults`, `HealthCheckRadarChart`, `ExportHealthCheckDialog`)

| Função anterior | Agora |
|---|---|
| "Health Score" (média ÷ máx × 10) | Nota de clima 0 a 10 (fórmula acima) |
| "Engajamento" (votos ÷ dimensões × 5) | removido; "N respostas por dimensão" (de verdade: contagem de votos por dimensão) |
| "Data inicial: Sprint atual", "Snapshot oficial", versão "v2.5" | "Sobre este radar": criado por, escala, squad, criado em, situação |
| Frequência (barras empilhadas, chaves cruas no tooltip) | `FrequencyChart` com a contagem em cada trecho e rótulos em português |
| Gráfico radar (média no cliente, texto "1 a 3") | `HealthCheckRadarChart`, régua 0 a 10 nas três escalas |
| `HealthCheckTrendChart` (sem uso) | removido; "Comparar com o anterior" (`listBoards` + `previousBoard` + `compareBoards`) |
| Pontos fortes e "Faróis de Atenção" (limiares diferentes) | `StrongCard` e `AttentionCard` pela regra única |
| "Sugestão de Foco" fixa com citação | `FocusCard` com a dimensão real |
| Detalhamento ("Avg: 2.5", chaves cruas) e comentários anônimos | `DimensionDetail` (nota, contagem em português, comentários) |
| "Gerar Plano de Ação" (um cartão por ponto no Kanban pessoal, duplicava ao recarregar) | `HealthPlanDialog`: plano da squad (5W2H via `actionPlanApi`) ou Kanban pessoal, itens editáveis, resultado por item, "Plano criado" persistente (trava local) |
| "Sair do Radar" (levava ao Kanban) | seta do cabeçalho para o Radar de clima |
| Exportar (MD/CSV só semáforo; PDF por captura, campos inexistentes) | `HealthExportDialog` + `buildReport`: MD, CSV e PDF nas três escalas, PDF vetorial em páginas A4 |
| (não existia) | Modo apresentação (`PresentationBar` + `StageNav`: nota, radar, frequência, comentários, plano) |

Removidos por estarem sem uso: `FinishHealthCheckDialog`, `HealthCheckNicknameDialog`, `HealthCheckTrendChart`, `ExportHealthCheckDialog` (substituído).

## Fora da interface (precisa de backend)

- Quantas pessoas já responderam, "N de M" na sala e no resultado (o servidor conta em `RitualSessionService`, mas não devolve no board nem no WebSocket). Hoje: contagem de respostas por dimensão (resultado) e "respostas até agora" do histórico da Home (lobby), quando existe.
- Presença (quem está online): o servidor só avisa entrada e saída. Os avatares e a lista não mostram ponto de online (`online` ficou opcional no kit).
- Todos seguirem a etapa do facilitador na apresentação (evento novo no WebSocket). Hoje cada pessoa navega na própria tela.
- `finishedAt` no radar ("Encerrada em").

## Testes

`src/lib/__tests__/health-check-{rules,lobby,form,export}.test.ts` (regras, ID/link, filtros, evolução, comparação, CSV/Markdown nas três escalas, plano e trava) e `src/components/health-check/__tests__/health-render.test.tsx` (render com mocks do lobby, da votação, do resultado, dos diálogos e dos estados).
