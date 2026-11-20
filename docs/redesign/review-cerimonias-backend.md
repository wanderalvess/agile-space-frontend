# Review: o que o front consome do backend novo (V81)

Trava de decisão do PO/SME, edição por card, participantes do resumo, seguir o apresentador e consultas JQL da squad. O contrato do servidor é `agile-space-backend/docs/ceremony-review-api.md` (migração V81, rotas em `/api/showcase-sessions`, WebSocket `/ws/showcase/{id}`); este documento diz **o que a tela consome** e **como se comporta contra o backend antigo** (sem V81), que é o que está na homologação.

## Regra de ouro: funciona com os dois backends

Todo campo novo é opcional e toda rota nova tratada com 404/405/501 vira "indisponível", sem erro na tela. O sinal de "este servidor conhece a V81" é o **card trazer `version`** (`supportsPatch` em `card-sync.ts`).

| Recurso | Backend novo (V81) | Backend antigo |
|---|---|---|
| Trava de decisão | Veredito e feedback só para quem pode; o 403 `DECISION_RESTRICTED` é tratado | O servidor aceita qualquer pessoa logada; a tela decide pelos vínculos, se houver, senão pelo cargo do perfil |
| Edição de um card | `PATCH /{id}/cards/{cardId}` só com os campos mudados, mais `version` | `POST` da sessão inteira (fila de gravação de sempre) |
| Edição ao mesmo tempo | 409 resolvido sozinho quando os campos são outros; aviso com "Reaplicar a minha" quando é o mesmo campo | A última gravação vence (reaplicada sobre a versão atual, como antes) |
| Tempo real | `CARD_UPDATED` troca só aquele card; `SESSION_UPDATED` segue valendo | `SESSION_UPDATED` / `REFRESH_SESSION` |
| Cards mantidos no `POST` | `staleCardIds` avisa "N cards foram mantidos como estavam no servidor" e recarrega | Não vem; nada muda |
| Participantes | Linha "Participantes" no resumo, na impressão e nas exportações | A linha não aparece |
| Seguir o apresentador | Chip "Apresentando: nome" + botão Acompanhar | Nada aparece (a publicação para na primeira resposta 404/405) |
| JQL da squad | Grupo "Da squad" ao lado de "Neste navegador" e opção de salvar na squad | Só as consultas deste navegador |

## Trava PO/SME (`canDecide` em `review-room-logic.ts`)

Regra do servidor (`ShowcaseAccessPolicy`), espelhada no cliente com os vínculos da pessoa (`useMyMemberships`, ver `src/lib/memberships.ts`):

1. Administrador (`userProfile.role === 'admin'`) sempre pode.
2. Review **com squad** (a chave guardada em `squadName`): liderança da squad por vínculo (`leadership` do vínculo ou de qualquer papel) **ou** vínculo na squad com papel `PRODUCT_OWNER`/`SME` (pela chave ou pelo nome, sem caixa, incluindo "Product Owner (PO)"). Vínculo de outra squad não vale.
3. Review **sem squad**: só administrador e criador (`session.createdBy === login`).
4. **Sem dados de vínculos** (endpoint ausente, conta só com rastro legado): vale o cargo global do perfil (PO ou SME), como antes. `canDecide('Product Owner')` (texto) segue chamando essa regra.

A sala calcula o resultado e o passa ao Teatro (`canDecide`, botões Aprovar/Ajustar/Rejeitar desativados com o aviso "Decisão restrita") e ao card (o "Feedback da Review" fica só para leitura, sem apagar o texto).

**403 `DECISION_RESTRICTED`** (cliente desatualizado, vínculo que mudou): o servidor recusa a requisição inteira. A sala mostra "Você não pode registrar a decisão desta Review", tira veredito e feedback do que ia gravar, **grava o resto** (PATCH sem esses campos; no `POST`, refaz com a decisão do servidor nos `cardIds` recusados), recarrega o card e não avança no Teatro. Nada digitado some.

## Edição por card (`useShowcaseRoom.ts` + `card-sync.ts`)

- `updateTask`: se o card tem `version`, calcula a diferença contra o estado anterior (`diffCard`: campos de conteúdo; `evidence` por subcampo; `metrics` por inteiro), aplica na tela na hora e enfileira um `PATCH` com a versão lida. Alterações seguidas do mesmo card ainda na fila viram um PATCH só. Campos do servidor (`decidedBy`, `approvedAt`, anexos...) nunca vão.
- A fila é uma só: os cards editados saem primeiro (PATCH), depois a sessão (`POST`: criar/remover cards, ordem, configurações), com a releitura de sempre antes de gravar. O `POST` deixa de levar `presenter` e `staleCardIds` (só leitura).
- **409 `CARD_VERSION_CONFLICT`**: o corpo traz o card atual. Para cada campo que a pessoa mexeu, compara o valor do servidor com a **base** (o valor antes da primeira alteração local) e com o novo: se o servidor mudou aquele campo para outra coisa, **colidiu**. O que não colidiu é reaplicado sobre o card atual e regravado com a versão nova, sem perguntar nada (até 3 tentativas). O que colidiu fica em `conflicts` e aparece em `ReviewConflictBar`: "Outra pessoa alterou PTV-12 ao mesmo tempo: título. Sua versão não foi gravada.", com o que a pessoa digitou e os botões **Reaplicar a minha** (regrava por cima do card atual) e **Descartar**. A tela mostra o que está gravado.
- **`CARD_UPDATED`** (`payload.card`): troca só aquele card (`applyServerCard`), mantendo por cima o que a pessoa ainda não gravou nele; versão igual ou menor é eco e é ignorada; card desconhecido recarrega a sessão; `sessionUpdatedAt` atualiza `updatedAt` da sessão.
- **`staleCardIds`** no `POST`: toast "N cards foram mantidos como estavam no servidor" e releitura da sessão.
- `updateTask` devolve `false` nos três casos de falha e `lastFailure()` diz qual foi (`restricted`, `conflict`, `error`); a página só mostra o toast genérico "A decisão não foi gravada" quando a sala ainda não explicou.

