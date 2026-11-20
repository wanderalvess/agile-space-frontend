# 7a. Admin, Suporte, Changelog, Governança e Manual — inventário funcional

> Levantado do código em 2026-10-15, branch `feat/home-frontend`. Somente leitura.
> Caminhos relativos a `agile-space-frontend/`. Contexto global de providers, RoomHeader, Footer e FeedbackWidget em `06-onboarding-convite-reset.md`.

---

## 7.1 Admin — `/admin`

**Arquivos:** `src/app/admin/page.tsx` (259), `admin/api.ts` (185), `components/admin/*` (GovernanceHub 31, JiraSyncPanel 536, UserExplorer 457, PasswordResetManager 229, user-admin.ts 65, CeremoniesDashboard 194, SessionMonitor 424, GrowthDashboard 434, FeedbackManager 346, CommunicationsManager 374, SystemConfigManager 239, ChangelogManager 824, IntelligenceHubMonitor 199, ApiKeysManager 246, AuditLogExplorer 169), `lib/announcement-form.ts`, `lib/home-api.ts` (`adminAnnouncementsApi`), `lib/audit.ts`, `lib/api-key-expiry.ts`, `services/changelogApi.ts`.

**Shell:** `LoadingScreen`; não admin → "Acesso Restrito" + "Voltar ao Início", mas há redirect para `/` em 100ms (a tela só pisca). RoomHeader com badge "POSTGRES CORE" e e-mail (md+); Footer + FeedbackWidget ("Portal Tech V&D - Admin").

**12 abas em 6 dropdowns** (estado local, padrão `governance`, **sem deep-link por URL**):

| Grupo | Aba | Componente |
|---|---|---|
| Governança | Sincronização Jira | GovernanceHub → JiraSyncPanel |
| Governança | Usuários & Acesso | PasswordResetManager + UserExplorer |
| Cerimônias | Analytics de Cerimônias | CeremoniesDashboard |
| Cerimônias | Histórico de Sessões | SessionMonitor |
| Métricas | Crescimento & Métricas | GrowthDashboard |
| Métricas | Feedbacks & NPS | FeedbackManager |
| Sistema | Anúncios & Avisos | CommunicationsManager (avisos v2) |
| Sistema | Configurações | SystemConfigManager |
| Plataforma | Versões & Releases | ChangelogManager |
| Plataforma | Motor AI & Conhecimento | IntelligenceHubMonitor |
| Segurança | API Keys | ApiKeysManager |
| Segurança | Auditoria & Logs | AuditLogExplorer |

### Por aba

- **Sincronização Jira:** Project Key (maiúscula, salva no localStorage), Domínio, Unidade (HOURS/SP/TSHIRT/COUNT), PAT — todos obrigatórios. "Consultar e Pré-visualizar" → `POST /admin/jira/preview-project` → **Dialog de validação** (selecionar todos, checkbox por pessoa, avatar, badge "Liderança" se score ≥90, cargo entre 11 `SQUAD_ROLES`, lixeira, "Limpar membros anteriores", "Atualizar cargos na base global", Cancelar / "Confirmar e Salvar no Banco" → `POST /admin/jira/confirm-sync`). Banner verde ou erro + toast. localStorage `agileSpace_jiraSync_projectKey`, `agileSpace_projectEstimationUnit`, `agileSpace_estimationUnit_{key}`; PAT salvo no servidor **antes** da prévia dar certo.
- **Usuários & Acesso:**
  - *PasswordResetManager:* `GET /admin/password-resets`, badge "N PENDENTES", Atualizar; "Aprovar & Gerar Link" → `POST .../{id}/approve` → banner com link, copiar, validade; histórico (5); vazio.
  - *UserExplorer:* `GET /users`; busca sem acento (nome, e-mail, id Jira); chips de cargo (Todos, Admins, Gestão, PO/PM, Agile, Tech Leads, Devs) e status (Todos/Ativos/Inativos); recarregar; "Exibindo X de Y"; "Carregar mais" (30). Tabela: avatar (raio = admin), Switch ativo, último acesso (Hoje/Ontem/Há N dias/data), cargo (`ROLES`), nível de acesso (`AUTH_ROLES`), squad, Detalhes, Redefinir senha. Mudanças via `POST /users`. Não desativa/rebaixa a si mesmo nem o último admin (409 traduzido). AlertDialog "Desativar…?" (perde sessão em 30s, API keys param); AlertDialog "Redefinir a senha…?" (link 2h, `POST /admin/users/{id}/reset-password`); Dialog do link; Dialog de detalhes (`GET /users/{id}/squads`).
