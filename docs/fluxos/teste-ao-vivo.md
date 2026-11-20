# Teste ao vivo local: roteiro para quem for validar

Este documento é para o **Claude (ou a pessoa) que vai rodar o ambiente completo numa máquina com Docker** e validar o que ainda só tem teste unitário. Foi escrito em 2026-10-14 depois de uma máquina sem memória não conseguir subir o Docker.

> **Regras desta tarefa**
> - Só ambiente **local de teste**. Nunca contra produção; não crie contas em produção.
> - **Não faça push nem deploy** sem o usuário pedir no chat. Correções que achar: commits locais pequenos, `git add` de caminhos explícitos, `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
> - Separe sempre, no relatório: **compila / teste unitário / testado ao vivo local / NÃO testado**.
> - Antes de mexer em código, leia o documento do módulo em `docs/fluxos/` (o índice é o `README.md`).

## 1. O que já foi testado e o que falta

- **Já testado ao vivo (2026-10-09/10), no HEAD de `4fa9628` do backend:** migrations V1 a V55 do zero, API e WebSocket da Retro, Biblioteca de IA, Meu Espaço, perfil, feedback, Jolt, Radar de Saúde, Brainstorming, Poker e Review por API; telas de onboarding, Retro, painel, squad; domínios de cadastro; "assumir controle". Os roteiros estão em `agile-space-backend/scripts/live-tests/` (ver o README de lá).
- **Só teste unitário, NUNCA rodou contra Postgres real (é o que você vai validar):** tudo que entrou em 2026-10-13, listado na seção 5: migrations **V56** (chaves de API) e **V61** (versões da Base de Conhecimento), chaves de API com validade, token do Jira/TDN escondido do admin, Base de Conhecimento (permissão e histórico), anonimato no servidor (Retro e Brainstorming), remoção do Jira Dash, e o tratador global de mensagens de erro (`ErrorMessageAdvice`).

## 2. Requisitos da máquina

Docker Desktop (com o daemon respondendo: `docker ps` sem erro), JDK 21, Maven 3.9+ (`mvn`), Node 20+, Python 3, Git. Memória: ~6 a 8 GB livres (Postgres ~0,5 GB, backend ~1 GB, `next dev` 1 a 2 GB, navegador).

## 3. Subir o ambiente

```bash
git clone https://github.com/wanderalvess/agile-space-backend.git
git clone https://github.com/wanderalvess/agile-space-frontend.git
# (se já clonou: git pull origin develop nos dois, branch develop)
```

**Banco** (contêiner `agile-space-db`, porta 5432 só em loopback; o usuário/senha padrão é `postgres`/`postgres`):

```bash
cd agile-space-backend
docker compose up -d db
docker exec agile-space-db psql -U postgres -c "CREATE DATABASE portal_test;"
```

Use **sempre um banco novo** (`portal_test`); não use o `espacoagil`, que é o de desenvolvimento.

**Backend** (porta 8002), de uma cópia limpa do HEAD se houver arquivos soltos no checkout:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/portal_test
export APP_ENCRYPTION_SECRET='AgileSpaceDevMasterKey2026LocalOnly#AES'
export ALLOWED_EMAIL_DOMAIN='totvs.com.br,ext.totvs.com.br'
export ALLOWED_ORIGINS='http://localhost:9002,http://127.0.0.1:9002'
mvn -o spring-boot:run -Dmaven.test.skip=true "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"
```

(sem `-o` na primeira vez, para baixar as dependências). Sinal de sucesso no log: `Successfully applied N migrations ... now at version v65` e `Started AgileSpaceBackendApplication`. **Se falhar na validação do Hibernate (`Schema-validation`) ou numa migration, isso já é o primeiro achado**: anote o erro exato e a migration (V56 ou V61 são as suspeitas).

**Frontend** (porta 9002):

```bash
cd agile-space-frontend && npm install
npm run dev            # abre em http://localhost:9002
```

Limite conhecido: o `next dev` bloqueia o hot-reload em `127.0.0.1`, então um **segundo usuário na tela** não funciona nesse modo. Para dois usuários ao mesmo tempo use `npm run build && npm start -- -p 9002` (modo produção, sem HMR) com duas origens (`localhost` e `127.0.0.1`) ou dois perfis de navegador. Alternativa: um usuário na tela e o outro por API/WebSocket (como os scripts fazem).

**Entrar na tela sem digitar senha:** guarde o JWT em `localStorage['agileSpace_auth_token']` (`localStorage.setItem(...)` no console) e abra a rota. O token vem do `tokens.json` dos scripts.

## 4. Linha de base (regressão)

Em `agile-space-backend/scripts/live-tests/` (leia o README de lá): `t_retro.py` (59/59), `t_misc.py` (57/57), `t_poker_review.py` (22/27, falhas explicadas), `t_ws.js` (9/9), `t_takeover.js`. **Rode antes das mudanças novas** e compare com os números. Se algum teste antigo piorou, é regressão das mudanças de 2026-10-13: relate com o commit suspeito.

Contas de teste (criadas pelo `t_retro.py`): `ana.master` (AM via roster), `bruno.dev`, `carla.qa`, `dani.fora` (intruso), `adm.root` (ADMIN, promovido por `update users set role='ADMIN'`). Cuidado: `register` e `login` têm limite de 10/min por IP: use os tokens guardados.

## 5. O que testar nas mudanças novas (escreva roteiros no mesmo formato PASS/FAIL)

