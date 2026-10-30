# Inventário funcional das telas — antes do redesenho

> Levantado do código em 2026-10-15, branch `feat/home-frontend` (develop + commits da Home). Somente leitura; nenhuma tela foi alterada.
> Objetivo: registrar tudo o que cada tela faz hoje (funções, painéis, modais, dados, papéis), para o redesenho não perder nada.

## Arquivos

Ordem de renovação combinada com o time:

| Ordem | Tela | Arquivo |
|---|---|---|
| 1 | Retro | [01-retro.md](01-retro.md) |
| 2–3 | Painel do Time e Meu Quadro (`/workspace`) | [02-03-painel-e-meu-quadro.md](02-03-painel-e-meu-quadro.md) |
| 4 | Showcase (Review + Teatro) | [04-showcase.md](04-showcase.md) |
| 5 | Brainstorming, Health Check, Plano de Ação | [05-brainstorming-health-check-plano.md](05-brainstorming-health-check-plano.md) |
| 6 | Onboarding, convite, reset de senha | [06-onboarding-convite-reset.md](06-onboarding-convite-reset.md) |
| 7 | Admin, Suporte, Changelog, Governança, Manual | [07a-admin-suporte-changelog-governanca-manual.md](07a-admin-suporte-changelog-governanca-manual.md) |
| 7 | Conhecimento, Prompt Hub, Jolt, DevTools | [07b-conhecimento-prompt-hub-jolt-devtools.md](07b-conhecimento-prompt-hub-jolt-devtools.md) |

Cada arquivo segue o mesmo roteiro: arquivos → estados → ações → painéis → modais → dados → papéis → componentes compartilhados → detalhes fáceis de perder → código morto, fake ou quebrado.

**Fora deste inventário:** Poker (`/room`, em redesenho em `feat/redesign-poker`), Home, Login, `/squad/**` (dashboards, roster, panels), `/sprint-planner`, `/agile-tools/sprint-planner`, `/projects`, `/dashboards/product-owner`, `/qa` (é o hub do DevTools filtrado).

---

## Peças que se repetem entre telas (candidatas ao kit)

| Peça | Onde aparece hoje | Situação |
|---|---|---|
| **Hub de ferramenta** (`ToolHubLayout`) | Retro, Showcase, Brainstorming, Health Check, Plano, Prompt Hub (landing) | Cada hub copia `saveRoomMeta`/`ROOMS_META_KEY`, validações de criação e `requestIdentity`. "Entrar por ID" converte para MAIÚSCULAS em todos (provável 404 com UUID). "Recentes" só lista o que foi criado no navegador. |
| **Dialog de criação de sala** | Retro, Showcase, Brainstorming, HC, Plano | Brainstorming e Plano são praticamente idênticos (Título + Squad). |
| **Cabeçalho de sala** (`RoomHeader`) | Quase todas | Brainstorming tem barra própria sem tema/perfil/feedback; Plano passa ícone vazio. |
| **Copiar link / convidar** | 5+ implementações | Textos de toast diferentes; alguns não tratam falha do clipboard. |
| **Guia (Sheet)** | Retro, Brainstorming, HC, Plano, Jolt, Conhecimento, Prompt Hub, Governança | Mesmo template; vários com conteúdo fake ou desatualizado. |
| **Exportação** | Retro (PDF/MD/CSV/TDN), Showcase (PDF/MD), Brainstorming (MD/CSV/PNG), HC (MD/CSV/PDF), Plano (MD/CSV), Admin (PDF/CSV) | 3+ geradores de CSV e de PDF à mão; `EliteExportDialog` com `handleCopy` morto em dois lugares. |
| **Participantes / presença** | Retro e Brainstorming (sidebar completa), HC (só contagem), Showcase e Plano (nada) | Retro não tem heartbeat: todos aparecem online. |
| **Timer** | Retro (dentro de `RetroControls`), Brainstorming (`EliteTimer`) | Duas implementações; som sem controle para o participante em ambas. |
| **Chat** | Retro (reusa `poker/team-chat/*`) | Já compartilhado com o Poker. |
| **Card votável** (`AgileCard`/`EliteBaseCard`) | Retro, Brainstorming | Botão de voto sempre visível, mesmo fora da votação. |
| **Socket de sala + auto-join + gates** | Retro, Brainstorming, HC, Showcase | `reloadSeq`, `joinAttempted`, `wsBase`, Loading/NotFound e `document.title` duplicados. Plano usa polling de 15s. |
| **Edição inline com proteção de duplo salvamento** | Brainstorming, Plano, HC (comentário), Showcase (debounce) | 4 implementações. |
| **Importação Jira** | Showcase (`JiraImportDialog`), Painel e Onboarding (`JiraProfieldsImport` + `JiraImportPreview`), Admin (`JiraSyncPanel`) | Três fluxos diferentes; listas de cargos divergem. |
| **Feedback** | Todas | Ligado de 3 jeitos; inacessível no Brainstorming; ausente no Plano. |
| **Confirmações** | Todas | `window.confirm` nativo misturado com `AlertDialog` e confirmação inline. |
| **Toasts** | Workspace, Conhecimento, Prompt Hub | Duas bibliotecas (`useToast` e `sonner`) na mesma tela. |

