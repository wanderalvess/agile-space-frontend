# Sprint Planner: plano técnico de implementação

Data: 2026-10-20. Base: backend `agile-space-backend-wt-integ` em develop `35a7db0` (Flyway aplicado até V85); frontend `agile-space-frontend-wt/integration` em develop `9ec1b046`.
Fontes de produto: decisões do usuário (fonte da verdade), os 8 boards `SprintPlanner*.dc.html` (Lobby, Capacidade, Escopo, Apresentacao, Distribuicao, Revisao, Celular, Notas) e `docs/pesquisa-sprint-planner-2026-10.md`.
Escopo deste documento: só o plano. Nenhum código do app foi alterado.

> Observação: `docs/app-shell.md` não existe na raiz de `docs/` deste worktree. As referências ao shell abaixo usam o código (`src/components/page/PageShell.tsx`). Confirmar onde o doc foi parar (talvez em `docs/redesign/`).

---

## 1. Inventário: o que já existe e serve

### 1.1 Backend (caminhos relativos a `src/main/java/com/agilespace/backend/`)

| Peça | Onde | Serve? | Notas |
|---|---|---|---|
| `SquadPersonConfig` (tabela `squad_person_configs`, V17) | `domain/SquadPersonConfig.java:17-56` | **Sim, reusar como está** | PK `{squadId}_{sprintId}_{jiraAccountId}`; campos `papel` (DEV/QA), `diasCodificacaoTeste`, `diasRegressivo`, `horasProdutivas`. `sprintId = GLOBAL_SPRINT_ID` é o padrão da squad. |
| `SquadCapacityService` | `service/SquadCapacityService.java:32` | **Sim, núcleo da capacidade** | `ResolvedPersonConfig` (l.40-50) já calcula `capacityCodificacaoTesteHours = horas × diasCod` e `capacityRegressivoHours = dias × horas`; `resolve()` (l.103-120) faz a herança sprint atual → sprints anteriores → GLOBAL → padrão 8 h, devolvendo `inherited`/`source` por campo. `save()` em l.58. Falta: ausências, feriados, reserva e foco (ficam no plano novo, não aqui). |
| Endpoint de config | `controller/SquadController.java:495` (`GET /api/squads/{squadId}/person-config/{jiraAccountId}`) | Sim | O plano novo terá um endpoint agregado (todas as pessoas de uma vez) para evitar N chamadas. |
| `SquadIssueSnapshot` (`squad_issue_snapshots`) | `domain/SquadIssueSnapshot.java` | **Parcial** | Ver 1.3. |
| `SquadSyncService` | `service/SquadSyncService.java:44` | **Parcial, reusar a infraestrutura** | Fields pedidos (l.59-61): summary, issuetype, status, created, updated, duedate, assignee, parent, timeoriginalestimate, timeestimate, timespent e os `aggregate*`. Paginação com `PAGE_SIZE` (l.505), credenciais do dono do sync, SSRF/TLS e retry em 429 (comentário l.36). `syncSquad()` l.94, `forceResyncSprint()` l.279. A JQL é `squad.syncJql` (l.142-167), ou seja, **o que está na JQL da squad**, normalmente a sprint ativa. |
| `SquadSyncScheduler` | `scheduler/SquadSyncScheduler.java:46` | Sim | `@Scheduled(fixedDelay = app.squad.scheduled-sync.fixed-delay-ms, padrão 900000 = 15 min)`, desligado por padrão (l.22), pula squad já sincronizando (l.56). O sync do backlog novo deve pendurar aqui. |
| `SquadSyncGuard` | `service/SquadSyncGuard.java` | Sim | Evita sync concorrente por squad; reusar no sync do backlog. |
| `SquadAccessService` | `service/SquadAccessService.java:40` | **Sim, autorização** | `matchesSquad()` l.97/104 (membro), `canManageSquad()` l.231/237, `isSquadLeadership()` l.320. Liderança vem de `ProjectMemberRole.isLeadership` (`domain/ProjectMemberRole.java:53`, coluna `is_leadership`) + `SquadLeadership.isLeadershipJobTitle`. Modo `APP_MEMBERSHIP_AUTHZ=new` (`authzMode()` l.79). |
| `SprintPlanning*` antigo (V19) | `domain/SprintPlanning*.java`, `controller/SprintPlanningController.java` (`/api/sprint-plannings`, l.15-46), `service/SprintPlanningService.java`, `db/migration/V19__*.sql` | **Aposentar** | Sem `squad_id`, modelo de "contagem de DEVs/QAs + foco 70%", tarefas com nome livre, sem ligação com Jira. Não casa com nenhuma decisão nova. Ver 1.4. |
| `PokerService` / `McpPokerTools` | `service/PokerService.java`, `mcp/McpPokerTools.java` | Indireto | A string "(DEV xh / QA yh)" é montada no **frontend** (`src/lib/poker-utils.ts:506-534`, testes em `src/lib/__tests__/poker-copy.test.ts`) e colada no título da pai no Jira. O planner só precisa **ler** esse padrão do `summary`. Reaproveitar a regex de forma espelhada no backend (classe nova `PokerHoursTitleParser`) com os mesmos casos de teste. |
| `JiraService` / `JiraController` (`/api/jira`) | `controller/JiraController.java:11-89` | Só como proxy de leitura avulsa | `/search`, `/sprint`, `/fields`, `/boards`, `/greenhopper/work-data`. O planner **não** usa o proxy a cada clique; usa o snapshot. `/boards` e `/sprint` podem servir no lobby para escolher a próxima sprint (futura) do board. |
| `JiraAdminService` | `service/JiraAdminService.java` | Sim, admin | Credenciais/domínio do Jira Server/DC. |
| WebSocket | `websocket/BoardWebSocketHandler.java:27` (abstrato, `broadcastEvent(boardId, "REFRESH_BOARD", null)` l.96), subclasses Brainstorming/HealthCheck; `PokerWebSocketHandler` separado | **Sim, padrão** | Criar `SprintPlanWebSocketHandler extends BoardWebSocketHandler` com `boardId = planId`. |
| Feriados | nenhum no backend (grep "holiday/feriado" vazio) | **Lacuna** | Front tem só um comentário em `src/lib/date-utils.ts:5-6` prevendo "futura regra de feriados". |

