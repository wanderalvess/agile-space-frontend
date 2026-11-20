# 4. Showcase (Review da sprint + modo Teatro) — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/`.

## 1. Arquivos

**Rotas (`src/app/showcase/`)**
- `page.tsx` (237): hub `/showcase` — lista Reviews da squad e dialog "Configurar Review".
- `[id]/page.tsx` (1057): sala — carga, WebSocket, fila de salvamento, lista com filtros/ordenação, e liga Teatro, Summary, Settings, Jira e Tour.
- `[id]/layout.tsx` (18): metadata/OpenGraph.
- `api.ts` (89): `showcaseApi` + URL do WS.

**Componentes (`src/components/showcase/`)**
- `ShowcaseDashboard.tsx` (564): os 5 cards do hub.
- `ShowcaseRoomHeaderActions.tsx` (101), `ShowcaseRoomHeaderBadge.tsx` (121): ações e badge "Esforço total"/"Prontidão" do cabeçalho.
- `TaskCard.tsx` (190), `TaskCardHeader.tsx` (184), `TaskCardSummary.tsx` (61), `TaskCardContentFields.tsx` (66), `TaskCardExecutionDetails.tsx` (210), `TaskCardAttachments.tsx` (208), `TaskCardFields.tsx` (54), `ControlledFields.tsx` (89): card editável e seus pedaços.
- `MetricsEditor.tsx` (172), `chartPresets.ts` (106), `ChartRenderer.tsx` (38): métricas e gráficos (`ui/SimpleBar|Pie|LineChart`).
- `TeatroMode.tsx` (845, com `TaskSlide`), `TeatroHeader.tsx` (198), `ShowcaseCover.tsx` (220), `TaskFileEvidence.tsx` (132), `useTaskFileBlob.ts` (50): modo Teatro.
- `SessionSettingsDialog.tsx` (906): configurações em 4 abas.
- `SummaryDialog.tsx` (649): resumo final e exportações.
- `PrintSlidesView.tsx` (357): slides em `@media print`.
- `ShowcaseTour.tsx` (186): tour de 5 passos.
- `types.ts` (289), `utils.ts` (297), `__tests__/` (3 testes, só utils).

**Dependências compartilhadas:** `shared/JiraImportDialog.tsx` (811), `shared/ToolHubLayout.tsx` (419), `layout/RoomHeader.tsx` (213), `lib/sprintCycleNav.ts`, `squad/api.ts` (`getSquad`), `work-items-api.ts` (`showcaseDecision`), `retro/api.ts` (`listBoards`), `services/jiraService.ts` (1075), `useJiraSettings`, `useSavedJqls`, `useToolHistory`.

Total ≈ 7.700 linhas próprias + 2.000 compartilhadas.

## 2. Estados e fases

**Hub:** esqueleto de 5 blocos → dashboard. Sem squad resolvida, lista vazia.

**Sala**
1. Loading "Sincronizando Showcase...".
2. Erro "Review não encontrada" / "Não foi possível carregar", com "Tentar de novo" (só erro de conexão) e "Voltar para as Reviews".
3. Vazia (0 cards): onboarding "Sua Review está pronta" — 3 passos, "Importar do Jira" e "Criar card manual".
4. Preparação: lista de cards com busca, filtros e ordenação.
5. `?setup=1` (vindo da criação) abre o Settings sozinho e é removido da URL.
6. Primeiro "Apresentar" sem "Objetivos da sprint" abre o Settings com banner (uma vez por visita).
7. **Teatro** (`isPresenting`): sempre começa na **capa** (`currentIndex=-1`), depois slides 0..n-1. Cabeçalho do Teatro oculto na capa. Fecha por X, Esc ou X da capa.
8. **Finalizar** (só no último card): `window.confirm` se houver cards sem decisão → grava `status:'finished'`, fecha o Teatro, abre o Summary.

**Status:** `planning` na criação, `finished` ao finalizar. `presenting` só é lido no dashboard e **nunca gravado**. `finished` não bloqueia edição nem mostra selo.

## 3. Ações do usuário

**Hub**
- "Nova Review" (pede identidade se não logado). Dialog: Título (obrigatório), Squad/Time (pré-preenchido), Sprint (opcional); Enter cria; navega para `/showcase/{id}?setup=1`.
- Entrar por ID ou link colado (regex `showcase/...`).
- "Retomar Sessão" e 3 cards do histórico.
- Checklist de 4 itens (clique/Espaço/Enter) grava `readinessChecklist` na sessão mais recente.

**Cabeçalho da sala**
- Título editável inline (debounce 700ms, commit no blur, vazio reverte).
- "Adicionar": Importar do Jira / Card padrão / Card de métricas.
- "Configurar", "Copiar link".
- "⋯": "Retro desta sprint", "Como funciona" (tour).
- "Apresentar".
- Dropdown "Prontidão": cards com status de preparação; ↻ sincroniza quando o status manual diverge do conteúdo.

