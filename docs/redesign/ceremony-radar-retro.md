# Radar de clima e Retrospectiva: o que o backend novo (V79) trouxe

Contrato do backend: `agile-space-backend/docs/ceremony-radar-retro-api.md` (branch `feat/membership-integration`, migração V79). Este documento diz **o que o frontend consome**, **como cada recurso se comporta com o backend antigo e com o novo** e onde está o código.

Regra geral: tudo é **opcional e aditivo**. Campo novo ausente = recurso escondido, nunca zero inventado nem erro na tela. Rota nova com `404`/`405` = "indisponível", sem toast. Evento novo só chega a quem pediu no socket (`?presentation=1`, `?typing=1`); um backend antigo ignora o parâmetro e nunca envia o evento.

## Socket (`src/lib/room-socket.ts`)

`connectRoomSocket` ganhou, de forma aditiva:

| Opção / retorno | Efeito |
|---|---|
| `presentation: true` | acrescenta `presentation=1` à URL (cada tentativa de reconexão) |
| `typing: true` | acrescenta `typing=1` à URL |
| retorno | continua sendo a função que encerra tudo; agora com `send(mensagem)` anexado (`false` se a conexão não está aberta, sem fila) |
| `withFlagParam(url, nome)` | helper genérico, mesmo padrão do `withPresenceParam` |

Sem as opções a URL não muda.

## Radar de clima

Arquivos: `src/lib/health-check-progress.ts` (lógica pura), `src/hooks/useHealthPresentationSync.ts`, `src/components/health-check/HealthResponseProgress.tsx`, `src/app/health-check/api.ts`, `src/app/health-check/[id]/page.tsx`, `HealthCheckResults.tsx`, `HealthCheckVotingBoard.tsx`, `HealthRoomShell.tsx`, `HealthLobbyView.tsx`, `src/lib/health-check-lobby.ts`.

| Recurso | Backend antigo | Backend novo |
|---|---|---|
| Encerrado ou não | lê `status` (`collecting`/`finished`) | lê `lifecycleStatus` (`OPEN`/`FINISHED`) primeiro, com fallback para `status` (`isBoardFinished`) |
| Data do encerramento | "Situação: Encerrada", sem data | "Encerrada em dd/mm/aaaa às hh:mm" (`finishedAt`). `finishedAt` nulo (encerrado antes da V79) cai no "Situação: Encerrada"; nenhuma data é inventada. No lobby, "encerrada há N dias" na última pesquisa |
| "N de M já responderam" | não aparece | sala (cartão de andamento e painel de participantes), resultado (cartão e linha "Participação") e lobby (coluna Respostas "5 de 8" e última pesquisa). `respondedCount`/`completedCount` vêm do quadro e do `BOARD_UPDATED`; o total (`M`) vem da lista de participantes já sincronizada (no lobby, de `participantsCount`). Nunca mostra mais respondentes que pessoas |
| "Ainda não votaram" | não aparece | só criador/ADMIN: `GET /{id}/progress`, refeito quando `respondedCount` muda (uma chamada leve); nomes pelos participantes do quadro, ordem alfabética. Sem `respondedCount` no quadro (backend antigo) a rota nem é chamada. `404`/`405`/`403` desligam o bloco sem erro |
| Texto de privacidade | "Votos anônimos. Você só vê os seus até o facilitador encerrar…" | o mesmo, mais "O facilitador vê quem ainda não votou, nunca o que cada pessoa votou." (só aparece quando o servidor informa as contagens) |
| Apresentação | cada pessoa navega na sua tela ("Cada pessoa navega na própria tela") | **facilitador** (criador/ADMIN) publica a etapa: `PUT /presentation {stage}` ao abrir e a cada troca, `DELETE` ao sair ou fechar a tela. **Participantes** acompanham: socket com `presentation=1`, evento `PRESENTATION_STAGE` (estado completo) e `presentationStage` do `GET`/`BOARD_UPDATED` (cobre quem entra ou reconecta; o servidor não manda snapshot) |

### Apresentação sincronizada, passo a passo

- Etapas publicadas: `score`, `radar`, `freq`, `comments`, `plan` (o servidor aceita qualquer texto de 1 a 40 caracteres `A-Za-z0-9_-.`). Etapa desconhecida (versão mais nova do facilitador) é ignorada.
- Participante: **"Acompanhar o facilitador" ligado por padrão**. Enquanto há etapa publicada ele entra na apresentação, vê a mesma etapa e a navegação (`StageNav`, setas) fica travada, com o chip "Acompanhando o facilitador" e o botão **Soltar**. Soltar mantém a pessoa na apresentação, agora livre; "Acompanhar o facilitador" volta a seguir. Sair da apresentação (botão ou Esc) enquanto segue também solta, para não ser puxada de volta na hora. Quando o facilitador encerra (`stage = null`), quem estava seguindo sai; quem abriu a própria apresentação continua nela.
- Fora da apresentação, se o facilitador está apresentando e a pessoa soltou, aparece a faixa "O facilitador está apresentando agora" com o botão de acompanhar.
- Tudo isso é **derivado** (sem efeito que copia estado): `followState` em `health-check-progress.ts` e o hook `useHealthPresentationSync`.
- Facilitador: as publicações são enfileiradas (a última vence). `404`/`405` (backend antigo) ou `403` param de publicar pelo resto da sessão e a tela volta ao texto "Cada pessoa navega na própria tela". O facilitador só tenta publicar se o quadro trouxe o campo `presentationStage` (a rota nem é chamada em backend antigo). Falha de rede só vai ao `console.warn`.
- `PRESENTATION_STAGE` é tratado explicitamente no `onMessage` (o tipo desconhecido recarregaria tudo).

