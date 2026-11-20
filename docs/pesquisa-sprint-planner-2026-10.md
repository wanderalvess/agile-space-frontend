# Pesquisa de mercado: redesenho do Sprint Planner (Portal Tech V&D)

Data da pesquisa/acesso às fontes: 2026-10-20. Escopo: somente leitura do código; nenhum código do app foi alterado.

## Sumário
1. Aviso de honestidade e limites da pesquisa
2. O que já temos (frontend, legado, backend)
3. Como as ferramentas planejam a sprint
4. Padrões de UX de uma boa tela de planejamento
5. Boas práticas e antipadrões
6. Integração com Jira Server/Data Center
7. IA no planejamento
8. Síntese: matriz, recursos essenciais, diferenciais, riscos
9. Fontes numeradas
10. 15 perguntas para o encontro com o usuário

---

## 1. Aviso de honestidade e limites
- A ferramenta de busca devolveu resultados rasos. Foram **lidas na íntegra** (WebFetch): Scrum Guide [1], Linear Cycles [2], Azure DevOps capacity [3], GitLab iterations [4], índice da REST API do Jira DC [5]. O restante vem de **resumos de busca** (blogs, listagens de Marketplace, agregadores) e deve ser tratado como opinião de fornecedor.
- **Não consegui verificar**: ClickUp, Asana, Monday, Shortcut, YouTrack, Targetprocess, Aha!, Productboard, Scrumwise (nenhuma fonte primária obtida). TeamRhythm/Tempo/Structure/BigPicture: apenas listagens de Marketplace parciais.
- **Reviews de G2/Capterra e threads de Reddit/Atlassian Community não foram obtidos.** A parte de "elogios/críticas" abaixo é inferência a partir de blogs e precisa ser validada. Não há prints neste relatório.
- Páginas de suporte do Jira Plans retornaram 404 em fetch direto; usei resumos de busca que as citam [6][7].

## 2. O que já temos
**Frontend** (`agile-space-frontend-wt/integration`)
- `src/app/sprint-planner/page.tsx`: só renderiza `ComingSoon` ("Planejador de Entregas", "Capacidade do time e planejamento de sprint, depois do Scrum Poker").
- `src/components/shared/ComingSoon.tsx`: página genérica "Em breve" com botão de voltar.
- Capacidade/roster: `src/app/squad/roster/page.tsx`, `src/components/roster/*` (PersonConfigPanel, RosterTable, RosterKpis, hooks `usePersonConfig`, `useRosterRule`, import/export), `src/app/squad/api.ts`.
- `src/components/squad/SquadPlansTimeline.tsx`: timeline de tarefas Jira com `targetStart/targetEnd`, fases de workflow e datas inferidas. Há também `SquadScrumBoard`, `SquadPerformanceView`, `SquadRituals`.
- `src/components/poker/CreateSessionModal.tsx` referencia capacidade; `src/app/manual/content/PlannerTopic.tsx` documenta um "Planner".

**Legado** (`agile-space-legado`): `src/app/sprint-planner/page.tsx` tem 19 linhas e `agile-tools/sprint-planner/page.tsx` 5 linhas, ou seja, também é placeholder/redirect. **Não há versão antiga funcional para descrever** (não investiguei histórico git).

**Backend** (`agile-space-backend-wt-integ`)
- `SprintPlanning` (tabela `sprint_plannings`: título, criador, `importedPokerRoomIds`, `settings`, `tasks`, `members`) + `SprintPlanningController` em `/api/sprint-plannings` (GET lista "ready for poker", GET/POST/DELETE por id); serviço `SprintPlanningService`.
- `SprintPlanningSettings`: `sprintStartDate`, `workingDays=10`, `focusFactor=70`, `devCount/qaCount`, `devAbsences/qaAbsences`, `isDetailedMode`, `defaultDev/QaHoursPerDay=8`, `isReadyForPoker`.
- `SprintPlanningMember`: nome, papel dev|qa, `focusFactor`, `daysOff`, `hoursPerDay`. `SprintPlanningTask`: nome, link, status, assignee, papel, `hours`, datas, subtasks. **Sem coluna de squad** (coerente com a memória do projeto: SprintPlanning sem squad, logo sem authz por squad).
- `SquadPersonConfig` (`squad_person_configs`): por squad+sprint+jiraAccountId: `papel` DEV/QA, `diasCodificacaoTeste`, `diasRegressivo`, `horasProdutivas`. `SquadCapacityService` resolve herança campo a campo (sprint atual, sprint anterior, default global do squad, default fixo 8h/dia) e calcula `capacityHours = horasProdutivas x (diasCodTeste + diasRegressivo)`.
- `SquadIssueSnapshot` (`squad_issue_snapshots`): chave, tipo, `isBug`, status, sprintId/Name, assignee, `estimateSec`, `remainingSec`, `loggedSec`, `staleSinceDays`, datas, parentKey/título, `pointsEstimated`, `ceremonyStatus`. Sincronizado por `SquadSyncService` + `SquadSyncScheduler` (migração V15).
- Conclusão: **capacidade por pessoa, estimativa em horas e backlog Jira já existem**. Faltam a tela, a regra "comprometimento x capacidade" e a persistência de plano de sprint por squad (o `SprintPlanning` atual parece rascunho pré-Poker, sem ligação a squad).