**Lista**
- Busca (chave, título, dev, QA); selects Dev, QA, Tipo; ordenação Chave/Tipo/Dev/QA (ordem natural); chips de filtros ativos com × e "Limpar Tudo"; "Carregar mais N tarefas" (20 por página).

**Card (edição inline)**
- Texto com debounce 400ms + flush no blur/desmontar: Chave (MAIÚSCULA), Título, Problema, Solução, Critérios, Contexto (métricas), Dev, QA, Projeto, versões (Suporte, Master, Release, Develop), Print, Vídeo, Doc técnico, TDN, Feedback da Review.
- Selects Tipo (`ISSUE_TYPES`) e Preparação (Aguardando, Em Preparação, Em Revisão, Pronta).
- "Abrir no Jira"; abrir cada link em nova aba.
- "Abre primeiro: Vídeo/Print" (só com os dois links).
- Recolher/expandir (só com "Pronta"); clicar na linha-resumo expande.
- Remover card com confirmação inline "Remover card e anexos" / "Manter".

**Anexos:** clique ou drag-and-drop; múltiplos (um por vez); abrir (nova aba recebe o blob); remover com confirmação inline.

**Métricas:** "+ Métrica de Impacto"; linhas campo/valor; tipo Barras/Pizza/Linha; título; "Gráfico Pronto" (4 presets); Compacto/Destaque (card padrão).

**Teatro**
- Capa → "Iniciar Apresentação".
- ← / "Próxima", segmentos de progresso clicáveis, teclado ←/→/Esc.
- Decisões: "Aprovar" grava direto; "Ajustar" e "Rejeitar" abrem modal de feedback.
- Recolher painel lateral, tela cheia, "Ver/Ocultar detalhes", "Evidência i/n", lightbox de imagem, "Nova Aba", "Abrir em nova aba", "Doc. técnico", "TDN".

**Summary:** "Copiar aprovações" (tabela MD), "Baixar log (.md)", "Exportar slides (PDF)", "Copiar links das issues", abrir/copiar link Jira por card.

**Settings:** 4 abas, chips do checklist levam à aba certa, Salvar/Cancelar.

**Impressão:** Ctrl+P imprime `PrintSlidesView` (sem botão).

**Atalhos:** Teatro ←/→/Esc; modal de feedback Esc; Tour Esc/→; hub Enter; checklist Espaço/Enter; dialogs Esc.

## 4. Painéis

**Hub (grid 12 col):** Boas-vindas (Nova Review + entrar por ID); "Métricas de Aceite" (anel % aceite, nº sessões/tarefas, barra "Evidências Configuradas"); "Última Review" (status, barra empilhada, Aprovados/Ajustes/Rejeitados/Pendentes, Retomar); "Review Sem Slides" (checklist 4 passos); "Histórico de Reviews" (3 + "N Registros").

**Sala:** RoomHeader (Home, ícone, título editável, badge Esforço total horas gastas/estimadas + Prontidão, ações, tema, projeto, perfil); barra de busca/filtros/ordenação; grid de TaskCards (faixa lateral da preparação, borda verde se completo, selos "Manual"/"Métrica", selo de decisão, bloco de feedback quando ajuste/rejeição).

**Teatro:** header 3 zonas (navegação / progresso + timer / decisões + utilitários); painel lateral (~26–30%; chave, tipo, decisão, título, Problema/Contexto, chips de métricas, dev, QA, esforço, links; "Ver detalhes" com Solução, Critérios, Deploy/Versões, gráfico compacto); palco com gráfico grande, anexo, embed (Loom/YouTube/Drive/PDF), imagem, fallback de link ou "Sem evidência vinculada". Capa com título, squad, período/sprint, "Entregas Prontas", objetivo, "Pauta", "Tipo Dominante".

**Settings:**
- Geral: Título, Squad, Data/Ciclo, Ordenar por (`defaultSort`), Objetivos.
- Cards e link: contagem, Importar do Jira, criar card, link + Copiar, tabela "De onde vem cada campo".
- Capa: 5 fundos, imagem por link + "Aplicar", preview.
- Apresentação: filtro Todos/Claro/Escuro, 12 presets, color picker, input livre (hex/CSS/URL), 5 atalhos de cor, 4 estilos de interface, prévia ao vivo.

## 5. Modais, popovers, confirmações, toasts

