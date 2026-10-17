# Brainstorming: encerrar, facilitação, limite de votos, autoria e "editada"

Frontend das cerimônias (2/3). Contrato do backend: `agile-space-backend/docs/ceremony-brainstorming-api.md`
(migração V80, branch `feat/membership-integration`, ainda fora da homologação).

**Regra de ouro: o frontend funciona contra o backend antigo e contra o novo.** Todo campo novo é opcional
(`src/lib/types.ts`) e toda função nova só aparece quando o servidor a conhece.

## Como a tela decide que o servidor é novo

`supportsCeremonyApi(board)` (em `src/components/brainstorming/brainstorm-ceremony.ts`): o backend novo sempre manda
`status` e `facilitatorId` (mesmo em mural antigo). Sem eles a sala é a de sempre. Além disso, um 404/405 numa rota nova
marca `ceremonyUnavailable` na página e a função some (com um aviso neutro, sem vermelho). No `transfer`, o 404
"Essa pessoa não está nesta sala." é mensagem do servidor, não rota ausente.

## Contrato consumido

| Campo / rota | Onde aparece | Backend antigo | Backend novo |
|---|---|---|---|
| `facilitatorId` (cai em `creatorId`) | "sou facilitador" em todas as telas (poderes, ocultar/revelar, apagar ideia alheia, cronômetro, etapas, texto das ideias ocultas); lobby ("você facilita", apagar) | = criador, como antes | muda ao assumir/passar; trocar recarrega as ideias |
| `facilitatorName`, `participante.displayName` | "Facilitação: Fulana" na lista de participantes; nomes na sala | usa `nickname` | `displayName` primeiro |
| `status` (`OPEN`/`FINISHED`), `finishedAt` | chip "Encerrado" na barra, aviso, sala somente leitura; lobby (coluna Status, filtros Abertos/Encerrados) | sempre aberto | real |
| `POST /{id}/finish`, `/reopen` | menu "Mais" e Configurações (facilitador, criador, ADMIN); "Reabrir" no aviso | não há botão | idempotente |
| `POST /{id}/facilitation/claim` | "Assumir a facilitação" (aviso e painel de participantes) | não há botão | 409/403 mostram a mensagem do servidor |
| `POST /{id}/facilitation/transfer` `{userId}` | "Passar a facilitação…" (menu "Mais" e painel; facilitador/ADMIN) | não há botão | escolha numa lista da sala |
| `votesPerParticipant` (1..100 ou `null`) | "Votos por pessoa" em Nova sessão e Configurações; "Você usou 2 de 3 votos" ao pé da sala; votar desabilitado ao atingir | sem limite | servidor valida (409) |
| `settings.restrictEdits` | interruptor "Só o autor e a facilitação editam o texto" (Nova sessão e Configurações); lápis escondido de quem não pode | livre | 403 mostra a mensagem |
| `authorName` (ideia) | nome do autor no cartão; senão lista de participantes; senão "Participante"; anônimo segue "Anônimo" | idem ao de hoje | só em mural não anônimo |
| `editedAt`, `editedBy`, `editedByName` | selo "editada" / "editada por Caio" no pé do cartão (data e hora no `title`) | sem selo | nomes só em mural não anônimo |

## Regras da tela (puras e testadas)

- **Encerrar/reabrir**: facilitador atual, criador ou ADMIN (`canFinishOrReopen`). Encerrar pede confirmação. Encerrado:
  todos leem, ninguém escreve (lançar, editar, votar, fundir, mover, agrupar, apagar, criar/apagar grupo, ligar na Teia,
  mover na Matriz); a navegação de etapas e o cronômetro ficam travados e os ajustes desabilitados (só o título muda, como
  no servidor). Passar a facilitação, entrar/sair, exportar e criar o plano seguem permitidos.
- **Assumir** (`claimState`): criador e ADMIN sempre; participante só com a presença dizendo que o facilitador está OFFLINE,
  habilitado depois de 60 s medidos pela tela (`FACILITATOR_OFFLINE_SECONDS`, o mesmo padrão do servidor; o servidor confere
  e responde 409 "saiu há pouco" se divergir). Presença desconhecida (`null`) = o botão não aparece para participante.
- **Passar**: facilitador atual ou ADMIN, para alguém da lista de participantes.
- **Cota de votos**: `votesUsedBy` conta as ideias com o seu id em `votes`; com a cota cheia só dá para tirar o voto. Ideias
  ocultas vêm sem votos para quem não pode lê-las, então a tela pode subestimar: o servidor é quem recusa (409) e a tela
  recarrega o mural. Reduzir o limite abaixo do usado não tira votos de ninguém.
- **Quem edita o texto** (`canEditIdeaText`): sem `restrictEdits`, qualquer participante; com ele, autor, facilitador atual e
  ADMIN. Mover, agrupar, votar e fundir seguem livres.
- Qualquer 409 de escrita recarrega só o mural (encerrado, limite ou facilitação mudaram por outra pessoa).

## Backend antigo vs novo (resumo para a homologação)

- Hoje (homologação, sem V80): nada de novo aparece; a sala é idêntica à anterior. Lobby mostra "Aberto" em todas as sessões.
- Com o backend novo: tudo acima liga sozinho, sem flag. Em Nova sessão, os ajustes novos aparecem se algum mural da squad
  traz os campos novos (ou se a squad ainda não tem mural). Se o servidor ignorar os campos (antigo), um aviso diz que o
  limite não foi aplicado.

## Testes

`brainstorm-ceremony.test.ts` (regras puras), `BrainstormRoom.ceremony.test.tsx` (somente leitura, assumir, passar, cota, selo,
edição restrita, configurações), `brainstorming-room-page.test.tsx` (facilitador efetivo, encerrar/reabrir/assumir/passar,
404/403/409), `api.test.ts` (rotas novas), `CreateBrainstormDialog.test.tsx`, `useOfflineElapsed.test.ts`, lobby
(`brainstorming-lobby.test.ts`, `BrainstormLobbyView.test.tsx`).

## Pendências

- Tempo real (BOARD_UPDATED com o novo facilitador, mural encerrado por outra pessoa) só se prova com o backend novo e dois
  usuários.
- Encerrado trava a troca de etapa também para leitura (o servidor só aceita `PATCH` de título): para ver outra etapa é
  preciso reabrir. Decisão aberta: permitir navegação local só de leitura.