### 1.2 Frontend (`src/` do worktree integration)

| Peça | Onde | Uso no planner |
|---|---|---|
| Página atual | `src/app/sprint-planner/page.tsx` (só `ComingSoon`) | Substituir. |
| `PageShell` | `src/components/page/PageShell.tsx:38` | Moldura do lobby (`/sprint-planner`). |
| Kit de sala | `src/components/room-kit/` (`index.ts`): `RoomTopBar`, `PhaseStepper`, `StageNav`, `TabBar`, `SidePanel`, `PresentationBar`, `PresenceList`, `ConfirmDialog`, `Modal`, `GuideSheet`, `SelectField`, `SettingRow`, `ShareDialog`, `primitives.tsx`, `tokens.ts`, `useBelowBreakpoint`, `useElementSize`, `useRoomPreference` | Tela do plano (`/sprint-planner/[planId]`): `RoomTopBar` + `PhaseStepper` para as 4 etapas, `PresentationBar` para modo reunião, `PresenceList` para quem está na tela, `SidePanel` para detalhe da tarefa, `useBelowBreakpoint` para celular. |
| Socket | `src/lib/room-socket.ts:68` (`connectRoomSocket`), `withFlagParam` l.52 | Assinar `REFRESH_PLAN` e refazer o GET. |
| Roster / capacidade | `src/app/squad/roster/page.tsx`, `src/components/roster/*` (`PersonConfigPanel`, `RosterTable`, `RosterKpis`, `usePersonConfig`, `useRosterRule`) | Reusar `PersonConfigPanel`/hooks na etapa Capacidade (mesma fonte `squad_person_configs`). |
| Cronograma | `src/components/squad/SquadPlansTimeline.tsx`, aba "Cronograma" em `src/components/squad/hub/SquadHub.tsx:4,99,294` | Continua em `/squad` **só como acompanhamento** (lê datas do Jira). O Gantt do planner é componente novo, mas pode copiar escalas/fases (`plans-phases.test.ts`). |
| Poker | `src/lib/poker-utils.ts:506` | Fonte do formato do título. |
| Dias úteis | `src/lib/date-utils.ts` | Usar só para exibição; o cálculo oficial é no backend. |

### 1.3 O que o snapshot tem hoje (`squad_issue_snapshots`)

| Pergunta | Resposta | Evidência |
|---|---|---|
| issuetype **id**? | **Não.** Só o nome em `issue_type` (`type`). | `SquadIssueSnapshot.java:42-43`; `SquadSyncService.java:536` lê `issuetype.name`. |
| parent? | Sim: `parent_key`, `parent_title`. | `SquadIssueSnapshot.java:102-106`; `SquadSyncService.java:564-566`. |
| status? | Sim: `status` (nome) e `status_category`. Sem status **id**. | l.48-52; Sync l.537-538. |
| originalEstimate / remaining? | Sim, mas **mistura agregado**: `estimate_sec = firstNonZero(aggregatetimeoriginalestimate, timeoriginalestimate)` e idem para `remaining_sec`. Na pai, o valor é a soma das subtarefas, não o da própria pai. | Sync l.542-543. Para subtarefa (sem filhos), agregado = próprio, então serve. |
| título da pai? | Sim, `parent_title` na subtarefa e `title` na pai. | l.99-106. |
| subtarefas da pai? | Lidas (`subtaskKeys`, l.570) mas não persistidas como lista; dá para reconstruir via `parent_key`. | |
| backlog fora de sprint? | **Não**, a não ser que a `syncJql` da squad inclua. O sync é orientado à sprint ativa + removidos. | Sync l.142-198. |
| assignee? | Sim, `assignee_id`/`assignee_name`. | l.60-64. |
| sprint? | `sprint_id`/`sprint_name` (subtarefa herda da pai, l.713-716). | |

Conclusão: **não dá para montar o escopo só com o snapshot atual**. Faltam issuetype id, estimativas não agregadas da pai e, principalmente, as issues "Refinamento Concluído" fora de sprint.

### 1.4 SprintPlanning antigo: aposentar
- Não tem squad; o modelo (contagem de pessoas, foco 70%, tarefas digitadas) contradiz a decisão "horas valem pelo título + subtarefas do Jira".
- Proposta: **não reaproveitar tabelas**. Manter `/api/sprint-plannings` respondendo enquanto alguém do front usar (grep no front: só `src/services/jiraService.ts`/`types.ts` citam "sprint-planning"; confirmar se algum fluxo do Poker "importa do planejamento"). Na E2, marcar o controller como `@Deprecated` e, depois de 1 ciclo em homologação sem uso, migração `DROP` em uma V futura separada (não nesta leva aditiva).
- **Estado (pendências do Sprint Planner):** `SprintPlanningController` e `SprintPlanningService` estão `@Deprecated` (javadoc) e cada chamada gera log `[DEPRECATED] ... /api/sprint-plannings`. Nada foi removido (tabelas e dados intactos). Verificado por grep: nenhuma tela do frontend (`integration/src`) chama `/api/sprint-plannings` (nem `readyForPoker`); o único vestígio é o contador `totalSprintPlannings` do painel admin, que vem de `AdminService` (conta a tabela antiga). Remover só depois de um ciclo de logs sem uso.