- **Configurar Review** (hub).
- **SessionSettingsDialog:** edita cópia local, salva só o diff; fechar com mudanças pede `window.confirm`; banner âmbar "Apresentar mesmo assim".
- **JiraImportDialog:** aba XML (upload múltiplo, dedup por chave); aba API (domínio, PAT, JQL; abre direto se já há token); chips de JQL salvas (privadas/"públicas", excluir no hover); 8 presets fixos; "Lembrar credenciais"; busca enriquecida com subtarefas "Codificação" e contexto da issue pai; revisão com filtro, chips de tipo/status, seleção, "Marcar todas"/"Desmarcar" (sobre o filtrado), "Ver detalhes", "Resetar", "Outra Busca", "Importar Selecionados (n)"; sub-dialog "Salvar Consulta JQL"; chaves existentes são ignoradas ("Nenhuma tarefa nova").
- **SummaryDialog:** participantes (`members`), 4 contadores, taxa de aprovação, Estimado÷gasto, Tempo total; lista por decisão (Ajuste, Rejeitadas, Aguardando, Aprovadas) com quem/quando/feedback; exportações.
- **Teatro:** modal de feedback (textarea opcional, "Descartar"/"Confirmar Decisão", preso ao card; fecha se o card sair); lightbox.
- **Dropdowns** "Adicionar", "⋯", "Prontidão", "Criar card manual"; popover "Gráfico Pronto" (div própria, não Radix).
- **ShowcaseTour:** spotlight em `data-tour` (search, first-card-status, jira-import, start-teatro); Próximo/Voltar/Pular/Concluir; pula alvos ausentes; abre sozinho 600ms após carregar se há cards e não visto.
- **Confirmações:** inline (remover card/anexo); `window.confirm` (finalizar com cards abertos, descartar Settings).
- **Toasts:** falha ao carregar/criar, "Nome obrigatório"; "Não foi possível salvar a última alteração" (reverte); importação/cards; "A decisão não foi gravada"; "Decisão salva na Review, mas não chegou ao acompanhamento da squad"; Retro (squad não identificada, sem sprint ativa, erro); link copiado; "O card em foco saiu da Review"; anexos (limite, sucesso, falhas); checklist; PDF/cópias; Jira (XML lido, busca concluída/truncada, JQL salva/excluída).

## 6. Dados

**REST (`showcase/api.ts`)**
- `GET /showcase-sessions?limit=50&squadId=`
- `GET /showcase-sessions/{id}` (404 → null)
- `POST /showcase-sessions` — cria **e** atualiza, sempre o documento inteiro
- `POST /showcase-sessions/{id}/tasks/{taskId}/files` (multipart)
- `DELETE /showcase-sessions/{id}/files/{fileId}`
- `GET /showcase-sessions/{id}/files/{fileId}` (blob)

**Outros**
- `PUT /work-items/{squad}/{jiraKey}/showcase-decision` `{status, feedback}` — approved→delivered, rejected→rejected, needs_adjustment→carried_over, open→committed; só chaves Jira reais; disparado sempre que decisão **ou feedback** muda (inclusive editando no card).
- `GET /squads/{id}` + `GET /retros?sprintId=` ("Retro desta sprint" → `/retro/{id}` ou `/retro?sprintId=&squad=`).
- Jira (rotas Next): `POST /api/jira/search` (timeout 30s, chunks de 100), `POST /api/jira/attachment` (proxy de imagens).
- Credenciais Jira: `/users/{id}/jira-config`.

**WebSocket** `/ws/showcase/{id}?token=` — só recebe `SESSION_UPDATED` (ignorado com salvamento pendente ou `updatedAt` mais antigo; outros tipos → reload). Backoff 1s–30s, ressincroniza ao abrir e ao voltar a aba. **Cliente não envia nada: sem presença e sem sincronizar o slide.**

**Fila de salvamento:** cada mutação faz GET da versão atual, reaplica as mudanças locais e faz POST (merge otimista).

**localStorage:** `agileSpace_rooms_meta`, `agileSpace_showcase_tour_v1`, `agile_jira_config_{userId}` (migra `agileSpace_jira_config`), `agile_jql_presets_public`, `agile_jql_presets_private_{userId}`.

**Integrações:** Jira (XML, API, proxy de anexos); embeds Loom, YouTube, Google Drive (preview e `lh3`), Dropbox; Unsplash (capas); jsPDF; Markdown. Sem IA, Spotify, Google Auth ou CSV.

## 7. Papéis e permissões

- **Decidir** (Aprovar/Ajustar/Rejeitar) só para `role` ∈ {Product Owner, Product Owner (PO), SME}. Demais veem botões desabilitados com selo "Somente PO/SME" (só xl).
- **Todo o resto é aberto a quem tem o link:** editar, importar, remover cards e anexos, configurar, apresentar, finalizar. Não há dono/facilitador. Feedback editável por qualquer um e vai para o work-items.
- Criar exige identidade. `/showcase/` escapa do onboarding forçado.
- Admin: só o item "Administração" no menu.

