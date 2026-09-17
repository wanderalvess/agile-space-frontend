# Espaço Ágil - Architecture & Context Map (Repomap)

Este documento fornece um mapeamento técnico completo do ecossistema **Espaço Ágil**, servindo como fonte da verdade para a estrutura do projeto, domínios de negócio e fluxos de dados.

---

## 1. Visão Geral da Arquitetura
O **Espaço Ágil** é uma aplicação **Next.js 16 (App Router, Turbopack)** de alta performance, projetada para ser síncrona e colaborativa em tempo real.

- **Frontend**: React 19 com renderização híbrida. Interfaces baseadas em Glassmorphism, Tailwind CSS, Shadcn/UI e animações fluidas com Framer Motion. Executa por padrão na porta `9002`.
- **Backend (API & Persistência)**: Spring Boot 3.x (Java 17+) executando na porta `8002` (`http://localhost:8002/api`), com banco PostgreSQL gerenciado por migrações versionadas do **Flyway** e integridade validada pelo Hibernate (`ddl-auto: validate`).
- **Segurança & Autenticação**: Autenticação corporativa nativa JWT (HS256) com senhas criptografadas em BCrypt. O cliente HTTP centralizado `authFetch` (`src/lib/auth-client.ts`) anexa automaticamente o cabeçalho `Authorization: Bearer <token>` a partir do `localStorage['agileSpace_auth_token']` e intercepta respostas 401 via `UNAUTHORIZED_EVENT` para redirecionamento automático ao login.
- **Sincronização em Tempo Real**: Spring WebSockets (Stomp/SockJS) operando como barramento Pub/Sub para propagação instantânea de eventos das cerimônias (virada de cartas, movimentação de notas na Retro, votações, anúncios globais), combinado com chamadas REST para persistência e recuperação eficiente de estado.

---

## 2. Mapa de Domínios (Business Domains)

### 🃏 Scrum Poker (Elite Style)
- **Rota Principal**: `src/app/room/[id]/page.tsx`
- **Componentes Chave**: `src/components/poker/PokerRoom.tsx`, `src/components/poker/AsyncPokerRoom.tsx`, `src/components/poker/VotingArea.tsx`, `src/components/poker/Results.tsx`.
- **Responsabilidade**: Facilita estimativas técnicas (Fibonacci/T-Shirt/Horas) em modos síncrono e assíncrono.

### 🔄 Retrospectiva Inteligente (Retro Boards)
- **Rota Principal**: `src/app/retro/page.tsx` e `src/app/retro/[id]/page.tsx`
- **Componentes Chave**: `src/components/retro/RetroBoard.tsx`, `src/components/retro/RetroCard.tsx`, `src/components/retro/RetroColumn.tsx`, `src/components/retro/RetroHeader.tsx`, `src/components/retro/RetroMergeModal.tsx`.
- **Responsabilidade**: Cerimônia síncrona de retrospectiva com colunas configuráveis (Start/Stop/Continue, Mad/Sad/Glad, 4Ls), controle de limite de votos por participante, fusão inteligente de tópicos similares preservando o histórico integral dos textos originais (`originalTexts`), reações emoji e geração direta de itens para o Plano de Ação.

### 🎭 Sprint Showcase (Apresentação Executiva & Modo Teatro)
- **Rota Principal**: `src/app/showcase/page.tsx`
- **Componentes Chave**: `src/components/showcase/TeatroMode.tsx`, `src/components/showcase/TaskCard.tsx`, `src/components/showcase/ShowcaseCover.tsx`, `src/components/showcase/SessionSettingsDialog.tsx`, `src/components/showcase/JiraAttachmentModal.tsx`, `src/components/showcase/utils.ts` (`exportToPdf`).
- **Responsabilidade**: Apresentação cinematográfica e interativa dos resultados da sprint. Conta com Modo Teatro imersivo, cards de histórias e métricas com visualização customizável (destaque x compacto), ordenação por versão (Suporte, Master, Release, Develop), proxy autenticado para exibição de evidências e mídias do Jira corporativo (fotos e vídeos), controle de prontidão da sessão e exportação em PDF executiva de alta fidelidade.

