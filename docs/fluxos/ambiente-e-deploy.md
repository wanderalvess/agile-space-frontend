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
6. **Token do WebSocket vai na query string** (`?token=`) nos cinco endpoints de WebSocket (retro, poker, review, brainstorming, health check). Aparece em logs de proxy.
7. **Mudou o `Caddyfile`? Reiniciar o proxy.** A rota `GET /api/v1/knowledge/docs/{id}/download` foi acrescentada à lista `@nextApi`; o deploy desta rodada exige reiniciar o contêiner do proxy (ver armadilha 2).
8. **Chaves de configuração novas (todas com padrão que não muda o comportamento atual):**
   - `APP_REGISTRATION_ENABLED` (padrão `true`): em `false`, fecha o cadastro de novas contas.
   - `app.jira.allow-private-hosts` (padrão `false`): o backend agora bloqueia redes privadas como destino do Jira; quem tiver Jira em rede interna precisa ligar. Para o Jira público da TOTVS nada muda. `app.jira.allowed-domains` limita os domínios aceitos.
9. **Variável de build `NEXT_PUBLIC_GEMINI_API_KEY`:** se tiver valor no `.env` da VM, a chave vai para o JavaScript público. Deve ficar vazia; `GEMINI_API_KEY` (sem `NEXT_PUBLIC_`) não expõe.
10. **O login é do próprio Portal (e-mail e senha no Spring)**, não Firebase nem Google. Mensagens antigas e a memória de sessões falavam em Firebase; o frontend não depende dele. O SSO corporativo está só planejado (`DOCUMENTACAO_SSO.md` no backend).
11. **Fuso da JVM fixo em UTC:** o `Dockerfile` do backend define `TZ=UTC` e `-Duser.timezone=UTC`. As datas do servidor (`createdAt`, `updatedAt`, `lastLoginAt`) são `LocalDateTime` gravados com `now()` e a API as envia com `Z`; a JVM precisa estar em UTC para o navegador mostrar a hora certa. Rodando o backend fora do Docker (desenvolvimento), passe `-Duser.timezone=UTC` (por exemplo `-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC`), senão as datas aparecem 3 h atrás em horário de Brasília.
12. **Docker local pode não subir** (sockets antigos que o Docker não consegue apagar). Sem banco local, o backend local responde 500 e só os testes unitários rodam.

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
| V40 | Brainstorming, Health Check, Plano de Ação | 7 índices de leitura | Só índices |
| V60 | Workspace | `icon_type` e `color` em atalhos; `url` e `origin_link` passam a 2048; 6 índices | O `ALTER TYPE` roda uma vez no boot |
| V65 | Jolt | `version` (lock otimista) e índices em `jolt_projects` e `jolt_project_versions` | O mapeamento `@Version` só é exercitado na primeira subida |

## Como rodar testes localmente

- **Backend** (offline): JDK 21 e o Maven do wrapper do usuário (`mvn -o test`, ou `-Dtest=Classe`). Os testes são unitários (Mockito); nenhum sobe banco. Por isso **migrations e a validação do Hibernate só são exercitadas na primeira subida real**.
- **Frontend:** `npx tsc --noEmit -p .` e `npx vitest run`.
- **Verificação de tela:** o login é e-mail e senha do Portal, então dá para testar ao vivo com uma conta de teste, mas hoje não há banco local (Docker fora do ar) e criar contas em produção não é permitido a agentes; a verificação ao vivo é manual (Chrome real).

## Ambiente local de teste (funciona hoje, com Docker Desktop de pé)

O contêiner `agile-space-db` (Postgres 17, porta 5432) costuma estar de pé. **Nunca teste contra o banco `espacoagil` de desenvolvimento**: crie um banco novo, o que também exercita todas as migrations do zero.

1. `docker exec agile-space-db psql -U postgres -c "CREATE DATABASE portal_test;"`
2. Backend (porta 8002), apontando para o banco de teste: variáveis `DB_URL=jdbc:postgresql://localhost:5432/portal_test` e `APP_ENCRYPTION_SECRET` (o valor de desenvolvimento está em `run-backend.cmd`), `JAVA_HOME` do JDK 21, e `mvn -o spring-boot:run`. Sobe em ~20-30 s; a primeira subida aplica V1 a V65 e a validação do Hibernate roda de verdade.
3. Frontend (porta 9002): `npm run dev` na pasta do frontend (o CORS do backend já aceita `http://localhost:9002`).
4. Contas de teste: `POST /api/auth/register` com e-mail `@totvs.com.br` e senha de teste. Para papéis: `update users set role='ADMIN'` direto no banco de teste; para AM/PL, inserir linha em `project_member_roles` com `role_key` `AGILE_MASTER` ou `PEOPLE_LEAD`.
5. Para entrar no navegador sem digitar senha: guardar o JWT em `localStorage['agileSpace_auth_token']` e abrir a rota.

Cuidados que já custaram tempo:
- `register` e `login` têm limite de 10/min por IP (faixa apertada). Em roteiros de teste, **guarde os tokens** em vez de logar de novo a cada execução.
- Reiniciar o backend zera os limitadores em memória.
- Votos concorrentes, eventos de WebSocket e conflitos de versão (409) só aparecem com chamadas reais; testes unitários não os pegam. Roteiros de API com várias contas (admin, AM, dois devs, intruso) pegaram bugs que 969 testes unitários não pegaram (ver o 429 em `/api/auth/me`).

## Checklist para uma mudança que mexe em contrato (frontend + backend)

1. Backend aditivo primeiro (endpoint novo convive com o antigo) quando possível.
2. Migrations novas com `IF NOT EXISTS`, idempotentes, número conferido.
3. Testes do backend e do frontend verdes; `tsc` limpo.
4. Changelog (`versions.json`) e `package.json` na mesma entrega; conferir `/changelog`.
5. Deploy: backup se a migration apaga dados, backend, depois frontend; olhar `healthy` e o log de subida.
6. Atualizar o documento do módulo em `docs/fluxos/`.