## Participantes

`participantNames(session)` (`review-export.ts`): nomes de `participants`, sem repetir (sem caixa) e sem vazios. Aparece como "Participantes:" no resumo (a antiga lista de integrantes da Review virou "Squad:", igual ao log), na capa da impressão, na capa do PDF e no log em Markdown. Lista vazia ou campo ausente: a linha some.

## Seguir o apresentador

- `useShowcasePresenter` publica `PUT /presenter` com `{ cardId, step }` (`step` é `cover` na capa, com `cardId` nulo, ou `card`), no máximo uma vez a cada 500 ms (primeira na hora, no meio do intervalo só a última). `DELETE` ao sair do Teatro, finalizar ou sair da sala, se fui eu quem publicou.
- **Só publica** quando ninguém apresenta ou o apresentador sou eu: outra pessoa apresentando não é tomada por quem só navega. 404/405/501 (backend antigo), 403 (não conduz a Review), 409 e 401 desligam a publicação da sala, em silêncio.
- O estado vem do GET da sessão (`presenter`) e do `PRESENTER_UPDATED` (estado completo; `null` = acabou). Nada de "snapshot" no socket.
- Quem não apresenta vê `PresenterChip` ("Apresentando: Ana" + Acompanhar, liga/desliga com `aria-pressed`) no cabeçalho do Teatro e, fora do Teatro, numa faixa acima da lista (Acompanhar abre o Teatro já seguindo, sem regravar o status da Review). Acompanhando, o Teatro vai para o `cardId` publicado (capa se nulo; card removido não move). Navegar com setas, botões ou barra de progresso **solta sozinho**; o apresentador parar (ou virar eu) também. Quem acompanha não avança sozinho depois de decidir.

## JQL da squad

- `GET /jql?squadId=` ao abrir a aba "Conexão API" do Importar do Jira (só se a Review tem squad); `POST /jql` e `DELETE /jql/{id}` pelo hook `useSquadJqls`.
- Grupo **Da squad** (ícone de pessoas para visibilidade `SQUAD`, cadeado para `PRIVATE`; X só quando `canDelete`) acima do grupo **Neste navegador** (as consultas locais ficam exatamente como estavam, com os mesmos ícones e exclusão) e das predefinições. Os rótulos só aparecem quando o grupo da squad existe.
- Salvar pergunta **onde guardar**: Privada / Pública (neste navegador, como sempre) ou **Da squad** / **Só minha** (na squad). Texto honesto: "Da squad: só o texto da consulta é compartilhado. A busca roda no seu navegador, com a sua conta do Jira." Erros do servidor (nome repetido, limite de 30, sem permissão) aparecem no formulário com a mensagem do servidor.
- 404/405/501 ou 403 no GET: some o grupo e ficam só as locais, sem erro. Falha de rede ou 5xx: linha "Não foi possível carregar as consultas da squad. Tentar de novo".

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/components/showcase/types.ts` | Campos opcionais: `version`/`updatedAt` do card, `createdBy`/`participants`/`presenter`/`staleCardIds` da sessão, `ShowcaseParticipant`, `ShowcasePresenter`, `ShowcaseJqlQuery` |
| `src/app/showcase/api.ts` | `patchCard`, `getPresenter`/`setPresenter`/`clearPresenter`, `listSquadJql`/`saveSquadJql`/`deleteSquadJql`; o erro leva `status`, `code` e `body`; `isUnavailableError` |
| `src/components/showcase/card-sync.ts` | Regras puras: diferença por campo, base, colisões, PATCH, card do servidor na sessão, leitura de 403/409 |
| `src/components/showcase/useShowcaseRoom.ts` | Fila de gravação unificada, `CARD_UPDATED`, `PRESENTER_UPDATED`, conflitos |
| `src/components/showcase/review-room-logic.ts` | `canDecide` com vínculos |
| `src/components/showcase/presenter-sync.ts`, `useShowcasePresenter.ts`, `PresenterChip.tsx` | Apresentador |
| `src/components/showcase/squad-jql.ts`, `useSquadJqls.ts`, `src/components/shared/JiraImportDialog.tsx` | JQL da squad |
| `src/components/showcase/ReviewConflictBar.tsx` | Aviso de conflito |

## Decisões em aberto

- **Assumir a apresentação**: hoje quem só navega não toma o lugar de quem apresenta. Se o apresentador sumiu sem encerrar, a validade do servidor (4 h) libera; não há botão "assumir".
- **Presença e participantes dependem da instância única** do servidor (memória do processo), como a presença das salas.
- O `PATCH` detecta conflito por card, não por campo: o cliente já trata a diferença por campo, mas dois PATCH quase simultâneos em campos diferentes custam uma volta a mais.
- Antes de ligar para todos, vale testar em homologação com o backend novo e **dois usuários** (tempo real, conflito e acompanhar só se provam assim).