---

## 2. Lacunas

### 2.1 Buscar do Jira (Server/DC, API v2)

Novo sync **de backlog do planner**, separado do sync da sprint ativa (para não alterar o comportamento do Quadro/Cronograma):

1. **Pais candidatas**:
   `project = {jiraProjectKey} AND status = "Refinamento Concluído" AND issuetype not in subTaskIssueTypes() ORDER BY Rank ASC`
   Configurável por squad (`squad.plannerBacklogJql`, opcional; padrão acima). Para squads que usam board com filtro, alternativa: `filter = {boardFilterId} AND status = ...`.
2. **Sobra (carry-over)**: pais da sprint que está fechando com statusCategory != done:
   `sprint = {sprintAtualId} AND statusCategory != Done AND issuetype not in subTaskIssueTypes()`.
3. **Subtarefas**: `parent in (K1,...,Kn)` em lotes de no máximo 50 chaves por JQL (limite de tamanho de URL/JQL).
4. Fields: `summary, issuetype, status, parent, assignee, timeoriginalestimate, timeestimate, timespent, subtasks, updated, rank (customfield do Rank, opcional), {sprintFieldId}`. **Sem `aggregate*`** neste sync (queremos o valor próprio da issue).
5. Paginação: `startAt` + `maxResults=50` (reusar `fetchAllIssues`/`PAGE_SIZE`, l.495-505), retry em 429 com `Retry-After` (já existe). Teto de segurança: 1000 pais por squad; acima disso, registrar aviso.
6. Rate limit: no máximo 1 sync de backlog por squad a cada 5 min disparado por clique (`POST .../planner-backlog/sync` devolve 429 com `retryAfterSec` se cedo demais); agendado a cada 15 min junto do `SquadSyncScheduler` só para squads com plano em `ESCOPO` ou `DISTRIBUICAO`.
7. Tipos de subtarefa da instância: `GET /rest/api/2/issuetype` (id, nome, `subtask=true`), cache diário em tabela, para a tela de mapeamento listar os ~40 tipos.
8. Sprint futura e meta: `GET /rest/agile/1.0/board/{boardId}/sprint?state=future,active` (nome, datas, `goal`). Já há `/api/jira/boards` e `/api/jira/sprint` no proxy; criar método no `JiraService` chamado pelo backend, não pelo front.

### 2.2 Onde guardar o backlog
Opção escolhida: **colunas novas em `squad_issue_snapshots`** + flag de origem, porque Quadro/Cronograma já leem dali e o join por `parent_key` é natural.
- `issue_type_id varchar(32)`, `status_id varchar(32)`, `own_estimate_sec bigint`, `own_remaining_sec bigint`, `in_planner_backlog boolean default false`, `planner_synced_at varchar(255)`.
- Risco: o sync atual faz "remover o que sumiu da JQL". Precisa **não apagar** linhas com `in_planner_backlog = true` (e vice-versa). Se isso ficar frágil, plano B: tabela própria `planner_backlog_issues` com o mesmo shape. Decidir na E1 após ler o trecho de remoção do `SquadService`.

### 2.3 Tabelas novas
`sprint_plans`, `sprint_plan_items`, `sprint_plan_assignments`, `squad_subtask_type_mapping`, `sprint_plan_absences`, `sprint_plan_holidays`, `jira_issue_types_cache`. Detalhe na seção 3.

---

## 3. Modelo de dados (Flyway aditivo, V86+)

Convenções do repo: ids `varchar(255)` (UUID gerado no service), datas de negócio como `date` aqui (novas tabelas; não repetir o `varchar` de data do snapshot), `ddl-auto=validate`, então entidades JPA batem 1:1 com o SQL.

### V86__sprint_planner_base.sql
```sql
CREATE TABLE sprint_plans (
  id               varchar(255) PRIMARY KEY,
  squad_id         varchar(255) NOT NULL REFERENCES squads(id),
  jira_sprint_id   varchar(64),            -- sprint futura do Jira; null até escolher
  sprint_name      varchar(255) NOT NULL,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  status           varchar(16) NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO|ESCOPO|DISTRIBUICAO|REVISAO|ENVIADO
  goal             text,                    -- meta (Sprint goal do Jira; gravação só na E6)
  reserve_mode     varchar(16) NOT NULL DEFAULT 'HORAS',   -- HORAS | FOCO
  reserve_pct      numeric(5,2),            -- limite "coberto pela reserva" (% da capacidade)
  focus_factor_pct numeric(5,2),            -- fator de foco do time (modo FOCO)
  created_by       varchar(255) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  version          bigint NOT NULL DEFAULT 0  -- @Version, para 409
);
CREATE UNIQUE INDEX ux_sprint_plans_squad_sprint ON sprint_plans(squad_id, jira_sprint_id) WHERE jira_sprint_id IS NOT NULL;
CREATE INDEX ix_sprint_plans_squad_status ON sprint_plans(squad_id, status);

CREATE TABLE sprint_plan_person (            -- override por plano, além de squad_person_configs
  plan_id          varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  jira_account_id  varchar(255) NOT NULL,
  included         boolean NOT NULL DEFAULT true,
  focus_factor_pct numeric(5,2),            -- foco por pessoa (modo FOCO), sobrepõe o do time
  PRIMARY KEY (plan_id, jira_account_id)
);

CREATE TABLE sprint_plan_reserve_types (     -- tipos "fora da conta" no modo HORAS (ex.: reunião, suporte)
  id       varchar(255) PRIMARY KEY,
  plan_id  varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  label    varchar(120) NOT NULL,
  hours_per_day numeric(5,2)                -- informativo; a conta usa horas_produtivas < 8
);

CREATE TABLE sprint_plan_absences (
  id               varchar(255) PRIMARY KEY,
  plan_id          varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  jira_account_id  varchar(255) NOT NULL,
  start_date       date NOT NULL,
  end_date         date NOT NULL,           -- = start_date quando é um dia
  hours_per_day    numeric(5,2),            -- null = dia inteiro
  reason           varchar(255),
  created_by       varchar(255) NOT NULL,
  CHECK (end_date >= start_date)
);
CREATE INDEX ix_sprint_plan_absences_plan_person ON sprint_plan_absences(plan_id, jira_account_id);

CREATE TABLE sprint_plan_holidays (
  plan_id  varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  day      date NOT NULL,
  label    varchar(120),
  PRIMARY KEY (plan_id, day)
);
```