- **Analytics de Cerimônias:** `GET /squads` (ativa pré-selecionada); Select de squad, Sprint ID (`active`), Atualizar → `GET /work-items/{squad}/sprint/{sprint}/stats`; KPIs velocity real, comprometido, carry-over; "Abrir Retro desta Sprint" e "Abrir Plano de Ação" (desabilitados com `active`); vazio.
- **Histórico de Sessões:** `GET /admin/sessions`; busca; chips de tipo (poker/retro/health/brainstorm/sprint_planning); período (todo/7d/30d); ordenação clicável (padrão participantes desc); seleção múltipla; "Exibir mais" (20); barra "Excluir Tudo" (sequencial); por linha abrir em nova aba e excluir (`confirm()` → `DELETE /admin/sessions/{id}?type=`).
- **Crescimento & Métricas:** `GET /admin/stats`; 3 destaques (interações, taxa de feedback, média por usuário); "Uso do Sistema" (ou "Em breve"); ranking por módulo; "Densidade de Dados"; **Exportar PDF** (`relatorio-uso-espaco-agil-AAAA-MM-DD.pdf`); erro.
- **Feedbacks & NPS:** `GET /feedbacks`; busca; Select de ferramenta e status (Novo/Em Análise/Resolvido/Arquivado); chips NPS (Promotores, Neutros, Detratores, Sugestões); Exportar CSV; status por linha (`PATCH/POST /feedbacks/{id}/status`); excluir (`confirm()`).
- **Anúncios & Avisos (v2):** tipo Aviso/Importante/Manutenção; Título (120); Texto (2000); Público Todos / Squads (busca + checkboxes, `GET /projects` com fallback) / Papéis (ADMIN, LEAD, MEMBER, AGILE_MASTER, TRIBE_LEAD); Início/Fim; Link (http(s) ou /rota); Publicar/Salvar/Cancelar. Validação em `validateAnnouncementForm`. Lista com ícone, "Expirado"/"Agendado", autor · data · público · "até …"; Editar; Remover com 2 cliques inline. `GET/POST/PUT/DELETE /admin/announcements`. Lado usuário: `GET /announcements/active|history`, `POST /announcements/{id}/dismiss`.
- **Configurações:** nome da empresa, cor primária HSL com preview, URL do logo, "Acesso Anônimo", "Modo Manutenção"; "ATUALIZAR SISTEMA" (5 `POST /admin/configs/{key}` + auditoria); Reset (`confirm()`, só formulário). Leitura pública `GET /public/system-config`.
- **Versões & Releases:** "Importar Histórico" (210 itens de `versions.json` → `POST /admin/changelog/import-legacy`, `confirm()`); "Nova Versão"; 4 stats; busca; chips Todas/Patches/Minors/Majors/Rascunhos; cards com 3 alterações + "+N", Editar, Excluir (`confirm()`). Dialog: tipo SemVer calcula a próxima tag e troca ícone; tag, data (texto), título, descrição, 10 ícones; alterações (Enter, remover, "Inserir em lote" por linha ou `;`); "Publicar Imediatamente". `GET/POST/PUT/DELETE /admin/changelog`.
- **Motor AI & Conhecimento:** `GET /knowledge/token-usage/top`, `GET /knowledge?…`; 3 métricas, ranking, "Status do Motor".
- **API Keys:** `GET /admin/api-keys`; nome + validade (90/30/180/"Sem expiração" com aviso); "Gerar" → chave exibida uma vez; Renovar (+90d), Revogar (`confirm()`); alerta <14 dias; badges; auditoria.
- **Auditoria & Logs:** `GET /admin/audit-logs`; busca; recarregar; Exportar CSV; tabela Data/Ação/Operador/Detalhes (expande no hover). Escrita `POST /admin/audit-logs?action=&performedBy=`.

**Papéis:** só admin (`userProfile.role === 'admin'`; backend exige ADMIN em `/admin/*`).

**Detalhes:**
- Sem deep-link: "Admin → API Keys" do manual cai em Sincronização Jira.
- `confirm()` nativo em 6 lugares + AlertDialog em usuários.
- **Sem modo escuro** (`bg-white`) em SessionMonitor, GrowthDashboard, FeedbackManager, SystemConfigManager, IntelligenceHubMonitor, ApiKeysManager.
- AuditLog troca a tabela pelo spinner no refresh.
- ChangelogManager só vê o que está no banco.

