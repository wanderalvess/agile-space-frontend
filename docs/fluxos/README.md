# Fluxos do Portal Tech V&D

Documentação de **como cada módulo funciona**, escrita para que um agente (ou uma pessoa) entenda o fluxo sem ler código, e para que erros de fluxo apareçam na leitura. Descreve o que o sistema faz **hoje** (estado do `develop` em 2026-10-09). Onde algo é suposição ou não foi testado ao vivo, o texto diz.

## Índice

| Documento | Assunto |
|---|---|
| [onboarding-e-papeis.md](onboarding-e-papeis.md) | Primeiro acesso, quem cadastra equipes (AM/PL), importação do Jira em lote, papéis e permissões |
| [retro.md](retro.md) | Retrospectiva: criação, fases, votação, timer, fusão, plano de ação, exportação, tempo real |
| [poker.md](poker.md) | Scrum Poker: sala, rodadas, síncrono/assíncrono, votos às cegas, Jira |
| [review.md](review.md) | Review (showcase): sessão, cards, anexos, decisão do PO, modo Teatro |
| [biblioteca-ia.md](biblioteca-ia.md) | Biblioteca de IA (`/prompt-hub`): itens, coleções, visibilidade, leitura pública |
| [ambiente-e-deploy.md](ambiente-e-deploy.md) | Repositórios, migrations, deploy em produção, armadilhas conhecidas |

> `poker.md`, `review.md` e `biblioteca-ia.md` são escritos pelas sessões que auditaram cada módulo. Se algum ainda não existir, a sessão correspondente não terminou.

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