### V87__sprint_planner_items.sql
```sql
CREATE TABLE sprint_plan_items (
  id               varchar(255) PRIMARY KEY,
  plan_id          varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  parent_key       varchar(64) NOT NULL,
  title_snapshot   text,                    -- summary no momento da inclusão
  title_dev_hours  numeric(7,2),            -- de "(DEV xh / QA yh)"; null = título sem horas
  title_qa_hours   numeric(7,2),
  sort_order       integer NOT NULL,
  carry_over       boolean NOT NULL DEFAULT false,
  added_by         varchar(255) NOT NULL,
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, parent_key)
);
CREATE INDEX ix_sprint_plan_items_plan_order ON sprint_plan_items(plan_id, sort_order);

CREATE TABLE sprint_plan_assignments (
  id               varchar(255) PRIMARY KEY,
  plan_id          varchar(255) NOT NULL REFERENCES sprint_plans(id) ON DELETE CASCADE,
  item_id          varchar(255) NOT NULL REFERENCES sprint_plan_items(id) ON DELETE CASCADE,
  subtask_key      varchar(64) NOT NULL,
  jira_account_id  varchar(255),            -- quem pegou; null = livre
  start_date       date,
  end_date         date,
  class            varchar(16) NOT NULL,    -- DEV|QA|FORA|SEM (resolvido na hora de criar; recalculado se o mapa mudar)
  hours            numeric(7,2),            -- estimate (ou remaining se carry_over)
  version          bigint NOT NULL DEFAULT 0,
  updated_by       varchar(255),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, subtask_key),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX ix_sprint_plan_assignments_person ON sprint_plan_assignments(plan_id, jira_account_id);
```

### V88__subtask_type_mapping.sql
```sql
CREATE TABLE jira_issue_types_cache (
  squad_id   varchar(255) NOT NULL,
  type_id    varchar(32) NOT NULL,
  name       varchar(255) NOT NULL,
  is_subtask boolean NOT NULL,
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (squad_id, type_id)
);

CREATE TABLE squad_subtask_type_mapping (
  squad_id   varchar(255) NOT NULL,
  sprint_key varchar(64) NOT NULL,          -- jira_sprint_id ou 'GLOBAL' (mesma ideia do GLOBAL_SPRINT_ID)
  type_id    varchar(32) NOT NULL,
  type_name  varchar(255) NOT NULL,
  class      varchar(16) NOT NULL,          -- DEV|QA|FORA|SEM
  qa_by_title_exception boolean NOT NULL DEFAULT false, -- "Code Review" com 'QA' no título vira QA
  default_hours numeric(5,2),               -- Code Review = 1
  origin     varchar(16) NOT NULL,          -- PADRAO|AM|HERDADO
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, sprint_key, type_id)
);
```
Semente (no service, não no SQL, porque os ids podem variar por instância): `10036 Codificação → DEV`, `12300 Code Review → DEV, default 1h, exceção QA no título`, `10013 Execução de TI → QA`, `10069 Teste Automatizado → QA`, `10063 Documento Técnico → QA (opcional)`; demais → `SEM`.

### V89__snapshot_planner_columns.sql
```sql
ALTER TABLE squad_issue_snapshots
  ADD COLUMN issue_type_id varchar(32),
  ADD COLUMN status_id varchar(32),
  ADD COLUMN own_estimate_sec bigint,
  ADD COLUMN own_remaining_sec bigint,
  ADD COLUMN in_planner_backlog boolean NOT NULL DEFAULT false,
  ADD COLUMN planner_synced_at varchar(255);
CREATE INDEX ix_snap_squad_parent ON squad_issue_snapshots(squad_id, parent_key);
CREATE INDEX ix_snap_squad_backlog ON squad_issue_snapshots(squad_id) WHERE in_planner_backlog;
ALTER TABLE squads ADD COLUMN planner_backlog_jql text, ADD COLUMN planner_backlog_synced_at varchar(255);
```
O sync atual passa a gravar também `issue_type_id`, `status_id`, `own_*` (mudança pequena em `SquadSyncService.java:534-552`).

### Reuso de `squad_person_configs`
- `papel`, `dias_codificacao_teste`, `dias_regressivo`, `horas_produtivas` continuam lá, por `(squad, sprint)`, com a herança do `SquadCapacityService.resolve()`. Gravar com `sprintId = plan.jira_sprint_id` (ou o id do plano enquanto não há sprint, prefixo `plan:`; ajustar `priorSprintIdsMostRecentFirst` para ignorar esse prefixo).
- O plano **não duplica** esses campos; só guarda o que é dele (inclusão, foco, ausências, feriados).
- A reserva % "sugerida pela anterior": `reserve_pct` do último plano da squad com status >= REVISAO.

---

## 4. Contrato REST

