# Plano de ação: origem, trava de duplicidade e prazo

De onde o plano nasceu (Retro, Radar de clima, Brainstorming, Review ou à mão), a trava real contra plano repetido, as contagens de ações na lista e o prazo ("Quando") como data. O contrato do servidor é `agile-space-backend/docs/action-plan-origin-api.md` (migração V78); este documento diz **o que o front consome** e **como se comporta contra o backend antigo** (sem V78).

## Regra de ouro: funciona com os dois backends

Todo campo novo é opcional. O sinal de "este servidor conhece a V78" é o plano trazer `sourceType` (o novo devolve `"MANUAL"` até nos planos antigos; o antigo não devolve nada). `hasOriginContract(board)` em `src/lib/action-plan-origin.ts` decide.

| Recurso | Backend novo (V78) | Backend antigo |
|---|---|---|
| Criar plano de uma cerimônia | Envia `sourceType`, `sourceId`, `sourceTitle`; origem repetida na squad volta **409** | O corpo extra é ignorado; sem trava no servidor |
| "Esta sessão já gerou o plano «X»" | Vem do servidor (`?squadId=&sourceType=&sourceId=`); **sem** "criar outro" | Só o aviso guardado neste navegador (trava local), com "Criar outro mesmo assim" |
| Lobby `/action-plan` | Colunas **Origem** e **Ações concluídas** (barra), filtros por origem e por andamento, "Último plano" com as contagens da lista | Sem as colunas nem os filtros; "Último plano" lê as ações (`listTasks`) como antes |
| Página `/action-plan/[id]` | Faixa "Criado a partir de ...", "de: ..." na ação, prazo em **data**, selo **Atrasada**, filtro e ordenação por prazo | "Quando" segue texto livre; o botão de calendário continua preenchendo o texto |
| Exportação | Markdown e CSV levam o prazo em data (e a origem da ação no Markdown) | Coluna `Prazo` sai vazia |

## Cliente (`src/app/action-plan/api.ts`)

- `listBoards(filtro)`: texto = `sprintId` (como sempre); objeto `{ sprintId?, squadId?, sourceType?, sourceId? }` monta a consulta. `listBoardsBySquad(squadId)` continua existindo.
- `createBoard` aceita `sourceType`/`sourceId`/`sourceTitle`. **409** vira `PlanSourceConflictError` (subclasse de `CeremonyApiError`, `status` 409, `existingPlanId` quando o plano é visível; ausente se for privado). Qualquer outro erro segue como antes.
- `createTask`/`updateTask` aceitam `dueDate` (`yyyy-MM-dd`), `sourceItemId`, `sourceLabel` e, na edição, `clearDueDate: true` para limpar o prazo.
- Tipos em `src/lib/types.ts`: `PlanSourceType`, campos novos opcionais em `ActionPlanBoard` e `ActionPlanTask`, `ActionPlanTaskInput`.

## Regras puras (`src/lib/action-plan-origin.ts`)

- Origem: `SOURCE_LABEL` (`SHOWCASE` aparece como **Review**), `sourceRoute` (`/retro/{id}`, `/health-check/{id}`, `/brainstorming/{id}`, `/showcase/{id}`; manual não tem), `boardOrigin`.
- Trava: `findPlanBySource` filtra a lista **no cliente** também (o backend antigo ignora o filtro e devolveria tudo); `checkOrigin` devolve `server` (trava real), `local` (reserva) ou `none` (com `stale` quando o aviso local apontava para um plano apagado, 404); `conflictOf` lê o 409.
- Contagens: `planCounts`, `matchesProgress` ("Com ações abertas" = ainda há ação não concluída; "Concluídos" = tem ações e todas concluídas).
- Prazo: `isOverdue` (prazo antes de hoje e status diferente de concluído; vencer hoje ainda não é atraso), `matchesDueFilter`, `sortByDue` (sem prazo no fim, estável), `formatDueDate`.

## Como cada cerimônia cria o plano

| Cerimônia | `sourceType` | `sourceId` / `sourceTitle` | Por ação: `sourceItemId` / `sourceLabel` |
|---|---|---|---|
| Radar de clima (`HealthPlanDialog`, `health-check-plan.ts`) | `HEALTH_CHECK` | id do radar / nome da sprint do radar | chave da dimensão / nome da dimensão |
| Brainstorming (`CreatePlanDialog`, `brainstorm-plan.ts`) | `BRAINSTORMING` | id da sessão / título | id da ideia / grupo da ideia (ou o começo do texto, sem grupo) |
| Retro | `RETRO` (suportado na leitura) | — | — |

**A Retro não cria plano de ação hoje:** as colunas de ação ficam dentro do próprio quadro (ver `docs/fluxos/retro.md`). O front já exibe e roteia planos `RETRO` (faixa, filtro, link), mas ninguém os cria até existir um "Criar plano" na Retro. O mesmo vale para `SHOWCASE` (Review).

`sourceTitle` vai sem o nome da cerimônia ("Sprint 42"), porque a faixa já escreve "Criado a partir de **Radar de clima** «Sprint 42»".

## Trava de duplicidade

1. Ao abrir o resultado do Radar / a janela do Brainstorming, o front consulta `?squadId=&sourceType=&sourceId=` (sem `squadId` para sessão de "Squad Geral": o servidor trava também entre os planos sem squad) e confere o resultado no cliente.
2. Achou: mostra "Esta sessão já gerou o plano «X»" com **Abrir o plano**. Não oferece criar outro. No Radar o destino "Meu Kanban pessoal" continua disponível (cartões pessoais não são plano da squad).
3. Não achou: cria. Se outra pessoa criou no meio (corrida), o **409** leva ao plano existente (`existingPlanId`, título buscado em `GET /{id}`); sem `existingPlanId` (plano privado) a tela explica que o plano é privado e pede acesso.
4. A trava local (`healthCheck.plans.v1`, `agile_brainstorming_plan_{id}`) só vale quando o servidor não garante: consulta falhou, ou o plano do aviso volta **sem `sourceType`** (backend antigo). Se o servidor é novo e o plano do aviso foi apagado (404), o aviso é descartado e a sessão pode gerar plano de novo (o servidor libera a origem ao apagar).

## Prazo em data

- Na tabela, "Quando" vira campo de data (`<input type="date">`) com "Limpar o prazo" e o texto livre `when` como "Observação do prazo". Na janela da ação, "Prazo (data)" substitui o botão de calendário e "Quando" vira complemento.
- Atrasada: selo **Atrasada** (ícone + texto, tom de aviso) em ação com prazo vencido e status diferente de Concluído. O filtro "Atrasadas (N)" e a ordenação "Prazo mais próximo" são só do front.
- Gravação: `dueDate` quando há data; `clearDueDate: true` quando a pessoa apagou um prazo que existia; nada quando não havia prazo antes nem depois. Contra o backend antigo `dueDate`/`clearDueDate` **nunca** são enviados (`taskFormPayload`).

## Testes

`src/lib/__tests__/action-plan-origin.test.ts` e `action-plan.test.ts` (regras, payload, filtros, exportação), `src/app/action-plan/__tests__/api.test.ts` (409, filtros, contagens, ausência dos campos), `src/components/action-plan/__tests__/lobby.test.tsx` e `plan-origin.test.tsx` (lobby e página, com e sem V78), `src/components/health-check/__tests__/health-render.test.tsx` e `src/components/brainstorming/__tests__/CreatePlanDialog.test.tsx` (envio da origem, "já existe", 409, reserva local).
