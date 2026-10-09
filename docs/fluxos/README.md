# Fluxos do Portal Tech V&D

Documentação de **como cada módulo funciona**, escrita para que um agente (ou uma pessoa) entenda o fluxo sem ler código, e para que erros de fluxo apareçam na leitura. Descreve o que o sistema faz **hoje** (estado do `develop` em 2026-10-09). Onde algo é suposição ou não foi testado ao vivo, o texto diz.

## Índice

### Acesso, equipes e papéis
| Documento | Assunto |
|---|---|
| [onboarding-e-papeis.md](onboarding-e-papeis.md) | Primeiro acesso, quem cadastra equipes (AM/PL), importação do Jira em lote, papéis |
| [autenticacao-e-sessao.md](autenticacao-e-sessao.md) | Login do Portal, JWT, sessão, cadastro |
| [usuarios-e-administracao.md](usuarios-e-administracao.md) | Perfil, usuários, administração |
| [convites.md](convites.md) | Convites de equipe |
| [chaves-de-api-e-mcp.md](chaves-de-api-e-mcp.md) | Chaves de API (REST e MCP) |
| [suporte-e-feedback.md](suporte-e-feedback.md) | Chamados de suporte e feedback |
| [seguranca-transversal.md](seguranca-transversal.md) | Modelo de autorização, rotas públicas, riscos aceitos |

### Cerimônias
| Documento | Assunto |
|---|---|
| [retro.md](retro.md) | Retrospectiva: fases, votação, timer, fusão, plano de ação, exportação |
| [poker.md](poker.md) | Scrum Poker: sala, rodadas, síncrono/assíncrono, votos às cegas, Jira |
| [review.md](review.md) | Review (showcase): sessão, cards, anexos, decisão do PO, modo Teatro |
| [brainstorming.md](brainstorming.md) | Brainstorming: mural, ideias, grupos, votos, Matriz, Plano 5W2H |
| [health-check.md](health-check.md) | Radar de saúde do time |
| [plano-de-acao.md](plano-de-acao.md) | Planos de ação |

### Squad e Jira
| Documento | Assunto |
|---|---|
| [squad.md](squad.md) | Hub da squad: roster, capacidade, board |
| [dashboards-por-papel.md](dashboards-por-papel.md) | O que cada papel vê e de onde vem cada número |
| [sincronizacao-jira-squad.md](sincronizacao-jira-squad.md) | Sync com o Jira, snapshots, rollups, agendador |
| [planejamento-sprint.md](planejamento-sprint.md) | Planejamento de sprint e work items |
| [painel.md](painel.md) | Painel (`/painel`) |
| [governanca-e-projetos.md](governanca-e-projetos.md) | Governança, PO e projetos |
| [integracao-jira.md](integracao-jira.md) | Proxy do Jira, importação Profields, tokens, segurança |
| [jira-dash.md](jira-dash.md) | Jira Dash |

### Conhecimento e ferramentas
| Documento | Assunto |
|---|---|
| [biblioteca-ia.md](biblioteca-ia.md) | Biblioteca de IA (`/prompt-hub`): itens, coleções, visibilidade, leitura pública |
| [base-de-conhecimento.md](base-de-conhecimento.md) | Wiki, ingestão de PDF/Word, busca, assistente de IA |
| [workspace.md](workspace.md) | Meu Espaço: kanban, notas, atalhos |
| [manual-e-ajuda.md](manual-e-ajuda.md) | Manual e ajuda |
| [jolt.md](jolt.md) | Jolt: sandbox, mapeador visual, projetos salvos |
| [devtools.md](devtools.md) | Ferramentas de desenvolvimento |
| [central-de-qualidade.md](central-de-qualidade.md) | Central de Qualidade |
| [ferramentas-ageis.md](ferramentas-ageis.md) | Ferramentas ágeis avulsas e arquitetura |

### Operação
| Documento | Assunto |
|---|---|
| [ambiente-e-deploy.md](ambiente-e-deploy.md) | Repositórios, migrations, deploy, armadilhas |
| [decisoes-pendentes.md](decisoes-pendentes.md) | **O que depende de decisão sua**, por módulo, e riscos aceitos |

## Visão geral do sistema

- **Frontend** (`agile-space-frontend`): Next.js, é o app novo. Fala com o backend por REST e WebSocket.
- **Backend** (`agile-space-backend`): Spring Boot + Postgres (Flyway). Autenticação por JWT. Quase toda regra de permissão importante vive aqui.
- **Legado** (`agile-space-legado`): app antigo (Firestore). Só recebe portes quando a regra do produto manda; o redesign de `/squad` **não** vai para o legado.
- **Produção:** `app.espacoagil.com.br`, VM Oracle ARM, `docker compose` (db, backend, frontend, proxy Caddy).

## Conceitos que aparecem em todos os módulos

- **Squad / projeto / time:** a mesma coisa em lugares diferentes. A chave do projeto (ex.: `DDWMISSI`) é o `squadId`. `team` em alguns objetos é só o nome de exibição.
- **Facilitador:** quem criou a sessão (`creatorId`) ou quem assumiu o controle. Não é o mesmo que o papel de negócio (Agile Master).
- **Papel de negócio** (Agile Master, People Lead, PO, Dev, QA...): vem do Jira/Profields ou de convite. Ver `onboarding-e-papeis.md`.
- **Tempo real:** cada módulo tem um WebSocket por sala/quadro. O cliente aplica o que o servidor devolve e **ressincroniza ao reconectar**.
- **Otimista:** o cliente mostra a mudança antes do servidor confirmar e desfaz só aquele item se falhar.

## Como manter esta documentação

Mudou fluxo, regra de permissão, estado ou endpoint? Atualize o documento do módulo no mesmo commit. A seção **"Pontos frágeis"** de cada documento é a lista viva de erros de fluxo conhecidos: tire de lá o que foi corrigido e acrescente o que for descoberto.