### 📅 Sprint Planner (Engenharia de Capacidade)
- **Rota Principal**: `src/app/sprint-planner/page.tsx`
- **Componentes Chave**: `src/components/planner/SprintPlannerContent.tsx`, `src/components/planner/PlannerGuide.tsx`.
- **Responsabilidade**: Planejamento de capacidade da squad com suporte a modo simples (em massa) e detalhado (foco individual, férias e ausências), importação em lote inteligente de cards e tracking de sobrecarga em tempo real.

### 📈 Squad Pulse & Jira Dashboards (Jiradash)
- **Rotas Principais**: `src/app/jiradash/page.tsx` e `src/app/squad/page.tsx`
- **Componentes Chave**: `src/components/jiradash/*`, radar da sprint integrado à Daily.
- **Responsabilidade**: Monitoramento contínuo da saúde e entregas da squad. Inclui radar automático de progresso da sprint, capacidade planejada x realizada, burnup/burndown, worklogs, rollups consolidados e cache compartilhado no backend de consultas JQL para alta performance.

### ⚡ Daily Flow & Helper
- **Rota Principal**: `src/app/daily-flow/page.tsx`
- **Componentes Chave**: `src/components/daily-flow/DailyFlowGuide.tsx`, `src/app/daily-flow/SquadManagementSheet.tsx`.
- **Responsabilidade**: Mural de sincronização diária assíncrona com registro de humor, acompanhamento de impedimentos e radar da sprint automático.

### 🧠 Knowledge Base & Chat de Documentação (Base de Conhecimento)
- **Rotas Principais**:
  - `src/app/knowledge/page.tsx`: Landing page e busca global.
  - `src/app/knowledge/kb/page.tsx`: Visualização de documentos organizados em cartões Bento Grid (Bento Grid Cards) responsivos de alta densidade.
  - `src/app/knowledge/chat/page.tsx`: Chat de consulta inteligente sobre documentação interna e manuais do TDN.
  - `src/app/knowledge/admin/page.tsx`: Painel administrativo com suporte para:
    - Download em massa (múltiplos arquivos simultaneamente).
    - Sincronização e busca de manuais no TDN via modal padronizado de importação (recebe URL, chave e query).
- **Componentes Chave**: `src/components/knowledge/GlobalSearch.tsx`, `src/components/knowledge/KnowledgeSidebar.tsx`, `src/components/knowledge/TdnImportDialog.tsx`.
- **Responsabilidade**: Repositório estruturado de ativos técnicos com busca semântica e integração com sistemas externos.
- **RAG Vetorial (Backlog Próxima Versão - VM Única)**: Ingestão de documentações vetorizadas diretamente do **WinThor Dev Manager** e consulta em banco PostgreSQL com `pgvector`. O Chat atua via similaridade vetorial (`cosine distance`) de forma autônoma, sem necessidade de chaves nem custos de APIs externas de IA.

### 🛡️ Secret Vault (Cofre de Segredos)
- **Rota Principal**: `src/app/vault/[id]/page.tsx`
- **Componentes Chave**: Lógica de criptografia em `src/lib/vault-crypto.ts`.
- **Responsabilidade**: Compartilhamento seguro de segredos com criptografia zero-knowledge (AES-GCM).

### 🛠️ DevTools Hub & Jolt Engine
- **Rota Principal**: `src/app/devtools/page.tsx` e `src/app/jolt/page.tsx`
- **Componentes Chave**: `src/lib/jolt-lite.ts` (Motor de transformação), `src/components/devtools/*`.
- **Ferramentas Disponíveis**:
  - **Dados**: Utilidades JSON, XML, Validador Schema, Formatador SQL, Fábrica de Mocks, Gerador de Documentos.
  - **Transformação**: Sandbox Jolt, Mapeador Visual Jolt, Conversor YAML/JSON.
  - **Segurança**: Decodificador Universal, Inspetor JWT, Certificados, Rede & IP Analyzer.
  - **Geradores**: Tipagens (TypeScript), Snippets de API, UUIDs, JUnit Tests.
  - **Utilidades**: Base64, Regex Lab, Consulta CEP, Data & Hora, Diff Viewer, Cron Decoder, URL Encoder.
- **Responsabilidade**: Suíte de utilitários técnicos para desenvolvedores e engine de transformação de dados.

