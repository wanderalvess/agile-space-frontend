# 6. Onboarding, convite e reset de senha — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/`.

## Contexto global (vale para estas e as telas de apoio)

- **Providers** (`src/app/layout.tsx:97-110`): AuthProvider → AuthGuard → UserProvider → UserChannelProvider (WS) → BackendHealthGatekeeper → IdentityGatekeeper → Header global.
- **AuthGuard** (`components/auth/AuthGuard.tsx`): pública só `/login`; "abertas" (logado ou não) `/changelog` e `/reset-password`; o resto sem sessão vai para `/login?returnUrl=…`.
- **IdentityGatekeeper**: quem tem `mustOnboard` (perfil sem squadId) vai para `/onboarding`. Exceções: `/onboarding`, `/login`, `/reset-password`, `/invite/*` e as rotas colaborativas (`/room/`, `/retro/`, `/showcase/`…).
- **Header global** (`layout/Header.tsx`): oculto em `/admin`, `/manual`, `/governance`, `/changelog`, `/support`, `/reset-password` (essas usam RoomHeader). Aparece em `/onboarding` e `/invite/*` (logo, Manual, GlobalProjectSelector, NotificationBell, ThemeToggle, menu).
- **RoomHeader** (213): Home, ícone, título (editável opcional), badge; `actions`, ThemeToggle, GlobalProjectSelector (>1 projeto), feedback (md+); menu do perfil (Meu Perfil, Projetos & Governança, Meu Workspace, Manual, Administração só admin, Sair) ou "Entrar" sem perfil.
- **Footer** (99): Feedback, Versões, Manual, Governança, Suporte, espacoagil.com.br.
- **FeedbackWidget** (250): NPS 0–10 em 3 passos → `POST /feedbacks` (nota −1 se só sugestão); `feedback_sent_{toolName}`.

---

## 6.1 Onboarding — `/onboarding`

**Arquivos:** `src/app/onboarding/page.tsx` (792, com `Header` e `Fact` internos); `services/onboardingService.ts` (70); `components/jira/JiraProfieldsImport.tsx` (297) e `JiraImportPreview.tsx` (279); `hooks/useJiraSettings.ts`; `AuthContext` (`createProject`, `joinProject`, `claimRosterMember`, `switchProject`); `UserContext` (`updateProfile`, `setIsPublicExploration`).

**Etapas** (`type Step`; começa em `suggestion`, cai para `intent` sem sugestão ou em erro):
- **Carregando:** "Procurando você nos times…".
- **`suggestion` — "É você?":** 1º candidato (iniciais, nome, `emailHint` mascarado, papel, Projeto / Tribo / Pessoas) + "Também achamos você em".
- **`intent`:** "Sou Agile Master ou People Lead" (→ `jira`) / "Participo de uma equipe" (→ `search`); Voltar só com sugestões.
- **`search`:** debounce 350ms, mínimo 2 caracteres; resultados (iniciais, chave · nome, tribo, nº de pessoas, 3 nomes); vazio "Nenhum time encontrado com…"; card "Seu time não aparece?" → "Eu sou Agile Master ou People Lead".
- **`roster`:** membros com status ("já é você", "já está no Portal", emailHint, "ainda não entrou"); badge de papel com coroa para liderança (oculto no mobile); "Sou eu" só para `claimable`; senão "entra por convite" ou "vinculada".
- **`role`:** "Eu construo" (Developer), "Eu desenho" (Designer), "Eu acompanho" (Stakeholder/Observador); aviso de que liderança só vem por Jira ou convite.
- **`create`:** nome do time; chave gerada por `slugify` (A-Z0-9, máx. 12) editável; card "Importar do Jira".
- **`jira`:** `JiraProfieldsImport` embutido; com prévia aberta o container alarga para 1400px.
- **Trilha lateral** de 3 passos (lg+), estática — não marca o passo atual.
- **Rodapé sempre visível:** "Tenho um link de convite" (input + Abrir + Cancelar), "Só quero dar uma olhada", "Dá pra trocar de time depois".

**Ações**
- "Sou eu" → `POST /onboarding/claim/{memberId}` → `/painel`.
- Escolher papel → `POST /projects/{key}/join?roleName=` → `updateProfile({squadId})` → `/painel`.
- Criar time → `POST /projects` → `updateProfile` → `localStorage agileSpace_newSquad_{key}=1` (lido por `home/NewSquadWelcome`) → `/`.
- Convite colado (link ou token, Enter) → `/invite/{token}`.
- Explorar → `setIsPublicExploration(true)` → `/`.
- **JiraProfieldsImport:** domínio, chaves (várias, por vírgula/espaço/;), token; "Começar com N equipes"; link Atlassian; "Criar uma equipe sem o Jira" (→ `create`); fila com "Pular esta equipe", "Voltar à lista / Trocar projeto".
- **JiraImportPreview:** 7 campos do projeto (nome, segmento, tribo, localidade, VP, área VP, status; vazios destacados "preencha"); pessoas com Todos / Nenhum / Liderança, busca, checkbox, cargo (`ASSIGNABLE_ROLES`), liderança travada com cadeado; "Sou eu" só se o próprio e-mail não foi achado; barra fixa "Importar N pessoas" (bloqueada se `canImport===false`).