## 3. Como as ferramentas planejam
| Ferramenta | Tela/mecânica | Capacidade | Carry-over / previsão | Fonte |
|---|---|---|---|---|
| Jira Plans (Advanced Roadmaps), Premium/Enterprise | Sprints com barra de capacidade, vermelha se alocado > capacidade; agrupar por time | Pontos ou horas por iteração; horas = semanais x semanas; default 30 pts; disponibilidade individual afeta velocity prevista | Velocity = média histórica; auto-schedule não consome capacidade se a issue não está em sprint | [6][7] |
| Jira + apps Marketplace (Team Capacity, DiViM etc.) | Heatmap por pessoa, folgas, velocity passada ao lado | Pontos, horas ou nº de issues; default + override por pessoa | Velocity histórica | [8] (fornecedor) |
| Azure DevOps Boards | Página Capacity por sprint; barras de remaining work x capacidade por pessoa e time | Horas/dia por pessoa **por atividade**, folgas individuais e do time, copiar da sprint anterior (só capacidade/dia e atividade; folgas não), capacidade por time para quem está em vários | Sem forecasting nas fontes lidas | [3] |
| Linear Cycles | Ciclos de 1 a 8 semanas, cooldown opcional | Dial em ciclos futuros: média dos 3 ciclos anteriores (issues ou pontos); sem histórico, estima por nº de membros | **Rollover automático**; auto-add de issues iniciadas | [2] |
| GitLab Iterations | Cadências automáticas | Peso aparece só em burn charts | Rollover opcional por bot; burndown/burnup | [4] |
| Zenhub / Parabol / TeamRhythm | Zenhub: sprint planning, velocity, poker; Parabol: poker/retro; TeamRhythm: integra Jira | Não confirmado | IA paga no Zenhub (não confirmado) | [9] (agregadores) |
| ClickUp, Asana, Monday, Shortcut, YouTrack, Targetprocess, Aha!, Productboard, Scrumwise, Tempo, Structure, BigPicture | **Não verificado** | - | - | - |

Pontos confirmados: capacidade é definida por sprint porque ausências variam [3]; a unidade deve ser a mesma que o time usa para estimar [3]; tarefas de até um dia reduzem risco de estimativa ruim [1][3]. **Monte Carlo/forecast probabilístico: não encontrei fonte** em nenhuma das ferramentas acima.

## 4. Padrões de UX de uma boa tela
Derivados das fontes (não de reviews):
- Duas colunas backlog x sprint com totais por coluna, atualizados ao arrastar.
- Barra de capacidade por pessoa **e** por time, com estado de excesso (Jira Plans vermelha [6]; Azure por pessoa [3]). O portal pode ter também por **papel DEV/QA**, análogo ao "Activity" do Azure.
- Capacidade com herança/cópia da sprint anterior [3] (o backend do portal já faz herança).
- Rollover explícito (Linear/GitLab automáticos [2][4]); alternativa: sugerir e o time confirma.
- Meta da sprint em destaque [1].
- Referência histórica tipo dial do Linear (média de 3 ciclos) [2].
- Modo reunião (projeção, sem configuração) e filtros por épico/componente: proposta minha, sem referência de mercado verificada.
- Críticas plausíveis (não verificadas em reviews): lentidão com boards grandes (Zenhub [9]); falta de visão consolidada multi-time no Azure (blog de fornecedor [3b]); capacidade do Jira Plans só em planos pagos [7].