## Retrospectiva

Arquivos: `src/lib/retro-lifecycle.ts`, `src/lib/retro-typing.ts`, `src/lib/retro-lobby.ts`, `src/hooks/useRetroTyping.ts`, `src/app/retro/api.ts`, `src/app/retro/[id]/page.tsx`, `RetroRoom.tsx`, `RetroRoomBar.tsx`, `RetroControlBar.tsx`, `RetroColumn.tsx`, `RetroCard.tsx`, `AddRetroCard.tsx`, `RetroHealthCheckGate.tsx`, `RetroCheckinNotes.tsx`, `SprintStatsDialog.tsx`, `RetroLobbyView.tsx`, `src/components/poker/team-chat/{TeamChat,ChatComposer}.tsx` (props opcionais; o Poker não passa e não muda).

O "backend novo" da Retro é reconhecido por `lifecycleStatus` presente no quadro (`supportsRetroLifecycle`). Sem ele, os botões de encerrar, o "Escrevendo…" e a nota do check-in não existem.

| Recurso | Backend antigo | Backend novo |
|---|---|---|
| Encerrar / Reabrir | não existe | botões **Encerrar retro** e **Reabrir** na barra de controles, só para o facilitador (criador) e ADMIN, cada um com `ConfirmDialog`. `POST /finish` e `/reopen`; `403`/`409` mostram a mensagem do servidor num toast. Selo **Encerrada** na barra da sala |
| Retro encerrada para participante | n/a | **somente leitura**: aviso fixo ("O facilitador encerrou esta retro…"), sem campo de novo cartão, sem editar/apagar/mover/fundir, votos e reações desabilitados, sem boas-vindas. As escritas também são barradas no handler da página, antes de chamar o servidor. O chat, o check-in e sair continuam (o servidor não bloqueia). Se mesmo assim o servidor devolver `409`, o toast mostra o texto dele. Facilitador e ADMIN continuam podendo tudo |
| Lobby | "Em andamento" = criada nas últimas 24 h e votação não encerrada | **Ao vivo** = `lifecycleStatus` aberto e criada nas últimas 24 h (a votação encerrada não tira da lista). **Encerrada** (chip + "encerrada em dd de mmm") = `lifecycleStatus = FINISHED`. Filtro **Encerradas** só aparece quando algum quadro traz o campo |
| "Escrevendo…" | nada é enviado nem mostrado | `typing=1` no socket; ao digitar num novo cartão ou no chat envia `{type:'TYPING', scope, columnKey\|channelId}` no máximo **a cada 2 s** por sessão (sem `userId`: o servidor usa o do login). Mostra "Fulana está escrevendo…" na coluna ou no canal por **até 5 s** (a validade conta do relógio local, no máximo 5 s). Autoria oculta (`anonymous`/`userId: null`, ou `isAuthorsRevealed` falso na tela): só **"Alguém está escrevendo…"**, nunca o nome. O evento próprio é ignorado e `TYPING` nunca recarrega a sala |
| Check-in com nota | só a escolha entre 5 humores | campo opcional "Quer contar mais?" (até 500; enviado só se preenchido, nunca `null`). O facilitador vê nome, humor e nota no painel de participantes ("Notas do check-in"); os demais não veem na interface |
| Números da sprint | entregue, previsto, ficou para a próxima e cumprimento | os mesmos, mais **Itens na sprint** (`totalItens`), **Concluídos no Jira** (`concluidosJira`), **Bugs na sprint** (`bugs`) e **Pontos que ficaram para a próxima** (`carryOverPontos`). Cada campo só aparece se veio; nada de zero inventado |

## Decisões e limites

- **Quem é facilitador na tela**: criador do radar/retro ou `role === 'admin'` (o backend aceita os dois). Quem assume o controle da retro (`transfer-control`) vira o criador.
- **Retro "Ao vivo" e retros antigas**: todas as retros anteriores à V79 voltam `OPEN`. Por isso "Ao vivo" exige também as 24 h; sem isso o lobby encheria de "ao vivo" antigas. Uma retro reaberta depois de 24 h não volta ao banner "Em andamento" (o backend não informa quando foi reaberta).
- **Nota do check-in**: o texto da janela diz que aparece "com o seu nome, só para o facilitador" (é o que a interface faz). Pelo contrato, `checkinNote` sai em `GET /participants` e no `PARTICIPANT_JOINED` para quem está na sala, ou seja, tecnicamente é legível por quem consulta a API. Se for preciso garantir sigilo de verdade, o backend precisa restringir o campo ao facilitador.
- **"Escrevendo…" em várias instâncias do backend** só alcança quem está na mesma instância (contrato).
- **Testes**: lógica pura em `src/lib/__tests__/health-check-progress.test.ts`, `retro-ceremony-v79.test.ts`, `room-socket-flags.test.ts`; clientes em `src/app/health-check/__tests__/api.test.ts` e `src/app/retro/__tests__/api.test.ts`; página em `retro-room-page.test.tsx`; telas em `health-render.test.tsx`, `RetroRoom.test.tsx` e `retro-dialogs.test.tsx`. Tempo real de verdade (dois usuários) só se prova com o backend novo no ar.
