# Ambiente, migrations e deploy

Este documento descreve **como o sistema sobe e como uma mudança chega à produção**. Credenciais, IPs e chaves **não** ficam aqui; ver `agile-space-backend/DEPLOYMENT.md` e `GO-LIVE-CHECKLIST.md`.

## Repositórios e branches

| Repositório | Branch de trabalho | O que é |
|---|---|---|
| `agile-space-frontend` | `develop` | App novo (Next.js). Versão em `package.json`; changelog em `src/app/changelog/versions.json` |
| `agile-space-backend` | `develop` | Spring Boot + Postgres; migrations Flyway em `src/main/resources/db/migration` |
| `agile-space-legado` | `main` | App antigo (Firestore). Só recebe portes quando a regra do produto manda |

Várias sessões de agentes podem trabalhar nos mesmos checkouts ao mesmo tempo. Antes de assumir que algo não foi commitado, confira `git log` e `git status`.

## Produção

- Domínio `app.espacoagil.com.br`, VM Oracle ARM, `docker compose` com quatro serviços: banco (Postgres 17), backend, frontend e proxy (Caddy).
- O deploy é: atualizar os dois repositórios na VM (`git pull`, branch `develop`) e reconstruir os serviços com `docker compose --profile proxy up -d --build backend frontend`, em segundo plano (passa de 2 minutos).
- **Ordem:** backend primeiro, frontend depois, porque o frontend novo chama endpoints que o backend antigo não tem e o backend novo recusa o que o frontend antigo ainda faz (ex.: gravar votos pelo card inteiro).
- Depois do deploy: conferir `docker ps` (backend e frontend `healthy`), o log do backend na primeira subida (Flyway e validação do Hibernate) e a página `/changelog`.

## Armadilhas conhecidas

1. **O Caddy manda todo `/api/*` para o Spring.** Rotas do Next em `src/app/api/**` ficam inalcançáveis em produção, a não ser que estejam na lista `@nextApi` do `Caddyfile`. Chamada nova a `/api/...` precisa existir no backend.
2. **`Caddyfile` é bind mount.** O `git pull` troca o arquivo (inode novo) e `caddy reload` continua lendo o antigo; depois de mudar o Caddyfile, reiniciar o container do proxy.
3. **Migrations Flyway.** `out-of-order` está ativo. Duas migrations com o mesmo número derrubam o boot ("Found more than one migration"). Descobrir o maior número com `ls | sort -V` (nunca `ls | tail`). Sessões paralelas já disputaram números: reconferir antes de criar.
4. **`active_sprint_id = UNMAPPED`** numa squad com rollup gravado na sprint real dava 404 em `/api/squads/{id}/rollup`; corrigido com fallback. Se reaparecer, comparar `squads.active_sprint_id` com `squad_metrics_rollup.sprint_id`.
5. **Importação do Jira/Profields:** o endpoint de layout traz só definições; os valores vêm de `.../values/projects/{chave}`. As pessoas vêm da descoberta do importador (papéis do projeto, grupos, líderes, atividade).
6. **Token do WebSocket vai na query string** (`?token=`) nos três módulos com tempo real. Aparece em logs de proxy.
7. **Docker local pode não subir** (sockets antigos que o Docker não consegue apagar). Sem banco local, o backend local responde 500 e só os testes unitários rodam.

## Migrations recentes (o que fazem e o risco)

| Versão | Módulo | O que faz | Cuidado em produção |
|---|---|---|---|
| V30 | Poker | `@Version` (lock otimista) na sala | — |
| V31 | Review | Links de doc técnico/TDN no card | — |
| V32 | Review | Configurações da apresentação | — |
| V33 | Review | Checklist de prontidão | — |
| V34 | Review | Anexos de card (PNG/JPEG/PDF) | Arquivos ficam em disco local do container |
| V35 | Retro | Remove votos duplicados e com usuário nulo; unicidade `(card, usuário)`; `version` em quadro e card; índices | **Apaga linhas** de `retro_card_votes`; contagem de cards antigos pode cair. Fazer backup das tabelas `retro_*` antes |
| V36 | Biblioteca de IA | Índices de listagem | Só índices |
| V37 | Review | `cover_image` vira `text`; índice por squad | — |
| V38 | Poker | Unicidade do voto passa a `(sala, participante, tarefa)` para o modo assíncrono; índice de rodadas | Troca a restrição `poker_votes_room_id_participant_id_key` |
| V39 | Retro | Colunas `column_sorts` e `summary` em `retro_boards` | — |

## Como rodar testes localmente

- **Backend** (offline): JDK 21 e o Maven do wrapper do usuário (`mvn -o test`, ou `-Dtest=Classe`). Os testes são unitários (Mockito); nenhum sobe banco. Por isso **migrations e a validação do Hibernate só são exercitadas na primeira subida real**.
- **Frontend:** `npx tsc --noEmit -p .` e `npx vitest run`.
- **Verificação de tela:** o fluxo de salas exige login Google/Firebase, então a verificação ao vivo é manual (Chrome real). Nenhuma correção recente de fluxos foi validada assim até o momento deste documento.

## Checklist para uma mudança que mexe em contrato (frontend + backend)

1. Backend aditivo primeiro (endpoint novo convive com o antigo) quando possível.
2. Migrations novas com `IF NOT EXISTS`, idempotentes, número conferido.
3. Testes do backend e do frontend verdes; `tsc` limpo.
4. Changelog (`versions.json`) e `package.json` na mesma entrega; conferir `/changelog`.
5. Deploy: backup se a migration apaga dados, backend, depois frontend; olhar `healthy` e o log de subida.
6. Atualizar o documento do módulo em `docs/fluxos/`.
