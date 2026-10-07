# Checklist de QA — validação pré-produção (Agile Space)

## Automação (o que já roda sozinho)

- Backend: `AuthServiceTest` (claim de conta), `JiraAdminServiceTest` (preview do Jira com HTTP
  mockado, sync). Rodar com `mvnw test`.
- Frontend (Cypress, `npm run cypress:run` com o stack subido em `localhost:9002`/`:8002` e o
  container `agile-space-db` do docker-compose acessível): `auth-register-login.cy.ts`,
  `onboarding-create-project.cy.ts`, `onboarding-claim-account.cy.ts`, `multi-squad-access.cy.ts`,
  `modules-smoke.cy.ts`. Os specs de claim/multi-squad rodam `docker exec` no Postgres pra semear
  estado que hoje não tem endpoint público — não têm como rodar sem o `docker` local.
- O que ainda fica só no checklist manual abaixo: import real contra Jira ao vivo, interação
  profunda dentro de cada módulo (só o smoke de carregar a página está automatizado), e o painel
  Admin (exige usuário ADMIN, promovido manualmente).

Roteiro manual para validar o fluxo completo antes de um deploy de produção, partindo de
sistema limpo (sem dados). Complementa a suite automatizada (JUnit no backend, Cypress no
frontend) — aqui ficam só os passos que dependem de infraestrutura real (Jira ao vivo, deploy
via Docker) e não entram em CI.

Rode isso pelo menos uma vez antes do primeiro deploy de produção, e de novo sempre que mexer
no conector Jira, no fluxo de auth/onboarding, ou no `docker-compose.yml`/migrations do backend.

## 0. Sistema limpo (banco vazio)

- [ ] `docker compose down -v && docker compose up -d --build` no `agile-space-backend` a partir
      de um clone limpo (ou com volume novo).
- [ ] Backend sobe sem erro (`docker compose logs backend` até `Started AgileSpaceBackendApplication`).
      Corrigido em 2026-09-11: faltava migration base (`V1_1__baseline_schema.sql`) e o
      `docker-compose.yml` não repassava `APP_ENCRYPTION_SECRET`/`SPRING_PROFILES_ACTIVE` pro
      container — ambos bloqueavam subida em banco/ambiente 100% novo.
- [ ] `GET /actuator/health` responde `{"status":"UP"}`.
- [ ] Frontend sobe e a tela de login carrega sem erro no console.

## 1. Primeiro usuário / conta

- [ ] Cadastro pela aba "Cadastrar" cria a conta e loga automaticamente.
- [ ] Login com senha errada retorna erro genérico (não revela se o e-mail existe).
- [ ] Usuário novo, sem squad vinculada, é redirecionado pro `/onboarding`.
- [ ] Promoção manual a ADMIN (tier de sistema, usado só em `/admin`):
      `UPDATE users SET role = 'ADMIN' WHERE email = '...';` — não existe fluxo de API pública
      pra isso, de propósito (ver `AuthService.java`, comentário em `User.role`). Confirmar que
      esse usuário passa a ver o módulo Admin depois de logar de novo.

## 2. Conectar Jira + importar squad (contra Jira real de sandbox/homologação)

- [ ] No onboarding, aba "Importar do Jira": preencher domínio + token de uma conta com acesso
      a um projeto de teste.
- [ ] `preview-project` retorna membros/papéis coerentes com o projeto real.
- [ ] `confirm-sync` cria a `Squad` e os `SquadMember` (roster) — conferir na aba Squad > Roster.
- [ ] Repetir o sync (idempotência): rodar `confirm-sync` de novo não duplica membros nem quebra.

## 3. Membro importado cria a própria conta e fica vinculado

- [ ] Pegar o e-mail de uma pessoa que apareceu no roster (passo 2) e cadastrar uma conta nova
      com esse e-mail exato.
- [ ] Login funciona logo em seguida (antes da correção de 2026-09-11, essa conta nascia sem
      senha ativa e o cadastro sempre batia em "e-mail já cadastrado" — ver
      `AuthService.register`).
- [ ] Após logar, a pessoa já cai vinculada à squad certa (não vai pro onboarding).
- [ ] **Observação (não bloqueia, comportamento validado)**: se a squad da pessoa foi criada só
      pelo sync de roster (`/api/admin/jira/*`, sem passar pelo sync de governança Profields em
      `/api/projects/sync/*`), o projeto não aparece em `GET /api/projects` — o redirect pós-login
      passa rapidinho pelo `/onboarding` antes de voltar pra home, porque o gate de rota real
      (`IdentityGatekeeper`, baseado em `squadId`) já libera o acesso. É um flash, não um travamento;
      só vale confirmar visualmente que não fica preso lá.