### O que já existe no kit (resposta da sessão do Poker, 2026-10-15)

- **Pronto** em `src/components/room-kit/` na branch `feat/redesign-poker` (worktree `agile-space-frontend-wt/poker`, ainda não mergeada): tokens, primitives, Modal, ConfirmDialog, SidePanel, RoomTimer, PresenceList, PhaseStepper, GuideSheet, ExportDialogShell, VoteKit, TabBar, RoomQr.
- **Planejado sem código:** cabeçalho de sala padrão (extrair do `PokerRoomBar`), barra de controles da facilitação, cartão de nota/ideia, estados vazios.
- **A extrair na Retro:** RoomChat (mover `poker/team-chat`), ReactionBar, NoteCard, `useDotVoting` + VoteDots, modo apresentação/foco, check-in de humor, OptionSwitches, ModelPicker.
- **A aposentar conforme cada sala migrar:** `shared/Elite*` (EliteTimer, EliteParticipantList, EliteExportDialog, EliteSidebar) e os diálogos de apelido paralelos.
- **Só o Poker está liberado para implementação.** Cada tela seguinte (começando pelas salas ao vivo) só começa depois que o design dela for discutido e aprovado no canvas e este inventário for conferido de novo contra o código. As extrações acima são só a lista de peças, não um plano de execução.
- Não editar `room-kit/`, `poker/`, `app/room/`, arquivos da Home nem `app/layout.tsx` enquanto as branches de redesign estão abertas.

---

## Decisões que o redesenho precisa tomar (achados que mudam o desenho)

**Funções que a UI promete e não entrega**
- Retro: não existe "Sair do quadro" nem estado "encerrada".
- Showcase: o Summary só abre via "Finalizar"; não há como reexportar uma Review finalizada.
- Health Check: exportação sai zerada fora da escala semáforo; "Gerar Plano de Ação" duplica cards no Kanban após recarregar.
- Meu Quadro: aba Prompts não edita nem exclui; prazo (`dueDate`) carregado e nunca mostrado; "+ Outra Squad (Digitar)" só limpa o campo.
- Suporte: "Abrir Primeiro Ticket" não faz nada; **o admin não tem tela para responder tickets** (dialog pronto em `AdminComponents.tsx`, morto).
- Admin: "Modo Manutenção", "Acesso Anônimo" e "Logo" são salvos e nada os consome.
- Jolt: persistência na nuvem implementada e não usada (layouts só no navegador).
- DevTools: Estúdio de Mocks não serve nada.
- Prompt Hub: não há "adicionar à coleção" no card.

**Dados fake na tela**
- Health Check: "Engajamento" supõe 5 participantes, "Data Inicial: Sprint Atual" fixo.
- Admin Motor AI: latência, assertividade e precisão fixas.
- Meu Quadro: "Sistema Pronto", "Ritmo do Dia" (é % de todos os tempos).
- Conhecimento: "Otimização 98%", "V4.0.2 Premium".
- Governança: Guia com "99.99%" e "TLS 1.3" que contradizem a página.
- Painel: métricas "Sprint atual" e "Retrospectivas" sempre "—".

**Navegação sem URL** (links externos caem no lugar errado)
- Abas do Admin e do Meu Quadro não vão para a URL.

**Permissões frouxas a decidir**
- Showcase: qualquer pessoa com o link edita, remove e finaliza (só a decisão é PO/SME).
- Retro: qualquer participante funde cards e assume o controle.
- Brainstorming: qualquer participante edita e funde ideias de outros e exporta para 5W2H.
- Plano de Ação: nenhuma diferença de papel.
- Meu Quadro: papel autodeclarado no Perfil.

**Mobile e tema escuro**
- Brainstorming: participantes inacessíveis abaixo de md; Matriz sem DnD em toque.
- Health Check: "Exportar Radar" some no celular.
- Meu Quadro: ⌘K e ações de snippets inacessíveis no toque.
- Conhecimento: sem menu abaixo de xl.
- Admin e `MyApiKeysManager`: sem modo escuro.