**Morto, fake ou quebrado**
- **`components/admin/AdminComponents.tsx` (532) não é importado** — tem `TicketDetailDialog` (responder tickets), `GovernanceConsoleCard` (purge fake), `RecentActivityFeed`, `KpiCard`. **Resultado: o admin não tem tela de tickets de suporte**; `supportApi.listAll/updateStatus/addReply/deleteTicket` só são usados por esse arquivo morto.
- **SystemConfig:** `logoUrl`, `allowAnonymous` e `maintenanceMode` são gravados e **nada os consome** (só `primaryColor` e `companyName`); `setConfig` não checa `res.ok`.
- **IntelligenceHubMonitor:** "Latência ~1.2s", "Assertividade > 98%", "Precisão 98.4%", "Motor Ativo - Online", "últimos 50 documentos" fixos; "Usuários Ativos (Motor)" é o tamanho do top 10.
- GrowthDashboard: "Próximo Marco: Escalabilidade" fixo.
- FeedbackManager: "Anterior"/"Próximo" sempre desabilitados; ícone de "Arquivado" é a lixeira.
- ChangelogManager: fallback `v3.117.1` fixo; ids `legacy-` residuais.
- SessionMonitor: `creatorId.slice` quebra com nulo; `sprint_planning` aponta para `/sprint-planning/{id}` (rota inexistente; o app tem `/sprint-planner`).
- ApiKeysManager: Renovar ignora a validade escolhida; `adminOnly` não aplicado.
- JiraSyncPanel: imports sem uso; `onSyncSuccess` vazio; lista de cargos diverge do onboarding (`UX/Designer` vs `Designer`, `UX`).
- PasswordResetManager diz "Admin, Agile Master ou Tribe Lead", mas é só admin.

---

## 7.2 Suporte — `/support`

**Arquivos:** `src/app/support/page.tsx` (476, com `UserTicketItem` e SVG `History` local); `support/api.ts` (96).

**Estados:** aba "Nova Solicitação" (formulário ou "Ticket Enviado!" + "Enviar Outra Solicitação"); aba "Meus Tickets" (erro "Erro de Acesso" + "Tentar Novamente" que recarrega a página; 2 skeletons; vazio "Histórico Vazio" + "Abrir Primeiro Ticket"; lista com badge OPEN "Em Análise" / IN_PROGRESS "Processando" / CLOSED "Resolvido").

**Ações:** tipo Suporte/Bug/Sugestão/Elogio (vira prefixo `[Tipo]` no assunto); Assunto, Descrição; expandir ticket (carrega respostas sob demanda: "Respostas da Governança", atendente, data); "Acessar Manual", "Explorar Changelog".

**Painéis:** Tabs (Nova / Meus Tickets com contador) + aside com 3 cards (Autoatendimento, Evolução Contínua, "Foco no seu fluxo" decorativo).

**Dados:** `POST /support/tickets` `{subject,message,requesterName}`, `GET /support/tickets/mine`, `GET /support/tickets/{id}/replies`. Sem realtime.

**Quebrado/fake:**
- **"Abrir Primeiro Ticket" não faz nada** (Tabs não controlado).
- Usuário não responde ao próprio ticket e **o admin não tem tela para responder**, mas a página promete "Análise em até 24h úteis" e "ID de rastreio gerado no painel administrativo".
- Imports sem uso.

---

## 7.3 Changelog — `/changelog`

**Arquivos:** `src/app/changelog/page.tsx` (291); `merge.ts` (30); `versions.json` (210 versões, v4.24.0 → v3.28.82); `services/changelogApi.ts` (144); teste `merge.test.ts`.

**Estados:** carregando; "Nenhuma versão encontrada…"; timeline.

**Ações:** busca (tag, título, descrição, alterações); filtros Todas / Grandes / Novos Recursos / Correções; "Voltar para a Central".

**Painéis:** RoomHeader com badge da última tag; busca e filtros; timeline vertical (ícone, data, card com título, tag, descrição, grade de alterações); CTA final; Footer; FeedbackWidget.

**Dados:** `GET /changelog` mesclado com `versions.json` (na mesma tag vale o backend); falha ou vazio → só o arquivo. `document.title` na montagem.

**Papéis:** rota aberta; sem login o RoomHeader mostra "Entrar".

**Detalhes:** feedback anônimo manda `userId:'anonymous'` via `authFetch` (pode dar 401); fallback `v3.117.1` fixo; `GET /changelog/latest` existe e não é usado.

---

## 7.4 Governança — `/governance` e `/governance/product-owner`