**Toasts (sem modais):** sucesso de claim/entrada/criação; erros de claim, roster, join, create; Jira: "Dados encontrados", "Falha na sincronização", "Não consegui ler X", "importada mas não ativada", "token não ficou guardado", "Nenhuma equipe foi importada", "N importadas / Sem importar: …".

**Dados:** `GET /onboarding/suggestions`, `GET /onboarding/search?q=`, `GET /onboarding/roster/{key}`, `POST /onboarding/claim/{memberId}`, `POST /projects/{key}/join?roleName=`, `POST /projects`, `POST /projects/sync/{key}/preview` (`X-Jira-Token`, `?domain=`), `POST /projects/sync/{key}/confirm`, `POST /auth/switch-project?projectId=` (só 1ª equipe), `GET/POST/DELETE /users/{id}/jira-config` + `localStorage agile_jira_config_{userId}`.

**Papéis:** precisa estar logado e com `mustOnboard` (senão `router.replace('/')`; `doneRef` evita corrida). Criar/importar só AM/PL (backend impõe). Liderança não é autodeclarável.

**Detalhes:** claim e join vão para `/painel`, criar vai para `/` (painel ficaria vazio); importar várias equipes ativa só a 1ª; `updateProfile` liga `isPublicExploration=true` de efeito colateral; token Jira pré-preenchido; mobile sem trilha e sem coluna de papel.

**Morto/quebrado:**
- **Provável laço:** "Só quero dar uma olhada" vai para `/`, mas o IdentityGatekeeper devolve quem tem `mustOnboard` para `/onboarding` sem olhar `isPublicExploration` (não testado no navegador).
- `create` só é alcançável pelo atalho do Jira.
- Comentários de numeração e cabeçalho do arquivo desatualizados.

---

## 6.2 Convite — `/invite/[token]`

**Arquivos:** `src/app/invite/[token]/page.tsx` (136); `lib/invite-api.ts` (71); `AuthContext.acceptInvite`.

**Estados:** "Carregando…"; sem sessão: "Você foi convidado" + "Entrar ou criar conta" (`/login?returnUrl=…`); "Convite aceito! Redirecionando…"; "Convite inválido" + mensagem; indisponível: ACCEPTED "já foi usado", REVOKED "cancelado", EXPIRED (ou `expiresAt` passado pelo relógio local) "expirou"; "Verificando convite…"; válido: "Convite pro squad", papel, badges Squad e Papel, "Aceitar Convite".

**Ações/dados:** `GET /invites/{token}` (erros traduzidos 404/403/401/genérico); `POST /invites/{token}/accept` adota o token novo e, após 1,5s, vai para `/squad`. Mesmo client tem `createInvite`, `listInvites`, `revokeInvite`, `buildInviteLink` (usados em outras telas).

**Papéis:** qualquer logado; isento do onboarding forçado.

**Quebrado:**
- Erro e indisponível **sem botão de saída** (beco sem saída; só o Header global).
- Erro no aceite aparece como "Convite inválido".
- **Ramo "sem sessão" praticamente inalcançável:** `/invite` não está nas rotas abertas, o AuthGuard redireciona antes.
- Destino `/squad` — vale rever, dado que `/squad` é a tela que o usuário acha confusa.

---

## 6.3 Reset de senha — `/reset-password?token=`

**Arquivos:** `src/app/reset-password/page.tsx` (127); `lib/password-api.ts` (52).

**Estados:** fallback de Suspense; sem token: "Link incompleto. Peça um novo link…" + "Voltar ao login"; formulário; "Senha redefinida" + "Ir para o login"; erro inline `role=alert`.

**Ações:** nova senha + confirmação (`new-password`); `validateNewPassword` (8–128, iguais); submit; "Voltar ao login".

**Dados:** `POST /auth/reset-password` `{token,newPassword}` com `fetch` puro, sem JWT.

**Papéis:** rota aberta, isenta do onboarding.

**Detalhes:**
- Visual escuro fixo (`bg-slate-950`), sem tema claro.
- **Fluxo completo:** `/login` aba "forgot" → `POST /auth/forgot-password` → admin aprova/gera o link em Admin → Usuários → pessoa recebe o link → esta tela.
- Não há como pedir novo link daqui.

Nada quebrado encontrado.