## 5. Boas práticas e antipadrões
- Scrum Guide 2020 [1]: três tópicos. Por quê (meta da sprint, fechada antes do fim do planning); o quê (itens escolhidos considerando desempenho passado, capacidade futura e Definição de Pronto); como (plano, tarefas de até um dia). Timebox máximo de 8h para sprint de um mês; escopo negociável sem mudar a meta.
- Capacidade [10]: (dias úteis - folgas) x horas/dia x fator de foco; fatores típicos 60-80% (blogs, não norma); erro comum é usar média do time em vez de ausências individuais; cuidado com dupla contagem de fator de foco + buffer + velocity; heurísticas de blog: planejar ~80% e alertar acima de ~110% da velocity média.
- Horas vs pontos [11]: debate antigo (Cohn prefere tarefas em horas, Sutherland pontos). O time já estima em horas por papel.
- Antipadrões: overcommit (problema de informação, não de disciplina [10]); planejar 100% da capacidade; ignorar bug/suporte/débito/cerimônias; média do time; carry-over sem reestimar o remanescente.
- Em português: Atlassian BR [12], ClickUp BR (fator de foco 0,6-0,8) [13], GitScrum [14]. São conteúdos comerciais.

## 6. Integração com Jira Server/Data Center
- Suporte ao Server acabou em 15/02/2024 (citado em resultado de busca [15]); o alvo é Data Center. A REST tem grupos Agile (backlog, board, epic, sprint) e Core (issue, search, worklog...) [5].
- Rate limiting no DC (token bucket, HTTP 429, desde 8.6) é configurado pelo admin [16]; a busca pagina por `startAt/maxResults`, padrão 50 [15]. Boa prática: sincronizar em lote no servidor (como `SquadSyncService`), nunca por ação de usuário na tela; a tela lê do snapshot.
- Campos úteis (conhecimento geral, **não confirmado nas fontes lidas**): sprint, `timetracking.originalEstimate/remainingEstimate`, componentes, épico/parent, assignee, issuetype. O snapshot já guarda estimate/remaining/logged, sprint, parent, assignee.
- Reaproveitável sem novas chamadas: backlog e itens da sprint (`squad_issue_snapshots`), capacidade por pessoa (`SquadPersonConfig`), horas por papel do Poker, `staleSinceDays` (sinal de risco), `isBug`.
- Lacunas: registro de ausências/feriados com datas (hoje só contagem de dias), componente/etiqueta nos snapshots (verificar), e escrita de volta no Jira (mover issue de sprint) não existem; decidir escopo e permissões.

## 7. IA no planejamento
- Atlassian descreve Rovo com sugestão de meta, priorização e resumos; geração de plano e balanceamento ficam em apps de Marketplace; há um "Work Readiness Checker" [18]. Tudo é afirmação de fornecedor/blog.
- Azure Boards documenta consulta em linguagem natural (MCP Server) sobre capacidade x trabalho restante [3].
- Útil de verdade (opinião, baixo risco): rascunho de meta a partir dos itens escolhidos (humano edita); lista de itens "não prontos" (sem estimativa, sem épico, parados); alerta determinístico de excesso e de carry-over repetido; resumo da sprint anterior.
- Enfeite/risco: "prever estouro" sem histórico confiável; auto-montar a sprint; qualquer coisa baseada em pontos (o time usa horas). Cada recurso deve começar como regra simples antes de virar IA.

## 8. Síntese
**Matriz resumida** (S = confirmado; ~ = parcial/fornecedor; ? = não verificado)

| Recurso | Jira Plans | Azure | Linear | GitLab | Portal hoje |
|---|---|---|---|---|---|
| Capacidade por pessoa | S | S | ? | n/a | dados sim, UI roster |
| Por papel/atividade | ~ | S | n/a | n/a | S (DEV/QA) |
| Folgas | ~ | S | n/a | n/a | parcial |
| Barra de excesso | S | S | S (dial) | n/a | não |
| Meta da sprint | ? | ? | ? | ? | não |
| Rollover | ? | ? | S | S | não |
| Previsão histórica | S | n/a | S | burn charts | não |
| Copiar da sprint anterior | ? | S | n/a | n/a | S (herança) |

**Essenciais (propostos)**: (1) capacidade por pessoa/papel em horas, com folgas e fator de foco; (2) backlog x sprint com totais ao vivo em horas por papel; (3) barra de excesso por pessoa, papel e time; (4) meta da sprint; (5) carry-over visível com remanescente; (6) reserva explícita para bug/suporte; (7) modo reunião e resumo exportável; (8) salvar o plano por squad.