**Arquivos:** `src/app/governance/page.tsx` (434, só texto); `governance/product-owner/page.tsx` (5, `redirect('/squad/dashboards/product-owner')`); `components/knowledge/GovernanceGuide.tsx` (137, Sheet); teste `page-claims.test.ts` (impede frases desmentidas: Flyway, token só do dono, Google Workspace, "Política v3.0").

**Seções (constantes fixas):** Hero; Infraestrutura (4 cards); Pilares de Segurança (6, `SECURITY_PILLARS`); Limitações Conhecidas (4, `KNOWN_LIMITATIONS`); Inventário de Dados (tabela 8 linhas); Conformidade & Avisos Legais (4); CTA "Abrir Suporte" e "Manual do Usuário".

**Ações:** "Guia" no RoomHeader abre o Sheet (link `/manual/governance`); badge fixo "Revisada em 09/10/2026"; feedback; Footer.

**Dados:** nenhum remoto. **Papéis:** qualquer logado.

**Fake/inconsistente:** `GovernanceGuide` afirma "TLS 1.3", "Disponibilidade 99.99%", "AES-256", "Cloud Brasil / US" — contradiz a página (AES-GCM, "não possui SLA garantido"). O teste de frases não cobre o Guia.

---

## 7.5 Manual — `/manual` e `/manual/[topic]`

**Arquivos:** `manual/layout.tsx` (66: RoomHeader, sidebar, Footer, FeedbackWidget); `page.tsx` (161, índice); `[topic]/page.tsx` (47, Server Component com `generateMetadata`, `generateStaticParams`, `notFound()`); `data/topics.ts` (282: 4 categorias, 14 tópicos com `actionUrl`/`actionLabel`); `content/index.ts` (`TOPIC_COMPONENTS`; 14 tópicos estáticos de 27–128 linhas — Poker, Retro, Knowledge, PromptHub, Showcase, Workspace, PrimeirosPassos usam `ManualGuide`; Brainstorming, Planner, Health, Jolt, Manifesto, Governance, Integrações têm layout próprio); `components/ManualSidebar.tsx` (215), `ManualHero.tsx` (95), `ManualGuide.tsx` (101), `ModuleApiToolSection.tsx` (180); `components/manual/IntegrationsSection.tsx` (554) + `lib/integration-catalog.ts`; `shared/CodeBlock.tsx` (57); teste `topics.test.ts` (ids, rotas de `actionUrl`, frases proibidas).

**Estados:** índice filtrado (categoria some se vazia; sem mensagem de vazio); sidebar com "Resultados (N)" ou "Nenhum tópico encontrado"; tópico inexistente → 404.

**Ações:** busca no índice e na sidebar (com limpar); cards/itens → `/manual/{id}` (ativo destacado); "Visão Geral & Índice"; "Voltar à Plataforma"; breadcrumb "← Manual"; CTA do Hero para `actionUrl` (`/room`, `/brainstorming`, `/retro`, `/sprint-planner` "Ver status (em breve)", `/health-check`, `/workspace`, `/jolt`, `/knowledge/kb`, `/prompt-hub`, `/showcase`, `/onboarding`, `/governance`); `/manual#poker` → `/manual/poker` (inclusive `hashchange`); copiar código; links "Meu Espaço → Conectividade" e "Admin → API Keys".

**Painéis:** sidebar fixa lg+ (w-72); mobile: Sheet à esquerda pelo botão "Tópicos" (fecha ao navegar); uma área de rolagem; Footer no `main`.

**Dados:** nenhum remoto (inclusive o catálogo REST/MCP). **Papéis:** qualquer logado (`/manual` não é aberta).

**Morto/fake:** muitos imports sem uso (`page.tsx`, `ModuleApiToolSection`); `IntegrationsSection` com "Só 4 módulos" fixo e hosts fixos (`espacoagil.app`, `espacoagil.com.br`, `localhost:8002/mcp/sse`); Planner "Ver status (em breve)"; links "Admin → API Keys" caem na aba errada.

---

## Riscos para o redesenho (resumo deste grupo)

1. Admin sem UI de tickets (dialog pronto em `AdminComponents.tsx`, morto).
2. "Modo Manutenção", "Acesso Anônimo" e "Logo" salvos sem efeito.
3. "Abrir Primeiro Ticket" não funciona.
4. Números fixos no Motor AI e no Guia de Governança.
5. Abas do admin sem URL, e o manual aponta para elas.
6. Admin com `confirm()` nativo em 6 lugares e sem modo escuro.
7. Sessões `sprint_planning` apontam para rota inexistente.