- [ ] Se o e-mail do cadastro **não** bater com o do Jira, a pessoa cai no onboarding sem vínculo
      e precisa entrar manualmente ("Entrar em Projeto Existente") ou receber um convite (ver 3b).
      Validar que a mensagem nesse card explica isso com clareza.

### 3b. Convite real por link (`Squad → Roster → "Convidar por Link"`)

> Atualizado em 2026-09-12: existe agora um convite de verdade por token/link
> (`InviteController`/`InviteService` no backend, `src/app/invite/[token]/page.tsx` +
> `invite-api.ts` no frontend), que resolve o vínculo sem depender do e-mail bater com o Jira —
> a limitação documentada anteriormente aqui não se aplica mais quando esse fluxo é usado.
> Commitado em 2026-09-12 na branch `develop` (backend `16bcea3`, frontend `2bf9c18`) — ainda
> sem PR/merge pra `main`. Confirmar que chegou em produção antes de considerar este item coberto.

- [ ] Agile Master (ou ADMIN/LEAD) abre Squad → Roster → "Convidar por Link", escolhe papel,
      opcionalmente restringe a um e-mail, gera o link. Aparece em "Convites Pendentes".
- [ ] Pessoa sem conta abre o link deslogada → vê "Você foi convidado" → "Entrar ou criar conta"
      → cadastra/loga → volta automaticamente pro convite (via `returnUrl`) → aceita → cai em
      `/squad` já vinculada, com o papel certo. Convite some da lista de pendentes.
- [ ] Convite restrito a um e-mail específico: outra conta tentando aceitar recebe erro
      "endereçado a outro e-mail" (403), não vincula.
- [ ] Convite revogado (botão de revogar antes de aceitar) ou expirado (7 dias) não pode mais ser
      aceito — mensagem de erro clara, sem vincular ninguém.
- [ ] Quem não é liderança do squad (nem ADMIN/LEAD de sistema) não vê a lista de convites nem
      consegue gerar um (403 em `POST/GET /api/squads/{id}/invites`).
- [ ] Membro removido do roster ("Remover da squad", também adicionado nessa leva) some da lista
      e — se fizer sentido pro caso de teste — confirmar que reaceitar um convite novo funciona
      pra essa mesma pessoa depois.

## 4. Multi-squad do agilista

- [ ] Usuário com papel `TRIBE_LEAD`, `AGILE_COACH` ou `PEOPLE_LEAD` em um projeto: confirmar
      que ele enxerga automaticamente todos os projetos da mesma tribo/segmento no seletor,
      mesmo sem atribuição direta neles.
- [ ] `switch-project` troca a squad ativa e os módulos (Squad, Poker, Retro, etc.) passam a
      refletir dados da squad nova.
- [ ] Usuário sem papel de liderança tentando trocar pra um projeto fora do seu acesso recebe
      `403`.

## 5. Gestão de squad/projeto

- [ ] Papéis de negócio (Agile Master, PO, Tech Lead, People Lead, Tribe Lead) veem os
      dashboards corretos em `/squad/dashboards/*`.
- [ ] Edição de configuração da squad (JQL, sprint field, capacidade) persiste e reflete no
      próximo sync.

## 6. Módulos principais (usar a squad seedada nos passos 2-3)

- [ ] **Scrum Poker**: criar sala, votar, revelar, sala expira/some depois da sessão.
- [ ] **Retrospectiva**: criar board, adicionar cards, reações, check-in de saúde, exportar.
- [ ] **Review (Sprint Review/Showcase)**: criar sessão, apresentar itens, registrar feedback.
- [ ] **Planejador**: Sprint Planner puxa itens da squad; Action Plan cria/edita tarefas 5W2H.
- [ ] **JiraDash**: dashboard reflete dados reais da squad sincronizada.
- [ ] **Base de Conhecimento**: upload de documento, busca, edição, lixeira.
- [ ] **Biblioteca de IA (Prompt Hub)**: criar prompt, coleção, autor, tutorial.
- [ ] **Admin**: com usuário ADMIN (passo 1), acessar configs globais, announcements, audit log,
      gestão de API keys.

## 7. Regressão de permissão entre módulos

- [ ] Membro comum não vê ações/painéis restritos a liderança (ex: config da squad, admin).
- [ ] Usuário sem squad vinculada é bloqueado nas rotas normais mas consegue acessar rotas
      colaborativas de convite direto (`/room/*`, `/retro/*`, `/showcase/*`, etc. — ver
      `isCollaborativeRoute` em `IdentityGatekeeper.tsx`).
