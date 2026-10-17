# Kit de sala

Peças compartilhadas pelas salas ao vivo (Poker, Retro, Brainstorming, Health Check, Showcase, Plano de ação), em `src/components/room-kit`. O Poker foi a sala de referência; a Retro é a segunda a usar o kit inteiro. Tudo sai dos tokens do shadcn (`primary`, `card`, `muted`...) e vale nos 7 temas, claro e escuro. Classes são strings literais (o Tailwind só gera o que lê por inteiro).

Importe de `@/components/room-kit`.

## Peças

| Peça | Para quê |
|---|---|
| `RoomTopBar` | Cabeçalho único (~56 px): voltar, nome, fases, cronômetro, presença, ações, tema e conta. Ações extras recolhem no "Mais" por largura (`tier`). |
| `PhaseStepper` | Fases do ritual (a sala passa as suas). |
| `RoomTimer` | Contagem regressiva. `onExpire({ late })` (uma vez por `endTime`) e `lateGraceMs` (fim atrasado não toca o alarme) são opcionais; sem eles o comportamento é o do Poker. |
| `PresenceList`, `PersonAvatar` | Lista de presença agrupada por papel. |
| `SidePanel`, `ResponsivePanel` | Painel lateral: coluna fixa no desktop, folha lateral abaixo de 1024 px. |
| `Modal`, `ModalButton`, `ConfirmDialog` | Janelas: P 420, M 560, G 800. Vermelho só em excluir e encerrar. |
| `GuideSheet`, `Kbd` | Guia da sala em folha lateral com abas. |
| `ExportDialogShell` | Escolha do formato e um botão que diz o verbo. A sala gera o arquivo. |
| `TabBar`, `Segmented`, `SelectField` | Abas, seletor segmentado e lista suspensa temada (nunca `<select>` nativo). |
| `VoteKit` (`VoteCard`, `VoteSeat`, `DeckCard`...) | Cartas e assentos do Poker. |
| `RoomQr` | QR da sala. |
| **`SettingRow`** | Linha de ajuste: título, frase de apoio e interruptor (`role="switch"`). Aceita conteúdo extra que só aparece ligada. |
| **`PresentationBar`** | Faixa do modo apresentação no lugar do cabeçalho: "Apresentando", nome, controles da sala à direita e "Sair" (a sala trata a tecla Esc). |
| **`StageNav`** | Navegação em pílula entre etapas/colunas, fixa no pé; `locked` desabilita a troca e mostra o cadeado. |
| **`useRoomPreference`** | Preferência pessoal no navegador (visão, som, aviso dispensado). Começa no padrão, lê o storage depois de montar (sem divergência de hidratação) e devolve `loaded`. |

Em negrito, o que nasceu com a Retro. `connectRoomSocket` (`src/lib/room-socket.ts`) ganhou `onOpen`, chamado em toda abertura, inclusive a primeira.

## Como a Retro usa o kit

- `RetroRoomBar` monta o `RoomTopBar`: fases Escrever, Revelar, Votar e Agir (derivadas do quadro, `retroPhase`), chips de squad e formato, presença, chat, copiar link, exportar, números da sprint, configurações (facilitador), guia, som do timer e sair.
- `RetroControlBar`: ações do facilitador por fase (`RetroPhaseActions`), limite de votos, `RoomTimer` e a visão Quadro / Foco / Apresentar (`Segmented`).
- Janelas: `Modal` (configurações, boas-vindas, check-in, ações pendentes, números da sprint, Nova retro), `ConfirmDialog` (excluir cartão, zerar votos, remover pessoa, assumir controle, sair), `ExportDialogShell`, `GuideSheet`.
- Painéis: `ResponsivePanel` + `PresenceList` (participantes) e o `TeamChat` do Poker (chat).
- A regra que não depende de tela fica em `src/components/retro/retro-room-logic.ts` (fases, votos e limite, arrastar, timer, reducers dos eventos), testada sem DOM.

## Testes de sala

- Nos arquivos de teste os imports e os `vi.mock` usam caminho relativo: o alias `@/` não resolve a partir de `__tests__`.
- O `DropdownMenu` do Radix trava o jsdom ao abrir (mesmo isolado). Nos testes da sala ele é trocado por uma lista simples (ver `RetroRoom.test.tsx`); o `Select` do Radix também (um `<select>` nativo faz o papel).
- jsdom não traz `matchMedia` nem `ResizeObserver`: o teste cria os dois.

## Como o Brainstorming usa o kit

- Hub (`/brainstorming`): `BrainstormLobbyView` no `PageShell` (começar, última sessão, Como funciona com as cinco etapas reais, dicas e a lista da squad). A lista vem de `listBoards` e o histórico (`ritualsApi.history('BRAINSTORMING')`) dá ideias e pessoas. O campo de entrada aceita o ID ou o link inteiro (`readRoomCode`, em `lib/brainstorming-lobby.ts`; UUID volta em minúsculas). `CreateBrainstormDialog` é um `Modal` com squad fixa/do vínculo e os ajustes do facilitador (anônimo, ocultar ideias, duração).
- Sala (`/brainstorming/[id]`): a página cuida dos dados e do WebSocket; `BrainstormRoom` desenha com `RoomTopBar` (`BrainstormRoomBar`: cinco etapas, `RoomTimer` com `presets` de 1 a 20 min, presença `unknown`), `StageNav` (travado para quem não é facilitador), `ResponsivePanel` + `PresenceList`, `ShareDialog`, `GuideSheet`, `ExportDialogShell` e `ConfirmDialog` nas exclusões.
- Etapas: `MuralPhase`, `DiagramPhase` (Teia, React Flow), `GroupingPhase` (dnd-kit + `MoveToMenu`), `PrioritizationPhase` (Matriz: arrastar do navegador + `MoveToMenu`) e `ActionsPhase` (+ `CreatePlanDialog`, com prévia e trava local de duplicidade).
- `IdeaCard` lê autor e cobertura por contexto (`brainstorm-context.tsx`): o texto some para quem não é autor nem facilitador quando as ideias estão ocultas.
- Regras sem tela (testadas): `brainstorm-room-logic.ts`, `brainstorm-plan.ts`, `brainstorm-export.ts`.
- O pedido de imagem (PNG) é um número que a sala incrementa (`useExportRequest`): a etapa nunca baixa um PNG antigo ao ser montada.
- Mudanças aditivas no kit: `PresenceItem.online` opcional e `presence.unknown` no `RoomTopBar` (sem ponto verde quando o servidor não informa presença), `RoomTimer.presets`, `connectRoomSocket({ onClose })`.