Cada item: **o que provar** e o **resultado esperado**.

1. **Migrations V56 e V61 e Hibernate.** Subir do zero (banco novo) e também incremental: crie um banco, rode o backend de um commit anterior (`git checkout 9077a6b` no backend, que está em V65 sem V56/V61), crie dados (chaves de API, documentos), depois suba o HEAD: as migrations devem aplicar sem erro e sem perder dados. Esperado: `now at version v65` ou maior sem conflito de numeração.
2. **Chaves de API com validade** (`chaves-de-api-e-mcp.md`). Criar chave pelo admin: tem `expiresAt` ≈ agora + 90 dias. Chave com `expires_at` no passado (`update api_keys set expires_at = now() - interval '1 day'`): a chamada com ela dá **401** com mensagem clara. Renovar/rotacionar: a chave antiga deixa de valer (rotação), a nova funciona. As chaves **existentes** (criadas antes da V56) ganharam validade de 90 dias a partir da migration e continuam funcionando. API v1 e MCP com chave válida respondem 200.
3. **Token do Jira/TDN escondido.** O dono lê o próprio (a tela dele precisa para funcionar); **ADMIN lendo outra pessoa recebe só `{configured: true, domain}` sem o token**; nada de token no log do backend (`grep` o log). No navegador: depois do logout e da troca de conta, `localStorage` não tem mais token do Jira/TDN.
4. **Base de Conhecimento: permissão e versões** (`base-de-conhecimento.md`). Autor edita; **liderança da squad do documento** (linha de roster com `is_leadership`) e ADMIN editam; um dev comum recebe **403** com a mensagem em português; criar continua livre; documento sem autor registrado só o ADMIN edita. Cada gravação cria uma versão (autor, data em UTC); listar, ver e **restaurar** funcionam (restaurar cria nova versão e exige permissão de edição); limite de 50 versões descarta as mais antigas; busca semântica e Assistente de IA usam só a versão vigente; API v1 lê só a vigente; lixeira/apagar com a mesma regra.
5. **Anonimato no servidor, Retro** (`retro.md`). Com um segundo usuário (participante, não autor, não facilitador): antes de revelar, `GET /api/retros/{id}/cards` devolve os cards **sem texto, sem autor, sem votos** e com `hidden: true`; o **WebSocket** (`CARD_SAVED`, `CARDS_IMPORTED`) também; o **autor** vê os próprios completos; o **facilitador** vê o texto mas **não o autor** enquanto `isAuthorsRevealed=false`; depois de `isCardsRevealed=true` o texto aparece para todos e o autor continua oculto até `isAuthorsRevealed=true`; coluna de ação nunca é redigida; votar, fundir, mover, reagir continuam funcionando. Na tela: o card oculto vira placeholder borrado e a revelação recarrega a lista sem piscar.
6. **Anonimato no servidor, Brainstorming** (`brainstorming.md`). Mesmo critério para ideias e autores (confira os nomes reais das flags em `BrainstormingBoard`); ideia oculta não vota nem funde; REST e WebSocket.
7. **Jira Dash removido.** `/jiradash`, `/config` e `/jira/*` devem dar 404 (ou redirecionar); a home não tem o card; sem erros de console. **O que NÃO pode ter quebrado:** importação do Jira em lote no onboarding e no painel (a prévia responde com mensagem de erro clara sem token), sincronização da squad, Planejador, JiraAdmin. Procure no frontend `grep -ri jiradash src` e no backend `grep -ri JiraDash src` por sobras.
8. **Mensagens de erro em produção** (`ErrorMessageAdvice`). Suba o backend com o perfil de produção (`SPRING_PROFILES_ACTIVE=prod`; veja `ProductionSecretsValidator` para as variáveis obrigatórias: segredo JWT, chave de criptografia, `ALLOWED_EMAIL_DOMAIN`, etc.; use valores de teste): um 409 (ex.: votar com a votação fechada) deve trazer `{"error":"409 CONFLICT","message":"A votação não está aberta."}`; um 5xx provocado deve trazer mensagem **genérica** sem o motivo interno.
9. **Datas em UTC.** A data da API (`updatedAt` de um card do Kanban) deve bater com `date -u` (diferença de segundos) rodando com `-Duser.timezone=UTC`.
10. **Limite de login.** 15 chamadas seguidas a `GET /api/auth/me` (sem token ou com token): nenhuma pode dar 429.
11. **Telas (navegador).** Com um usuário na tela: login, onboarding de participante (buscar equipe, "Não estou na lista", escolher papel), Retro (revelar, votar, timer até zero com auto-revelar, exportar PDF/Markdown/CSV), Administração → Usuários & Acesso (ativar/desativar, redefinir senha, último acesso), Pessoas do time (AM adiciona/troca papel), Base de Conhecimento (editar como autor, ver Histórico, restaurar), Brainstorming. Anote erros de console (404 de `jira-config` e `rollup` em equipe sem Jira são esperados).
12. **Não testáveis aqui, só registrar:** importação real do Jira, e-mail, SSO.

## 6. Relatório final

Responda ao usuário em português, curto: o que passou, o que falhou (com o comando/resposta exata), commits de correção feitos localmente, e o que continuou sem teste ao vivo. Atualize `docs/fluxos/decisoes-pendentes.md` e o documento do módulo se algo mudar. Se achar bug grave, **pare e avise antes** de corrigir algo que mude contrato.