### 📊 Radar de Saúde (Health Check)
- **Rota Principal**: `src/app/health-check/page.tsx`
- **Componentes Chave**: `src/components/health-check/*`.
- **Responsabilidade**: Diagnóstico anônimo do clima e cultura da squad.

### 📚 Biblioteca de IA (Prompt Hub & Skills)
- **Rota Principal**: `src/app/prompt-hub/page.tsx`
- **Rotas Auxiliares**: `src/app/prompt-hub/[id]/page.tsx` (link compartilhável), `autor/[authorId]/page.tsx` (perfil), `colecoes/page.tsx` e `colecoes/[id]/page.tsx` (trilhas), `tutorial/page.tsx` (guia de skills).
- **Componentes Chave**: `src/app/prompt-hub/components/*` (catálogo, card, editor, detalhe, coleções) e `src/components/prompt-hub/PromptGuide.tsx` (painel de ajuda).
- **Persistência**: Integrado via API REST do Spring Boot (`/api/prompt-hub/**` e `/api/v1/prompt-hub/**`).
- **Responsabilidade**: Acervo colaborativo de prompts, skills, agentes, instruções e workflows da organização categorizados por papéis ágeis (Scrum Master, Product Owner, Dev, QA), com suporte a importação/exportação em lote (JSON/Markdown), tags e versionamento.

### 📋 Plano de Ação (Action Plan)
- **Rota Principal**: `src/app/action-plan/page.tsx` e `src/app/action-plan/[id]/page.tsx`
- **Componentes Chave**: `src/components/action-plan/*`.
- **Responsabilidade**: Gestão e acompanhamento visual de planos de ação táticos da squad.

### 💡 Ideação & Brainstorming
- **Rota Principal**: `src/app/brainstorming/page.tsx` e `src/app/brainstorming/[id]/page.tsx`
- **Componentes Chave**: `src/components/brainstorming/*`.
- **Responsabilidade**: Facilitação de dinâmicas síncronas de ideação do time.

### ⏱️ Modo Foco (Focus Area)
- **Rota Principal**: `src/app/focus/page.tsx`
- **Componentes Chave**: `src/app/focus/*` e helpers de som ambiente.
- **Responsabilidade**: Ambiente de trabalho pomodoro individual focado.

### 🏢 Workspace Dashboard
- **Rota Principal**: `src/app/workspace/page.tsx`
- **Componentes Chave**: `src/components/workspace/*` (BentoDashboard, KanbanBoard, StickyNotes, QuickLinks, ProfileSettings).
- **Responsabilidade**: Painel de produtividade pessoal do usuário integrado à squad, com quadro kanban privado, notas adesivas, atalhos rápidos e gerenciamento de perfil.

### 🔐 Gestão de Acessos & Convites
- **Rotas Principais**: `src/app/admin/page.tsx` e `src/app/invite/[token]/page.tsx`
- **Componentes Chave**: `src/app/admin/api.ts`, fluxos de aceitação de convite.
- **Responsabilidade**: Painel restrito a administradores de sistema (`role = ADMIN`) para gestão global de usuários, emissão de links de convite seguro com token de expiração e segregação de autorização entre o nível de sistema e lideranças de squad.

### ⚖️ Governança & Suporte
- **Rotas Principais**: `src/app/governance/page.tsx`, `src/app/support/page.tsx`, `src/app/changelog/page.tsx`
- **Responsabilidade**: Painéis de conformidade, auditoria e acompanhamento de métricas do ecossistema, central de tickets de suporte e visualização de notas de versão (changelog).

---

## 3. Componentes Compartilhados (Shared Design System)

Para evitar redundância, utilize sempre os componentes em `src/components/shared/`:

- **EliteCard / AgileCard**: Wrapper principal de cartões com suporte a múltiplos temas e variações.
- **AgileBaseCard**: O componente atômico de cartão com acabamento Glassmorphism (`backdrop-blur-xl`).
- **RoomHeader**: Cabeçalho unificado para módulos de cerimônias e páginas administrativas (breadcrumbs, controle de tema, modo calmaria).
- **EliteSidebar**: Barra de navegação lateral retrátil com suporte a grupos de rotas e status da conexão.
- **EliteTimer**: Componente universal de cronômetro com alertas sonoros e visuais.
- **JiraImportDialog**: Modal padrão para importação de tarefas do Jira via busca JQL ou payloads.
- **TdnImportDialog**: Diálogo padrão para sincronização e atualização de manuais técnicos externos.
- **AgileSpinner**: Indicador visual de carregamento com consistência estética com o restante da aplicação.
- **UserProfileModal**: Modal global para edição de perfil, preferências de avatar e visualização de squads.
- **GlobalAnnouncementListener**: Listener em tempo real via WebSocket para alertas e avisos broadcast da administração.