Base: `/api/squads/{squadId}/sprint-plans` (fica claro o squad para o `SquadAccessService`). Papéis: **L** = liderança da squad (`isSquadLeadership`) ou ADMIN; **M** = membro (`matchesSquad`); **AM** = liderança com papel AM (se não houver distinção de AM no `ProjectMemberRole`, tratar AM = L; pergunta aberta). Erros comuns: 401 sem token, 403 sem acesso, 404 plano de outra squad, 409 conflito de versão ou de estado, 422 validação.

| Método e caminho | Corpo | Resposta | Quem | Erros |
|---|---|---|---|---|
| `GET /api/squads/{s}/sprint-plans` | - | `[{id, sprintName, startDate, endDate, status, totals:{capDev, capQa, planDev, planQa}, updatedAt}]` | M | 403 |
| `GET /api/squads/{s}/sprint-plans/next-sprint` | - | `NextSprintView` (ver 4.1) | L | 400 sem token/board, 403, 429, 502 Jira |
| `POST .../{id}/copy-from-previous` | `{sourcePlanId?}` | `PlanView` (ver 4.2) | L (plano em RASCUNHO) | 403, 404, 422 |
| `POST /api/squads/{s}/sprint-plans` | `{jiraSprintId?, sprintName, startDate, endDate}` | plano completo | L | 409 já existe plano para a sprint |
| `GET /api/squads/{s}/sprint-plans/{id}` | - | `PlanView` (abaixo) | M | 404 |
| `PATCH /api/squads/{s}/sprint-plans/{id}` | `{version, sprintName?, startDate?, endDate?, goal?, reserveMode?, reservePct?, focusFactorPct?}` | `PlanView` | L | 409 versão, 422 datas |
| `POST .../{id}/status` | `{version, to}` | `PlanView` | L (avançar/voltar); ENVIADO só na E6 | 409 transição inválida |
| `DELETE .../{id}` | - | 204 | L (só RASCUNHO/ESCOPO) | 409 |
| `GET .../{id}/capacity` | - | `[{accountId, name, papel, diasCod, diasReg, horasProdutivas, inherited*, absencesHours, holidaysHours, focusPct, capacityHours}]` + totais por classe | M | |
| `PUT .../{id}/capacity/{accountId}` | `{papel?, diasCod?, diasReg?, horasProdutivas?, included?, focusPct?}` | linha atualizada | L | 422 |
| `POST .../{id}/absences` | `{accountId, startDate, endDate, hoursPerDay?, reason?}` | ausência | L | 422 fora da sprint |
| `DELETE .../{id}/absences/{absId}` | - | 204 | L | |
| `PUT .../{id}/holidays` | `[{day, label}]` | lista | L | 422 |
| `GET /api/squads/{s}/subtask-types?sprintKey=` | - | `[{typeId, name, class, origin, qaByTitleException, defaultHours}]` (inclui todos os tipos de subtarefa do cache) | M | |
| `PUT /api/squads/{s}/subtask-types/{typeId}` | `{sprintKey, class, defaultHours?, qaByTitleException?}` | linha | AM/L | 422 classe inválida |
| `POST /api/squads/{s}/planner-backlog/sync` | - | `{syncedAt, parents, subtasks}` | L | 429 `{retryAfterSec}`, 409 sync em andamento |
| `GET /api/squads/{s}/planner-backlog` | `?q=&onlyWithHours=` | `{syncedAt, items:[{key, title, devH, qaH, subtasks:[{key, typeId, class, estimateH, remainingH, assignee}], divergence:{dev, qa}, carryOver}]}` | M | |
| `POST .../{id}/items` | `{parentKey}` ou `{parentKeys:[...]}` | itens criados (assignments gerados das subtarefas) | L | 409 já no plano, 422 não candidata |
| `PATCH .../{id}/items/order` | `{orderedItemIds:[...]}` | 204 | L | |
| `DELETE .../{id}/items/{itemId}` | - | 204 | L | 409 se status >= REVISAO |
| `PATCH .../{id}/assignments/{asgId}` | `{version, take?:true, release?:true, startDate?, endDate?}` | assignment + lista de QA ajustados (encadeamento) | M: só se `class` bate com o papel dele e (`jira_account_id` é ele ou é null); L: qualquer um | 403 subtarefa de outro, 409 versão, 422 data fora da sprint |
| `GET .../{id}/review` | - | `{goal, items, perPerson:[{name, loadH, capH}], warnings:[...], jiraPreview:[{op, key, field, from, to}]}` | M | |
| `POST .../{id}/send-to-jira` | `{version}` | **E6**; até lá 501 | L | 501 |

`PlanView` = `{id, squadId, version, status, sprint{...}, goal, reserve{mode, pct, focusPct, types[]}, syncedAt, capacity{byClass{DEV,QA}, people[]}, items[], assignments[], thermometer{DEV:{pct, zone}, QA:{...}}, permissions{canEditPlan, canEditTypes, myAccountId}}`. `permissions` vem do backend; a tela não deduz sozinha.

### 4.1 Próxima sprint do Jira: `GET /api/squads/{s}/sprint-plans/next-sprint`
Somente leitura no Jira. Usa o token do próprio usuário (`UserJiraConfig`, o mesmo do sync) e o número do quadro da squad (`Squad.rapidViewId`), chamando `/rest/agile/1.0/board/{id}/sprint?state=future,active`; escolhe a sprint **futura** de menor data de início (sem futura: `found=false`).

```json
{ "found": true, "jiraSprintId": "11", "name": "Sprint 11", "startDate": "2026-11-02", "endDate": "2026-11-13",
  "goal": "Entregar X", "state": "future" }
```
Sem sprint futura: `{"found": false, "jiraSprintId": null, "name": null, "startDate": null, "endDate": null, "goal": null, "state": null}`.
Erros: 400 sem token ("Configure seu Token de Acesso do Jira...") ou sem board ("A squad não tem o número do quadro (board)..."); 403 não liderança; 429 `Tente de novo em N s.` (1 chamada por 10 s por squad+usuário, `app.planner.next-sprint.min-interval-sec`); 502 se o Jira falhar.
Para criar o plano a partir da resposta: `POST /sprint-plans` aceita `{jiraSprintId, sprintName, startDate, endDate, goal, jiraGoal}`; o front manda a `goal` da resposta em `goal` e em `jiraGoal` (este guarda a meta atual do Jira em `sprint_plans.jira_goal`, V92).