**Diferenciais realistas**: usar horas DEV/QA do Poker como entrada direta; sinalizar itens sem estimativa ou parados; histórico planejado x entregue por sprint (média própria, como o dial do Linear); copiar capacidade/plano anterior.

**Riscos**: horas x dados Jira incompletos; duplicar capacidade do roster; `SprintPlanning` atual sem squad (authz); carga no Jira; escopo de escrita no Jira; o usuário desconfia da página /squad (dar página própria); evitar o termo "engenharia" na copy.

## 9. Fontes (acessadas em 2026-10-20)
1. Scrum Guide: https://scrumguides.org/scrum-guide.html (lida)
2. Linear, Use cycles: https://linear.app/docs/use-cycles (lida)
3. Microsoft Learn, sprint capacity: https://learn.microsoft.com/en-us/azure/devops/boards/sprints/set-capacity?view=azure-devops (lida). 3b. Blog Canarys (fornecedor): https://ecanarys.com/devopsmartboard-multiple-team-capacity-2/ (só resumo)
4. GitLab iterations: https://docs.gitlab.com/ee/user/group/iterations/ (lida)
5. Jira DC REST, índice: https://developer.atlassian.com/server/jira/platform/rest-apis/ (lida)
6. Atlassian, capacity and velocity: https://support.atlassian.com/jira-software-cloud/docs/what-are-capacity-and-velocity-in-advanced-roadmaps/ (resumo de busca)
7. Atlassian, capacity scrum vs kanban: https://support.atlassian.com/jira-software-cloud/docs/capacity-in-scrum-vs-kanban-teams-in-advanced-roadmaps/ (resumo de busca)
8. Marketplace: https://marketplace.atlassian.com/apps/2392093081 e https://marketplace.atlassian.com/apps/1219264 (fornecedor)
9. Agregadores: https://softwarefinder.com/project-management-software/zenhub/reviews ; https://onlineplanningpoker.com/parabol-alternatives
10. Klority: https://www.klority.com/blog/sprint-capacity-planning-guide/ (blog de fornecedor)
11. InfoQ: https://www.infoq.com/news/2009/09/story-points-versus-hours/
12. Atlassian BR: https://www.atlassian.com/br/agile/scrum/sprint-planning
13. ClickUp BR: https://clickup.com/pt-BR/blog/129861/planejamento-agil-de-capacidade
14. GitScrum: https://docs.gitscrum.com/pt/best-practices/how-to-manage-development-team-capacity-planning
15. Atlassian KB maxResults: https://support.atlassian.com/jira/kb/how-to-use-the-maxresults-api-parameter-for-jira-issue-search-rest-api/
16. Rate limiting DC 8.6: https://community.developer.atlassian.com/t/rate-limiting-coming-to-jira-data-center-8-6/33603
18. IA no Jira (blogs): https://www.eesel.ai/blog/jira-and-generative-ai ; https://resources.rework.com/tools/ai-tools/best-ai-tools-for-agile-teams-2026

## 10. 15 perguntas para o usuário
1. Quem conduz o planejamento e quem precisa participar (PO, líder técnico, QA, gestor)?
2. Quando acontece (dia/hora), quanto dura e é presencial/projetado ou assíncrono?
3. Qual a duração da sprint e as datas de início/fim são fixas?
4. Em que unidade planejam hoje: horas, pontos ou nº de itens? Sempre horas por papel DEV/QA?
5. Como calculam a capacidade de cada pessoa (horas/dia, fator de foco, dias de codificação x regressivo)?
6. Como tratam ausências, férias e feriados, e onde registram isso hoje?
7. Quem entra no cálculo (pessoas em mais de um squad, parciais, terceiros)?
8. Onde fica o backlog de verdade (Jira, planilha) e quem prioriza/refina antes do planning?
9. Como decidem o que entra e o que sai? Há critério de "pronto para a sprint" (estimado, com épico)?
10. Reservam capacidade para bug, suporte, débito técnico e cerimônias? Quanto?
11. O que fazem com itens não concluídos (carry-over): reestimam o restante, voltam ao backlog, seguem automaticamente?
12. Existe meta de sprint hoje? Quem escreve e onde aparece?
13. Quem aprova ou valida o plano e o que acontece se a capacidade estourar?
14. O que fazem com sobra de capacidade e com mudanças de escopo durante a sprint?
15. O que mais dói hoje (planilha, retrabalho no Jira, estimativas, visibilidade) e o plano precisa ser escrito de volta no Jira?