## 8. Compartilhados

`RoomHeader` (ThemeToggle, GlobalProjectSelector, ProfileAvatar); `ToolHubLayout` (onlyChildren) + FeedbackWidget; `JiraImportDialog`; `ui/*` (Simple*Chart, dialog, dropdown, select, tabs, checkbox, scroll-area, card, badge, button, input, textarea, label); hooks `use-toast`, `useJiraSettings`, `useSavedJqls`, `useToolHistory`; `AuthContext`, `UserContext`. **Não usa** presença, timer compartilhado, reações, som ou confete.

## 9. Detalhes fáceis de perder

- **Timers:** título 700ms; campos 400ms; avanço automático 600ms após decisão (se não navegou); tour 600ms/320ms; "Copiado" 2s; cronômetro do Teatro de 1s, zera a cada abertura, não salvo; espera de salvamentos antes de upload até 5s; revogação de object URLs 10s/60s.
- **Limites:** 20 cards por página; 5 arquivos por card, 10 MB, PNG/JPEG/PDF; 50 sessões no hub, 3 no histórico; cache de 12 blobs.
- **Ordem:** natural; `defaultSort` aplicado quando muda; **o Teatro segue a ordenação mas ignora os filtros**; o slide acompanha o card pelo id.
- **Prontidão:** conteúdo completo (problema + solução + evidência/anexo; ou métrica com valor) vs status manual; ponto âmbar na divergência; respeita o filtro.
- Card recolhe sozinho ao virar "Pronta" (não se o foco estiver nele) e reabre se regredir.
- Evidência no Teatro segue "Abre primeiro", anexos depois dos links; próximo embed pré-carregado em iframe invisível; imagens Jira via proxy ("Carregando evidência do Jira..."); ícones/emoticons do Jira não contam como evidência.
- Cor do texto adapta ao fundo; temas `glass`/`minimalist` mudam o painel; tela cheia acompanha o Esc nativo.
- `normalizeSession` mantém campo apagado vazio. Card manual `MANUAL-NNN`; card de métricas nasce com 1 linha.
- **PDF:** A4 paisagem, capa com KPIs + 1 página por card; imagem do print por CORS, senão 1º anexo PNG/JPEG; texto sanitizado.
- **Responsivo:** badge Prontidão/Esforço some abaixo de xl; rótulos somem abaixo de md/lg; no Teatro o painel empilha (máx. 50%), timer só lg+, rótulos de decisão só xl; Summary só ícones abaixo de md.
- Animações só framer-motion; sem som ou confete.

## 10. Código morto, fake ou quebrado

**Fake / hardcoded**
- `'DDWMISSI'` como squad padrão (`page.tsx:81`).
- Domínio `jiraproducao.totvs.com.br` padrão; 8 presets JQL fixos com `sprint = 52188`.
- JQL "Pública — compartilhada com toda a squad" é só localStorage.
- Prévia com "DEMO-101"/"Ana Silva".
- Capa chama de "Entregas Prontas" o total de cards.
- Dashboard mostra "Sem squad atribuído" quando falta `sprintName`.
- % "OK" do histórico (aprovados÷total) ≠ fórmula do anel (aprovados÷avaliados).
- Temas `corporate` e `cinematic` renderizam igual.
- `members` nunca é preenchido; `presenting` nunca é gravado.

**Bugs**
- Chip do filtro QA não aparece e "Limpar Tudo" não zera `filterQa` → estado vazio sem saída.
- Chip de ordenação mostra "Tipo" quando é `qa`, e só aparece com outro filtro ativo.
- Teatro: Esc com lightbox aberto fecha o Teatro; setas trocam de card.
- Settings salva com nome vazio → backend rejeita → toast genérico e reverte.
- "Apresentar mesmo assim" descarta o Settings não salvo sem perguntar.
- `PrintSlidesView` usa URL de vídeo como `<img>` e ignora anexos; sem botão de imprimir.
- **Summary só abre via "Finalizar"** — não há como reexportar uma Review finalizada.
- Select de Tipo só tem `ISSUE_TYPES` (tipo do Jira fora da lista some).
- Hub com `onlyChildren` = `h-dvh overflow-hidden` sem rolagem → provável corte em telas baixas (checar visualmente).
- `ToolHubLayout` chama `useToolHistory('poker')` no hub do Showcase.
- `<input>` passado ao RoomHeader com cast `as unknown as string`.

**Não usados:** vários imports em `[id]/page.tsx`, `TeatroMode.tsx`, `ShowcaseDashboard.tsx`, `page.tsx`, `api.ts` (`resilientReq`); `stats.total/approved/open/ready`; prop `onJoinSession` contornada; `TaskCard.members`. Sem TODO/FIXME.