### 4.2 Copiar da sprint anterior: `POST /api/squads/{s}/sprint-plans/{id}/copy-from-previous`
Corpo opcional `{ "sourcePlanId": "..." }`. Sem corpo: o plano mais recente da squad cuja sprint termina antes do início deste (404 `Nenhum planejamento anterior` se não houver; também 404 se `sourcePlanId` for inexistente/de outra squad). Só em RASCUNHO (422 fora disso). Copia: modo e % de reserva, tipos de reserva, fator de foco do time, inclusão e fator de foco por pessoa. **Não copia** ausências, feriados, itens nem atribuições. A capacidade por pessoa (papel/dias/horas) já herda pelo `SquadCapacityService`. Resposta: `PlanView`.

### 4.3 Campos acrescentados às respostas
- `DistributionView.people[].absences: [{startDate, endDate, hours (null = dia inteiro), reason (null)}]` (ausências da pessoa neste plano).
- `ScopeView.planVersion` (long): versão do plano depois da operação (também em POST items e PUT items/order, que devolvem `ScopeView`); `DELETE items/{id}` continua 204 (o front recarrega).
- `PlanView.jiraGoal`: meta atual da sprint no Jira (null = desconhecida/sem meta). Atualizada pelo sync do backlog (`SprintPlanJiraService.refreshGoals`: uma leitura `/rest/agile/1.0/sprint/{id}` por plano não enviado, só dentro do sync).
- `ReviewView.jiraSprintUrl`: `https://{domínio}/secure/RapidBoard.jspa?rapidView={boardId}&view=planning&selectedIssue=&sprint={jiraSprintId}` (sem sprint do plano: sem `&sprint=`; sem board: `.../RapidBoard.jspa`).
- `ReviewView.jiraPreview.sprintGoal`: `from` = `jiraGoal`; `kind` = `SET` (Jira sem meta), `UNCHANGED` (igual) ou `CHANGE` (difere).

### WebSocket
- `SprintPlanWebSocketHandler extends BoardWebSocketHandler`, rota `/ws/sprint-plan/{planId}`, mesma autenticação JWT do WS já existente.
- Após qualquer escrita no plano: `broadcastEvent(planId, "REFRESH_PLAN", {scope})` com `scope` em `capacity|items|assignments|status`. Cliente faz refetch do `GET` correspondente (padrão do Retro `RetroService.java:133`).
- Presença (`PresenceBroadcaster`) para a `PresenceList` e para o modo reunião.

---

## 5. Regras de cálculo (pseudo-código, cada bloco vira teste)

```text
DIAS_UTEIS(plan) = dias entre start_date e end_date, seg–sex, menos sprint_plan_holidays

CAP_PESSOA(p, plan):
  cfg = SquadCapacityService.resolve(squad, plan.sprintKey, p)          # herança já existente
  h   = cfg.horasProdutivas                                              # padrão 8
  base = (cfg.diasCod + cfg.diasReg) * h                                 # igual ResolvedPersonConfig.capacityHours()
  # feriados: diasCod/diasReg já são números informados pelo PL; feriado só desconta se cair em dia
  # que ele não descontou. Regra: dias informados são "antes de feriados"; descontamos aqui.
  feriadoH = count(holidays dentro da sprint, seg–sex) * h
  ausH = soma sobre ausências de p, por dia útil não feriado no intervalo:
           (hoursPerDay == null ? h : min(hoursPerDay, h))
  bruto = max(0, base - feriadoH - ausH)
  se plan.reserveMode == FOCO:
       foco = person.focusPct ?? plan.focusFactorPct ?? 100
       return bruto * foco / 100
  senão  # HORAS: a reserva já está em h < 8
       return bruto
```
(Pergunta aberta 1: confirmar se `diasCod`/`diasReg` já excluem feriados; se sim, `feriadoH = 0`.)