---

## 4. Fluxo de Dados (State & Persistence)

### Autenticação & Sessão
- **AuthContext** (`src/context/AuthContext.tsx`): Mantém o estado reativo da sessão autenticada (`user`, `token`, `isAuthenticated`). Realiza login e logout corporativos comunicando-se com `/api/auth/login` e `/api/auth/me`.
- **UserContext** (`src/context/UserContext.tsx`): Gerencia o perfil ativo do usuário, squads atribuídas, papéis de liderança (`isLeadership`) e estado de onboarding.
- **SystemConfigContext** (`src/context/SystemConfigContext.tsx`): Distribui configurações globais de sistema, flags de recursos e conectividade.
- **Cliente HTTP Centralizado (`authFetch`)** (`src/lib/auth-client.ts`):
  - Injeta automaticamente `Authorization: Bearer <token>` a partir do `localStorage['agileSpace_auth_token']`.
  - Garante o cabeçalho padrão `Content-Type: application/json` em corpos JSON (preservando o boundary em requisições `FormData`).
  - Emite o evento global `UNAUTHORIZED_EVENT` quando recebe status `401 Unauthorized`, limpando a sessão e redirecionando para a tela de login.

### Persistência REST & Sincronização Síncrona
A aplicação adota um modelo claro e leve de fluxo de dados, evitando a complexidade desnecessária de stores pesadas:
- **Serviços REST**: Funções encapsuladas por domínio (e.g., `src/app/**/api.ts` ou `src/services/*`) realizam leituras e mutações diretamente nos endpoints da API Spring Boot (`http://localhost:8002/api`).
- **WebSockets Stomp**: Conexões nativas sobre SockJS escutam canais dedicados (e.g., `/topic/poker/{roomId}`, `/topic/retro/{boardId}`, `/topic/announcements`) para sincronização em tempo real entre todos os participantes da cerimônia, disparando re-fetches pontuais sem sobrecarregar o cliente nem o servidor.

### Utilitários Core
- `src/lib/types.ts`: Tipagem completa e contratos TypeScript de todos os domínios da aplicação.
- `src/lib/utils.ts`: Utilitários compartilhados de formatação, debounce e composição de classes Tailwind via `clsx` e `tailwind-merge` (`cn`).
- `src/lib/jolt-lite.ts`: Engine client-side para pré-visualização e validação de transformações Jolt.

---

## 5. Regras de Integridade e Engenharia (Elite Guidelines)

1. **AUTENTICAÇÃO PADRONIZADA**: Sempre utilize `authFetch` para qualquer requisição HTTP autenticada. Nunca instancie chamadas `fetch` brutas com tokens manuais.
2. **CENTRALIZAÇÃO DE WEBSOCKETS**: Nunca abra conexões WebSocket duplicadas; conecte-se através dos canais estabelecidos e desinscreva-se adequadamente no ciclo de vida do componente (`useEffect` cleanup).
3. **DESIGN SYSTEM**: Nunca crie cartões, botões ou modais estilizados do zero; estenda `AgileBaseCard`, `EliteCard` e os componentes da biblioteca Shadcn/UI.
4. **LIMITE DE 300 LINHAS DE CÓDIGO**: Arquivos que ultrapassarem 300 linhas devem ser imediatamente decompostos em subcomponentes menores e hooks customizados.
5. **ZERO-SCROLL PRINCIPAL**: Mantenha a viewport principal livre de rolagem da janela geral (`h-screen`, `overflow-hidden`), utilizando painéis de scroll internos (`ScrollArea`) para áreas de conteúdo denso.
6. **LIGHT/DARK MODE TOTAL**: Garanta contraste e legibilidade adequados em ambos os temas através de variáveis semânticas do Tailwind.