```text
CLASSE(subtask, squad, sprintKey):
  m = mapping(squad, sprintKey, subtask.typeId) ?? herdado da sprint anterior ?? GLOBAL ?? padrão-semente ?? SEM
  se m.typeId == CODE_REVIEW e m.qaByTitleException e titulo contém palavra "QA" (case-insensitive, \bQA\b): return QA
  return m.class

HORAS_SUBTASK(s, item): item.carryOver ? s.ownRemaining : s.ownEstimate      # em horas
  se tipo Code Review e horas == 0: usar m.defaultHours (1h)

PARSE_TITULO(summary): regex /\(\s*DEV\s+(\d+(?:[.,]\d+)?)\s*h\s*\/\s*QA\s+(\d+(?:[.,]\d+)?)\s*h[^)]*\)/i
  -> (dev, qa) ou null. Aceitar ordem e papéis extras (UX) como em poker-utils.ts:506.

HORAS_ITEM(item, classe):                                   # o que conta no total
  # REGRA DO CODE REVIEW (decisão vigente): as horas do título do Poker "(DEV xh / QA yh)" NÃO incluem o Code Review.
  # Horas do item = título + Code Review da classe.
  se item.carryOver: soma HORAS_SUBTASK(remaining) das subtarefas daquela classe (Code Review já é subtarefa)
  senão se titulo tem horas:
       titulo[classe] + CR[classe]
       CR[classe] = soma das subtarefas de tipo Code Review da classe (estimativa do Jira);
                    DEV sem nenhuma subtarefa de Code Review: 1 h presumida (SprintPlanScopeService.DEFAULT_CODE_REVIEW_DEV_HOURS);
                    QA nunca ganha hora presumida (só conta se houver subtarefa de Code Review QA)
  senão: soma das subtarefas da classe (e flag "sem horas no título")

DIVERGENCIA(item, classe) = !carryOver e titulo != null e |titulo[classe] - Σ subtarefas[classe SEM Code Review]| > 0.01
  -> alerta "Ajuste as subtarefas no Jira", vale o título (+ Code Review). O Code Review nunca entra na comparação.
  # ItemView expõe codeReviewDevH/codeReviewQaH (parte do Code Review dentro de devHours/qaHours) e
  # codeReviewDevAssumed (true = entrou a 1 h presumida), além de subtaskDevH/subtaskQaH (sem Code Review).

TOTAL_PLANO[classe] = Σ HORAS_ITEM(item, classe)            # FORA e SEM não entram
CAP_CLASSE[classe]  = Σ CAP_PESSOA(p) para p com papel == classe e included

TERMOMETRO(classe):
  pct = TOTAL_PLANO / CAP_CLASSE * 100   (CAP 0 -> "sem capacidade")
  zona = pct < 85 ? VERDE : pct <= 95 ? AMARELO : VERMELHO
  se pct > 100:
     limite = 100 + plan.reservePct
     estado = pct <= limite ? "COBERTO_PELA_RESERVA" : "ALERTA_FORTE"   # nunca bloqueia
```
(Pergunta aberta 2: "coberto pela reserva" mede contra capacidade + reserva_pct da capacidade? Assumido: até 100 + reserve_pct %.)

```text
ENCADEAMENTO(item):
  crDev = assignments do item com tipo Code Review e classe DEV
  fimDev = max(crDev.end_date) (se não houver CR, max(end) das DEV)
  para cada qa em assignments QA do item:
     se qa.start_date != null e qa.start_date <= fimDev:
         dur = diasUteis(qa.start, qa.end)
         qa.start = proximoDiaUtil(fimDev); qa.end = somaDiasUteis(qa.start, dur)
         marcar qa.shiftedBy = "encadeamento"
  # se o DEV antecipa, o QA NÃO volta sozinho (só empurra). Pergunta aberta 3.
  Executado na mesma transação do PATCH do DEV; resposta lista os QA alterados; broadcast REFRESH_PLAN.

CARGA_PESSOA(p) = Σ assignments.hours onde jira_account_id == p   -> barra "x/30 h" (board Distribuição)
VALIDACOES_DISTRIBUICAO: start/end dentro da sprint, dias úteis, end >= start; aviso se carga > cap.

CARRY_OVER: item.carryOver = parent estava em sprint anterior e statusCategory != done;
  horas = remaining; tela mostra estimado e restante (board Notas/Escopo).
```

---

## 6. Frontend

**Rotas** (App Router):
- `src/app/sprint-planner/page.tsx` → Lobby em `PageShell`: lista de planos da squad da sessão, card "Próxima sprint" (cria), "sincronizado há X min", atalhos "Abrir o Poker" / "Ver no Jira" (board Lobby). Membro sem plano ativo vê estado "A liderança está montando o escopo".
- `src/app/sprint-planner/[planId]/page.tsx` → tela de sala com `RoomTopBar` + `PhaseStepper` (Capacidade, Escopo, Distribuição, Revisar e enviar). Etapa na URL (`?etapa=`) como o `SquadHub` faz com abas.
- Configuração de tipos: aba/painel dentro da Capacidade (board "A classe vem do tipo no Jira, não do título"), não página separada.
- `/squad` aba Cronograma: só leitura, com link "Planejar no Sprint Planner" (não mover nada para dentro de /squad, decisão do usuário).

**Componentes novos** em `src/components/sprint-planner/`: `PlannerLobby`, `CapacityStep` (tabela por pessoa reusando `PersonConfigPanel`/`usePersonConfig`; `AbsenceEditor`; `HolidayEditor`; `ReserveSettings` com as duas opções; `SubtaskTypeMapping`), `ScopeStep` (duas colunas "Refinadas" x "Nesta sprint", termômetro DEV/QA fixo no topo, alerta de divergência, selo de carry-over), `DistributionStep` (lista "minhas subtarefas" + `PlannerGantt` por pessoa, barra de carga x/cap), `ReviewStep` (resumo, avisos, `JiraPreview` com o que seria gravado), `CapacityThermometer`, `SyncBadge`.
Lógica pura em `src/lib/sprint-planner/` só para exibição (formatar horas, zonas); a regra oficial vem do backend (`thermometer` no `PlanView`).

**Estado**: hooks `useSprintPlan(planId)` (fetch + `connectRoomSocket` → refetch por `scope`), `usePlannerBacklog(squadId)`, mutações otimistas só em Distribuição (datas), com rollback em 409. Seguir o padrão de serviços do repo (`src/services/*`) para as chamadas.

**Permissões na tela**: usar `PlanView.permissions`. Liderança edita etapas 1–2 e tudo; membro vê 1–2 em leitura e, na 3, só as linhas da própria classe/pessoa com botão "Pegar". AM edita mapeamento.

**Modo reunião**: `PresentationBar` do kit; sem inputs (`readOnly` propagado), fonte maior, navegação entre etapas por quem apresenta; os outros só seguem via evento WS `PRESENT_STEP` (opcional, E4+).

**Celular** (board Celular, 375 px): `useBelowBreakpoint`; Escopo vira duas abas ("Nesta sprint" / "Refinadas"); Distribuição vira lista por dia em vez de Gantt; alvos de toque 40–44 px; termômetro compacto fixo.

Visual: tokens do `room-kit/tokens.ts`, PT-BR, sem a palavra "engenharia", regras do guia de marca (sem texto em gradiente).

---

## 7. Etapas de entrega

| Etapa | Conteúdo | Pronto quando | Depende de | Paralelo com |
|---|---|---|---|---|
| **E1a** Backend modelo + capacidade | V86, entidades, `SprintPlanService` (CRUD, status), `SprintPlanCapacityService` (usa `SquadCapacityService`; ausências; feriados; reserva/foco; termômetro), endpoints de plano/capacidade/ausências/feriados, authz | Testes unitários das regras da seção 5 (capacidade, feriado, ausência parcial, foco pessoa x time, termômetro nas bordas 85/95/100/100+reserva); testes de controller 403/409 | - | E1b, E2 (com mock) |
| **E1b** Backend tipos + sync de backlog | V88/V89, cache de issuetypes, `SubtaskTypeMappingService` (semente, herança, exceção CR+QA), `PlannerBacklogSyncService` (JQL, lotes de 50 pais, 429), alteração mínima no `SquadSyncService` para `issue_type_id/own_*`, endpoint de backlog, gancho no scheduler | Teste com respostas Jira gravadas (fixture JSON) cobrindo paginação, 429, pais sem horas, divergência; o sync atual continua igual (testes existentes verdes); backlog não é apagado pelo sync da sprint | - | E1a |
| **E2** Front lobby + capacidade + tipos | Rotas, `PlannerLobby`, `CapacityStep`, `SubtaskTypeMapping`, `SyncBadge`, socket | Liderança cria plano, ajusta pessoa/ausência/feriado/reserva e vê termômetro; membro só lê; testes de componente | E1a (E1b para tipos) | E3 backend |
| **E3** Escopo | Backend: V87 items, `PokerHoursTitleParser`, itens/ordem, divergência, carry-over. Front: `ScopeStep` | Adicionar/remover/ordenar pais; totais e termômetro mudam ao vivo para 2 usuários; alerta de divergência; carry-over usa restante | E1a, E1b | - |
| **E4** Distribuição + Gantt + encadeamento | `PATCH assignments` com authz por pessoa/classe, encadeamento, WS; `DistributionStep`, `PlannerGantt`, celular | Dois navegadores: DEV move fim do CR → QA desloca nos dois; membro não edita subtarefa de outro (403) | E3 | Modo reunião |
| **E5** Revisão / prévia | `GET review` com `jiraPreview` (sem gravar), avisos; `ReviewStep`; modo reunião completo | Prévia lista exatamente os campos que a E6 gravaria (sprint da pai/subtarefa, assignee, datas, meta) | E4 | - |
| **E6** Escrita no Jira (por último) | Via MCP/regras que o usuário vai trazer; `send-to-jira` hoje responde 501 | Definido quando o MCP chegar | E5 + insumo do usuário | - |
| **E-final** | Aposentar `/api/sprint-plannings` (V futura com DROP), deploy na homologação | Sem chamadas ao endpoint antigo | E5 | - |

---

## 8. Riscos e perguntas abertas

**Riscos**
1. **Sync atual apagar o backlog** do planner ao reconciliar a JQL da squad (2.2). Mitigação: flag `in_planner_backlog` respeitada na remoção, ou tabela própria.
2. **Estimativa agregada na pai** (`SquadSyncService.java:542-543`): quem usar `estimate_sec` da pai recebe soma das subtarefas. O planner usa só `own_*` e o título.
3. **IDs de issuetype por instância**: 10036/12300/10013/10069/10063 vêm do Jira atual da TOTVS; na instalação Azure nova podem mudar. A semente deve casar por id e, na falta, por nome, e o AM confirma.
4. **Status "Refinamento Concluído" por nome**: acento e nome podem variar por projeto; preferir status id configurável por squad.
5. Título editado à mão fora do padrão do Poker → item "sem horas no título"; mostrar e deixar contar pelas subtarefas.
6. Concorrência na Distribuição (dois DEVs, encadeamento empurrando QA): `@Version` + 409 + refetch.
7. Rate limit do Jira Server/DC da TOTVS desconhecido; lotes de 50 e intervalo de 5 min por squad.
8. Credencial: sync usa o token do dono do sync da squad (`syncOwnerUserId`); se ele sair, o planner para. Mesmo risco do sync atual.
9. Datas como `varchar` no snapshot vs `date` nas tabelas novas: converter na borda.
10. Limite de 300 req/min por IP do backend pode atingir a sala com muitos refetches; o evento WS deve carregar `scope` para refetch parcial.

**Perguntas abertas (para o usuário)**
1. `diasCod`/`diasReg` informados já descontam feriados? (define `feriadoH`).
2. "Coberto pela reserva": até 100% + reserva_pct da capacidade, ou a reserva é tirada antes (capacidade × (1 − reserva))?
3. Se o DEV antecipa o fim, o QA volta junto ou só é empurrado para frente?
4. AM é um papel distinto em `ProjectMemberRole`/job title, ou qualquer liderança pode mapear tipos?
5. Quem lança feriados: PL por plano, ou um calendário de feriados da squad/empresa reaproveitável?
6. Um plano por sprint do Jira por squad (unique) é suficiente, ou querem rascunhos alternativos?
7. Ausências devem alimentar também `squad_person_configs` (dias), ou só o plano?
8. Subtarefa sem responsável no Jira e sem ninguém que pegue: alerta na revisão, ou bloqueia o avanço para REVISAO?
9. Pai sem subtarefas de QA mas com "QA yh" no título: a prévia da E6 deve propor criar subtarefas?
10. Onde ficou `docs/app-shell.md`?
